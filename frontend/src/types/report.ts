export interface DashboardSummary {
  today_total: number;
  today_by_status: Record<string, number>;
  upcoming_7_days: number;
  new_customers_this_month?: number;
  revenue_this_month?: string;
}

export type ChartMetric = "appointments" | "revenue" | "new_customers" | "top_services";
export type ChartGroupBy = "day" | "week" | "month";

export interface ChartPoint {
  period?: string;
  count?: number;
  total?: string;
  service_id?: string;
  service_name?: string;
}

export interface ChartResponse {
  metric: ChartMetric;
  group_by: ChartGroupBy;
  data: ChartPoint[];
}

export interface GeneralReport {
  date_from: string;
  date_to: string;
  appointments: { total: number; by_status: Record<string, number> };
  cancellations: { cancelled: number; no_show: number; rate: number };
  productivity?: { employee_id: string; employee_name: string; completed: number }[];
  customers?: { new: number };
  revenue?: { total: string };
}

export interface ModuleReport {
  [key: string]: unknown;
}
