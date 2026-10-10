/** Thin fetch wrapper. Cookies carry the session; errors surface field messages for forms. */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) { super(message); }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    credentials: "include",
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body?.message ?? res.statusText, body?.fields ?? {});
  return body as T;
}

export type Me = { id: string; email: string; name: string; locale: string; departmentId: string | null; roles: string[] };
export type Lookup = { list: string; code: string; labelEn: string; labelMs: string; helpEn: string | null; helpMs: string | null };
export type Lookups = Record<string, Lookup[]>;
export type TodoItem = { kind: "COMPLAINT" | "NCR"; number: string; title: string; action: string; priority: string; dueAt: string | null; link: string };
