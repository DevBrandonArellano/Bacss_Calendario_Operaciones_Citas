# Modelo de datos (ERD)

Todas las entidades marcadas `[tenant]` heredan de `TenantAwareModel` (FK obligatoria `organization_id`, no anulable, indexada). Todas las entidades heredan además de `TimeStampedModel` (`created_at`, `updated_at`) salvo que se indique lo contrario. `SoftDeleteModel` se usa donde se indica `[soft-delete]`.

## Core

```mermaid
erDiagram
    ORGANIZATION ||--o{ BRANCH : "tiene"
    ORGANIZATION ||--o{ USER : "emplea"
    ORGANIZATION ||--o{ CUSTOMER : "atiende"
    ORGANIZATION ||--o{ SERVICE : "ofrece"
    ORGANIZATION ||--o{ MODULE_ACTIVATION : "activa"
    BRANCH ||--o{ APPOINTMENT : "agenda"
    USER }o--o{ ROLE : "tiene"
    ROLE }o--o{ PERMISSION : "otorga"
    USER ||--o{ EMPLOYEE : "es (opcional)"
    EMPLOYEE }o--o{ SERVICE : "presta"
    SERVICE ||--o{ APPOINTMENT : "se agenda como"
    CUSTOMER ||--o{ APPOINTMENT : "reserva"
    EMPLOYEE ||--o{ APPOINTMENT : "atiende"
    APPOINTMENT ||--o{ PAYMENT : "genera"
    APPOINTMENT ||--o{ NOTIFICATION : "dispara"
    EMPLOYEE ||--o{ SCHEDULE : "tiene horario"
    BRANCH ||--o{ SCHEDULE : "define horario de"
    USER ||--o{ AUDIT_LOG : "genera"

    ORGANIZATION {
        uuid id PK
        string name
        string legal_name
        string tax_id
        string timezone
        string default_currency
        string date_format
        string logo_url
        string status "active|suspended|trial"
        jsonb settings
        datetime created_at
        datetime updated_at
    }

    MODULE_ACTIVATION {
        uuid id PK
        uuid organization_id FK
        string module_code "moto|laboratory|store|legal"
        bool is_active
        jsonb config
        datetime activated_at
        datetime deactivated_at
    }

    BRANCH {
        uuid id PK
        uuid organization_id FK
        string name
        string address
        string phone
        string timezone_override
        bool is_active
    }

    USER {
        uuid id PK
        uuid organization_id FK "null para superadmin de plataforma"
        string email UK
        string password_hash
        string first_name
        string last_name
        string phone
        bool is_active
        bool is_platform_superadmin
        datetime last_login
        datetime password_changed_at
    }

    ROLE {
        uuid id PK
        uuid organization_id FK "null si es rol de sistema"
        string code "superadmin|org_admin|reception|professional|customer"
        string name
        bool is_system_role
    }

    PERMISSION {
        uuid id PK
        string code UK "resource:action, ej. customers:read"
        string description
    }

    EMPLOYEE {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK "nullable si aun no tiene login"
        uuid branch_id FK
        string first_name
        string last_name
        string specialty
        bool is_active
    }

    CUSTOMER {
        uuid id PK
        uuid organization_id FK
        uuid branch_id FK "nullable"
        string first_name
        string last_name
        string document_type
        string document_number
        string phone
        string email
        string address
        date birth_date
        text notes
        string status "active|inactive"
        datetime registered_at
    }

    SERVICE {
        uuid id PK
        uuid organization_id FK
        string name
        string category
        int duration_minutes
        decimal price
        string status "active|inactive"
    }

    SERVICE_BRANCH {
        uuid service_id FK
        uuid branch_id FK
    }

    EMPLOYEE_SERVICE {
        uuid employee_id FK
        uuid service_id FK
    }

    SCHEDULE {
        uuid id PK
        uuid organization_id FK
        uuid branch_id FK "nullable si es horario de empleado"
        uuid employee_id FK "nullable si es horario de sucursal"
        int weekday "0-6"
        time start_time
        time end_time
        bool is_break
    }

    AVAILABILITY_BLOCK {
        uuid id PK
        uuid organization_id FK
        uuid employee_id FK "nullable"
        uuid branch_id FK "nullable"
        date date
        time start_time
        time end_time
        string reason "vacation|holiday|manual_block|absence"
        text notes
    }

    APPOINTMENT {
        uuid id PK
        uuid organization_id FK
        uuid branch_id FK
        uuid customer_id FK
        uuid service_id FK
        uuid employee_id FK
        date appointment_date
        time start_time
        time end_time
        int duration_minutes
        string status "pending|confirmed|waiting|in_progress|completed|cancelled|no_show|rescheduled"
        string booking_channel "online|staff|phone|api"
        decimal price
        string payment_status "unpaid|partial|paid|refunded"
        text notes
    }

    PAYMENT {
        uuid id PK
        uuid organization_id FK
        uuid appointment_id FK "nullable, tambien puede ligar a order"
        uuid customer_id FK
        decimal amount
        string method "cash|transfer|card|other"
        string status "pending|partial|paid|refunded"
        datetime paid_at
    }

    NOTIFICATION {
        uuid id PK
        uuid organization_id FK
        uuid recipient_user_id FK "nullable"
        uuid customer_id FK "nullable"
        string channel "email|sms|whatsapp|internal"
        string template_code
        string status "queued|sent|failed|read"
        jsonb payload
        datetime sent_at
    }

    DOCUMENT {
        uuid id PK
        uuid organization_id FK
        string owner_type "customer|appointment|case|work_order|patient|order"
        uuid owner_id
        string name
        string file "FileField, agregado en Fase 11B: el diagrama original no listaba el archivo en si, solo su metadata"
        string file_type
        int size_bytes
        int version
        string status "active|archived"
        uuid uploaded_by_user_id FK
    }

    AUDIT_LOG {
        uuid id PK
        uuid organization_id FK "nullable para acciones de plataforma"
        uuid user_id FK "nullable"
        string action "login|logout|create|update|delete|download|permission_change"
        string entity_type
        uuid entity_id
        jsonb changes
        string ip_address
        string correlation_id
        datetime created_at
    }
```

**Restricciones e índices clave del core:**

- `USER.email` único global (o único por `organization_id` si se permite el mismo email en distintas organizaciones — decisión: único global para simplificar login).
- `APPOINTMENT`: índice compuesto `(organization_id, branch_id, employee_id, appointment_date)` para acelerar el cálculo de disponibilidad; constraint de exclusión (`EXCLUDE USING gist`) o único parcial sobre `(employee_id, appointment_date, start_time, end_time)` para estados activos (`pending, confirmed, waiting, in_progress`), como defensa a nivel de base de datos contra doble reserva (ver `docs/booking-engine.md`).
- `MODULE_ACTIVATION`: único `(organization_id, module_code)`.
- `DOCUMENT`: índice `(organization_id, owner_type, owner_id)`.
- `AUDIT_LOG`: sin `updated_at`, sin soft-delete, sin permiso de `DELETE` a nivel de aplicación (ni siquiera para superadmin de organización).

## Módulo Taller de motos (`moto`) `[tenant]`

```mermaid
erDiagram
    CUSTOMER ||--o{ MOTORCYCLE : "posee"
    MOTORCYCLE ||--o{ VEHICLE_HISTORY : "acumula"
    MOTORCYCLE ||--o{ WORK_ORDER : "genera"
    WORK_ORDER ||--o{ WORK_ORDER_ITEM : "contiene"
    APPOINTMENT ||--o{ WORK_ORDER : "puede originar"

    MOTORCYCLE {
        uuid id PK
        uuid organization_id FK
        uuid customer_id FK
        string plate
        string brand
        string model
        int year
        string color
        string vin
        string engine_number
        int mileage
        date purchase_date
        text notes
    }

    VEHICLE_HISTORY {
        uuid id PK
        uuid organization_id FK
        uuid motorcycle_id FK
        date service_date
        int mileage
        string service_description
        text diagnosis
        text parts_used
        text labor_description
        uuid technician_id FK
        decimal cost
        text notes
    }

    WORK_ORDER {
        uuid id PK
        uuid organization_id FK
        uuid motorcycle_id FK
        uuid appointment_id FK "nullable"
        string status "received|diagnosis|awaiting_authorization|in_repair|awaiting_part|finished|delivered"
        decimal total
        text diagnosis_notes
        datetime received_at
        datetime delivered_at
    }

    WORK_ORDER_ITEM {
        uuid id PK
        uuid work_order_id FK
        string item_type "part|labor"
        string description
        int quantity
        decimal unit_price
        decimal subtotal
    }
```

## Módulo Laboratorio clínico (`laboratory`) `[tenant]`

```mermaid
erDiagram
    CUSTOMER ||--o| PATIENT : "es (opcional)"
    PATIENT ||--o{ LAB_ORDER : "solicita"
    LAB_ORDER ||--o{ LAB_TEST : "incluye"
    LAB_TEST ||--o| SAMPLE : "requiere"
    LAB_TEST ||--o| LAB_RESULT : "produce"
    APPOINTMENT ||--o| LAB_ORDER : "puede originar"

    PATIENT {
        uuid id PK
        uuid organization_id FK
        uuid customer_id FK "nullable"
        string first_name
        string last_name
        string document_number
        date birth_date
        string sex
        text medical_notes
    }

    LAB_ORDER {
        uuid id PK
        uuid organization_id FK
        uuid patient_id FK
        uuid ordering_employee_id FK
        string status "ordered|sample_pending|sample_taken|processing|result_available|validated|delivered"
        datetime ordered_at
    }

    LAB_TEST {
        uuid id PK
        uuid organization_id FK
        uuid lab_order_id FK
        string test_code
        string test_name
        string status "ordered|sample_pending|sample_taken|processing|result_available|validated|delivered"
    }

    SAMPLE {
        uuid id PK
        uuid organization_id FK
        uuid lab_test_id FK
        string sample_type
        datetime collected_at
        uuid collected_by_employee_id FK
        string status "pending|collected|rejected"
    }

    LAB_RESULT {
        uuid id PK
        uuid organization_id FK
        uuid lab_test_id FK
        string result_value
        string unit
        string reference_range
        text observations
        uuid validated_by_employee_id FK
        datetime validated_at
    }
```

**Nota de sensibilidad:** `PATIENT`, `LAB_RESULT` y `SAMPLE` requieren control de acceso reforzado (ver `docs/auth-rbac.md` y `docs/security-iso27001.md`); todo acceso de lectura/escritura a `LAB_RESULT` queda auditado.

## Módulo Tienda / lanzamientos (`store`) `[tenant]`

```mermaid
erDiagram
    PRODUCT ||--o{ PRODUCT_VARIANT : "tiene"
    PRODUCT_VARIANT ||--o| INVENTORY : "controla stock en"
    PRODUCT_LAUNCH }o--o{ PRODUCT : "incluye"
    CUSTOMER ||--o{ ORDER : "realiza"
    ORDER ||--o{ ORDER_ITEM : "contiene"
    ORDER_ITEM }o--|| PRODUCT_VARIANT : "referencia"

    PRODUCT {
        uuid id PK
        uuid organization_id FK
        string sku UK
        string name
        text description
        string category
        decimal price
        decimal cost
        int stock
        int min_stock
        string status "active|inactive|discontinued"
    }

    PRODUCT_VARIANT {
        uuid id PK
        uuid organization_id FK
        uuid product_id FK
        string sku UK
        string attributes "jsonb: talla, color, etc"
        int stock
        decimal price_override
    }

    INVENTORY {
        uuid id PK
        uuid organization_id FK
        uuid branch_id FK
        uuid product_variant_id FK
        int quantity
        datetime last_counted_at
    }

    PRODUCT_LAUNCH {
        uuid id PK
        uuid organization_id FK
        string name
        datetime launch_at
        bool presale_enabled
        int quota
        jsonb schedule_windows
    }

    ORDER {
        uuid id PK
        uuid organization_id FK
        uuid customer_id FK
        uuid branch_id FK
        string status "pending|confirmed|paid|preparing|ready|delivered|cancelled"
        decimal total
        datetime ordered_at
    }

    ORDER_ITEM {
        uuid id PK
        uuid order_id FK
        uuid product_variant_id FK
        int quantity
        decimal unit_price
        decimal subtotal
    }
```

## Módulo Legal (`legal`) `[tenant]`

```mermaid
erDiagram
    CUSTOMER ||--o{ LEGAL_CASE : "tiene"
    LEGAL_CASE ||--o{ CASE_EVENT : "acumula"
    LEGAL_CASE ||--o{ HEARING : "programa"
    LEGAL_CASE ||--o{ CASE_TASK : "genera"

    LEGAL_CASE {
        uuid id PK
        uuid organization_id FK
        string case_number UK
        uuid customer_id FK
        string case_type
        uuid responsible_lawyer_id FK
        string status "new|in_review|active|on_hold|closed|archived"
        date opened_at
        date closed_at
        string priority "low|medium|high"
        text description
    }

    CASE_EVENT {
        uuid id PK
        uuid organization_id FK
        uuid legal_case_id FK
        datetime event_at
        string event_type
        text description
        uuid created_by_user_id FK
    }

    HEARING {
        uuid id PK
        uuid organization_id FK
        uuid legal_case_id FK
        datetime scheduled_at
        string location
        string status "scheduled|held|postponed|cancelled"
        text notes
    }

    CASE_TASK {
        uuid id PK
        uuid organization_id FK
        uuid legal_case_id FK
        string title
        text description
        uuid assigned_to_user_id FK
        date due_date
        string priority "low|medium|high"
        string status "pending|in_progress|completed|cancelled"
    }
```

## Tabla genérica de tareas transversales (Fase 11B)

`TASK` (distinta de `CASE_TASK`, reutilizable por cualquier módulo): `organization_id`, `owner_type` (`customer|appointment|case|work_order|order`), `owner_id`, `title`, `description`, `assigned_to_user_id`, `due_date`, `priority`, `status`.
