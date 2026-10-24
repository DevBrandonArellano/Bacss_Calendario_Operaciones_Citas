import { FAQ } from "./faq.ts";
import { HOME_PAGE, SITE_NAME, type PageSeo } from "./pages.ts";

type JsonLdNode = Record<string, unknown>;

/**
 * Solo se marca lo que la página muestra de verdad: sin precios, valoraciones,
 * direcciones ni horarios inventados. Nada de esto se incluye en el área privada.
 */
export function buildStructuredData(page: PageSeo, siteUrl: string): JsonLdNode {
  const graph: JsonLdNode[] = [
    { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: SITE_NAME, url: `${siteUrl}/` },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: SITE_NAME,
      url: `${siteUrl}/`,
      inLanguage: "es",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ];

  if (page.path === HOME_PAGE.path) {
    graph.push(
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${siteUrl}/`,
        inLanguage: "es",
        description: HOME_PAGE.description,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      }
    );
  } else if (page.breadcrumb) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: page.breadcrumb, item: `${siteUrl}${page.path}` },
      ],
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
