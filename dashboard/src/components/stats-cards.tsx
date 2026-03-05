import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Stop } from "@/types";

interface StatsCardsProps {
  stops: Stop[];
}

export function StatsCards({ stops }: StatsCardsProps) {
  const total = stops.length;
  const arrests = stops.filter((s) => s.arrest === "Y").length;
  const oi = stops.filter((s) => s.cfs_vs_oi === "Officer Initiated").length;
  const juveniles = stops.filter((s) => s.juvenile === "Juvenile").length;
  const avgAge =
    total > 0 ? Math.round(stops.reduce((s, r) => s + r.age, 0) / total) : 0;

  const cards = [
    { title: "Total Stops", value: total },
    { title: "Arrests", value: `${arrests} (${total ? ((arrests / total) * 100).toFixed(1) : 0}%)` },
    { title: "Officer Initiated", value: `${oi} (${total ? ((oi / total) * 100).toFixed(1) : 0}%)` },
    { title: "Juveniles", value: juveniles },
    { title: "Avg Age", value: avgAge },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {c.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
