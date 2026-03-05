import { useState, useEffect } from "react";
import type { Stop } from "@/types";

export function useStops() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}stops.json`)
      .then((r) => r.json())
      .then((data: Stop[]) => {
        setStops(data);
        setLoading(false);
      });
  }, []);

  return { stops, loading };
}
