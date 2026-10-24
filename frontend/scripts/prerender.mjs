// Genera el HTML estático de cada página pública para que los buscadores reciban
// contenido real y metadatos propios sin ejecutar JavaScript.
//   dist/index.html, dist/funcionalidades/index.html, ... → páginas públicas (indexables)
//   dist/app.html → shell del SPA para rutas privadas (noindex, sin contenido)
// Se ejecuta desde `npm run build` tras `vite build` y `vite build --ssr`.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Antes de importar React/Router: evita sus builds de desarrollo (avisos de SSR).
process.env.NODE_ENV = "production";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const SSR_DIR = path.join(ROOT, "dist-ssr");
const BODY_PLACEHOLDER = "<!--app-html-->";
const HEAD_PATTERN = /<!--seo-head-start-->[\s\S]*?<!--seo-head-end-->/;

const { render, headFor, privateHead, publicPaths } = await import(
  pathToFileURL(path.join(SSR_DIR, "entry-server.js")).href
);
const template = await readFile(path.join(DIST_DIR, "index.html"), "utf-8");

if (!HEAD_PATTERN.test(template) || !template.includes(BODY_PLACEHOLDER)) {
  throw new Error("dist/index.html no tiene los marcadores SEO/pre-render esperados");
}

function fillTemplate(head, body) {
  // Reemplazo por función: el HTML puede contener "$&" u otros patrones especiales.
  return template
    .replace(HEAD_PATTERN, () => `<!--seo-head-start-->\n    ${head}\n    <!--seo-head-end-->`)
    .replace(BODY_PLACEHOLDER, () => body);
}

function outputFileFor(urlPath) {
  return urlPath === "/" ? path.join(DIST_DIR, "index.html") : path.join(DIST_DIR, urlPath, "index.html");
}

// El shell privado se escribe primero: después se sobrescribe index.html con la home.
await writeFile(path.join(DIST_DIR, "app.html"), fillTemplate(privateHead, ""));

for (const urlPath of publicPaths) {
  const file = outputFileFor(urlPath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, fillTemplate(headFor(urlPath), render(urlPath)));
}

await rm(SSR_DIR, { recursive: true, force: true });
console.log(`Pre-renderizadas ${publicPaths.length} páginas públicas + app.html (shell privado)`);
