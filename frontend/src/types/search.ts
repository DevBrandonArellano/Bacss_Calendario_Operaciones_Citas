export type SearchResultType = "customer" | "appointment" | "motorcycle" | "legal_case" | "order" | "document";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  label: string;
  detail: string;
}

export const SEARCH_RESULT_TYPE_LABELS: Record<SearchResultType, string> = {
  customer: "Cliente",
  appointment: "Cita",
  motorcycle: "Moto",
  legal_case: "Caso legal",
  order: "Pedido",
  document: "Documento",
};

// Ruta de detalle por tipo de resultado; algunos tipos no tienen una
// pantalla de detalle propia todavía (se listan sin enlace).
export function searchResultPath(result: SearchResult): string | null {
  switch (result.type) {
    case "customer":
      return `/clientes/${result.id}/historial`;
    case "motorcycle":
      return `/motos/${result.id}/editar`;
    case "legal_case":
      return `/legal/casos/${result.id}`;
    default:
      return null;
  }
}
