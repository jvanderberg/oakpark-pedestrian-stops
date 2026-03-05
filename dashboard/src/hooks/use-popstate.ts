import { useState, useEffect } from "react";

/** Forces re-render on popstate (back/forward and our pushState dispatches) */
export function usePopstate() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
}
