import { describe, expect, it } from "vitest";

import { buildRobotsTxt, buildSitemapXml } from "../../build/seoPlugin";
import { FAQ } from "@/seo/faq";
import { buildHeadTags } from "@/seo/head";
import { PRIVATE_PAGE, PRIVATE_PATHS, PUBLIC_PAGES, findPublicPage } from "@/seo/pages";

const SITE = "https://citas.ejemplo.com";

describe("metadatos por página pública", () => {
  it("cada ruta tiene título y descripción únicos", () => {
    const titles = PUBLIC_PAGES.map((page) => page.title);
    const descriptions = PUBLIC_PAGES.map((page) => page.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("título y descripción respetan longitudes razonables", () => {
    for (const page of PUBLIC_PAGES) {
      expect(page.title.length, page.path).toBeLessThanOrEqual(65);
      expect(page.description.length, page.path).toBeGreaterThanOrEqual(120);
      expect(page.description.length, page.path).toBeLessThanOrEqual(170);
    }
  });

  it("cada página pública tiene un H1 propio y distinto", () => {
    const h1s = PUBLIC_PAGES.map((page) => page.h1);
    expect(h1s.every((h1) => h1.length > 0)).toBe(true);
    expect(new Set(h1s).size).toBe(h1s.length);
  });

  it("tolera la barra final al resolver la ruta", () => {
    expect(findPublicPage("/funcionalidades/")?.path).toBe("/funcionalidades");
    expect(findPublicPage("/dashboard")).toBeUndefined();
  });
});

describe("buildHeadTags", () => {
  it("páginas públicas: canonical propio, Open Graph y JSON-LD válido", () => {
    for (const page of PUBLIC_PAGES) {
      const head = buildHeadTags(page, SITE);
      const canonical = page.path === "/" ? `${SITE}/` : `${SITE}${page.path}`;
      expect(head).toContain(`<link rel="canonical" href="${canonical}" />`);
      expect(head).toContain('content="index, follow');
      expect(head).toContain('property="og:url"');

      const json = /<script type="application\/ld\+json">(.*)<\/script>/s.exec(head)?.[1];
      expect(() => JSON.parse(json ?? "")).not.toThrow();
    }
  });

  it("el área privada es noindex y no publica canonical, OG ni datos estructurados", () => {
    const head = buildHeadTags(PRIVATE_PAGE, SITE);
    expect(head).toContain("noindex, nofollow");
    expect(head).not.toContain("canonical");
    expect(head).not.toContain("og:");
    expect(head).not.toContain("ld+json");
  });

  it("un título hostil no puede cerrar el script ni inyectar HTML", () => {
    const hostile = { ...PUBLIC_PAGES[0], title: '</title><script>alert("x")</script>' };
    const head = buildHeadTags(hostile, SITE);
    expect(head).not.toContain("<script>alert");
  });

  it("el JSON-LD de la home refleja exactamente las preguntas visibles", () => {
    const head = buildHeadTags(PUBLIC_PAGES[0], SITE);
    const json = JSON.parse(/<script type="application\/ld\+json">(.*)<\/script>/s.exec(head)![1]);
    const faq = json["@graph"].find((node: { "@type": string }) => node["@type"] === "FAQPage");
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(FAQ.map((item) => item.question));
  });

  it("las subpáginas incluyen BreadcrumbList y no FAQPage", () => {
    const head = buildHeadTags(PUBLIC_PAGES[1], SITE);
    expect(head).toContain("BreadcrumbList");
    expect(head).not.toContain("FAQPage");
  });
});

describe("robots.txt y sitemap.xml", () => {
  it("robots permite el sitio y declara el sitemap", () => {
    const robots = buildRobotsTxt(SITE);
    expect(robots).toContain("User-agent: *\nAllow: /");
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(robots).not.toMatch(/^Disallow: \/$/m);
  });

  it("robots nunca bloquea una página pública indexable", () => {
    for (const page of PUBLIC_PAGES.filter((p) => p.path !== "/")) {
      const blocked = PRIVATE_PATHS.some((privatePath) => page.path.startsWith(privatePath));
      expect(blocked, page.path).toBe(false);
    }
  });

  it("el sitemap lista las páginas públicas, ninguna privada y no inventa lastmod", () => {
    const sitemap = buildSitemapXml(SITE);
    for (const page of PUBLIC_PAGES) {
      expect(sitemap).toContain(`<loc>${page.path === "/" ? `${SITE}/` : `${SITE}${page.path}`}</loc>`);
    }
    for (const privatePath of PRIVATE_PATHS) {
      expect(sitemap).not.toContain(`${SITE}${privatePath}`);
    }
    expect(sitemap).not.toContain("lastmod");
  });
});
