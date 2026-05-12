// Renders PNG icons for every tenant defined in lib/tenants.mjs.
// Each tenant gets:
//   public/tenants/<slug>/icon-192.png
//   public/tenants/<slug>/icon-512.png
//   public/tenants/<slug>/maskable-512.png  (with safe-zone padding)
//   public/tenants/<slug>/apple-touch-icon.png (180×180)
// All icons share the same checkmark glyph; the gradient colors come from
// the tenant config, so each tenant ends up with a visually distinct icon.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_TENANTS } from "../lib/tenants.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");

// --- PNG encoder (RGBA, 8-bit) ---------------------------------------------

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
    filtered[y * (1 + stride)] = 0;
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
function lerp(a, b, t) { return a + (b - a) * t; }

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function sdRoundRect(px, py, cx, cy, hx, hy, r) {
  const dx = Math.abs(px - cx) - hx + r;
  const dy = Math.abs(py - cy) - hy + r;
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(dx, dy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay));
  const cx = pax - bax * h;
  const cy = pay - bay * h;
  return Math.sqrt(cx * cx + cy * cy);
}

function blend(dst, sr, sg, sb, sa) {
  const da = dst[3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) { dst[0] = dst[1] = dst[2] = dst[3] = 0; return; }
  dst[0] = Math.round((sr * sa + dst[0] * da * (1 - sa)) / outA);
  dst[1] = Math.round((sg * sa + dst[1] * da * (1 - sa)) / outA);
  dst[2] = Math.round((sb * sa + dst[2] * da * (1 - sa)) / outA);
  dst[3] = Math.round(outA * 255);
}

function renderIcon(size, tenant, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);

  const from = hexToRgb(tenant.gradientFrom);
  const to = hexToRgb(tenant.gradientTo);

  const pad = maskable ? size * 0.12 : 0;
  const innerSize = size - pad * 2;
  const radius = innerSize * (112 / 512);
  const cx = size / 2;
  const cy = size / 2;
  const hx = innerSize / 2;
  const hy = innerSize / 2;

  // Checkmark geometry mapped from 512-space onto innerSize-space.
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

      const dRect = sdRoundRect(px, py, cx, cy, hx, hy, radius);
      const bgA = smoothstep(0.5, -0.5, dRect);

      if (bgA > 0) {
        const tx = (px - ox) / innerSize;
        const ty = (py - oy) / innerSize;
        const t = clamp01((tx + ty) / 2);
        const r = Math.round(lerp(from.r, to.r, t));
        const g = Math.round(lerp(from.g, to.g, t));
        const b = Math.round(lerp(from.b, to.b, t));
        const a = bgA;
        const da = buf[idx + 3] / 255;
        const outA = a + da * (1 - a);
        buf[idx + 0] = Math.round((r * a) / Math.max(outA, 1e-6));
        buf[idx + 1] = Math.round((g * a) / Math.max(outA, 1e-6));
        buf[idx + 2] = Math.round((b * a) / Math.max(outA, 1e-6));
        buf[idx + 3] = Math.round(outA * 255);
      }

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

  if (maskable) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        if (buf[idx + 3] === 0) {
          const tx = x / size;
          const ty = y / size;
          const t = clamp01((tx + ty) / 2);
          buf[idx + 0] = Math.round(lerp(from.r, to.r, t));
          buf[idx + 1] = Math.round(lerp(from.g, to.g, t));
          buf[idx + 2] = Math.round(lerp(from.b, to.b, t));
          buf[idx + 3] = 0xff;
        }
      }
    }
  }

  return buf;
}

function writeIcon(outDir, name, size, tenant, opts = {}) {
  const rgba = renderIcon(size, tenant, opts);
  const png = encodePNG(size, size, rgba);
  writeFileSync(resolve(outDir, name), png);
  return png.length;
}

console.log("Generating PWA icons for all tenants...");
for (const tenant of ALL_TENANTS) {
  const outDir = resolve(publicDir, tenant.iconPath.replace(/^\//, ""));
  mkdirSync(outDir, { recursive: true });
  const sizes = {
    "icon-192.png": [192, {}],
    "icon-512.png": [512, {}],
    "maskable-512.png": [512, { maskable: true }],
    "apple-touch-icon.png": [180, {}],
  };
  const written = [];
  for (const [name, [size, opts]] of Object.entries(sizes)) {
    const bytes = writeIcon(outDir, name, size, tenant, opts);
    written.push(`${name} (${bytes}b)`);
  }
  console.log(`  [${tenant.slug.padEnd(8)}] ${written.join(", ")}`);
}
console.log("Done.");
