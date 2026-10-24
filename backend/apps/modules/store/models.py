from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from core.models import TenantAwareModel, TimeStampedModel


class ProductStatus(models.TextChoices):
    ACTIVE = "active", "Activo"
    INACTIVE = "inactive", "Inactivo"
    DISCONTINUED = "discontinued", "Descontinuado"


class Product(TenantAwareModel, TimeStampedModel):
    sku = models.CharField(max_length=50)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    stock = models.PositiveIntegerField(default=0)
    min_stock = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=ProductStatus.choices, default=ProductStatus.ACTIVE)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "sku"], name="unique_product_sku_per_organization"
            )
        ]

    def __str__(self) -> str:
        return f"{self.sku} · {self.name}"


class ProductVariant(TenantAwareModel, TimeStampedModel):
    """`stock` es el contador operativo usado para vender (descontado al
    crear un pedido, docs/roadmap.md Fase 10). `Inventory` es el desglose
    físico por sucursal (docs/erd.md); no se usa para reservar stock de
    venta en el MVP, para no acoplar el motor de pedidos a en qué sucursal
    se originó — ver nota de diseño en `Inventory`.
    """

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField(max_length=50)
    attributes = models.JSONField(default=dict, blank=True)
    stock = models.PositiveIntegerField(default=0)
    price_override = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )

    class Meta:
        ordering = ["sku"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "sku"], name="unique_variant_sku_per_organization"
            )
        ]
        indexes = [models.Index(fields=["organization", "product"])]

    def __str__(self) -> str:
        return self.sku

    @property
    def effective_price(self):
        return self.price_override if self.price_override is not None else self.product.price


class Inventory(TenantAwareModel, TimeStampedModel):
    """Desglose físico de stock por sucursal (docs/erd.md). Es un registro
    de conteo, independiente del contador operativo `ProductVariant.stock`
    que usa el motor de pedidos — mantenerlos sincronizados es una tarea
    manual/operativa (conteo físico), no automática en el MVP.
    """

    branch = models.ForeignKey("branches.Branch", on_delete=models.PROTECT, related_name="+")
    product_variant = models.ForeignKey(
        ProductVariant, on_delete=models.CASCADE, related_name="inventory_records"
    )
    quantity = models.IntegerField(default=0)
    last_counted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["branch", "product_variant"], name="unique_inventory_per_branch_variant"
            )
        ]
        indexes = [models.Index(fields=["organization", "product_variant"])]

    def __str__(self) -> str:
        return f"{self.product_variant.sku} · sucursal {self.branch_id} · {self.quantity}"


class ProductLaunch(TenantAwareModel, TimeStampedModel):
    name = models.CharField(max_length=150)
    launch_at = models.DateTimeField()
    presale_enabled = models.BooleanField(default=False)
    quota = models.PositiveIntegerField(null=True, blank=True)
    schedule_windows = models.JSONField(default=list, blank=True)
    products = models.ManyToManyField(Product, related_name="launches", blank=True)

    class Meta:
        ordering = ["-launch_at"]

    def __str__(self) -> str:
        return self.name


class OrderStatus(models.TextChoices):
    PENDING = "pending", "Pendiente"
    CONFIRMED = "confirmed", "Confirmado"
    PAID = "paid", "Pagado"
    PREPARING = "preparing", "En preparación"
    READY = "ready", "Listo"
    DELIVERED = "delivered", "Entregado"
    CANCELLED = "cancelled", "Cancelado"


VALID_ORDER_TRANSITIONS: dict[str, set[str]] = {
    OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.PAID, OrderStatus.CANCELLED},
    OrderStatus.PAID: {OrderStatus.PREPARING, OrderStatus.CANCELLED},
    OrderStatus.PREPARING: {OrderStatus.READY, OrderStatus.CANCELLED},
    OrderStatus.READY: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}

# Estados anteriores a la entrega: si el pedido se cancela desde uno de
# estos, el stock reservado en la creación se restituye (services.py).
STOCK_RESERVED_STATUSES: set[str] = {
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PAID,
    OrderStatus.PREPARING,
    OrderStatus.READY,
}


class Order(TenantAwareModel, TimeStampedModel):
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="store_orders")
    branch = models.ForeignKey("branches.Branch", on_delete=models.PROTECT, related_name="+")
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    ordered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-ordered_at"]
        indexes = [models.Index(fields=["organization", "customer", "status"])]

    def __str__(self) -> str:
        return f"Pedido {self.id} · {self.status}"

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in VALID_ORDER_TRANSITIONS.get(self.status, set())


class OrderItem(TenantAwareModel, TimeStampedModel):
    """No tiene `organization_id` en `docs/erd.md`, pero hereda de
    `TenantAwareModel` igual que el resto de líneas de detalle del sistema
    (mismo criterio que `WorkOrderItem`, Fase 8): es la regla #1, no
    negociable, de `CLAUDE.md`.
    """

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product_variant = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, editable=False)

    class Meta:
        indexes = [models.Index(fields=["organization", "order"])]

    def __str__(self) -> str:
        return f"{self.product_variant.sku} × {self.quantity}"

    def save(self, *args, **kwargs):
        # Ver mismo comentario en `apps.modules.moto.models.WorkOrderItem.save`:
        # `unit_price` puede llegar como `str` y sin cast la multiplicación
        # es repetición de string, no aritmética.
        self.subtotal = Decimal(self.unit_price) * self.quantity
        super().save(*args, **kwargs)
