"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";
export type Attachment = { id: string; fileName: string; mimeType: string; sizeBytes: number };

/** Shrink a photo in the browser before upload: max 1600px, JPEG 0.82. Non-images pass through. */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 600_000 || file.type === "image/heic") return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
}

export async function uploadFile(file: File, ncrId?: string): Promise<Attachment> {
  const fd = new FormData(); fd.append("file", await compress(file));
  const res = await fetch(`${BASE}/attachments${ncrId ? `?ncrId=${ncrId}` : ""}`, { method: "POST", body: fd, credentials: "include" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body?.message ?? res.statusText, body?.fields ?? {});
  return body;
}

export function attachmentUrl(id: string) { return `${BASE}/attachments/${id}`; }
/** Only raster types the browser can draw; Chrome labels .dwg as image/vnd.dwg. */
export const isRaster = (mime: string) => /^image\/(jpeg|png|webp|gif|heic|heif|avif)$/i.test(mime);

/** Camera-first on phones, drag-and-drop on PC; uploads as soon as a file is picked. */
export function PhotoField({ value, onChange, ncrId, canRemove = true }: { value: Attachment[]; onChange: (a: Attachment[]) => void; ncrId?: string; canRemove?: boolean }) {
  const t = useTranslations("photos");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0); const [err, setErr] = useState("");

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setErr("");
    for (const f of Array.from(files).slice(0, 10 - value.length)) {
      setBusy((b) => b + 1);
      try { const a = await uploadFile(f, ncrId); onChange([...value, a]); value = [...value, a]; }
      catch (e) { setErr(e instanceof ApiError ? t(`error.${e.fields.file ?? "generic"}`) : t("error.generic")); }
      finally { setBusy((b) => b - 1); }
    }
    if (input.current) input.current.value = "";
  }
  async function remove(a: Attachment) {
    await fetch(attachmentUrl(a.id), { method: "DELETE", credentials: "include" }).catch(() => {});
    onChange(value.filter((x) => x.id !== a.id));
  }

  return (
    <div className="space-y-3" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
      <input ref={input} type="file" className="hidden" multiple accept="image/*,.pdf,.dwg,.dxf" capture="environment" onChange={(e) => add(e.target.files)} />
      <input type="file" id="pf-gallery" className="hidden" multiple accept="image/*,.pdf,.dwg,.dxf" onChange={(e) => add(e.target.files)} />
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn-secondary" onClick={() => input.current?.click()}>📷 {t("camera")}</button>
        <label htmlFor="pf-gallery" className="btn-secondary cursor-pointer">{t("choose")}</label>
      </div>
      {value.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((a) => (
            <li key={a.id} className="relative rounded-xl border border-grey-20 overflow-hidden bg-surface aspect-square">
              {isRaster(a.mimeType)
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={attachmentUrl(a.id)} alt={a.fileName} className="h-full w-full object-cover" />
                : <div className="h-full w-full flex items-center justify-center text-xs text-grey-60 p-2 text-center break-all">{a.fileName}</div>}
              {canRemove && <button type="button" aria-label={t("remove")} onClick={() => remove(a)} className="absolute top-1 right-1 h-8 w-8 rounded-full bg-white/90 text-ink font-bold shadow">×</button>}
            </li>
          ))}
        </ul>
      )}
      {busy > 0 && <div className="help">{t("uploading")}</div>}
      {err && <div className="error">{err}</div>}
      <div className="help">{t("hint", { n: value.length })}</div>
    </div>
  );
}

/** Read-only thumbnails/links for a record's attachments. */
export function AttachmentList({ items }: { items: Attachment[] }) {
  if (!items.length) return null;
  return (
    <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {items.map((a) => (
        <li key={a.id} className="rounded-xl border border-grey-20 overflow-hidden bg-surface aspect-square">
          <a href={attachmentUrl(a.id)} target="_blank" rel="noreferrer" className="block h-full w-full">
            {isRaster(a.mimeType)
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={attachmentUrl(a.id)} alt={a.fileName} className="h-full w-full object-cover" />
              : <div className="h-full w-full flex items-center justify-center text-xs text-grey-60 p-2 text-center break-all">{a.fileName}</div>}
          </a>
        </li>
      ))}
    </ul>
  );
}
