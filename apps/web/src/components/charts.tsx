"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/* Chart palette: reference categorical slots 1 and 2 (validated: CVD dE 9+, normal dE 19+).
   Brand red is reserved for actions and never used as a series colour. */
export const SERIES = ["#2a78d6", "#eb6834"];
const GRID = "#e6e6e9", INK2 = "#6b6b70";
const tip = { contentStyle: { borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 13 }, cursor: { fill: "#f7f7f8" } };

/** Single-series horizontal bars: magnitude, one hue, value at the tip. */
export function HBars({ data, nameKey, valueKey, format = (v: number) => String(v) }: { data: Record<string, unknown>[]; nameKey: string; valueKey: string; format?: (v: number) => string }) {
  const h = Math.max(120, 36 * data.length + 24);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }} barSize={18}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey={nameKey} width={150} tick={{ fontSize: 13, fill: INK2 }} axisLine={false} tickLine={false} />
        <Tooltip {...tip} formatter={(v) => format(Number(v))} />
        <Bar dataKey={valueKey} fill={SERIES[0]} radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 12, fill: INK2, formatter: (v: unknown) => format(Number(v)) }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Two series over time; legend always present, 2px lines, end markers. */
export function TwoLines({ data, xKey, a, b, labels }: { data: Record<string, unknown>[]; xKey: string; a: string; b: string; labels: [string, string] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: -16, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: INK2 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={32} tickFormatter={(v: string) => v.length === 7 ? v.slice(2).replace("-", "/") : v.slice(5)} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: INK2 }} tickLine={false} axisLine={false} />
        <Tooltip {...tip} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
        <Line type="monotone" dataKey={a} name={labels[0]} stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
        <Line type="monotone" dataKey={b} name={labels[1]} stroke={SERIES[1]} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StatTile({ label, value, unit, tone }: { label: string; value: string | number | null; unit?: string; tone?: "bad" | "warn" | "ok" }) {
  const colour = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <div className="card py-4">
      <div className="text-sm text-grey-60">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${colour}`}>{value ?? "—"}<span className="text-base font-semibold text-grey-60 ml-1">{value != null ? unit : ""}</span></div>
    </div>
  );
}
