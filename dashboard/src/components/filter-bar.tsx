import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Filters, Stop } from "@/types";
import { FILTER_KEYS, FILTER_LABELS, stopField } from "@/types";
import { ChevronDown, X } from "lucide-react";

interface FilterBarProps {
  stops: Stop[];
  filters: Filters;
  toggleFilter: (key: keyof Filters, value: string) => void;
  setFilters: (filters: Filters) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const MONTH_ORDER: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

const DAY_ORDER: Record<string, number> = {
  Sun: 1,
  Mon: 2,
  Tue: 3,
  Wed: 4,
  Thu: 5,
  Fri: 6,
  Sat: 7,
};

function uniqueValues(stops: Stop[], key: keyof Filters): string[] {
  const set = new Set<string>();
  for (const s of stops) {
    const v = stopField(s, key);
    if (v) set.add(v);
  }
  const values = Array.from(set);
  if (key === "month") {
    return values.sort((a, b) => (MONTH_ORDER[a] ?? 99) - (MONTH_ORDER[b] ?? 99));
  }
  if (key === "day") {
    return values.sort((a, b) => (DAY_ORDER[a] ?? 99) - (DAY_ORDER[b] ?? 99));
  }
  return values.sort();
}

function summarize(selected: string[], total: number): string {
  if (selected.length === 0) return "All";
  if (selected.length === 1) return selected[0];
  if (selected.length === total) return "All";
  return `${selected.length} selected`;
}

function FilterDropdown({
  filterKey,
  allValues,
  selected,
  filters,
  toggleFilter,
  setFilters,
}: {
  filterKey: keyof Filters;
  allValues: string[];
  selected: string[];
  filters: Filters;
  toggleFilter: (key: keyof Filters, value: string) => void;
  setFilters: (filters: Filters) => void;
}) {
  const label = FILTER_LABELS[filterKey];
  const summary = summarize(selected, allValues.length);
  const hasSelection = selected.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={hasSelection ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
        >
          <span className="text-xs font-medium opacity-70">{label}:</span>
          <span className="max-w-[120px] truncate">{summary}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex items-center justify-between px-2 pb-2 border-b mb-1">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setFilters({ ...filters, [filterKey]: [...allValues] })}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              All
            </button>
            <span className="text-xs text-muted-foreground">/</span>
            <button
              onClick={() => setFilters({ ...filters, [filterKey]: [] })}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              None
            </button>
          </div>
        </div>
        <div className="max-h-[240px] overflow-y-auto">
          {allValues.map((value) => {
            const checked = selected.includes(value);
            return (
              <label
                key={value}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleFilter(filterKey, value)}
                />
                <span className="truncate">{value}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FilterBar({
  stops,
  filters,
  toggleFilter,
  setFilters,
  clearFilters,
  hasActiveFilters,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTER_KEYS.map((key) => {
        const values = uniqueValues(stops, key);
        return (
          <FilterDropdown
            key={key}
            filterKey={key}
            allValues={values}
            selected={filters[key]}
            filters={filters}
            toggleFilter={toggleFilter}
            setFilters={setFilters}
          />
        );
      })}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
