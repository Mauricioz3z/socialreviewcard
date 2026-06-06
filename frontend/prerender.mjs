// Injects the statically-rendered landing HTML into dist/index.html so crawlers
// get real content in the page source. The client still mounts React over it.
import { readFileSync, writeFileSync } from 'node:fs';

const tpl = readFileSync('dist/index.html', 'utf-8');
const { render } = await import('./dist-ssr/entry-server.js');
const html = render();

const out = tpl.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
writeFileSync('dist/index.html', out);
console.log('✓ Prerendered "/" into dist/index.html');
