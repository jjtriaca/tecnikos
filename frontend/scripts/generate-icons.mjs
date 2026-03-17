// Generate PWA icons from favicon SVG using sharp
import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const svgPath = join(publicDir, "favicon.svg");

// Read SVG and make it bigger for quality rendering
const svgContent = readFileSync(svgPath, "utf-8");

// Standard icon sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Maskable icon SVG (with extra padding for safe zone)
function makeMaskableSvg(size) {
  const padding = Math.round(size * 0.1); // 10% padding
  const innerSize = size - padding * 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#2563eb"/>
    <g transform="translate(${padding}, ${padding})">
      <svg width="${innerSize}" height="${innerSize}" viewBox="0 0 60 60">
        <rect x="11" y="11" width="34" height="7" rx="3.5" fill="white"/>
        <rect x="24.5" y="11" width="7" height="34" rx="3.5" fill="white"/>
        <path d="M45 21 C42 21, 39.5 23.5, 39.5 26.5 C39.5 30.5, 45 37, 45 37 C45 37, 50.5 30.5, 50.5 26.5 C50.5 23.5, 48 21, 45 21Z" fill="none" stroke="white" stroke-width="2.5" opacity="0.55"/>
        <circle cx="45" cy="26.5" r="2.5" fill="white" opacity="0.55"/>
      </svg>
    </g>
  </svg>`;
}

async function generate() {
  // Make the SVG render at high resolution
  const svgHighRes = svgContent.replace('width="32" height="32"', 'width="512" height="512"');

  for (const size of sizes) {
    await sharp(Buffer.from(svgHighRes))
      .resize(size, size)
      .png()
      .toFile(join(publicDir, "icons", `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  // Maskable icons (192 and 512)
  for (const size of [192, 512]) {
    await sharp(Buffer.from(makeMaskableSvg(size)))
      .resize(size, size)
      .png()
      .toFile(join(publicDir, "icons", `icon-maskable-${size}.png`));
    console.log(`Generated icon-maskable-${size}.png`);
  }

  // Apple touch icon (180x180)
  await sharp(Buffer.from(svgHighRes))
    .resize(180, 180)
    .png()
    .toFile(join(publicDir, "apple-touch-icon.png"));
  console.log("Generated apple-touch-icon.png");

  console.log("Done!");
}

generate().catch(console.error);
