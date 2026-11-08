/**
 * Quad-Point Highlighter (Perspective Highlight Tool)
 * 
 * Provides geometric algorithms, point ordering, point-in-polygon detection,
 * pixel luminance masking (thresholding), and helper utilities for highlighting
 * skewed or perspective-distorted document tables, rows, and text.
 */

import { hexToRgb } from './pdfHelper.js';

// Popular fluorescent & pastel highlight colors
export const HIGHLIGHT_PRESET_COLORS = [
  { label: 'Vàng huỳnh quang', value: '#FFFF00' },
  { label: 'Vàng chanh dịu', value: '#FFF176' },
  { label: 'Xanh ngọc (Mint)', value: '#6EE7B7' },
  { label: 'Xanh dương nhạt', value: '#93C5FD' },
  { label: 'Hồng huỳnh quang', value: '#F9A8D4' },
  { label: 'Cam đào', value: '#FDBA74' },
  { label: 'Tím pastel', value: '#C4B5FD' }
];

/**
 * Checks if a point (x, y) is inside an arbitrary polygon using ray-casting.
 * 
 * @param {{x: number, y: number}} point - The point to test
 * @param {Array<{x: number, y: number}>} vs - Polygon vertices
 * @returns {boolean} True if point is inside polygon
 */
export function isPointInPolygon(point, vs) {
  const x = point.x;
  const y = point.y;
  let inside = false;
  
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y;
    const xj = vs[j].x, yj = vs[j].y;
    
    const intersect = ((yi > y) !== (yj > y)) && 
                      (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Calculates the bounding box of a list of points.
 * 
 * @param {Array<{x: number, y: number}>} points
 * @returns {{x: number, y: number, w: number, h: number, minX: number, minY: number, maxX: number, maxY: number}}
 */
export function getPointsBounds(points) {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    minX,
    minY,
    maxX,
    maxY
  };
}

/**
 * Organizes 4 arbitrary points into a clean convex quadrilateral order
 * (Top-Left -> Top-Right -> Bottom-Right -> Bottom-Left) to avoid
 * self-intersecting / hourglass shapes.
 * 
 * @param {Array<{x: number, y: number}>} points - 4 input points
 * @returns {Array<{x: number, y: number}>} 4 ordered points
 */
export function orderQuadPoints(points) {
  if (!points || points.length !== 4) return points;

  // Calculate centroid
  const cx = (points[0].x + points[1].x + points[2].x + points[3].x) / 4;
  const cy = (points[0].y + points[1].y + points[2].y + points[3].y) / 4;

  // Sort points by polar angle relative to centroid
  const sorted = [...points].map(p => ({
    ...p,
    angle: Math.atan2(p.y - cy, p.x - cx)
  })).sort((a, b) => a.angle - b.angle);

  // Find the top-left point (smallest x + y)
  let bestIdx = 0;
  let minSum = Infinity;
  for (let i = 0; i < sorted.length; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      bestIdx = i;
    }
  }

  // Rotate array so Top-Left point comes first (index 0)
  const ordered = [];
  for (let i = 0; i < 4; i++) {
    const p = sorted[(bestIdx + i) % 4];
    ordered.push({ x: p.x, y: p.y });
  }

  return ordered;
}

/**
 * Pixel manipulation & Luminance Masking (Algorithm Option 2):
 * Scans each pixel (R, G, B) inside the quadrilateral on the source canvas.
 * - Computes luminance: L = 0.299R + 0.587G + 0.114B
 * - If L < threshold (black/dark ink text): Keeps original black ink untouched
 * - If L >= threshold (white/light paper background): Blends highlight color
 * 
 * @param {HTMLCanvasElement} canvas - Underlying editor canvas
 * @param {Array<{x: number, y: number}>} points - 4 quad points in canvas coordinates
 * @param {string} hexColor - Highlight color (e.g. #FFFF00)
 * @param {number} threshold - Luminance threshold (0-255, default ~120)
 * @param {number} opacity - Blend opacity (0-1, default 0.7)
 * @returns {{ dataUrl: string, rect: { x: number, y: number, w: number, h: number } } | null}
 */
export function applyLuminanceMask(canvas, points, hexColor = '#FFFF00', threshold = 120, opacity = 0.7) {
  if (!canvas || !points || points.length < 4) return null;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const bounds = getPointsBounds(points);
  const minX = Math.max(0, Math.floor(bounds.minX));
  const minY = Math.max(0, Math.floor(bounds.minY));
  const maxX = Math.min(canvas.width, Math.ceil(bounds.maxX));
  const maxY = Math.min(canvas.height, Math.ceil(bounds.maxY));

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  let srcData;
  try {
    srcData = ctx.getImageData(minX, minY, width, height);
  } catch (e) {
    console.error('Failed to read canvas pixels for luminance mask:', e);
    return null;
  }

  const { r: hR0, g: hG0, b: hB0 } = hexToRgb(hexColor);
  const hR = Math.round(hR0 * 255);
  const hG = Math.round(hG0 * 255);
  const hB = Math.round(hB0 * 255);

  const patchCanvas = document.createElement('canvas');
  patchCanvas.width = width;
  patchCanvas.height = height;
  const patchCtx = patchCanvas.getContext('2d');
  const patchImg = patchCtx.createImageData(width, height);

  const pixels = srcData.data;
  const outPixels = patchImg.data;

  // Local points relative to bounding box
  const localPoints = points.map(p => ({ x: p.x - minX, y: p.y - minY }));

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = (py * width + px) * 4;

      // Check if pixel is within the 4-point quadrilateral
      if (!isPointInPolygon({ x: px, y: py }, localPoints)) {
        continue; // Leave alpha 0 (transparent outside polygon)
      }

      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];

      if (a === 0) continue;

      // Luminance formula
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum < threshold) {
        // Dark ink: preserve 100% original dark ink without fading
        outPixels[idx] = r;
        outPixels[idx + 1] = g;
        outPixels[idx + 2] = b;
        outPixels[idx + 3] = a;
      } else {
        // Paper background: dye with highlight color using multiply blending
        // Multiply: C_out = C_orig * C_hl / 255
        const mulR = (r * hR) / 255;
        const mulG = (g * hG) / 255;
        const mulB = (b * hB) / 255;

        outPixels[idx] = Math.round(r * (1 - opacity) + mulR * opacity);
        outPixels[idx + 1] = Math.round(g * (1 - opacity) + mulG * opacity);
        outPixels[idx + 2] = Math.round(b * (1 - opacity) + mulB * opacity);
        outPixels[idx + 3] = 255;
      }
    }
  }

  patchCtx.putImageData(patchImg, 0, 0);

  return {
    dataUrl: patchCanvas.toDataURL('image/png'),
    rect: { x: minX, y: minY, w: width, h: height }
  };
}
