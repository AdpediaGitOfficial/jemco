/* HTML for form F/QP/004-01 (V4), rendered to PDF. Layout follows the paper form's order:
 * header, type/source/process/priority, subject, issue, assignee response, verification, QA remarks. */

export interface FormData {
  number: string; date: string; version: string;
  type: string; source: string; process: string; priority: string;
  typeOptions: { code: string; label: string }[]; sourceOptions: { code: string; label: string }[];
  processOptions: { code: string; label: string }[]; priorityOptions: { code: string; label: string }[];
  dispositionOptions: { code: string; label: string }[];
  supplierName: string; customerName: string; poDoNumber: string; deliveryDate: string; cefNumber: string; quantity: string;
  issue: string; issuedBy: string; dateAssigned: string; respondBy: string; assignee: string; department: string;
  rootCause: string; rootCauseCategory: string; containment: string; actionPlan: string;
  actions: { description: string; owner: string; due: string; done: boolean }[];
  dateCompleted: string; completedBy: string;
  showPart3: boolean; dispositions: string[]; dispositionNote: string; cost: string;
  result: string; verifiedBy: string; verifiedDate: string; qaRemarks: string;
  effectiveness: string; attachments: string[]; history: { when: string; who: string; what: string; reason: string }[];
  logoDataUrl: string; generatedAt: string;
}

const esc = (s: string | null | undefined) => (s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const box = (on: boolean) => `<span class="cb">${on ? "&#10004;" : ""}</span>`;
const checks = (opts: { code: string; label: string }[], sel: string | string[]) => {
  const set = new Set(Array.isArray(sel) ? sel : [sel]);
  return opts.map((o) => `<span class="opt">${box(set.has(o.code))} ${esc(o.label)}</span>`).join("");
};

export function renderForm(d: FormData): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 12mm 12mm 14mm; }
  body { font-family: Inter, Arial, Helvetica, sans-serif; font-size: 10.5px; color: #1f1f23; margin: 0; }
  h1 { font-size: 15px; margin: 0; letter-spacing: .02em; }
  .hdr { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #474749; padding-bottom: 6px; margin-bottom: 8px; }
  .hdr img { height: 34px; }
  .meta { text-align: right; font-size: 10px; color: #474749; }
  .meta b { font-size: 13px; color: #cd1918; }
  .sec { border: 1px solid #9a9a9e; border-radius: 4px; padding: 6px 8px; margin-bottom: 6px; page-break-inside: avoid; }
  .sec h2 { font-size: 11px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: .04em; color: #474749; }
  .row { display: flex; gap: 10px; margin: 2px 0; }
  .row > div { flex: 1; }
  .lbl { color: #6b6b70; font-size: 9px; text-transform: uppercase; letter-spacing: .03em; }
  .val { min-height: 12px; border-bottom: 1px solid #d8d8dc; padding: 1px 0 2px; }
  .opts { display: flex; flex-wrap: wrap; gap: 2px 12px; }
  .opt { white-space: nowrap; }
  .cb { display: inline-block; width: 10px; height: 10px; border: 1px solid #474749; border-radius: 2px; vertical-align: -1px; font-size: 9px; line-height: 10px; text-align: center; margin-right: 2px; }
  .txt { white-space: pre-wrap; min-height: 28px; padding: 3px 0; }
  .sig { display: flex; gap: 14px; margin-top: 4px; }
  .sig > div { flex: 1; }
  .note { font-size: 8.5px; color: #6b6b70; }
  table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #d8d8dc; padding: 2px 4px; text-align: left; vertical-align: top; } th { background: #f1f1f3; font-weight: 600; }
  .foot { position: fixed; bottom: 0; left: 0; right: 0; font-size: 8px; color: #8a8a8f; display: flex; justify-content: space-between; }
  </style></head><body>
  <div class="hdr"><div><img src="${d.logoDataUrl}" alt="JEMCO"><h1>NON-CONFORMING REPORT (NCR)</h1></div>
    <div class="meta">${esc(d.version)}<br><b>NCR No.: ${esc(d.number)}</b><br>Date: ${esc(d.date)}</div></div>

  <div class="sec"><div class="row"><div><div class="lbl">Type</div><div class="opts">${checks(d.typeOptions, d.type)}</div></div></div>
    <div class="row"><div><div class="lbl">Source</div><div class="opts">${checks(d.sourceOptions, d.source)}</div></div></div>
    <div class="row"><div><div class="lbl">Process</div><div class="opts">${checks(d.processOptions, d.process)}</div></div></div>
    <div class="row"><div><div class="lbl">Priority</div><div class="opts">${checks(d.priorityOptions, d.priority)}</div></div></div></div>

  <div class="sec"><div class="row"><div><div class="lbl">Supplier name</div><div class="val">${esc(d.supplierName)}</div></div><div><div class="lbl">Customer name</div><div class="val">${esc(d.customerName)}</div></div></div>
    <div class="row"><div><div class="lbl">PO / DO number</div><div class="val">${esc(d.poDoNumber)}</div></div><div><div class="lbl">Date of delivery</div><div class="val">${esc(d.deliveryDate)}</div></div><div><div class="lbl">CEF number</div><div class="val">${esc(d.cefNumber)}</div></div><div><div class="lbl">Quantity</div><div class="val">${esc(d.quantity)}</div></div></div></div>

  <div class="sec"><h2>Nature of non-conformity</h2><div class="txt">${esc(d.issue)}</div>
    ${d.attachments.length ? `<div class="note">Attachments: ${d.attachments.map(esc).join("; ")}</div>` : ""}
    <div class="sig"><div><div class="lbl">Issued by</div><div class="val">${esc(d.issuedBy)}</div></div><div><div class="lbl">Date assigned</div><div class="val">${esc(d.dateAssigned)}</div></div><div><div class="lbl">Respond by (due date)</div><div class="val">${esc(d.respondBy)}</div></div><div><div class="lbl">Assignee / department</div><div class="val">${esc(d.assignee)} · ${esc(d.department)}</div></div></div></div>

  <div class="sec"><h2>To be completed by the assignee</h2>
    ${d.containment ? `<div class="lbl">Containment</div><div class="txt">${esc(d.containment)}</div>` : ""}
    <div class="lbl">Root cause analysis${d.rootCauseCategory ? ` · ${esc(d.rootCauseCategory)}` : ""}</div><div class="txt">${esc(d.rootCause)}</div>
    <div class="lbl">Correction and / or corrective action plan</div><div class="txt">${esc(d.actionPlan)}</div>
    ${d.actions.length ? `<table><tr><th style="width:12px"></th><th>Action</th><th>Owner</th><th>Due</th></tr>${d.actions.map((a) => `<tr><td>${box(a.done)}</td><td>${esc(a.description)}</td><td>${esc(a.owner)}</td><td>${esc(a.due)}</td></tr>`).join("")}</table>` : ""}
    <div class="sig"><div><div class="lbl">Date action completed</div><div class="val">${esc(d.dateCompleted)}</div></div><div><div class="lbl">Name</div><div class="val">${esc(d.completedBy)}</div></div></div></div>

  ${d.showPart3 ? `<div class="sec"><h2>Follow-up &amp; verification</h2>
    <div class="lbl">Lot disposition status</div><div class="opts">${checks(d.dispositionOptions, d.dispositions)}</div>
    ${d.dispositionNote ? `<div class="txt">${esc(d.dispositionNote)}</div>` : ""}
    <div class="row"><div><div class="lbl">Cost of non-conformance (RM)</div><div class="val">${esc(d.cost)}</div></div><div><div class="lbl">Result</div><div class="val">${box(d.result === "SATISFACTORY")} Satisfactory: Closed &nbsp; ${box(d.result === "NON_SATISFACTORY")} Non-satisfactory: Returned for further processing</div></div></div>
    <div class="sig"><div><div class="lbl">Verified by</div><div class="val">${esc(d.verifiedBy)}</div></div><div><div class="lbl">Date</div><div class="val">${esc(d.verifiedDate)}</div></div></div>
    <div class="lbl">Notes and justification / QA dept. remarks</div><div class="txt">${esc(d.qaRemarks)}</div>
    ${d.effectiveness ? `<div class="lbl">Effectiveness review</div><div class="txt">${esc(d.effectiveness)}</div>` : ""}</div>` : ""}

  <div class="sec"><h2>Record history</h2><table><tr><th>When</th><th>Who</th><th>What</th><th>Reason</th></tr>${d.history.map((h) => `<tr><td>${esc(h.when)}</td><td>${esc(h.who)}</td><td>${esc(h.what)}</td><td>${esc(h.reason)}</td></tr>`).join("")}</table></div>
  <div class="foot"><span>${esc(d.version)} · Controlled record, generated from JEMCO NCR</span><span>${esc(d.generatedAt)}</span></div>
  </body></html>`;
}
