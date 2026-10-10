import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/** Validates a request body with a shared Zod schema; errors are field-keyed for the form. */
export class ZodPipe<T> implements PipeTransform {
  constructor(private schema: ZodType<T>) {}
  transform(value: unknown): T {
    const r = this.schema.safeParse(value);
    if (r.success) return r.data;
    const fields: Record<string, string> = {};
    for (const i of r.error.issues) fields[i.path.join(".") || "_"] = i.message;
    throw new BadRequestException({ message: "validation", fields });
  }
}
