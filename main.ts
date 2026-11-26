// news-image-20261126 — "Thursday 26 November 2026 — The World in One Day"
// A program that draws a 1024x1024 newspaper poster of the day's world news
// entirely in code (Node 22 stdlib only, no network, deterministic output).
// Run:  node main.ts   (writes entry.png to $MAKEFUN_OUTPUT_DIR or /output)

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

const W = 1024;
const H = 1024;

// ---------- palette ----------
type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [26, 26, 26];
const RED: RGB = [176, 30, 36];
const NAVY: RGB = [31, 58, 95];
const TEAL: RGB = [46, 111, 126];
const SEA: RGB = [58, 110, 138];
const SKY: RGB = [198, 216, 228];
const GOLD: RGB = [196, 141, 44];
const ORANGE: RGB = [224, 110, 30];
const GREY: RGB = [110, 106, 98];
const LIGHT: RGB = [232, 226, 214];
const WHITE: RGB = [255, 255, 255];
const DARKTEAL: RGB = [24, 66, 82];

// ---------- framebuffer ----------
const fb = new Uint8Array(W * H * 3);
function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    fb[i * 3] = c[0];
    fb[i * 3 + 1] = c[1];
    fb[i * 3 + 2] = c[2];
  }
}
function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) px(i, j, c);
}
function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  rect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, c: RGB, t = 1): void {
  rect(x, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    rect(x - ((t - 1) >> 1), y - ((t - 1) >> 1), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}
function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) px(cx + x, cy + y, c);
}
function ring(cx: number, cy: number, r: number, c: RGB, t = 2): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++)
      px(Math.round(cx + (r + k) * Math.cos(rad)), Math.round(cy + (r + k) * Math.sin(rad)), c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
      const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) px(x, y, c);
    }
}

// ---------- 5x7 bitmap font (uppercase + digits + punctuation) ----------
// Each glyph: 7 rows, 5 bits each, '#' = on.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "@": ["01110", "10001", "10111", "10101", "10110", "10000", "01110"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
  "\u2022": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
};
const CHAR_W = 6; // 5px glyph + 1px gap
function textWidth(s: string, scale: number): number {
  return s.length * CHAR_W * scale - scale;
}
function drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if (g[r][col] === "1") rect(x + col * scale, y + r * scale, scale, scale, c);
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  for (let i = 0; i < s.length; i++) drawChar(x + i * CHAR_W * scale, y, s[i], scale, c);
}
function drawTextCenter(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textWidth(t, scale) <= maxW) {
      cur = t;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(x: number, y: number, s: string, maxW: number, scale: number, c: RGB, lh: number): number {
  const lines = wrapText(s, maxW, scale);
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * lh, lines[i], scale, c);
  return y + lines.length * lh;
}

// ---------- PNG encoder (zlib + CRC32, stdlib only) ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- illustrations (all drawn with primitives) ----------

// Hero: the Strait of Hormuz — tanker on a narrow sea, mine, fire and smoke.
function drawHeroArt(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, SKY);
  // sun
  circle(x + w - 70, y + 52, 30, GOLD);
  circle(x + w - 70, y + 52, 22, [226, 178, 80]);
  // distant coast
  tri(x, y + 118, x + 130, y + 88, x + 260, y + 118, [168, 158, 138]);
  tri(x + 150, y + 118, x + 300, y + 92, x + w, y + 118, [150, 142, 124]);
  // sea
  rect(x, y + 118, w, h - 118, SEA);
  // wave lines
  for (let i = 0; i < 5; i++) {
    const wy = y + 140 + i * 26;
    for (let wx = x + 12 + (i % 2) * 30; wx < x + w - 40; wx += 64)
      hline(wx, wy, 34, [120, 170, 195], 3);
  }
  // tanker: hull, deck, containers, bridge
  const hx = x + 36;
  const hy = y + 168;
  rect(hx, hy, 250, 46, [38, 38, 44]); // hull
  tri(hx - 8, hy, hx, hy, hx, hy + 46, [38, 38, 44]); // bow
  rect(hx + 8, hy - 26, 52, 26, RED); // container stack 1
  rect(hx + 66, hy - 26, 52, 26, GOLD); // stack 2
  rect(hx + 124, hy - 26, 52, 26, [240, 240, 235]); // stack 3
  rect(hx + 186, hy - 52, 34, 52, [210, 210, 205]); // bridge tower
  rect(hx + 192, hy - 46, 22, 6, NAVY);
  rect(hx + 192, hy - 34, 22, 6, NAVY);
  vline(hx + 226, hy - 66, 14, INK, 3); // mast
  // fire on deck
  tri(hx + 96, hy - 24, hx + 112, hy - 66, hx + 128, hy - 24, ORANGE);
  tri(hx + 104, hy - 24, hx + 112, hy - 50, hx + 120, hy - 24, RED);
  // smoke
  circle(hx + 108, hy - 78, 12, [120, 116, 108]);
  circle(hx + 122, hy - 96, 16, [140, 136, 128]);
  circle(hx + 140, hy - 112, 19, [160, 156, 148]);
  // naval mine in the water, foreground right
  const mx = x + w - 62;
  const my = y + h - 58;
  for (let a = 0; a < 8; a++) {
    const rad = (a * Math.PI) / 4;
    line(mx, my, Math.round(mx + 30 * Math.cos(rad)), Math.round(my + 30 * Math.sin(rad)), INK, 3);
  }
  circle(mx, my, 22, [30, 30, 34]);
  circle(mx - 6, my - 6, 6, [90, 90, 96]);
  // second mine, smaller, left
  const nx = x + 60;
  const ny = y + h - 34;
  for (let a = 0; a < 8; a++) {
    const rad = (a * Math.PI) / 4 + 0.4;
    line(nx, ny, Math.round(nx + 20 * Math.cos(rad)), Math.round(ny + 20 * Math.sin(rad)), INK, 2);
  }
  circle(nx, ny, 14, [30, 30, 34]);
}

// Kyiv: skyline under missile streaks. Fits inside the given box.
function drawKyivArt(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [214, 196, 176]);
  // skyline along the bottom
  const hs = [26, 38, 22, 46, 30, 42, 24, 34];
  let bx = x + 6;
  for (const hh of hs) {
    rect(bx, y + h - 12 - hh, 26, hh + 12, NAVY);
    bx += 32;
  }
  // missile streaks
  line(x + 24, y + 6, x + 74, y + 40, ORANGE, 3);
  line(x + 130, y + 4, x + 168, y + 34, ORANGE, 3);
  circle(x + 76, y + 42, 5, RED);
  circle(x + 170, y + 36, 5, RED);
  // explosion star
  for (let a = 0; a < 8; a++) {
    const rad = (a * Math.PI) / 4;
    line(x + w - 30, y + 16, Math.round(x + w - 30 + 11 * Math.cos(rad)), Math.round(y + 16 + 11 * Math.sin(rad)), GOLD, 2);
  }
  circle(x + w - 30, y + 16, 5, ORANGE);
}

// Tariffs: stacked cargo containers and a big %. Fits inside the given box.
function drawTariffArt(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, LIGHT);
  rect(x + 14, y + h - 26, 62, 22, RED);
  rect(x + 80, y + h - 26, 62, 22, NAVY);
  rect(x + 47, y + h - 50, 62, 22, GOLD);
  for (const [cx, cy] of [[14, h - 26], [80, h - 26], [47, h - 50]] as const) {
    hline(x + cx + 4, y + cy + 6, 54, WHITE, 2);
    hline(x + cx + 4, y + cy + 16, 54, WHITE, 2);
  }
  drawText(x + w - 62, y + 8, "%", 5, RED);
}

// Sudan: houses and a drone. Fits inside the given box.
function drawSudanArt(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [226, 208, 176]);
  // houses along the bottom
  for (const [hx, hw, hh] of [[14, 56, 26], [82, 48, 32], [142, 60, 24], [214, 52, 30]] as const) {
    rect(x + hx, y + h - 10 - hh, hw, hh + 10, [150, 116, 84]);
    tri(x + hx - 4, y + h - 10 - hh, x + hx + hw / 2, y + h - 10 - hh - 14, x + hx + hw + 4, y + h - 10 - hh, RED);
  }
  // drone
  const dx = x + w - 78;
  const dy = y + 16;
  rect(dx, dy, 34, 10, INK);
  line(dx - 14, dy - 5, dx + 48, dy - 5, INK, 2);
  circle(dx - 14, dy - 5, 6, GREY);
  circle(dx + 48, dy - 5, 6, GREY);
  line(dx + 8, dy + 10, dx + 8, dy + 20, INK, 2);
  circle(dx + 8, dy + 23, 3, RED);
}

// Shenzhou: rocket and station against a dark sky. Fits inside the given box.
function drawSpaceArt(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [16, 24, 44]);
  // stars
  const stars: [number, number][] = [[14, 10], [52, 22], [96, 8], [150, 18], [210, 10], [248, 26], [30, 40], [180, 38], [230, 46], [120, 50]];
  for (const [sx, sy] of stars) circle(x + sx, y + sy, 2, WHITE);
  // station (right)
  rect(x + 168, y + 44, 96, 10, [210, 210, 205]);
  rect(x + 152, y + 46, 16, 6, GOLD);
  rect(x + 264, y + 46, 16, 6, GOLD);
  rect(x + 204, y + 38, 22, 22, WHITE);
  // rocket (left)
  const rx = x + 52;
  const ry = y + 30;
  rect(rx, ry, 24, 26, WHITE);
  tri(rx, ry, rx + 12, ry - 16, rx + 24, ry, RED);
  rect(rx - 7, ry + 16, 8, 10, RED);
  rect(rx + 23, ry + 16, 8, 10, RED);
  tri(rx + 5, ry + 26, rx + 12, ry + 40, rx + 19, ry + 26, ORANGE);
}

// Indonesia: mine entrance with lamps. Fits inside the given box.
function drawMineArt(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [216, 200, 172]);
  // hill
  tri(x, y + h - 8, x + w / 2, y + 22, x + w, y + h - 8, [120, 104, 78]);
  // tunnel mouth
  rect(x + w / 2 - 34, y + h - 40, 68, 32, [20, 20, 24]);
  tri(x + w / 2 - 34, y + h - 40, x + w / 2, y + h - 58, x + w / 2 + 34, y + h - 40, [20, 20, 24]);
  // lamp dots in the dark
  circle(x + w / 2 - 14, y + h - 22, 3, GOLD);
  circle(x + w / 2 + 10, y + h - 28, 3, GOLD);
  circle(x + w / 2 + 2, y + h - 14, 2, GOLD);
  // water at the mouth
  rect(x + w / 2 - 34, y + h - 12, 68, 4, SEA);
  // helmet
  circle(x + 34, y + h - 20, 12, GOLD);
  rect(x + 20, y + h - 20, 28, 5, GOLD);
}

// ---------- page layout ----------
function cell(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, 2, INK);
  rect(x, y, 2, h, INK);
  rect(x + w - 2, y, 2, h, INK);
  rect(x, y + h - 2, w, 2, INK);
}

function drawPoster(): void {
  fill(PAPER);
  // outer double border
  rect(8, 8, W - 16, 3, INK);
  rect(8, H - 11, W - 16, 3, INK);
  rect(8, 8, 3, H - 16, INK);
  rect(W - 11, 8, 3, H - 16, INK);
  rect(16, 16, W - 32, 1, INK);
  rect(16, H - 17, W - 32, 1, INK);

  // masthead
  drawTextCenter(512, 34, "THE WORLD IN ONE DAY", 6, INK);
  hline(120, 96, 784, INK, 3);
  drawTextCenter(512, 108, "THURSDAY 26 NOVEMBER 2026", 3, RED);
  hline(120, 138, 784, INK, 3);

  // ---- hero ----
  const hy = 156;
  const hh = 330;
  drawText(40, hy + 6, "STRAIT OF HORMUZ", 3, RED);
  drawText(40, hy + 44, "TWO TANKERS", 6, INK);
  drawText(40, hy + 92, "HIT MINES", 6, INK);
  drawPara(
    40, hy + 158,
    "IRAN SAYS THE SHIPS EXPLODED AND CAUGHT FIRE AFTER STRIKING NAVAL MINES. VESSELS WARNED TO COORDINATE PASSAGE THROUGH THE VITAL OIL WATERWAY.",
    540, 2, INK, 22,
  );
  drawText(40, hy + 158 + 4 * 22 + 10, "OIL FLOWS AT RISK AS ATTACKS MOUNT", 2, RED);
  drawHeroArt(620, hy, 364, hh);

  hline(40, 506, 944, INK, 3);

  // ---- grid: 3 columns x 2 rows ----
  const gx = 40;
  const gy = 524;
  const cw = 304;
  const ch = 196;
  const gap = 16;
  const cells: {
    kicker: string;
    head: string;
    deck: string;
    art: (x: number, y: number, w: number, h: number) => void;
  }[] = [
    {
      kicker: "UKRAINE",
      head: "KYIV HIT BY BALLISTIC MISSILES",
      deck: "RUSSIA STRIKES A SHOPPING CENTRE; SEVERAL HURT.",
      art: drawKyivArt,
    },
    {
      kicker: "TRADE",
      head: "US PLANS NEW TARIFFS ON 14 PARTNERS",
      deck: "CHINA FACES +20%, BRAZIL 10% ON AIRCRAFT.",
      art: drawTariffArt,
    },
    {
      kicker: "SUDAN",
      head: "19 KILLED IN SUDAN DRONE STRIKES",
      deck: "RSF DRONES HIT HOMES IN BLUE NILE; 20 MORE WOUNDED, GROUP SAYS.",
      art: drawSudanArt,
    },
    {
      kicker: "SPACE",
      head: "CHINA FLIES FIRST FOREIGN ASTRONAUT",
      deck: "PAKISTAN'S ZEESHAN ALI RIDES SHENZHOU-24 TO TIANGONG FOR A WEEK.",
      art: drawSpaceArt,
    },
    {
      kicker: "INDONESIA",
      head: "9 DEAD IN INDONESIA GOLD MINE FLOOD",
      deck: "RESCUERS SEARCH FOR 17 MINERS STILL TRAPPED IN THE FLOODED MINE.",
      art: drawMineArt,
    },
  ];
  for (let i = 0; i < 5; i++) {
    const cx = gx + (i % 3) * (cw + gap);
    const cy = gy + Math.floor(i / 3) * (ch + gap);
    cell(cx, cy, cw, ch);
    const artH = 64;
    cells[i].art(cx + 8, cy + 8, cw - 16, artH);
    drawText(cx + 10, cy + 80, cells[i].kicker, 2, RED);
    drawPara(cx + 10, cy + 98, cells[i].head, cw - 20, 2, INK, 18);
    const headLines = wrapText(cells[i].head, cw - 20, 2).length;
    drawPara(cx + 10, cy + 98 + headLines * 18 + 4, cells[i].deck, cw - 20, 2, GREY, 16);
  }
  // sixth cell: in brief
  const bx = gx + 2 * (cw + gap);
  const by = gy + ch + gap;
  cell(bx, by, cw, ch);
  drawText(bx + 10, by + 10, "IN BRIEF", 2, RED);
  const briefs = [
    "US ECONOMY GREW 4.3% IN Q3, REVISED UP.",
    "HUAWEI GUILTY ON 10 COUNTS IN US TRIAL.",
    "ANTHROPIC DEBUTS ON WALL STREET AT $1.5 TRILLION.",
  ];
  let byy = by + 38;
  for (const b of briefs) {
    rect(bx + 10, byy + 4, 8, 8, RED);
    byy = drawPara(bx + 26, byy, b, cw - 40, 2, INK, 18) + 10;
  }

  // footer
  hline(40, 956, 944, INK, 2);
  drawTextCenter(
    512, 968,
    "SOURCES: REUTERS - ASSOCIATED PRESS - AL JAZEERA - AVIATION WEEK",
    2, GREY,
  );
  drawTextCenter(512, 990, "THE DAY'S NEWS AS REPORTED ON 26 NOVEMBER 2026", 1, GREY);
}

// ---------- main ----------
function main(): void {
  drawPoster();
  const png = encodePNG(W, H, fb);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);
  const sha = createHash("sha256").update(png).digest("hex");
  console.log(`wrote ${outPath} (${png.length} bytes, sha256 ${sha})`);
}

main();
