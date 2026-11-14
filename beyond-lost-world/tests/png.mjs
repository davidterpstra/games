// Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced) -> luminance statistics. Enough for Chromium screenshots.
import zlib from 'node:zlib';

export function pngLuma(buf) {
  let p = 8, w = 0, h = 0, bpp = 4, ct = 6; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; bpp = ct === 6 ? 4 : ct === 2 ? 3 : ct === 0 ? 1 : 0; if (data[8] !== 8 || data[12] !== 0 || !bpp) throw new Error('unsupported PNG'); }
    else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  let sum = 0, dark = 0, bright = 0, n = 0;
  for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) {
    const i = y * stride + x * bpp, l = bpp >= 3 ? 0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2] : out[i];
    sum += l; n++; if (l < 12) dark++; if (l > 245) bright++;
  }
  return { w, h, mean: sum / n, dark: dark / n, bright: bright / n };
}
