export interface Schedule {
  id: string;
  branch: string | null;
  employee: string | null;
  /** 0 = lunes ... 6 = domingo (convención de `date.weekday()` del backend). */
  weekday: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
}
