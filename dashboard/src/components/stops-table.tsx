import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Stop } from "@/types";

const PAGE_SIZE = 25;

export function StopsTable({ stops }: { stops: Stop[] }) {
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const totalPages = Math.ceil(stops.length / PAGE_SIZE);
  const pageStops = stops.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">
          Stops ({stops.length} records)
        </CardTitle>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-2 py-1 border rounded disabled:opacity-30"
            >
              Prev
            </button>
            <span>
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 border rounded disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Sex</TableHead>
              <TableHead>Race/Ethnicity</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Arrest</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageStops.map((s) => (
              <>
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    setExpanded(expanded === s.id ? null : s.id)
                  }
                >
                  <TableCell className="whitespace-nowrap">
                    {s.fc_date.split("T")[0]}
                  </TableCell>
                  <TableCell>{s.fc_hour.slice(0, 5)}</TableCell>
                  <TableCell>{s.age}</TableCell>
                  <TableCell>{s.sex}</TableCell>
                  <TableCell>{s.race_ethnicity_group}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {s.reason}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={s.arrest === "Y" ? "destructive" : "secondary"}
                    >
                      {s.arrest}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{s.cfs_vs_oi}</Badge>
                  </TableCell>
                </TableRow>
                {expanded === s.id && (
                  <TableRow key={`${s.id}-narrative`}>
                    <TableCell colSpan={8} className="bg-muted/30">
                      <p className="text-sm whitespace-pre-wrap max-w-4xl">
                        {s.narrative}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
