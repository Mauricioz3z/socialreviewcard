// Prerenders the landing AND every programmatic-SEO use-case page into static
// HTML so crawlers get real content in the page source. The client still
// mounts React over it. nginx's `try_files $uri $uri/` serves
// dist/<slug>/index.html directly for each route.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const ORIGIN = 'https://socialreviewcard.com';
const tpl = readFileSync('dist/index.html', 'utf-8');
const { render, seoRoutes } = await import('./dist-ssr/entry-server.js');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Swaps the homepage meta tags in the template for route-specific ones. */
function withMeta(html, { title, description, url }) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[\s\S]*?(")/,
      `$1${esc(description)}$2`,
    )
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(
      /(<meta\s+property="og:description"\s+content=")[\s\S]*?(")/,
      `$1${esc(description)}$2`,
    )
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(
      /(<meta\s+name="twitter:description"\s+content=")[\s\S]*?(")/,
      `$1${esc(description)}$2`,
    );
}

// 1. Homepage keeps the template's own meta tags.
writeFileSync('dist/index.html', tpl.replace('<div id="root"></div>', `<div id="root">${render('/')}</div>`));
console.log('✓ Prerendered "/" into dist/index.html');

// 2. One folder + index.html per use case, with page-specific meta tags.
for (const route of seoRoutes) {
  const html = withMeta(tpl, {
    title: route.title,
    description: route.description,
    url: `${ORIGIN}/${route.slug}`,
  }).replace('<div id="root"></div>', `<div id="root">${render('/' + route.slug)}</div>`);
  mkdirSync(`dist/${route.slug}`, { recursive: true });
  writeFileSync(`dist/${route.slug}/index.html`, html);
}
console.log(`✓ Prerendered ${seoRoutes.length} use-case pages`);

// 3. Regenerate the sitemap so new use-case pages are always included.
const today = new Date().toISOString().slice(0, 10);
const urlXml = (loc, priority, changefreq = 'weekly') =>
  `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  urlXml(`${ORIGIN}/`, '1.0'),
  urlXml(`${ORIGIN}/app`, '0.8', 'monthly'),
  ...seoRoutes.map((r) => urlXml(`${ORIGIN}/${r.slug}`, '0.7')),
  '</urlset>',
  '',
].join('\n');
writeFileSync('dist/sitemap.xml', sitemap);
console.log(`✓ Generated sitemap.xml with ${2 + seoRoutes.length} URLs`);
