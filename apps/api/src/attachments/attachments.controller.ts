import { Controller, Delete, Get, HttpCode, Param, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { AttachmentsService, MAX_BYTES } from "./attachments.service";
import { CurrentUser, type AuthUser } from "../common/decorators";

@Controller("attachments")
export class AttachmentsController {
  constructor(private svc: AttachmentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES, files: 1 } }))
  upload(@CurrentUser() u: AuthUser, @UploadedFile() file: Express.Multer.File, @Query("ncrId") ncrId?: string) {
    return this.svc.upload(u, file, ncrId || undefined);
  }

  @Get(":id")
  async get(@CurrentUser() u: AuthUser, @Param("id") id: string, @Res() res: Response) {
    const { meta, body } = await this.svc.stream(u, id);
    res.setHeader("Content-Type", meta.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(meta.fileName)}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    body.pipe(res);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() u: AuthUser, @Param("id") id: string) { return this.svc.remove(u, id); }
}
