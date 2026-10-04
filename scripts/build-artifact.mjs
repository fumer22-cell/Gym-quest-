// Inline the artifact bundle into a page fragment (the artifact host adds doctype/head/body).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dir = 'dist-artifact';
const files = readdirSync(dir);
const js = readFileSync(`${dir}/app.js`, 'utf8').replace(/<\/script/gi, '<\\/script');
const cssFile = files.find((f) => f.endsWith('.css'));
const css = cssFile ? readFileSync(`${dir}/${cssFile}`, 'utf8').replace(/<\/style/gi, '<\\/style') : '';
const icon = readFileSync('public/icon.svg', 'utf8');

const html = `<title>Gym Quest</title>
<meta name="theme-color" content="#14121c">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync('artifact/gym-quest.html', html);
console.log(`artifact/gym-quest.html: ${(html.length / 1024).toFixed(0)} KB`);
