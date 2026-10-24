export interface FaqItem {
  question: string;
  answer: string;
}

/** Preguntas visibles en la home; el mismo contenido alimenta el JSON-LD FAQPage (debe coincidir). */
export const FAQ: readonly FaqItem[] = [
  {
    question: "¿Qué es Bacss Citas?",
    answer:
      "Es una plataforma web para gestionar citas, clientes, servicios, profesionales, horarios y pagos de un negocio, con reportes y módulos especializados según el rubro.",
  },
  {
    question: "¿Para qué tipo de negocios sirve?",
    answer:
      "Para negocios que atienden por cita. Incluye módulos para talleres de motos, laboratorios clínicos, tiendas con lanzamientos y despachos de abogados; cada empresa activa solo los que necesita.",
  },
  {
    question: "¿Cómo evita las reservas duplicadas?",
    answer:
      "Antes de confirmar una cita el sistema valida el horario del profesional, los descansos, feriados y ausencias, y bloquea dos reservas simultáneas para el mismo turno.",
  },
  {
    question: "¿Mis datos están separados de los de otras empresas?",
    answer:
      "Sí. Cada empresa trabaja en un espacio aislado: sus usuarios solo pueden ver y modificar los datos de su propia organización, con roles y permisos por usuario.",
  },
  {
    question: "¿Se envían recordatorios a los clientes?",
    answer:
      "Sí, por correo electrónico antes de cada cita. El envío por WhatsApp y SMS todavía no está disponible.",
  },
];
