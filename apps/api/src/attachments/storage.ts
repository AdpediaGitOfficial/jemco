import { Injectable, Logger } from "@nestjs/common";
import { promises as fs, createReadStream } from "fs";
import { join, resolve } from "path";
import type { Readable } from "stream";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export interface Storage {
  put(key: string, body: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}

/** Local disk: the default when no S3_* env is set (dev, single-VPS option). */
class DiskStorage implements Storage {
  constructor(private root: string) {}
  private path(key: string) {
    const p = resolve(this.root, key);
    if (!p.startsWith(resolve(this.root))) throw new Error("bad key");
    return p;
  }
  async put(key: string, body: Buffer) {
    const p = this.path(key);
    await fs.mkdir(join(p, ".."), { recursive: true });
    await fs.writeFile(p, body);
  }
  async get(key: string) { return createReadStream(this.path(key)); }
  async delete(key: string) { await fs.rm(this.path(key), { force: true }); }
}

/** Any S3-compatible bucket (R2, MinIO, AWS). */
class S3Storage implements Storage {
  private s3: S3Client;
  constructor(private bucket: string) {
    this.s3 = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: !!process.env.S3_ENDPOINT,
      credentials: process.env.S3_ACCESS_KEY ? { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY ?? "" } : undefined,
    });
  }
  async put(key: string, body: Buffer, mime: string) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: mime }));
  }
  async get(key: string) {
    const r = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return r.Body as Readable;
  }
  async delete(key: string) { await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })); }
}

@Injectable()
export class StorageService implements Storage {
  private impl: Storage;
  constructor() {
    const bucket = process.env.S3_BUCKET;
    const root = process.env.UPLOAD_DIR ?? resolve(process.cwd(), "uploads");
    this.impl = bucket ? new S3Storage(bucket) : new DiskStorage(root);
    new Logger("storage").log(bucket ? `S3 bucket ${bucket}` : `local disk ${root}`);
  }
  put(key: string, body: Buffer, mime: string) { return this.impl.put(key, body, mime); }
  get(key: string) { return this.impl.get(key); }
  delete(key: string) { return this.impl.delete(key); }
}
