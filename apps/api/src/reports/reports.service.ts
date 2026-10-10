import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../common/decorators";

const OPEN = ["ASSIGNED", "IN_PROGRESS", "AWAITING_VERIFICATION", "RETURNED"];
const RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const byPriority = (a: { priority: string }, b: { priority: string }) => (RANK[a.priority] ?? 9) - (RANK[b.priority] ?? 9);

/**
 * Dashboard numbers come straight from SQL so the screen, the export and the
 * management pack share one definition. A department manager sees their
 * department only; QA, management and auditors see everything.
 */
@Injectable()
export class ReportsService {
  constructor(private db: PrismaService) {}

  private scope(user: AuthUser): Prisma.Sql {
    const deptOnly = user.roles.includes("DEPT_MANAGER") && !user.roles.some((r) => ["QA_COORDINATOR", "QA_MANAGER", "AUDITOR"].includes(r));
    return deptOnly && user.departmentId ? Prisma.sql`AND n.department_id = ${user.departmentId}::uuid` : Prisma.empty;
  }

  async management(user: AuthUser, months = 12) {
    const s = this.scope(user);
    const since = new Date(); since.setMonth(since.getMonth() - months); since.setDate(1);
    // Weekly buckets read as noise at JEMCO's volumes beyond half a year; use months there.
    const unit = months > 6 ? "month" : "week"; const step = months > 6 ? "1 month" : "1 week";

    const [openByState, overdue, tiles, newVsClosed, cycleTimeByPriority, slaByPriority, byProcess, bySource, rootCause, costByDisposition, returnRateByDept, repeat] = await Promise.all([
      this.db.$queryRaw<{ state: string; count: number }[]>`
        SELECT state, count(*)::int AS count FROM ncrs n WHERE state = ANY(${OPEN}) ${s} GROUP BY state`,
      this.db.$queryRaw<{ number: string; priority: string; assignee: string | null; department: string; kind: string; due_at: Date; days_over: number }[]>`
        SELECT n.number, n.priority, u.name AS assignee, d.name AS department, c.kind, c.due_at,
               working_days_between(c.due_at::date, current_date) AS days_over
        FROM sla_clocks c JOIN ncrs n ON n.id = c.ncr_id JOIN departments d ON d.id = n.department_id
        LEFT JOIN users u ON u.id = n.assignee_id
        WHERE c.stopped_at IS NULL AND c.due_at < now() ${s}
        ORDER BY c.due_at ASC LIMIT 50`,
      this.db.$queryRaw<{ open: number; overdue: number; new_month: number; closed_month: number; avg_cycle: number | null; sla_met: number; sla_total: number }[]>`
        SELECT
          (SELECT count(*)::int FROM ncrs n WHERE state = ANY(${OPEN}) ${s}) AS open,
          (SELECT count(DISTINCT n.id)::int FROM ncrs n JOIN sla_clocks c ON c.ncr_id = n.id AND c.stopped_at IS NULL AND c.due_at < now() WHERE true ${s}) AS overdue,
          (SELECT count(*)::int FROM ncrs n WHERE created_at >= date_trunc('month', now()) ${s}) AS new_month,
          (SELECT count(*)::int FROM ncrs n WHERE state = 'CLOSED' AND verified_at >= date_trunc('month', now()) ${s}) AS closed_month,
          (SELECT avg(working_days_between(created_at::date, verified_at::date))::float FROM ncrs n WHERE state = 'CLOSED' AND verified_at >= ${since} ${s}) AS avg_cycle,
          (SELECT count(*)::int FROM sla_clocks c JOIN ncrs n ON n.id = c.ncr_id WHERE c.stopped_at IS NOT NULL AND c.stopped_at <= c.due_at AND c.started_at >= ${since} ${s}) AS sla_met,
          (SELECT count(*)::int FROM sla_clocks c JOIN ncrs n ON n.id = c.ncr_id WHERE c.stopped_at IS NOT NULL AND c.started_at >= ${since} ${s}) AS sla_total`,
      this.db.$queryRaw<{ bucket: Date; opened: number; closed: number }[]>`
        WITH b AS (SELECT generate_series(date_trunc(${unit}, ${since}::timestamp), date_trunc(${unit}, now()), (${step})::interval) AS bucket)
        SELECT b.bucket,
          (SELECT count(*)::int FROM ncrs n WHERE date_trunc(${unit}, n.created_at) = b.bucket ${s}) AS opened,
          (SELECT count(*)::int FROM ncrs n WHERE n.state = 'CLOSED' AND date_trunc(${unit}, n.verified_at) = b.bucket ${s}) AS closed
        FROM b ORDER BY b.bucket`,
      this.db.$queryRaw<{ priority: string; avg_days: number; count: number }[]>`
        SELECT priority, avg(working_days_between(created_at::date, verified_at::date))::float AS avg_days, count(*)::int AS count
        FROM ncrs n WHERE state = 'CLOSED' AND verified_at >= ${since} ${s} GROUP BY priority`,
      this.db.$queryRaw<{ priority: string; met: number; total: number }[]>`
        SELECT n.priority, count(*) FILTER (WHERE c.stopped_at <= c.due_at)::int AS met, count(*)::int AS total
        FROM sla_clocks c JOIN ncrs n ON n.id = c.ncr_id WHERE c.stopped_at IS NOT NULL AND c.started_at >= ${since} ${s} GROUP BY n.priority`,
      this.db.$queryRaw<{ process: string; count: number }[]>`
        SELECT c.process, count(*)::int AS count FROM ncrs n JOIN complaints c ON c.id = n.complaint_id
        WHERE n.created_at >= ${since} ${s} GROUP BY c.process ORDER BY count DESC`,
      this.db.$queryRaw<{ source: string; count: number }[]>`
        SELECT c.source, count(*)::int AS count FROM ncrs n JOIN complaints c ON c.id = n.complaint_id
        WHERE n.created_at >= ${since} ${s} GROUP BY c.source ORDER BY count DESC`,
      this.db.$queryRaw<{ category: string; count: number }[]>`
        SELECT root_cause_category AS category, count(*)::int AS count FROM ncrs n
        WHERE root_cause_category IS NOT NULL AND created_at >= ${since} ${s} GROUP BY 1 ORDER BY count DESC`,
      this.db.$queryRaw<{ disposition: string; cost: number; count: number }[]>`
        SELECT d AS disposition, coalesce(sum(n.cost_of_nc), 0)::float AS cost, count(*)::int AS count
        FROM ncrs n, unnest(n.dispositions) AS d WHERE n.state = 'CLOSED' AND n.verified_at >= ${since} ${s} GROUP BY d ORDER BY cost DESC`,
      this.db.$queryRaw<{ department: string; returned: number; total: number }[]>`
        SELECT d.name AS department, count(*) FILTER (WHERE n.return_count > 0)::int AS returned, count(*)::int AS total
        FROM ncrs n JOIN departments d ON d.id = n.department_id WHERE n.created_at >= ${since} ${s} GROUP BY d.name ORDER BY total DESC`,
      this.db.$queryRaw<{ count: number }[]>`
        SELECT count(*)::int AS count FROM ncr_links l JOIN ncrs n ON n.id = l.from_id WHERE l.kind = 'RECURRENCE_OF' ${s}`,
    ]);

    const t = tiles[0];
    return {
      since: since.toISOString().slice(0, 10),
      bucket: unit,
      tiles: {
        open: t.open, overdue: t.overdue, newThisMonth: t.new_month, closedThisMonth: t.closed_month,
        avgCycleDays: t.avg_cycle == null ? null : Math.round(t.avg_cycle * 10) / 10,
        slaAttainmentPct: t.sla_total ? Math.round((t.sla_met / t.sla_total) * 100) : null,
        repeatIssues: repeat[0]?.count ?? 0,
      },
      openByState,
      overdue: overdue.map((o) => ({ number: o.number, priority: o.priority, assignee: o.assignee, department: o.department, kind: o.kind, dueAt: o.due_at, daysOver: o.days_over })),
      newVsClosed: newVsClosed.map((w) => ({ period: w.bucket.toISOString().slice(0, unit === "month" ? 7 : 10), opened: w.opened, closed: w.closed })),
      cycleTimeByPriority: cycleTimeByPriority.map((r) => ({ priority: r.priority, avgDays: Math.round(r.avg_days * 10) / 10, count: r.count })).sort(byPriority),
      slaByPriority: [...slaByPriority].sort(byPriority),
      byProcess, bySource, rootCause, costByDisposition, returnRateByDept,
    };
  }

  /** Every NCR with its key fields, for the register table and the CSV export. */
  async register(user: AuthUser) {
    const s = this.scope(user);
    return this.db.$queryRaw<Record<string, unknown>[]>`
      SELECT n.number, n.state, n.priority, d.name AS department, u.name AS assignee, c.number AS complaint,
             c.type, c.source, c.process, c.customer_name, c.supplier_name, c.po_do_number, c.quantity, c.quantity_unit,
             n.created_at::date AS raised, n.respond_by, n.completed_at::date AS completed, n.verified_at::date AS verified,
             n.verification_result, array_to_string(n.dispositions, '; ') AS dispositions, n.cost_of_nc, n.return_count,
             n.root_cause_category, v.name AS verified_by, left(c.description, 200) AS description
      FROM ncrs n JOIN departments d ON d.id = n.department_id LEFT JOIN users u ON u.id = n.assignee_id
      LEFT JOIN users v ON v.id = n.verified_by_id LEFT JOIN complaints c ON c.id = n.complaint_id
      WHERE true ${s} ORDER BY n.created_at DESC`;
  }

  toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return "";
    const cols = Object.keys(rows[0]);
    const esc = (v: unknown) => { const str = v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v); return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str; };
    return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  }
}
