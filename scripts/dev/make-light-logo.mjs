import sharp from "sharp";
import { join } from "path";
import { writeFileSync } from "fs";

const root = process.cwd();
const original = join(root, "public/exa-ati.png");

const { data, info } = await sharp(original)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const out = Buffer.from(data);
for (let i = 0; i < out.length; i += 4) {
  if (out[i + 3] < 20) continue;
  // Keep brand red (#a02525)
  if (out[i] > 100 && out[i] > out[i + 1] * 1.3) continue;
  // Remove dark plate (#161616) — becomes transparent
  out[i + 3] = 0;
}

const redOnly = await sharp(out, {
  raw: { width: info.width, height: info.height, channels: 4 },
}).png().toBuffer();

// Place charcoal "xa" where the original dark letters sat (after the stylized e)
const svg = `
<svg width="${info.width}" height="${info.height}" xmlns="http://www.w3.org/2000/svg">
  <text
    x="1550"
    y="1100"
    font-family="Arial, Helvetica, sans-serif"
    font-size="700"
    font-weight="500"
    fill="#2a2a28"
    letter-spacing="-8"
  >xa</text>
</svg>`;

const textPng = await sharp(Buffer.from(svg)).png().toBuffer();
const composed = await sharp(redOnly)
  .composite([{ input: textPng, blend: "over" }])
  .png()
  .toBuffer();

const trimmed = await sharp(composed).trim({ threshold: 0 }).png().toBuffer();
const finalPath = join(root, "public/exa-ati-light.png");
await sharp(trimmed).resize({ width: 720 }).png().toFile(finalPath);

const meta = await sharp(finalPath).metadata();
const { data: check, info: ci } = await sharp(finalPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const corner = [check[0], check[1], check[2], check[3]];
console.log({ meta, cornerAlpha: corner[3], corner });
