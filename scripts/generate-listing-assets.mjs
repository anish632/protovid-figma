import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from '../backend/node_modules/sharp/lib/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets/listing/v2');
const width = 1920;
const height = 1080;

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tspans(lines, x, y, size, lineHeight, weight = 800, fill = '#ffffff') {
  return `
    <text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="0">
      ${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`).join('')}
    </text>
  `;
}

function pill(x, y, text, fill = '#153d2b', stroke = 'rgba(255,255,255,0.08)', textFill = '#ffffff') {
  const w = text.length * 13 + 34;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="42" rx="12" fill="${fill}" stroke="${stroke}" />
    <text x="${x + w / 2}" y="${y + 27}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="${textFill}">${esc(text)}</text>
  `;
}

function phone(x, y, label, color = '#c7d2fe') {
  return `
    <g transform="translate(${x}, ${y})">
      <rect width="132" height="192" rx="22" fill="#ffffff" />
      <rect x="22" y="24" width="88" height="16" rx="8" fill="#dbe3ea" />
      <rect x="28" y="56" width="76" height="88" rx="10" fill="${color}" />
      <text x="66" y="166" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" fill="#64748b">${esc(label)}</text>
    </g>
  `;
}

function flowDiagram(x, y, scale = 1) {
  return `
    <g transform="translate(${x}, ${y}) scale(${scale})">
      <rect x="0" y="0" width="520" height="270" rx="28" fill="#101827" />
      ${phone(54, 44, 'Home', '#bfdbfe')}
      ${phone(198, 44, 'Checkout', '#fecdd3')}
      ${phone(342, 44, 'Success', '#bbf7d0')}
      <path d="M154 134 H194" stroke="#38bdf8" stroke-width="8" stroke-linecap="round" />
      <path d="M184 118 L202 134 L184 150" fill="none" stroke="#38bdf8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M298 134 H338" stroke="#38bdf8" stroke-width="8" stroke-linecap="round" />
      <path d="M328 118 L346 134 L328 150" fill="none" stroke="#38bdf8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
    </g>
  `;
}

function logo(iconData) {
  return `
    <g transform="translate(120, 94)">
      <image href="data:image/png;base64,${iconData}" x="0" y="0" width="58" height="58" />
      <text x="78" y="38" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="900" fill="#ffffff">ProtoVid</text>
      <rect x="0" y="78" width="134" height="38" rx="12" fill="#172033" />
      <text x="67" y="103" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="800" fill="#dbeafe">Figma plugin</text>
    </g>
  `;
}

function background() {
  return `
    <rect width="${width}" height="${height}" fill="#070808" />
    <circle cx="1800" cy="80" r="310" fill="#4b1719" opacity="0.55" />
    <circle cx="120" cy="1010" r="340" fill="#0f5132" opacity="0.65" />
    <circle cx="1660" cy="1040" r="360" fill="#0b3d2c" opacity="0.55" />
    <path d="M0 950 C320 830 500 970 760 860 C1060 730 1300 870 1620 760 C1770 710 1860 730 1920 760 V1080 H0 Z" fill="#092019" opacity="0.62" />
  `;
}

function mp4Card(x, y, scale = 1) {
  return `
    <g transform="translate(${x}, ${y}) scale(${scale})">
      <rect width="520" height="152" rx="26" fill="#ffffff" />
      <rect x="40" y="48" width="56" height="56" rx="13" fill="#020617" />
      <path d="M61 62 L83 76 L61 90 Z" fill="#ffffff" />
      <text x="128" y="72" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="900" fill="#0f172a">Prototype walkthrough.mp4</text>
      <text x="128" y="106" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="#64748b">Ready for reviews, decks, docs, and handoff</text>
    </g>
  `;
}

function pluginPanel(x, y, title = 'Export Settings') {
  return `
    <g transform="translate(${x}, ${y})">
      <rect width="420" height="540" rx="28" fill="#ffffff" />
      <text x="40" y="74" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="900" fill="#0f172a">ProtoVid</text>
      <rect x="40" y="108" width="340" height="72" rx="16" fill="#f8fafc" stroke="#e5e7eb" />
      <text x="62" y="140" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="#64748b">Prototype Info</text>
      <text x="62" y="166" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="#0f172a">Found 8 prototype frames</text>
      <text x="40" y="232" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="900" fill="#0f172a">${esc(title)}</text>
      <rect x="40" y="260" width="340" height="58" rx="14" fill="#f8fafc" stroke="#d1d5db" />
      <text x="62" y="297" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="800" fill="#0f172a">720p</text>
      <rect x="40" y="342" width="340" height="58" rx="14" fill="#eff6ff" stroke="#60a5fa" />
      <text x="62" y="379" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="900" fill="#1d4ed8">MP4</text>
      <rect x="40" y="440" width="340" height="64" rx="16" fill="#3b82f6" />
      <text x="210" y="481" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="21" font-weight="900" fill="#ffffff">Export Free MP4</text>
    </g>
  `;
}

function successPanel(x, y) {
  return `
    <g transform="translate(${x}, ${y})">
      <rect width="460" height="560" rx="30" fill="#ffffff" />
      <circle cx="230" cy="76" r="34" fill="#dcfce7" />
      <path d="M214 76 L225 88 L248 60" fill="none" stroke="#16a34a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
      <text x="230" y="144" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="900" fill="#0f172a">Prototype Video Exported</text>
      <rect x="48" y="184" width="364" height="162" rx="18" fill="#f8fafc" stroke="#e5e7eb" />
      <text x="76" y="228" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="#64748b">Duration</text>
      <text x="310" y="228" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="900" fill="#0f172a">16s / 8 frames</text>
      <text x="76" y="276" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="#64748b">Resolution</text>
      <text x="310" y="276" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="900" fill="#0f172a">720p MP4</text>
      <text x="76" y="322" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="#64748b">File</text>
      <text x="310" y="322" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="900" fill="#0f172a">walkthrough.mp4</text>
      <rect x="48" y="382" width="364" height="70" rx="18" fill="#3b82f6" />
      <text x="230" y="426" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900" fill="#ffffff">Download MP4</text>
      <text x="230" y="500" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="#64748b">Review-ready artifact, no editor timeline</text>
    </g>
  `;
}

function freeProCompare(x, y) {
  return `
    <g transform="translate(${x}, ${y})">
      <g>
        <rect width="430" height="250" rx="26" fill="#ffffff" opacity="0.96" />
        <text x="36" y="60" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="900" fill="#0f172a">Free proof</text>
        <rect x="36" y="88" width="358" height="124" rx="18" fill="#111827" />
        ${phone(88, 114, 'Home', '#bfdbfe')}
        ${phone(218, 114, 'Done', '#bbf7d0')}
        <rect x="36" y="188" width="358" height="24" rx="0" fill="#020617" opacity="0.85" />
        <text x="215" y="205" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="900" fill="#ffffff">Made with ProtoVid</text>
      </g>
      <g transform="translate(474, 0)">
        <rect width="430" height="250" rx="26" fill="#ffffff" opacity="0.96" />
        <text x="36" y="60" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="900" fill="#0f172a">Pro delivery</text>
        <rect x="36" y="88" width="358" height="124" rx="18" fill="#111827" />
        ${phone(88, 114, 'Home', '#bfdbfe')}
        ${phone(218, 114, 'Done', '#bbf7d0')}
        <rect x="36" y="216" width="130" height="32" rx="10" fill="#dcfce7" />
        <text x="101" y="238" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="900" fill="#166534">No watermark</text>
        <rect x="180" y="216" width="96" height="32" rx="10" fill="#dbeafe" />
        <text x="228" y="238" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="900" fill="#1d4ed8">HD/4K</text>
      </g>
    </g>
  `;
}

function shell(content) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#000000" flood-opacity="0.30"/>
        </filter>
      </defs>
      ${background()}
      ${content}
    </svg>
  `;
}

function thumbnail(iconData) {
  return shell(`
    ${logo(iconData)}
    ${tspans(['Export Figma', 'prototypes as', 'MP4 videos'], 120, 350, 78, 82)}
    ${tspans(['Turn connected flows into client-ready MP4s', 'for reviews, decks, docs, and handoff.'], 120, 620, 34, 46, 700, '#cbd5e1')}
    ${pill(120, 750, 'Auto-detect flows')}
    ${pill(366, 750, 'MP4 output', '#1f2937')}
    ${pill(555, 750, 'No screen recording', '#1f2937')}
    <g filter="url(#shadow)">
      <rect x="1040" y="250" width="660" height="440" rx="34" fill="#ffffff" />
      ${flowDiagram(1110, 315, 1)}
      ${mp4Card(1110, 615, 1)}
    </g>
  `);
}

function slideDetect(iconData) {
  return shell(`
    ${logo(iconData)}
    ${tspans(['Auto-detect connected', 'prototype flows'], 120, 360, 72, 78)}
    ${tspans(['Find connected frames on the current page.', 'Export the walkthrough in order.'], 120, 560, 34, 46, 700, '#cbd5e1')}
    ${pill(120, 700, 'Current page')}
    ${pill(326, 700, 'Connected frames', '#1f2937')}
    ${pill(586, 700, 'MP4-ready', '#1f2937')}
    <g filter="url(#shadow)">
      ${flowDiagram(1020, 270, 1.08)}
      ${pluginPanel(1240, 520, 'Prototype Info')}
    </g>
  `);
}

function slideSuccess(iconData) {
  return shell(`
    ${logo(iconData)}
    ${tspans(['Export a shareable', 'MP4 walkthrough'], 120, 360, 76, 82)}
    ${tspans(['Skip screen recording.', 'Download a clean walkthrough file.'], 120, 560, 34, 46, 700, '#cbd5e1')}
    ${pill(120, 705, 'Download MP4')}
    ${pill(354, 705, 'Review-ready', '#1f2937')}
    ${pill(583, 705, 'No editing timeline', '#1f2937')}
    <g filter="url(#shadow)">
      ${successPanel(1080, 250)}
      ${mp4Card(1030, 790, 1.1)}
    </g>
  `);
}

function slideFree(iconData) {
  return shell(`
    ${logo(iconData)}
    ${tspans(['Start free with', '3 MP4 exports'], 120, 360, 76, 82)}
    ${tspans(['Try the workflow with 3 free watermarked exports.', 'Upgrade when you need a client-ready file.'], 120, 560, 34, 46, 700, '#cbd5e1')}
    ${pill(120, 705, '3 free exports/month')}
    ${pill(432, 705, '720p MP4', '#1f2937')}
    ${pill(620, 705, 'Watermarked', '#1f2937')}
    <g filter="url(#shadow)">
      ${pluginPanel(1060, 270, 'Export Settings')}
    </g>
  `);
}

function slidePro(iconData) {
  return shell(`
    ${logo(iconData)}
    ${tspans(['Remove the watermark', 'and export in HD'], 120, 360, 74, 80)}
    ${tspans(['No watermark, HD/4K, and unlimited repeat exports.', 'Built for client iteration.'], 120, 560, 34, 46, 700, '#cbd5e1')}
    ${pill(120, 705, 'No watermark')}
    ${pill(342, 705, '1080p / 4K', '#1f2937')}
    ${pill(568, 705, 'Unlimited exports', '#1f2937')}
    <g filter="url(#shadow)">
      ${freeProCompare(920, 460)}
    </g>
  `);
}

const files = [
  ['protovid-thumbnail.png', thumbnail],
  ['protovid-carousel-1-detect.png', slideDetect],
  ['protovid-carousel-2-success.png', slideSuccess],
  ['protovid-carousel-3-free.png', slideFree],
  ['protovid-carousel-4-pro.png', slidePro],
];

await fs.mkdir(outDir, { recursive: true });
const iconPath = (await fs.stat(path.join(root, 'protovid-icon.png')).catch(() => null))
  ? path.join(root, 'protovid-icon.png')
  : path.join(root, 'logo128x128.png');
const iconData = await fs.readFile(iconPath, 'base64');

for (const [filename, render] of files) {
  const svg = render(iconData);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(outDir, filename));
  console.log(`wrote ${path.relative(root, path.join(outDir, filename))}`);
}
