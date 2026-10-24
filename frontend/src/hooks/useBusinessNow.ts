import { useEffect, useState } from "react";

import { nowInTimeZone, type BusinessNow } from "@/lib/businessTime";

const REFRESH_MS = 60_000;

/** «Ahora» en la zona horaria del negocio; se actualiza cada minuto (basta para la línea de hora actual). */
export function useBusinessNow(timeZone: string | undefined): BusinessNow {
  const [now, setNow] = useState<BusinessNow>(() => nowInTimeZone(timeZone));

  useEffect(() => {
    setNow(nowInTimeZone(timeZone));
    const timer = setInterval(() => setNow(nowInTimeZone(timeZone)), REFRESH_MS);
    return () => clearInterval(timer);
  }, [timeZone]);

  return now;
}
