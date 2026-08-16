import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  Order,
  OrderItemSpec,
  OrderStatus,
  Product,
  ProductInput,
  ProductVariant,
  ProductVariantInput,
} from "@/types/store";

export async function listProducts(
  params: { page?: number; status?: string; category?: string } = {}
): Promise<Paginated<Product>> {
  const response = await apiClient.get<Paginated<Product>>("/modules/store/products/", { params });
  return response.data;
}

export async function getProduct(id: string): Promise<Product> {
  const response = await apiClient.get<Product>(`/modules/store/products/${id}/`);
  return response.data;
}

export async function createProduct(payload: Partial<ProductInput>): Promise<Product> {
  const response = await apiClient.post<Product>("/modules/store/products/", payload);
  return response.data;
}

export async function updateProduct(id: string, payload: Partial<ProductInput>): Promise<Product> {
  const response = await apiClient.patch<Product>(`/modules/store/products/${id}/`, payload);
  return response.data;
}

export async function listProductVariants(
  params: { page?: number; product?: string } = {}
): Promise<Paginated<ProductVariant>> {
  const response = await apiClient.get<Paginated<ProductVariant>>("/modules/store/product-variants/", {
    params,
  });
  return response.data;
}

export async function createProductVariant(
  payload: Partial<ProductVariantInput>
): Promise<ProductVariant> {
  const response = await apiClient.post<ProductVariant>("/modules/store/product-variants/", payload);
  return response.data;
}

export async function listOrders(
  params: { page?: number; status?: string; customer?: string } = {}
): Promise<Paginated<Order>> {
  const response = await apiClient.get<Paginated<Order>>("/modules/store/orders/", { params });
  return response.data;
}

export async function getOrder(id: string): Promise<Order> {
  const response = await apiClient.get<Order>(`/modules/store/orders/${id}/`);
  return response.data;
}

export async function createOrder(payload: {
  customer_id: string;
  branch_id: string;
  items: OrderItemSpec[];
}): Promise<Order> {
  const response = await apiClient.post<Order>("/modules/store/orders/", payload);
  return response.data;
}

export async function transitionOrder(id: string, status: OrderStatus): Promise<Order> {
  const response = await apiClient.post<Order>(`/modules/store/orders/${id}/transition/`, { status });
  return response.data;
}
