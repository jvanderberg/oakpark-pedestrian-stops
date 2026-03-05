import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Stop } from "@/types";
import { normalizeSex } from "@/types";

type SortKey =
  | "fc_date"
  | "fc_hour"
  | "age"
  | "sex"
  | "race_ethnicity_group"
  | "reason"
  | "arrest"
  | "cfs_vs_oi"
  | "source_sheet";
type SortDir = "asc" | "desc";

const ROW_HEIGHT = 42;
const VIEWPORT_HEIGHT = 560;
const OVERSCAN = 10;

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function compareStops(a: Stop, b: Stop, key: SortKey, dir: SortDir): number {
  let result = 0;
  if (key === "age") {
    const av = Number.isFinite(a.age) ? a.age : -1;
    const bv = Number.isFinite(b.age) ? b.age : -1;
    result = av - bv;
  } else if (key === "sex") {
    result = normalizeSex(a.sex).localeCompare(normalizeSex(b.sex));
  } else if (key === "fc_date") {
    result = a.fc_date.localeCompare(b.fc_date);
  } else if (key === "fc_hour") {
    result = a.fc_hour.localeCompare(b.fc_hour);
  } else if (key === "race_ethnicity_group") {
    result = a.race_ethnicity_group.localeCompare(b.race_ethnicity_group);
  } else if (key === "reason") {
    result = a.reason.localeCompare(b.reason);
  } else if (key === "arrest") {
    result = a.arrest.localeCompare(b.arrest);
  } else if (key === "cfs_vs_oi") {
    result = a.cfs_vs_oi.localeCompare(b.cfs_vs_oi);
  } else if (key === "source_sheet") {
    result = a.source_sheet.localeCompare(b.source_sheet);
  } else {
    result = 0;
  }
  if (result === 0) result = a.id - b.id;
  return dir === "asc" ? result : -result;
}

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
  if (dir === "asc") return <ArrowUp className="h-3.5 w-3.5" />;
  return <ArrowDown className="h-3.5 w-3.5" />;
}

export function StopsTable({ stops }: { stops: Stop[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("fc_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [scrollTop, setScrollTop] = useState(0);

  const sorted = useMemo(() => {
    return [...stops].sort((a, b) => compareStops(a, b, sortKey, sortDir));
  }, [stops, sortKey, sortDir]);

  const totalHeight = sorted.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
  const endIndex = Math.min(sorted.length, startIndex + visibleCount);
  const visibleRows = sorted.slice(startIndex, endIndex);
  const topOffset = startIndex * ROW_HEIGHT;

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "fc_date" ? "desc" : "asc");
  };

  const exportCsv = () => {
    const header = [
      "id",
      "fc_date",
      "fc_hour",
      "age",
      "sex",
      "ethnic",
      "race_ethnicity_group",
      "juvenile",
      "reason",
      "arrest",
      "cfs_vs_oi",
      "narrative",
      "source_sheet",
    ];
    const lines = [header.join(",")];
    for (const s of sorted) {
      lines.push(
        [
          s.id,
          s.fc_date,
          s.fc_hour,
          s.age,
          normalizeSex(s.sex),
          s.ethnic,
          s.race_ethnicity_group,
          s.juvenile,
          s.reason,
          s.arrest,
          s.cfs_vs_oi,
          s.narrative,
          s.source_sheet,
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedestrian-stops-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm">Stops ({stops.length} records)</CardTitle>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted/60"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[1050px]">
            <div className="grid grid-cols-[155px_85px_70px_85px_180px_220px_90px_180px] border-b bg-muted/40 text-xs font-medium">
              <button
                className="flex items-center gap-1 px-2 py-2 text-left"
                onClick={() => onSort("fc_date")}
              >
                Date <SortIcon active={sortKey === "fc_date"} dir={sortDir} />
              </button>
              <button
                className="flex items-center gap-1 px-2 py-2 text-left"
                onClick={() => onSort("fc_hour")}
              >
                Time <SortIcon active={sortKey === "fc_hour"} dir={sortDir} />
              </button>
              <button
                className="flex items-center gap-1 px-2 py-2 text-left"
                onClick={() => onSort("age")}
              >
                Age <SortIcon active={sortKey === "age"} dir={sortDir} />
              </button>
              <button
                className="flex items-center gap-1 px-2 py-2 text-left"
                onClick={() => onSort("sex")}
              >
                Sex <SortIcon active={sortKey === "sex"} dir={sortDir} />
              </button>
              <button
                className="flex items-center gap-1 px-2 py-2 text-left"
                onClick={() => onSort("race_ethnicity_group")}
              >
                Race/Ethnicity{" "}
                <SortIcon active={sortKey === "race_ethnicity_group"} dir={sortDir} />
              </button>
              <button
                className="flex items-center gap-1 px-2 py-2 text-left"
                onClick={() => onSort("reason")}
              >
                Reason <SortIcon active={sortKey === "reason"} dir={sortDir} />
              </button>
              <button
                className="flex items-center gap-1 px-2 py-2 text-left"
                onClick={() => onSort("arrest")}
              >
                Arrest <SortIcon active={sortKey === "arrest"} dir={sortDir} />
              </button>
              <button
                className="flex items-center gap-1 px-2 py-2 text-left"
                onClick={() => onSort("cfs_vs_oi")}
              >
                Type <SortIcon active={sortKey === "cfs_vs_oi"} dir={sortDir} />
              </button>
            </div>

            <div
              className="relative overflow-y-auto border-b"
              style={{ height: VIEWPORT_HEIGHT }}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            >
              <div style={{ height: totalHeight, position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    top: topOffset,
                    left: 0,
                    right: 0,
                  }}
                >
                  {visibleRows.map((s) => (
                    <div
                      key={s.id}
                      className="grid grid-cols-[155px_85px_70px_85px_180px_220px_90px_180px] border-b text-sm hover:bg-muted/30"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div className="truncate px-2 py-2.5">{s.fc_date.split("T")[0]}</div>
                      <div className="truncate px-2 py-2.5">{s.fc_hour.slice(0, 5)}</div>
                      <div className="truncate px-2 py-2.5">{s.age ?? "Unknown"}</div>
                      <div className="truncate px-2 py-2.5">{normalizeSex(s.sex)}</div>
                      <div className="truncate px-2 py-2.5">{s.race_ethnicity_group}</div>
                      <div className="truncate px-2 py-2.5">{s.reason}</div>
                      <div className="px-2 py-2.5">
                        <Badge variant={s.arrest === "Y" ? "destructive" : "secondary"}>
                          {s.arrest}
                        </Badge>
                      </div>
                      <div className="truncate px-2 py-2.5">
                        <Badge variant="outline">{s.cfs_vs_oi}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
              <span>
                Showing {startIndex + 1} - {endIndex} of {sorted.length}
              </span>
              <span>
                Sorted by {sortKey} ({sortDir})
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
