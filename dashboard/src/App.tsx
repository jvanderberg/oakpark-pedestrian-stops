import { useMemo } from "react";
import { useStops } from "@/hooks/use-stops";
import { useFilters } from "@/hooks/use-filters";
import { usePopstate } from "@/hooks/use-popstate";
import { FilterBar } from "@/components/filter-bar";
import { StatsCards } from "@/components/stats-cards";
import { Charts } from "@/components/charts";
import { StopsTable } from "@/components/stops-table";
import type { Stop, Filters } from "@/types";
import { FILTER_KEYS, stopField } from "@/types";
import { Link } from "lucide-react";

function applyFilters(stops: Stop[], filters: Filters): Stop[] {
  return stops.filter((s) =>
    FILTER_KEYS.every((key) => {
      const selected = filters[key];
      if (selected.length === 0) return true;
      return selected.includes(stopField(s, key));
    })
  );
}

function App() {
  usePopstate();
  const { stops, loading } = useStops();
  const { filters, setFilters, toggleFilter, clearFilters, hasActiveFilters } =
    useFilters();

  const filtered = useMemo(
    () => applyFilters(stops, filters),
    [stops, filters]
  );

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Loading data...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pedestrian Stops Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Oak Park PD — Field Contact Data (Jan 2015 to Dec 2025)
            </p>
            <p className="text-sm text-muted-foreground">
              Pre-2024 data source:{" "}
              <a
                href="https://docs.google.com/spreadsheets/d/1aFVlaOqM4NeOZuB5DGw9v5xIequI-lY_JmmGN3Jr_UM/edit?gid=23324634#gid=23324634"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Freedom to Thrive
              </a>
            </p>
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border rounded-md px-3 py-1.5"
            title="Copy shareable link with current filters"
          >
            <Link className="h-4 w-4" />
            Copy Link
          </button>
        </div>

        <FilterBar
          stops={stops}
          filters={filters}
          setFilters={setFilters}
          toggleFilter={toggleFilter}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <StatsCards stops={filtered} />
        <Charts stops={filtered} />
        <StopsTable stops={filtered} />
      </div>
    </div>
  );
}

export default App;
