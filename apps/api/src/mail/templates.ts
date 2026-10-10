/** Email chrome in both languages; the event text itself is composed by the services. */
const T = {
  en: { hi: (n: string) => `Hello ${n},`, open: "Open in JEMCO NCR", why: "You receive this because you are involved in this record. Manage email in your account settings.", digest: "Your open items this week", none: "Nothing is waiting for you.", due: "due" },
  ms: { hi: (n: string) => `Salam ${n},`, open: "Buka dalam JEMCO NCR", why: "Anda menerima e-mel ini kerana anda terlibat dalam rekod ini. Urus e-mel dalam tetapan akaun.", digest: "Item terbuka anda minggu ini", none: "Tiada yang menunggu anda.", due: "tarikh akhir" },
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function renderNotification(locale: string, name: string, subject: string, body: string, link: string | null, origin: string) {
  const t = T[locale === "ms" ? "ms" : "en"];
  const url = link ? `${origin}${link}` : origin;
  const text = `${t.hi(name)}\n\n${subject}\n${body}\n\n${t.open}: ${url}\n\n${t.why}`;
  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#1f1f23;background:#f7f7f8;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e6e6e9;border-radius:16px;padding:24px">
<p style="margin:0 0 16px">${esc(t.hi(name))}</p>
<h2 style="margin:0 0 8px;font-size:18px;color:#474749">${esc(subject)}</h2>
<p style="margin:0 0 20px;white-space:pre-wrap">${esc(body)}</p>
<a href="${url}" style="display:inline-block;background:#cd1918;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px">${esc(t.open)}</a>
<p style="margin:24px 0 0;font-size:12px;color:#6b6b70">${esc(t.why)}</p></div></body></html>`;
  return { text, html };
}

export function renderDigest(locale: string, name: string, items: { number: string; title: string; dueAt: Date | null; link: string }[], origin: string) {
  const t = T[locale === "ms" ? "ms" : "en"];
  const lines = items.map((i) => `• ${i.number} — ${i.title}${i.dueAt ? ` (${t.due} ${i.dueAt.toLocaleDateString(locale === "ms" ? "ms-MY" : "en-MY")})` : ""}`);
  const text = `${t.hi(name)}\n\n${t.digest}\n${lines.length ? lines.join("\n") : t.none}\n\n${t.open}: ${origin}/todo`;
  const rows = items.map((i) => `<tr><td style="padding:6px 8px;font-family:monospace"><a href="${origin}${i.link}" style="color:#cd1918">${esc(i.number)}</a></td><td style="padding:6px 8px">${esc(i.title)}</td><td style="padding:6px 8px;white-space:nowrap;color:#6b6b70">${i.dueAt ? i.dueAt.toLocaleDateString("en-MY") : ""}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#1f1f23;background:#f7f7f8;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e6e6e9;border-radius:16px;padding:24px">
<p>${esc(t.hi(name))}</p><h2 style="font-size:18px;color:#474749">${esc(t.digest)}</h2>
${items.length ? `<table style="border-collapse:collapse;width:100%">${rows}</table>` : `<p>${esc(t.none)}</p>`}
<p style="margin-top:20px"><a href="${origin}/todo" style="display:inline-block;background:#cd1918;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px">${esc(t.open)}</a></p></div></body></html>`;
  return { subject: t.digest, text, html };
}
