/**
 * Fuente única de la verdad del SEO por ruta. La consumen el build (head
 * estático, sitemap), el servidor de pre-render y el cliente (navegación SPA),
 * para que título, descripción y canonical nunca diverjan entre capas.
 *
 * Los imports de este directorio usan extensión `.ts` porque `vite.config.ts`
 * los carga directamente con Node, sin alias ni bundler.
 */
export const SITE_NAME = "Bacss Citas";

export interface PageSeo {
  path: string;
  title: string;
  description: string;
  /** Texto del H1 visible; se usa también para validar la coherencia título/H1 en tests. */
  h1: string;
  indexable: boolean;
  /** Nombre en la miga de pan (BreadcrumbList); la home no lleva. */
  breadcrumb?: string;
}

export const HOME_PAGE: PageSeo = {
  path: "/",
  title: `Software de agendamiento de citas online | ${SITE_NAME}`,
  description:
    "Gestiona agenda, clientes, pagos y recordatorios en un solo lugar. Reservas sin choques de horario para talleres, laboratorios, tiendas y despachos.",
  h1: "Software de agendamiento de citas para tu negocio",
  indexable: true,
};

export const FEATURES_PAGE: PageSeo = {
  path: "/funcionalidades",
  title: `Funciones para gestionar citas y clientes | ${SITE_NAME}`,
  description:
    "Agenda con control de horarios, recordatorios por correo, clientes, registro de pagos, reportes y roles de acceso. Conoce todo lo que incluye Bacss Citas.",
  h1: "Funciones para gestionar citas, clientes y horarios",
  indexable: true,
  breadcrumb: "Funcionalidades",
};

export const BUSINESSES_PAGE: PageSeo = {
  path: "/para-negocios",
  title: `Agendamiento de citas para tu rubro | ${SITE_NAME}`,
  description:
    "Módulos para talleres de motos, laboratorios clínicos, tiendas y despachos de abogados sobre una misma plataforma de agenda. Descubre cuál encaja contigo.",
  h1: "Software de citas para talleres, laboratorios, tiendas y despachos",
  indexable: true,
  breadcrumb: "Para negocios",
};

/** Páginas indexables. Una página pública nueva se agrega aquí y aparece sola en sitemap y pre-render. */
export const PUBLIC_PAGES: readonly PageSeo[] = [HOME_PAGE, FEATURES_PAGE, BUSINESSES_PAGE];

/** Área autenticada: título genérico y `noindex`, sin datos de la organización. */
export const PRIVATE_PAGE: PageSeo = {
  path: "/app",
  title: `Panel de gestión | ${SITE_NAME}`,
  description: "Área privada de Bacss Citas.",
  h1: "",
  indexable: false,
};

/** Rutas del área autenticada: no tienen valor de búsqueda y no deben rastrearse. */
export const PRIVATE_PATHS = [
  "/dashboard",
  "/reportes",
  "/buscar",
  "/clientes",
  "/servicios",
  "/profesionales",
  "/citas",
  "/notificaciones",
  "/pagos",
  "/motos",
  "/ordenes-trabajo",
  "/laboratorio",
  "/tienda",
  "/legal",
  "/login",
] as const;

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function findPublicPage(pathname: string): PageSeo | undefined {
  const path = normalizePath(pathname);
  return PUBLIC_PAGES.find((page) => page.path === path);
}
