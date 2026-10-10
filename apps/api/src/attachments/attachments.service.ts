import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { extname } from "path";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "./storage";
import type { AuthUser } from "../common/decorators";

export const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".pdf", ".dwg", ".dxf", ".xlsx", ".docx"]);
const ALLOWED_MIME_PREFIX = ["image/", "application/pdf", "application/acad", "image/vnd.dwg", "application/dxf", "application/octet-stream",
  "application/vnd.openxmlformats-officedocument"];

const isQA = (u: AuthUser) => u.roles.includes("QA_COORDINATOR") || u.roles.includes("QA_MANAGER") || u.roles.includes("AUDITOR");

@Injectable()
export class AttachmentsService {
  constructor(private db: PrismaService, private storage: StorageService) {}

  /** Store a file; it is unlinked until a complaint or NCR claims it. */
  async upload(user: AuthUser, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }, ncrId?: string) {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME_PREFIX.some((p) => file.mimetype.startsWith(p))) {
      throw new BadRequestException({ message: "validation", fields: { file: "type" } });
    }
    if (file.size > MAX_BYTES) throw new BadRequestException({ message: "validation", fields: { file: "size" } });
    if (ncrId) {
      const n = await this.db.ncr.findUnique({ where: { id: ncrId } });
      if (!n) throw new NotFoundException();
      if (n.assigneeId !== user.id && !isQA(user)) throw new ForbiddenException();
    }
    const id = randomUUID();
    const key = `${new Date().getFullYear()}/${id}${ext}`;
    await this.storage.put(key, file.buffer, file.mimetype);
    return this.db.attachment.create({
      data: { id, fileName: file.originalname.slice(0, 200), mimeType: file.mimetype, sizeBytes: file.size, storageKey: key, uploadedById: user.id, ncrId },
    });
  }

  async stream(user: AuthUser, id: string) {
    const a = await this.db.attachment.findUnique({ where: { id }, include: { complaint: { select: { raisedById: true } }, ncr: { select: { assigneeId: true, departmentId: true } } } });
    if (!a) throw new NotFoundException();
    const allowed = isQA(user) || a.uploadedById === user.id || a.complaint?.raisedById === user.id || a.ncr?.assigneeId === user.id
      || (user.roles.includes("DEPT_MANAGER") && a.ncr?.departmentId === user.departmentId);
    if (!allowed) throw new ForbiddenException();
    return { meta: a, body: await this.storage.get(a.storageKey) };
  }

  /** Only an unlinked upload by the same user can be removed; linked evidence is a record. */
  async remove(user: AuthUser, id: string) {
    const a = await this.db.attachment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    if (a.uploadedById !== user.id || a.complaintId || a.ncrId) throw new ForbiddenException("linked evidence cannot be removed");
    await this.storage.delete(a.storageKey);
    await this.db.attachment.delete({ where: { id } });
  }
}
