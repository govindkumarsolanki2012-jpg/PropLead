import fs from 'fs';
import { Resvg } from '@resvg/resvg-js';

const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#FFFFFF" />

  <defs>
    <linearGradient id="roofGrad" x1="200" y1="200" x2="820" y2="780" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00A86B" />
      <stop offset="50%" stop-color="#009A60" />
      <stop offset="100%" stop-color="#008853" />
    </linearGradient>

    <linearGradient id="foldShadow" x1="180" y1="360" x2="512" y2="200" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00724E" />
      <stop offset="100%" stop-color="#00A86B" />
    </linearGradient>

    <linearGradient id="badgeGrad" x1="520" y1="620" x2="700" y2="800" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00B875" />
      <stop offset="100%" stop-color="#008853" />
    </linearGradient>
  </defs>

  <path d="M 660 250 L 750 250 L 750 360 L 660 300 Z" fill="#009A60" />
  <rect x="660" y="246" width="90" height="24" rx="8" fill="#00A86B" />

  <path d="M 512 180 L 780 390 A 40 40 0 0 1 796 420 L 796 730 A 40 40 0 0 1 756 770 L 670 770 L 670 480 A 20 20 0 0 0 650 460 L 512 350 L 374 460 A 20 20 0 0 0 354 480 L 354 770 L 268 770 A 40 40 0 0 1 228 730 L 228 420 A 40 40 0 0 1 244 390 Z" fill="url(#roofGrad)" />

  <path d="M 512 180 L 244 390 A 40 40 0 0 0 228 420 L 228 580 L 280 540 L 280 430 L 512 250 Z" fill="url(#foldShadow)" opacity="0.4" />

  <g>
    <circle cx="370" cy="550" r="48" fill="#8CE1C2" />
    <path d="M 300 680 C 300 615 330 600 370 600 C 410 600 440 615 440 680 Z" fill="#8CE1C2" />
  </g>

  <g>
    <circle cx="650" cy="550" r="48" fill="#8CE1C2" />
    <path d="M 580 680 C 580 615 610 600 650 600 C 690 600 720 615 720 680 Z" fill="#8CE1C2" />
  </g>

  <g>
    <circle cx="512" cy="520" r="62" fill="#00A86B" />
    <path d="M 380 770 C 380 660 435 630 512 630 C 589 630 644 660 644 770 Z" fill="#00A86B" />
  </g>

  <circle cx="616" cy="716" r="92" fill="#FFFFFF" />
  <circle cx="616" cy="716" r="82" fill="url(#badgeGrad)" />
  <path d="M 580 716 L 604 740 L 656 688" fill="none" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

fs.writeFileSync('public/logo.svg', svgContent);

const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: 1024 } });
const pngBuffer = resvg.render().asPng();

fs.writeFileSync('public/logo.png', pngBuffer);
fs.writeFileSync('src/assets/logo.png', pngBuffer);
fs.writeFileSync('public/favicon.png', pngBuffer);

const resvg192 = new Resvg(svgContent, { fitTo: { mode: 'width', value: 192 } });
fs.writeFileSync('public/icon-192.png', resvg192.render().asPng());

const resvg512 = new Resvg(svgContent, { fitTo: { mode: 'width', value: 512 } });
fs.writeFileSync('public/icon-512.png', resvg512.render().asPng());

console.log('Logos generated successfully!');
