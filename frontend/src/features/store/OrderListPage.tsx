import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import { listBranches } from "@/features/branches/api";
import { listCustomers } from "@/features/customers/api";
import { createOrder, listOrders, listProductVariants } from "@/features/store/api";
import { ORDER_STATUS_LABELS } from "@/types/store";
import type { Order, OrderItemSpec, OrderStatus, ProductVariant } from "@/types/store";
import type { Branch } from "@/types/branch";
import type { Customer } from "@/types/customer";

const EMPTY_ITEM: OrderItemSpec = { product_variant_id: "", quantity: 1 };

export function OrderListPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [items, setItems] = useState<OrderItemSpec[]>([{ ...EMPTY_ITEM }]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listOrders({ page, status: statusFilter || undefined });
      setOrders(data.results);
      setCount(data.count);
    } catch {
      setError("No se pudo cargar la lista de pedidos.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    listCustomers({ page: 1 })
      .then((data) => setCustomers(data.results))
      .catch(() => setFormError("No se pudo cargar la lista de clientes."));
    listBranches({ page: 1 })
      .then((data) => setBranches(data.results))
      .catch(() => setFormError("No se pudo cargar la lista de sucursales."));
    listProductVariants({ page: 1 })
      .then((data) => setVariants(data.results))
      .catch(() => setFormError("No se pudo cargar la lista de variantes."));
  }, []);

  function updateItem(index: number, field: keyof OrderItemSpec, value: string) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: field === "quantity" ? Number(value) : value } : item
      )
    );
  }

  function addItemRow() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItemRow(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!customerId || !branchId) {
      setFormError("Selecciona un cliente y una sucursal.");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      await createOrder({ customer_id: customerId, branch_id: branchId, items });
      setCustomerId("");
      setBranchId("");
      setItems([{ ...EMPTY_ITEM }]);
      setPage(1);
      await fetchOrders();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo crear el pedido.";
      setFormError(message);
    } finally {
      setCreating(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / 20));
  const statusOptions = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

  return (
    <div>
      <h1>Pedidos</h1>

      <section aria-labelledby="create-order-heading">
        <h2 id="create-order-heading">Nuevo pedido</h2>
        {formError && (
          <p role="alert" className="form-error">
            {formError}
          </p>
        )}
        <form onSubmit={handleCreate} className="auth-form">
          <label htmlFor="order-customer">Cliente</label>
          <select id="order-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            <option value="" disabled>
              Selecciona un cliente
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name}
              </option>
            ))}
          </select>

          <label htmlFor="order-branch">Sucursal</label>
          <select id="order-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
            <option value="" disabled>
              Selecciona una sucursal
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>

          <fieldset>
            <legend>Ítems</legend>
            {items.map((item, index) => (
              <div className="toolbar" key={index}>
                <label htmlFor={`item-variant-${index}`}>Variante</label>
                <select
                  id={`item-variant-${index}`}
                  value={item.product_variant_id}
                  onChange={(e) => updateItem(index, "product_variant_id", e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Selecciona una variante
                  </option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.sku} (stock: {variant.stock})
                    </option>
                  ))}
                </select>
                <label htmlFor={`item-quantity-${index}`}>Cantidad</label>
                <input
                  id={`item-quantity-${index}`}
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => removeItemRow(index)}
                  disabled={items.length === 1}
                  aria-label={`Quitar ítem ${index + 1}`}
                >
                  Quitar
                </button>
              </div>
            ))}
            <button type="button" onClick={addItemRow}>
              Agregar otro ítem
            </button>
          </fieldset>

          <button type="submit" disabled={creating}>
            {creating ? "Creando..." : "Crear pedido"}
          </button>
        </form>
      </section>

      <section aria-labelledby="orders-list-heading">
        <div className="toolbar">
          <h2 id="orders-list-heading">Historial</h2>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {ORDER_STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {loading && <p>Cargando...</p>}
        {!loading && orders.length === 0 && <p>No hay pedidos registrados todavía.</p>}

        {!loading && orders.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Total</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span className={`badge badge-status-${order.status}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td>{order.total}</td>
                  <td>{new Date(order.ordered_at).toLocaleDateString("es-EC")}</td>
                  <td>
                    <Link to={`/tienda/pedidos/${order.id}`}>Ver detalle</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </button>
        </div>
      </section>
    </div>
  );
}
