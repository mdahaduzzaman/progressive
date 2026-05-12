// Renders PNG icons for the PWA without any external dependencies.
// Draws the same artwork as public/icons/icon.svg:
//   - a rounded square with a diagonal gradient
//   - a centered white checkmark
// Outputs:
//   public/icons/icon-192.png
//   public/icons/icon-512.png
//   public/icons/maskable-512.png  (with safe-zone padding)
//   public/icons/apple-touch-icon.png (180×180)

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../public/icons");
mkdirSync(outDir, { recursive: true });

// --- PNG encoder (RGBA, 8-bit, no compression filtering tricks) -------------

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const filtered = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    filtered[y * (1 + stride)] = 0; // filter type: None
    rgba.copy(filtered, y * (1 + stride) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(filtered, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Drawing helpers --------------------------------------------------------

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// Signed distance to a rounded rect centered with the given half-sizes and radius.
function sdRoundRect(px, py, cx, cy, hx, hy, r) {
  const dx = Math.abs(px - cx) - hx + r;
  const dy = Math.abs(py - cy) - hy + r;
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(dx, dy), 0) - r;
}

// Signed distance from point to segment (ax,ay)->(bx,by).
function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay));
  const cx = pax - bax * h;
  const cy = pay - bay * h;
  return Math.sqrt(cx * cx + cy * cy);
}

function blend(dst, sx, sy, sz, sa) {
  // sx,sy,sz in 0..255, sa in 0..1, dst is [r,g,b,a] 0..255
  const da = dst[3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) { dst[0] = dst[1] = dst[2] = dst[3] = 0; return; }
  dst[0] = Math.round((sx * sa + dst[0] * da * (1 - sa)) / outA);
  dst[1] = Math.round((sy * sa + dst[1] * da * (1 - sa)) / outA);
  dst[2] = Math.round((sz * sa + dst[2] * da * (1 - sa)) / outA);
  dst[3] = Math.round(outA * 255);
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Render the icon to a w×h RGBA buffer.
// `inset` is a fraction (0..0.5) for maskable safe-zone padding.
function renderIcon(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);

  // Padding: standard manifest spec requires a ~20% safe zone for maskable icons.
  // For non-maskable icons we leave 0 padding.
  const pad = maskable ? size * 0.12 : 0;
  const innerSize = size - pad * 2;
  const radius = innerSize * (112 / 512);
  const cx = size / 2;
  const cy = size / 2;
  const hx = innerSize / 2;
  const hy = innerSize / 2;

  // Checkmark geometry mapped from 512-space to innerSize-space.
  // Path: 140,268 -> 208,336 -> 372,172, stroke-width 44, rounded caps.
  const s = innerSize / 512;
  const ox = cx - innerSize / 2;
  const oy = cy - innerSize / 2;
  const p1 = [ox + 140 * s, oy + 268 * s];
  const p2 = [ox + 208 * s, oy + 336 * s];
  const p3 = [ox + 372 * s, oy + 172 * s];
  const strokeR = (44 / 2) * s;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      const idx = (y * size + x) * 4;

      // Background fill area (rounded rect coverage)
      const dRect = sdRoundRect(px, py, cx, cy, hx, hy, radius);
      const bgA = smoothstep(0.5, -0.5, dRect); // 1 inside, fades over 1px edge

      if (bgA > 0) {
        // Diagonal gradient: top-left #7c9cff -> bottom-right #b48cff
        // Map t = (x+y) / (2*size) but only within the inner rect.
        const tx = (px - ox) / innerSize;
        const ty = (py - oy) / innerSize;
        const t = clamp01((tx + ty) / 2);
        const r = Math.round(lerp(0x7c, 0xb4, t));
        const g = Math.round(lerp(0x9c, 0x8c, t));
        const b = Math.round(lerp(0xff, 0xff, t));
        // Premultiplied write into transparent buffer:
        const a = bgA;
        const da = buf[idx + 3] / 255;
        const outA = a + da * (1 - a);
        buf[idx + 0] = Math.round((r * a) / Math.max(outA, 1e-6));
        buf[idx + 1] = Math.round((g * a) / Math.max(outA, 1e-6));
        buf[idx + 2] = Math.round((b * a) / Math.max(outA, 1e-6));
        buf[idx + 3] = Math.round(outA * 255);
      }

      // Checkmark stroke (white)
      const dSeg = Math.min(
        sdSegment(px, py, p1[0], p1[1], p2[0], p2[1]),
        sdSegment(px, py, p2[0], p2[1], p3[0], p3[1])
      );
      const strokeA = smoothstep(strokeR + 0.5, strokeR - 0.5, dSeg);
      if (strokeA > 0) {
        const pixel = [buf[idx], buf[idx + 1], buf[idx + 2], buf[idx + 3]];
        blend(pixel, 255, 255, 255, strokeA);
        buf[idx] = pixel[0];
        buf[idx + 1] = pixel[1];
        buf[idx + 2] = pixel[2];
        buf[idx + 3] = pixel[3];
      }
    }
  }

  // For maskable icons, fill the surrounding transparent area with the background
  // so that platforms can crop without exposing transparency.
  if (maskable) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        if (buf[idx + 3] === 0) {
          // Use the corner gradient color at this point
          const tx = x / size;
          const ty = y / size;
          const t = clamp01((tx + ty) / 2);
          buf[idx + 0] = Math.round(lerp(0x7c, 0xb4, t));
          buf[idx + 1] = Math.round(lerp(0x9c, 0x8c, t));
          buf[idx + 2] = 0xff;
          buf[idx + 3] = 0xff;
        }
      }
    }
  }

  return buf;
}

function write(name, size, opts = {}) {
  const rgba = renderIcon(size, opts);
  const png = encodePNG(size, size, rgba);
  const path = resolve(outDir, name);
  writeFileSync(path, png);
  console.log(`  wrote ${name}  (${size}×${size}, ${png.length} bytes)`);
}

console.log("Generating PWA icons...");
write("icon-192.png", 192);
write("icon-512.png", 512);
write("maskable-512.png", 512, { maskable: true });
write("apple-touch-icon.png", 180);
console.log("Done.");
