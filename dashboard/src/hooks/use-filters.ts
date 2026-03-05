import { useMemo, useCallback } from "react";
import type { Filters } from "@/types";
import { FILTER_KEYS } from "@/types";

const DEFAULT_YEAR = "2025";
const MONTH_CODES = new Set([
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]);

const EMPTY_FILTERS: Filters = {
  year: [DEFAULT_YEAR],
  race: [],
  sex: [],
  reason: [],
  arrest: [],
  cfs_vs_oi: [],
  juvenile: [],
  month: [],
  hour: [],
  day: [],
};

function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const filters = { ...EMPTY_FILTERS };
  for (const key of FILTER_KEYS) {
    const val = params.get(key);
    if (val) {
      const decoded = val.split(",").map(decodeURIComponent);
      filters[key] =
        key === "month"
          ? decoded
              .map((value) => value.trim().slice(0, 3))
              .map((value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase())
              .filter((value) => MONTH_CODES.has(value))
          : decoded;
    }
  }
  if (!params.has("year")) {
    filters.year = [DEFAULT_YEAR];
  }
  return filters;
}

function filtersToSearch(filters: Filters, currentSearch: string): string {
  // Keep non-filter params (chart settings, etc.) intact when filters change.
  const params = new URLSearchParams(currentSearch);
  for (const key of FILTER_KEYS) {
    params.delete(key);
  }
  for (const key of FILTER_KEYS) {
    if (filters[key].length > 0) {
      params.set(key, filters[key].map(encodeURIComponent).join(","));
    }
  }
  const next = params.toString();
  return next ? `?${next}` : "";
}

export function useFilters() {
  const filters = useMemo(
    () => parseFilters(window.location.search),
    // We read location.search once on mount; updates go through setFilters
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [window.location.search]
  );

  const setFilters = useCallback((next: Filters) => {
    const search = filtersToSearch(next, window.location.search);
    window.history.pushState(null, "", search || window.location.pathname);
    // Force re-render by dispatching popstate
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  const toggleFilter = useCallback(
    (key: keyof Filters, value: string) => {
      const current = filters[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      setFilters({ ...filters, [key]: next });
    },
    [filters, setFilters]
  );

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, [setFilters]);

  const hasActiveFilters = FILTER_KEYS.some((k) => filters[k].length > 0);

  return { filters, setFilters, toggleFilter, clearFilters, hasActiveFilters };
}
