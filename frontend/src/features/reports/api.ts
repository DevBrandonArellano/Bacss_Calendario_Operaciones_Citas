import { apiClient } from "@/api/client";
import type { ChartGroupBy, ChartMetric, ChartResponse, DashboardSummary, GeneralReport, ModuleReport } from "@/types/report";

export async function getDashboard(): Promise<DashboardSummary> {
  const response = await apiClient.get<DashboardSummary>("/reports/dashboard/");
  return response.data;
}

export async function getChartData(
  metric: ChartMetric,
  groupBy: ChartGroupBy,
  dateFrom?: string,
  dateTo?: string
): Promise<ChartResponse> {
  const response = await apiClient.get<ChartResponse>("/reports/charts/", {
    params: { metric, group_by: groupBy, date_from: dateFrom, date_to: dateTo },
  });
  return response.data;
}

export async function getGeneralReport(dateFrom?: string, dateTo?: string): Promise<GeneralReport> {
  const response = await apiClient.get<GeneralReport>("/reports/summary/", {
    params: { date_from: dateFrom, date_to: dateTo },
  });
  return response.data;
}

export async function getModuleReport(moduleCode: string, dateFrom?: string, dateTo?: string): Promise<ModuleReport> {
  const response = await apiClient.get<ModuleReport>(`/reports/modules/${moduleCode}/`, {
    params: { date_from: dateFrom, date_to: dateTo },
  });
  return response.data;
}
