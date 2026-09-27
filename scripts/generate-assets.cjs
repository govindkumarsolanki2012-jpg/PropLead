const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

// Master SVG representation of the user's uploaded Green PropLead 3D Logo (sdf.png)
const masterSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background squircle vibrant emerald-green gradient matching sdf.png -->
    <linearGradient id="bgGrad" x1="120" y1="40" x2="900" y2="980" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00E676" />
      <stop offset="35%" stop-color="#05C46B" />
      <stop offset="70%" stop-color="#00A859" />
      <stop offset="100%" stop-color="#008844" />
    </linearGradient>

    <!-- Top highlight reflection -->
    <linearGradient id="topGlow" x1="512" y1="20" x2="512" y2="400" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>

    <!-- House 3D surface gradient -->
    <linearGradient id="houseGrad" x1="300" y1="180" x2="600" y2="750" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="60%" stop-color="#F6FCF8" />
      <stop offset="100%" stop-color="#E1F3E7" />
    </linearGradient>

    <!-- Bar chart gradients - Green shades matching sdf.png -->
    <linearGradient id="bar1Grad" x1="340" y1="580" x2="440" y2="760" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4ADE80" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="bar2Grad" x1="460" y1="510" x2="560" y2="730" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4ADE80" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="bar3Grad" x1="580" y1="440" x2="680" y2="690" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4ADE80" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>

    <!-- Lime-Green Upward Growth Arrow Gradient -->
    <linearGradient id="arrowGrad" x1="260" y1="780" x2="840" y2="400" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#84CC16" />
      <stop offset="35%" stop-color="#A3E635" />
      <stop offset="75%" stop-color="#4ADE80" />
      <stop offset="100%" stop-color="#86EFAC" />
    </linearGradient>

    <!-- Window glass gradient -->
    <linearGradient id="windowGrad" x1="440" y1="340" x2="560" y2="470" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#DCFCE7" />
    </linearGradient>

    <!-- Avatar gradient -->
    <linearGradient id="avatarGrad" x1="600" y1="680" x2="720" y2="880" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#D1FAE5" />
    </linearGradient>
  </defs>

  <!-- 1. Background Squircle -->
  <rect x="20" y="20" width="984" height="984" rx="224" fill="url(#bgGrad)" />
  
  <!-- Top Specular Gloss Highlight -->
  <path d="M 20 244 C 20 120 120 20 244 20 L 780 20 C 904 20 1004 120 1004 244 C 1004 350 750 420 512 420 C 274 420 20 350 20 244 Z" fill="url(#topGlow)" />

  <!-- 2. Main 3D House Structure -->
  <!-- Chimney -->
  <path d="M 648 248 L 730 248 L 730 380 L 648 300 Z" fill="#E8F8EE" />
  
  <!-- Main House Body with Overhanging Gable Roof -->
  <path d="M 512 172 
           L 772 384 C 794 402 788 438 760 448 C 738 456 714 444 700 428 
           L 700 740 C 700 762 682 780 660 780 
           L 364 780 C 342 780 324 762 324 740 
           L 324 428 
           C 310 444 286 456 264 448 C 236 438 230 402 252 384 
           Z" 
        fill="url(#houseGrad)" stroke="#FFFFFF" stroke-width="12" stroke-linejoin="round" />

  <!-- 4-Pane Window on House Gable -->
  <g transform="translate(438, 350)">
    <rect x="0" y="0" width="64" height="64" rx="14" fill="url(#windowGrad)" stroke="#FFFFFF" stroke-width="8" />
    <rect x="82" y="0" width="64" height="64" rx="14" fill="url(#windowGrad)" stroke="#FFFFFF" stroke-width="8" />
    <rect x="0" y="82" width="64" height="64" rx="14" fill="url(#windowGrad)" stroke="#FFFFFF" stroke-width="8" />
    <rect x="82" y="82" width="64" height="64" rx="14" fill="url(#windowGrad)" stroke="#FFFFFF" stroke-width="8" />
  </g>

  <!-- 3. Ascending Green Bar Chart Columns -->
  <!-- Bar 1 (Left) -->
  <rect x="342" y="590" width="102" height="168" rx="24" fill="url(#bar1Grad)" stroke="#BBF7D0" stroke-width="6" />
  <!-- Bar 2 (Middle) -->
  <rect x="460" y="520" width="104" height="238" rx="24" fill="url(#bar2Grad)" stroke="#BBF7D0" stroke-width="6" />
  <!-- Bar 3 (Right) -->
  <rect x="580" y="450" width="102" height="308" rx="24" fill="url(#bar3Grad)" stroke="#BBF7D0" stroke-width="6" />

  <!-- 4. Dynamic Lime-Green Growth Arrow (Sweeps up through the house) -->
  <path d="M 256 786 
           C 410 790 580 720 740 500 
           L 708 474 
           L 856 384 
           L 858 554 
           L 818 522 
           C 670 706 480 804 256 786 Z" 
        fill="url(#arrowGrad)" stroke="#FFFFFF" stroke-width="10" stroke-linejoin="round" />

  <!-- 5. Bottom Right: Checklist Clipboard & Agent Avatar -->
  <!-- Clipboard Board -->
  <rect x="700" y="660" width="184" height="226" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="6" />
  <!-- Green Header Clip -->
  <rect x="740" y="632" width="104" height="42" rx="14" fill="#059669" stroke="#34D399" stroke-width="4" />
  <circle cx="792" cy="652" r="8" fill="#FFFFFF" />

  <!-- Checklist rows (Checkmarks + horizontal bars in vibrant green) -->
  <!-- Row 1 -->
  <path d="M 724 722 L 736 734 L 758 710" stroke="#059669" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <rect x="778" y="716" width="86" height="12" rx="6" fill="#059669" />
  
  <!-- Row 2 -->
  <path d="M 724 772 L 736 784 L 758 760" stroke="#059669" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <rect x="778" y="766" width="86" height="12" rx="6" fill="#059669" />
  
  <!-- Row 3 -->
  <path d="M 724 822 L 736 834 L 758 810" stroke="#059669" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <rect x="778" y="816" width="86" height="12" rx="6" fill="#059669" />
  
  <!-- User Avatar Bust (Head + Shoulders) -->
  <!-- Head -->
  <circle cx="642" cy="746" r="44" fill="url(#avatarGrad)" stroke="#FFFFFF" stroke-width="8" />
  <!-- Shoulders -->
  <path d="M 556 888 C 556 824 594 798 642 798 C 690 798 728 824 728 888 Z" fill="url(#avatarGrad)" stroke="#FFFFFF" stroke-width="8" />
</svg>`;

// Foreground emblem only (for Android adaptive launcher icons with transparency)
const foregroundSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fgHouseGrad" x1="300" y1="180" x2="600" y2="750" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="60%" stop-color="#F6FCF8" />
      <stop offset="100%" stop-color="#E1F3E7" />
    </linearGradient>
    <linearGradient id="fgBar1Grad" x1="340" y1="580" x2="440" y2="760" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4ADE80" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="fgBar2Grad" x1="460" y1="510" x2="560" y2="730" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4ADE80" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="fgBar3Grad" x1="580" y1="440" x2="680" y2="690" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4ADE80" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="fgArrowGrad" x1="260" y1="780" x2="840" y2="400" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#84CC16" />
      <stop offset="35%" stop-color="#A3E635" />
      <stop offset="75%" stop-color="#4ADE80" />
      <stop offset="100%" stop-color="#86EFAC" />
    </linearGradient>
    <linearGradient id="fgWindowGrad" x1="440" y1="340" x2="560" y2="470" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#DCFCE7" />
    </linearGradient>
    <linearGradient id="fgAvatarGrad" x1="600" y1="680" x2="720" y2="880" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#D1FAE5" />
    </linearGradient>
  </defs>

  <g transform="scale(0.72) translate(199, 199)">
    <!-- Chimney -->
    <path d="M 648 248 L 730 248 L 730 380 L 648 300 Z" fill="#E8F8EE" />
    
    <!-- House Body -->
    <path d="M 512 172 
             L 772 384 C 794 402 788 438 760 448 C 738 456 714 444 700 428 
             L 700 740 C 700 762 682 780 660 780 
             L 364 780 C 342 780 324 762 324 740 
             L 324 428 
             C 310 444 286 456 264 448 C 236 438 230 402 252 384 
             Z" 
          fill="url(#fgHouseGrad)" stroke="#FFFFFF" stroke-width="12" stroke-linejoin="round" />

    <!-- 4-Pane Window -->
    <g transform="translate(438, 350)">
      <rect x="0" y="0" width="64" height="64" rx="14" fill="url(#fgWindowGrad)" stroke="#FFFFFF" stroke-width="8" />
      <rect x="82" y="0" width="64" height="64" rx="14" fill="url(#fgWindowGrad)" stroke="#FFFFFF" stroke-width="8" />
      <rect x="0" y="82" width="64" height="64" rx="14" fill="url(#fgWindowGrad)" stroke="#FFFFFF" stroke-width="8" />
      <rect x="82" y="82" width="64" height="64" rx="14" fill="url(#fgWindowGrad)" stroke="#FFFFFF" stroke-width="8" />
    </g>

    <!-- Bars -->
    <rect x="342" y="590" width="102" height="168" rx="24" fill="url(#fgBar1Grad)" stroke="#BBF7D0" stroke-width="6" />
    <rect x="460" y="520" width="104" height="238" rx="24" fill="url(#fgBar2Grad)" stroke="#BBF7D0" stroke-width="6" />
    <rect x="580" y="450" width="102" height="308" rx="24" fill="url(#fgBar3Grad)" stroke="#BBF7D0" stroke-width="6" />

    <!-- Lime Arrow -->
    <path d="M 256 786 
             C 410 790 580 720 740 500 
             L 708 474 
             L 856 384 
             L 858 554 
             L 818 522 
             C 670 706 480 804 256 786 Z" 
          fill="url(#fgArrowGrad)" stroke="#FFFFFF" stroke-width="10" stroke-linejoin="round" />

    <!-- Clipboard & Avatar -->
    <rect x="700" y="660" width="184" height="226" rx="28" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="6" />
    <rect x="740" y="632" width="104" height="42" rx="14" fill="#059669" stroke="#34D399" stroke-width="4" />
    <circle cx="792" cy="652" r="8" fill="#FFFFFF" />

    <path d="M 724 722 L 736 734 L 758 710" stroke="#059669" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <rect x="778" y="716" width="86" height="12" rx="6" fill="#059669" />
    <path d="M 724 772 L 736 784 L 758 760" stroke="#059669" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <rect x="778" y="766" width="86" height="12" rx="6" fill="#059669" />
    <path d="M 724 822 L 736 834 L 758 810" stroke="#059669" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <rect x="778" y="816" width="86" height="12" rx="6" fill="#059669" />

    <circle cx="642" cy="746" r="44" fill="url(#fgAvatarGrad)" stroke="#FFFFFF" stroke-width="8" />
    <path d="M 556 888 C 556 824 594 798 642 798 C 690 798 728 824 728 888 Z" fill="url(#fgAvatarGrad)" stroke="#FFFFFF" stroke-width="8" />
  </g>
</svg>`;

function renderPng(svgContent, width, height) {
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: width,
    },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

const publicDir = path.join(__dirname, '../public');
const srcAssetsDir = path.join(__dirname, '../src/assets');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(srcAssetsDir)) fs.mkdirSync(srcAssetsDir, { recursive: true });

console.log('Writing Green 3D Logo SVGs...');
fs.writeFileSync(path.join(publicDir, 'logo.svg'), masterSvg);
fs.writeFileSync(path.join(publicDir, 'logo-foreground.svg'), foregroundSvg);

console.log('Rendering Web and PWA logo PNGs...');
const master512 = renderPng(masterSvg, 512, 512);
const master192 = renderPng(masterSvg, 192, 192);
const master64 = renderPng(masterSvg, 64, 64);

fs.writeFileSync(path.join(publicDir, 'logo.png'), master512);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), master192);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), master512);
fs.writeFileSync(path.join(publicDir, 'favicon.png'), master64);
fs.writeFileSync(path.join(srcAssetsDir, 'logo.png'), master512);

// Render Android mipmap icons
const densities = [
  { name: 'mipmap-mdpi', size: 48, fgSize: 108 },
  { name: 'mipmap-hdpi', size: 72, fgSize: 162 },
  { name: 'mipmap-xhdpi', size: 96, fgSize: 216 },
  { name: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
  { name: 'mipmap-xxxhdpi', size: 192, fgSize: 432 }
];

console.log('Rendering Android mipmap launcher icons...');
densities.forEach(d => {
  const dir = path.join(__dirname, `../android/app/src/main/res/${d.name}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), renderPng(masterSvg, d.size, d.size));
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), renderPng(masterSvg, d.size, d.size));
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), renderPng(foregroundSvg, d.fgSize, d.fgSize));
});

// Render splash drawables
const drawables = [
  { name: 'drawable', size: 192 },
  { name: 'drawable-hdpi', size: 144 },
  { name: 'drawable-mdpi', size: 96 },
  { name: 'drawable-xhdpi', size: 192 },
  { name: 'drawable-xxhdpi', size: 288 },
  { name: 'drawable-xxxhdpi', size: 384 }
];

console.log('Rendering Android splash drawables...');
drawables.forEach(dr => {
  const dir = path.join(__dirname, `../android/app/src/main/res/${dr.name}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'splash_icon_static.png'), renderPng(masterSvg, dr.size, dr.size));
});

console.log('All Green 3D PropLead Logo assets generated successfully!');
