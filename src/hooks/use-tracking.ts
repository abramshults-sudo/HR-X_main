import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function useTracking() {
  const location = useLocation();
  const lastTracked = useRef("");

  useEffect(() => {
    const path = location.pathname;
    if (path === lastTracked.current) return;
    lastTracked.current = path;

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      credentials: "include",
    }).catch(() => {});
  }, [location.pathname]);
}
