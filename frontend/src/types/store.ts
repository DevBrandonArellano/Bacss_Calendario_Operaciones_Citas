export type ProductStatus = "active" | "inactive" | "discontinued";

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  discontinued: "Descontinuado",
};

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  price: string;
  cost: string;
  stock: number;
  min_stock: number;
  status: ProductStatus;
}

export type ProductInput = Omit<Product, "id">;

export interface ProductVariant {
  id: string;
  product: string;
  sku: string;
  attributes: Record<string, string>;
  stock: number;
  price_override: string | null;
}

export type ProductVariantInput = Omit<ProductVariant, "id">;

export interface Inventory {
  id: string;
  branch: string;
  product_variant: string;
  quantity: number;
  last_counted_at: string | null;
}

export interface ProductLaunch {
  id: string;
  name: string;
  launch_at: string;
  presale_enabled: boolean;
  quota: number | null;
  schedule_windows: unknown[];
  products: string[];
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  paid: "Pagado",
  preparing: "En preparación",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

// Debe reflejar VALID_ORDER_TRANSITIONS de apps/modules/store/models.py.
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivered"],
  delivered: [],
  cancelled: [],
};

export interface OrderItem {
  id: string;
  product_variant: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface Order {
  id: string;
  customer: string;
  branch: string;
  status: OrderStatus;
  total: string;
  ordered_at: string;
  items: OrderItem[];
}

export interface OrderItemSpec {
  product_variant_id: string;
  quantity: number;
}
