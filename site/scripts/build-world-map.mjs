/**
 * 把 world-atlas 的 TopoJSON 预渲染成 SVG path，运行时零依赖。
 *
 * 输出：public/assets/world-map.json
 *   { width, height, countries: [{ code: 'CN', name: 'China', d: 'M…' }] }
 *
 * Cloudflare 的 request.cf.country 给的是 ISO alpha-2，而 world-atlas 的 id
 * 是 ISO numeric，所以这里用 i18n-iso-countries 做一次转换并写进数据里。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import iso from 'i18n-iso-countries';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = process.argv[2] || '/tmp/countries-110m.json';

const topo = JSON.parse(readFileSync(source, 'utf8'));
const collection = feature(topo, topo.objects.countries);

const width = 960;
const height = 500;

const projection = geoNaturalEarth1()
  .scale(width / 2 / Math.PI)
  .translate([width / 2, height / 2]);

const path = geoPath(projection);

const countries = collection.features
  .map((item) => {
    const numeric = String(item.id).padStart(3, '0');
    const code = iso.numericToAlpha2(numeric) || null;
    const d = path(item);
    if (!code || !d) return null;
    return { code, name: item.properties?.name || code, d };
  })
  .filter(Boolean);

const output = { width, height, countries };
const target = resolve(root, 'public/assets/world-map.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(output));

console.log(`wrote ${countries.length} countries -> ${target}`);
