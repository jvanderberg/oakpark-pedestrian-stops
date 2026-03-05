import { useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Stop } from "@/types";
import { getHour, getDayOfWeek, normalizeSex } from "@/types";
import type { PieLabelRenderProps } from "recharts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

const MONTH_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_BREAKDOWN_OPTIONS = [
  { value: "none", label: "None" },
  { value: "race", label: "Race" },
  { value: "sex", label: "Sex" },
  { value: "reason", label: "Reason" },
  { value: "arrest", label: "Arrest" },
  { value: "cfs_vs_oi", label: "Initiation" },
] as const;

const REASON_BREAKDOWN_OPTIONS = [
  { value: "none", label: "None" },
  { value: "race", label: "Race" },
  { value: "sex", label: "Sex" },
  { value: "arrest", label: "Arrest" },
  { value: "cfs_vs_oi", label: "Initiation" },
] as const;

const AGE_BREAKDOWN_OPTIONS = [
  { value: "none", label: "None" },
  { value: "race", label: "Race" },
  { value: "sex", label: "Sex" },
  { value: "reason", label: "Reason" },
  { value: "arrest", label: "Arrest" },
  { value: "cfs_vs_oi", label: "Initiation" },
] as const;

const AGE_BUCKETS = [
  "0-12",
  "13-17",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
  "Unknown",
] as const;

type BreakdownDimension = "race" | "sex" | "reason" | "arrest" | "cfs_vs_oi";
type MonthBreakdownKey = "none" | BreakdownDimension;
type ReasonBreakdownKey = "none" | Exclude<BreakdownDimension, "reason">;
type AgeBreakdownKey = "none" | BreakdownDimension;

const MONTH_BREAKDOWN_PARAM = "month_breakdown";
const REASON_BREAKDOWN_PARAM = "reason_breakdown";
const AGE_BREAKDOWN_PARAM = "age_breakdown";
const MONTH_PERCENT_PARAM = "month_percent";
const REASON_PERCENT_PARAM = "reason_percent";
const AGE_PERCENT_PARAM = "age_percent";

const TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    color: "var(--foreground)",
  },
  labelStyle: { color: "var(--foreground)" },
  itemStyle: { color: "var(--foreground)" },
} as const;

function countBy(stops: Stop[], accessor: (s: Stop) => string) {
  const counts: Record<string, number> = {};
  for (const s of stops) {
    const key = accessor(s);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function pieLabel({ name, percent }: PieLabelRenderProps) {
  return `${name ?? ""} ${((percent as number) * 100).toFixed(0)}%`;
}

function sourceSheetSortKey(value: string): number {
  const match = value.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const month = MONTH_INDEX[match[1]];
  const year = Number(match[2]);
  if (month === undefined || Number.isNaN(year)) return Number.MAX_SAFE_INTEGER;
  return year * 12 + month;
}

function monthTickLabel(v: string): string {
  const match = v.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return v;
  return `${match[1]} '${match[2].slice(2)}`;
}

function parseAge(stop: Stop): number | null {
  const raw = (stop as Stop & { age: number | string | null | undefined }).age;
  if (raw === null || raw === undefined) return null;
  const num = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(num) ? num : null;
}

function ageBucket(stop: Stop): (typeof AGE_BUCKETS)[number] {
  const age = parseAge(stop);
  if (age === null || age <= 0 || age === 99) return "Unknown";
  if (age <= 12) return "0-12";
  if (age <= 17) return "13-17";
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  if (age <= 54) return "45-54";
  if (age <= 64) return "55-64";
  return "65+";
}

function breakdownValue(stop: Stop, key: BreakdownDimension): string {
  switch (key) {
    case "race":
      return stop.race_ethnicity_group || "Unknown";
    case "sex":
      return normalizeSex(stop.sex);
    case "reason":
      return stop.reason || "Unknown";
    case "arrest":
      return stop.arrest || "Unknown";
    case "cfs_vs_oi":
      return stop.cfs_vs_oi || "Unknown";
  }
}

function colorForIndex(index: number): string {
  if (index < COLORS.length) return COLORS[index];
  const hue = (index * 47) % 360;
  return `hsl(${hue} 65% 52%)`;
}

function withPercentFields(
  rows: Array<Record<string, string | number>>,
  categories: string[]
) {
  return rows.map((row) => {
    const total = Number(row.total ?? 0);
    const next: Record<string, string | number> = { ...row };
    for (const category of categories) {
      const count = Number(row[category] ?? 0);
      next[`pct__${category}`] = total > 0 ? (count / total) * 100 : 0;
    }
    return next;
  });
}

function formatTooltipValue(value: number | string | undefined, percentMode: boolean) {
  if (percentMode) return `${Number(value ?? 0).toFixed(1)}%`;
  return `${value ?? 0}`;
}

function PercentToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="ml-2 inline-flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="text-muted-foreground">Percentage</span>
    </label>
  );
}

export function Charts({ stops }: { stops: Stop[] }) {
  const updateQueryParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (value === null) params.delete(key);
    else params.set(key, value);

    const search = params.toString();
    window.history.pushState(
      null,
      "",
      search ? `${window.location.pathname}?${search}` : window.location.pathname
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  const monthBreakdown = useMemo<MonthBreakdownKey>(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(MONTH_BREAKDOWN_PARAM) as MonthBreakdownKey | null;
    const valid = MONTH_BREAKDOWN_OPTIONS.some((opt) => opt.value === value);
    return valid && value ? value : "none";
  }, [window.location.search]);

  const setMonthBreakdown = useCallback(
    (next: MonthBreakdownKey) => {
      updateQueryParam(MONTH_BREAKDOWN_PARAM, next === "none" ? null : next);
    },
    [updateQueryParam]
  );

  const reasonBreakdown = useMemo<ReasonBreakdownKey>(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(REASON_BREAKDOWN_PARAM) as ReasonBreakdownKey | null;
    const valid = REASON_BREAKDOWN_OPTIONS.some((opt) => opt.value === value);
    return valid && value ? value : "none";
  }, [window.location.search]);

  const setReasonBreakdown = useCallback(
    (next: ReasonBreakdownKey) => {
      updateQueryParam(REASON_BREAKDOWN_PARAM, next === "none" ? null : next);
    },
    [updateQueryParam]
  );

  const ageBreakdown = useMemo<AgeBreakdownKey>(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(AGE_BREAKDOWN_PARAM) as AgeBreakdownKey | null;
    const valid = AGE_BREAKDOWN_OPTIONS.some((opt) => opt.value === value);
    return valid && value ? value : "none";
  }, [window.location.search]);

  const setAgeBreakdown = useCallback(
    (next: AgeBreakdownKey) => {
      updateQueryParam(AGE_BREAKDOWN_PARAM, next === "none" ? null : next);
    },
    [updateQueryParam]
  );

  const monthPercent = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get(MONTH_PERCENT_PARAM) === "1";
  }, [window.location.search]);

  const reasonPercent = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get(REASON_PERCENT_PARAM) === "1";
  }, [window.location.search]);

  const agePercent = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get(AGE_PERCENT_PARAM) === "1";
  }, [window.location.search]);

  const setMonthPercent = useCallback(
    (checked: boolean) => updateQueryParam(MONTH_PERCENT_PARAM, checked ? "1" : null),
    [updateQueryParam]
  );

  const setReasonPercent = useCallback(
    (checked: boolean) =>
      updateQueryParam(REASON_PERCENT_PARAM, checked ? "1" : null),
    [updateQueryParam]
  );

  const setAgePercent = useCallback(
    (checked: boolean) => updateQueryParam(AGE_PERCENT_PARAM, checked ? "1" : null),
    [updateQueryParam]
  );

  const byRace = countBy(stops, (s) => s.race_ethnicity_group);

  const byReasonRows = useMemo(() => {
    const reasons = countBy(stops, (s) => s.reason).map((r) => r.name);
    const rows: Array<Record<string, string | number>> = reasons.map((reason) => ({
      name: reason,
      total: 0,
    }));
    const rowByReason = new Map(rows.map((r) => [r.name as string, r]));
    const breakdownTotals: Record<string, number> = {};

    for (const stop of stops) {
      const row = rowByReason.get(stop.reason);
      if (!row) continue;
      row.total = Number(row.total) + 1;
      if (reasonBreakdown === "none") continue;
      const key = breakdownValue(stop, reasonBreakdown);
      row[key] = Number(row[key] ?? 0) + 1;
      breakdownTotals[key] = (breakdownTotals[key] ?? 0) + 1;
    }

    const categories = Object.entries(breakdownTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);

    return { rows, categories, percentRows: withPercentFields(rows, categories) };
  }, [stops, reasonBreakdown]);

  const byMonthRows = useMemo(() => {
    const months = Array.from(new Set(stops.map((s) => s.source_sheet))).sort(
      (a, b) => sourceSheetSortKey(a) - sourceSheetSortKey(b)
    );

    const rows: Array<Record<string, string | number>> = months.map((month) => ({
      name: month,
      total: 0,
    }));
    const rowByMonth = new Map(rows.map((r) => [r.name as string, r]));
    const breakdownTotals: Record<string, number> = {};

    for (const stop of stops) {
      const row = rowByMonth.get(stop.source_sheet);
      if (!row) continue;
      row.total = Number(row.total) + 1;
      if (monthBreakdown === "none") continue;
      const key = breakdownValue(stop, monthBreakdown);
      row[key] = Number(row[key] ?? 0) + 1;
      breakdownTotals[key] = (breakdownTotals[key] ?? 0) + 1;
    }

    const categories = Object.entries(breakdownTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);

    return { rows, categories, percentRows: withPercentFields(rows, categories) };
  }, [stops, monthBreakdown]);

  const byAgeRows = useMemo(() => {
    const rows: Array<Record<string, string | number>> = AGE_BUCKETS.map((bucket) => ({
      name: bucket,
      total: 0,
    }));
    const rowByBucket = new Map(rows.map((r) => [r.name as string, r]));
    const breakdownTotals: Record<string, number> = {};

    for (const stop of stops) {
      const bucket = ageBucket(stop);
      const row = rowByBucket.get(bucket);
      if (!row) continue;
      row.total = Number(row.total) + 1;
      if (ageBreakdown === "none") continue;
      const key = breakdownValue(stop, ageBreakdown);
      row[key] = Number(row[key] ?? 0) + 1;
      breakdownTotals[key] = (breakdownTotals[key] ?? 0) + 1;
    }

    const categories = Object.entries(breakdownTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);

    return { rows, categories, percentRows: withPercentFields(rows, categories) };
  }, [stops, ageBreakdown]);

  const byHour = Array.from({ length: 24 }, (_, i) => {
    const hour = String(i).padStart(2, "0");
    return {
      name: hour,
      value: stops.filter((s) => getHour(s) === hour).length,
    };
  });

  const byDay = DAY_NAMES.map((day) => ({
    name: day,
    value: stops.filter((s) => getDayOfWeek(s) === day).length,
  }));

  const byCfsOi = countBy(stops, (s) => s.cfs_vs_oi);
  const bySex = countBy(stops, (s) => normalizeSex(s.sex));

  const monthPercentMode = monthBreakdown !== "none" && monthPercent;
  const reasonPercentMode = reasonBreakdown !== "none" && reasonPercent;
  const agePercentMode = ageBreakdown !== "none" && agePercent;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">Stops by Month</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Breakdown</span>
              <Select
                value={monthBreakdown}
                onValueChange={(v) => setMonthBreakdown(v as MonthBreakdownKey)}
              >
                <SelectTrigger size="sm" className="w-[140px]">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_BREAKDOWN_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <PercentToggle
                checked={monthPercent}
                disabled={monthBreakdown === "none"}
                onChange={setMonthPercent}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthPercentMode ? byMonthRows.percentRows : byMonthRows.rows}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickFormatter={monthTickLabel} />
              <YAxis
                domain={monthPercentMode ? [0, 100] : undefined}
                tickFormatter={(v: number) =>
                  monthPercentMode ? `${Math.round(v)}%` : `${v}`
                }
              />
              <Tooltip
                {...TOOLTIP_PROPS}
                formatter={(value: number | string | undefined) =>
                  formatTooltipValue(value, monthPercentMode)
                }
              />
              {monthBreakdown === "none" ? (
                <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              ) : (
                <>
                  {byMonthRows.categories.map((category, idx) => (
                    <Bar
                      key={category}
                      dataKey={monthPercentMode ? `pct__${category}` : category}
                      stackId="month-breakdown"
                      fill={colorForIndex(idx)}
                    />
                  ))}
                  <Legend />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Race/Ethnicity</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={byRace}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={pieLabel}
              >
                {byRace.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...TOOLTIP_PROPS} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">Reason for Stop</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Breakdown</span>
              <Select
                value={reasonBreakdown}
                onValueChange={(v) => setReasonBreakdown(v as ReasonBreakdownKey)}
              >
                <SelectTrigger size="sm" className="w-[140px]">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {REASON_BREAKDOWN_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <PercentToggle
                checked={reasonPercent}
                disabled={reasonBreakdown === "none"}
                onChange={setReasonPercent}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={reasonPercentMode ? byReasonRows.percentRows : byReasonRows.rows}
              layout="vertical"
            >
              <XAxis
                type="number"
                domain={reasonPercentMode ? [0, 100] : undefined}
                tickFormatter={(v: number) =>
                  reasonPercentMode ? `${Math.round(v)}%` : `${v}`
                }
              />
              <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
              <Tooltip
                {...TOOLTIP_PROPS}
                formatter={(value: number | string | undefined) =>
                  formatTooltipValue(value, reasonPercentMode)
                }
              />
              {reasonBreakdown === "none" ? (
                <Bar dataKey="total" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
              ) : (
                <>
                  {byReasonRows.categories.map((category, idx) => (
                    <Bar
                      key={category}
                      dataKey={reasonPercentMode ? `pct__${category}` : category}
                      stackId="reason-breakdown"
                      fill={colorForIndex(idx)}
                    />
                  ))}
                  <Legend />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">Age Distribution</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Breakdown</span>
              <Select
                value={ageBreakdown}
                onValueChange={(v) => setAgeBreakdown(v as AgeBreakdownKey)}
              >
                <SelectTrigger size="sm" className="w-[140px]">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_BREAKDOWN_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <PercentToggle
                checked={agePercent}
                disabled={ageBreakdown === "none"}
                onChange={setAgePercent}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={agePercentMode ? byAgeRows.percentRows : byAgeRows.rows}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                domain={agePercentMode ? [0, 100] : undefined}
                tickFormatter={(v: number) => (agePercentMode ? `${Math.round(v)}%` : `${v}`)}
              />
              <Tooltip
                {...TOOLTIP_PROPS}
                formatter={(value: number | string | undefined) =>
                  formatTooltipValue(value, agePercentMode)
                }
              />
              {ageBreakdown === "none" ? (
                <Bar dataKey="total" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              ) : (
                <>
                  {byAgeRows.categories.map((category, idx) => (
                    <Bar
                      key={category}
                      dataKey={agePercentMode ? `pct__${category}` : category}
                      stackId="age-breakdown"
                      fill={colorForIndex(idx)}
                    />
                  ))}
                  <Legend />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Initiation</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={byCfsOi}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={pieLabel}
              >
                {byCfsOi.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip {...TOOLTIP_PROPS} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sex</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={bySex}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={pieLabel}
              >
                {bySex.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip {...TOOLTIP_PROPS} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hour of Day</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byHour}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
              <YAxis />
              <Tooltip {...TOOLTIP_PROPS} />
              <Bar dataKey="value" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Day of Week</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byDay}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip {...TOOLTIP_PROPS} />
              <Bar dataKey="value" fill="var(--chart-5)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
