import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import {
  createProduct,
  createProductVariant,
  getProduct,
  listProductVariants,
  updateProduct,
} from "@/features/store/api";
import { PRODUCT_STATUS_LABELS } from "@/types/store";
import type { ProductInput, ProductStatus, ProductVariant } from "@/types/store";

const STATUS_OPTIONS: ProductStatus[] = ["active", "inactive", "discontinued"];

const EMPTY_FORM: Partial<ProductInput> = {
  sku: "",
  name: "",
  description: "",
  category: "",
  price: "",
  cost: "0",
  stock: 0,
  min_stock: 0,
  status: "active",
};

export function ProductFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<ProductInput>>(EMPTY_FORM);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantSku, setVariantSku] = useState("");
  const [variantStock, setVariantStock] = useState("0");
  const [addingVariant, setAddingVariant] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  async function loadVariants(productId: string) {
    const data = await listProductVariants({ product: productId });
    setVariants(data.results);
  }

  useEffect(() => {
    if (mode === "edit" && id) {
      getProduct(id)
        .then(setForm)
        .then(() => loadVariants(id))
        .catch(() => setError("No se pudo cargar el producto."))
        .finally(() => setLoading(false));
    }
  }, [mode, id]);

  function handleChange<K extends keyof ProductInput>(field: K, value: ProductInput[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        const created = await createProduct(form);
        navigate(`/tienda/productos/${created.id}/editar`);
      } else if (id) {
        await updateProduct(id, form);
        navigate("/tienda/productos");
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo guardar el producto.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddVariant(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setAddingVariant(true);
    setVariantError(null);
    try {
      await createProductVariant({ product: id, sku: variantSku, attributes: {}, stock: Number(variantStock) });
      setVariantSku("");
      setVariantStock("0");
      await loadVariants(id);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo agregar la variante.";
      setVariantError(message);
    } finally {
      setAddingVariant(false);
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>{mode === "create" ? "Nuevo producto" : "Editar producto"}</h1>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="auth-form">
        <label htmlFor="sku">SKU</label>
        <input id="sku" value={form.sku ?? ""} onChange={(e) => handleChange("sku", e.target.value)} required />

        <label htmlFor="name">Nombre</label>
        <input id="name" value={form.name ?? ""} onChange={(e) => handleChange("name", e.target.value)} required />

        <label htmlFor="category">Categoría</label>
        <input
          id="category"
          value={form.category ?? ""}
          onChange={(e) => handleChange("category", e.target.value)}
        />

        <label htmlFor="price">Precio</label>
        <input
          id="price"
          type="number"
          min="0"
          step="0.01"
          value={form.price ?? ""}
          onChange={(e) => handleChange("price", e.target.value)}
          required
        />

        <label htmlFor="cost">Costo</label>
        <input
          id="cost"
          type="number"
          min="0"
          step="0.01"
          value={form.cost ?? "0"}
          onChange={(e) => handleChange("cost", e.target.value)}
        />

        <label htmlFor="min-stock">Stock mínimo</label>
        <input
          id="min-stock"
          type="number"
          min="0"
          value={form.min_stock ?? 0}
          onChange={(e) => handleChange("min_stock", Number(e.target.value))}
        />

        <label htmlFor="status">Estado</label>
        <select
          id="status"
          value={form.status ?? "active"}
          onChange={(e) => handleChange("status", e.target.value as ProductStatus)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {PRODUCT_STATUS_LABELS[option]}
            </option>
          ))}
        </select>

        <label htmlFor="description">Descripción</label>
        <textarea
          id="description"
          value={form.description ?? ""}
          onChange={(e) => handleChange("description", e.target.value)}
        />

        <div className="toolbar">
          <button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" onClick={() => navigate("/tienda/productos")}>
            Cancelar
          </button>
        </div>
      </form>

      {mode === "edit" && id && (
        <section aria-labelledby="variants-heading">
          <h2 id="variants-heading">Variantes</h2>
          <p>El stock de venta se controla por variante: cada producto necesita al menos una para poder venderse.</p>

          {variants.length === 0 ? (
            <p>Sin variantes todavía.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Stock</th>
                  <th>Precio (override)</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant) => (
                  <tr key={variant.id}>
                    <td>{variant.sku}</td>
                    <td>{variant.stock}</td>
                    <td>{variant.price_override ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>Agregar variante</h3>
          {variantError && (
            <p role="alert" className="form-error">
              {variantError}
            </p>
          )}
          <form onSubmit={handleAddVariant} className="auth-form">
            <label htmlFor="variant-sku">SKU de la variante</label>
            <input id="variant-sku" value={variantSku} onChange={(e) => setVariantSku(e.target.value)} required />

            <label htmlFor="variant-stock">Stock inicial</label>
            <input
              id="variant-stock"
              type="number"
              min="0"
              value={variantStock}
              onChange={(e) => setVariantStock(e.target.value)}
            />

            <button type="submit" disabled={addingVariant}>
              {addingVariant ? "Agregando..." : "Agregar variante"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
