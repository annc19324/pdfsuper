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
 * - If L < threshold (black/dark ink text or content of other colors):
 *   + If boldenText is ON: Deepens and bolds the ink/text (tô đậm nó) and optionally thickens strokes.
 *   + If boldenText is OFF: Keeps original ink untouched.
 * - If L >= threshold (white/light paper background): Blends highlight color
 * 
 * @param {HTMLCanvasElement} canvas - Underlying editor canvas
 * @param {Array<{x: number, y: number}>} points - 4 quad points in canvas coordinates
 * @param {string} hexColor - Highlight color (e.g. #FFFF00)
 * @param {number} threshold - Luminance threshold (0-255, default ~120)
 * @param {number} opacity - Blend opacity (0-1, default 0.7)
 * @param {object} options - Options { boldenText, darkenStrength, thickenStroke }
 * @returns {{ dataUrl: string, rect: { x: number, y: number, w: number, h: number } } | null}
 */
export function applyLuminanceMask(
  canvas, 
  points, 
  hexColor = '#FFFF00', 
  threshold = 120, 
  opacity = 0.7,
  options = {}
) {
  const {
    boldenText = false,
    darkenStrength = 0.7,
    thickenStroke = true
  } = options;

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

  // Step 1: Pre-classify pixels inside the quad into ink vs paper
  const isInside = new Uint8Array(width * height);
  const isInk = new Uint8Array(width * height);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const pIdx = py * width + px;
      if (isPointInPolygon({ x: px, y: py }, localPoints)) {
        isInside[pIdx] = 1;
        const idx = pIdx * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const a = pixels[idx + 3];
        if (a > 0) {
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum < threshold) {
            isInk[pIdx] = 1;
          }
        }
      }
    }
  }

  // Step 2: If boldenText and thickenStroke, compute dilated ink mask (expand by 1 pixel)
  const isDilatedInk = new Uint8Array(width * height);
  if (boldenText && thickenStroke) {
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const pIdx = py * width + px;
        if (!isInside[pIdx]) continue;
        if (isInk[pIdx]) {
          isDilatedInk[pIdx] = 2; // Original ink pixel
        } else {
          // Check 4-connected neighbors for dark ink
          const up = py > 0 ? isInk[(py - 1) * width + px] : 0;
          const down = py < height - 1 ? isInk[(py + 1) * width + px] : 0;
          const left = px > 0 ? isInk[py * width + (px - 1)] : 0;
          const right = px < width - 1 ? isInk[py * width + (px + 1)] : 0;
          if (up || down || left || right) {
            isDilatedInk[pIdx] = 1; // Expanded border stroke
          }
        }
      }
    }
  } else if (boldenText) {
    for (let i = 0; i < isInk.length; i++) {
      if (isInk[i]) isDilatedInk[i] = 2;
    }
  }

  // Step 3: Colorize pixels
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const pIdx = py * width + px;
      if (!isInside[pIdx]) continue;

      const idx = pIdx * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];
      if (a === 0) continue;

      const inkType = isDilatedInk[pIdx];

      if (boldenText && inkType > 0) {
        // Pixel is text/ink or thickened stroke: TÔ ĐẬM NÓ!
        if (inkType === 2) {
          // Original ink pixel: deepen color and boost contrast
          const factor = Math.max(0, 1 - darkenStrength * 0.85);
          outPixels[idx] = Math.round(r * factor);
          outPixels[idx + 1] = Math.round(g * factor);
          outPixels[idx + 2] = Math.round(b * factor);
          outPixels[idx + 3] = 255;
        } else {
          // Thickened border stroke pixel: blend dark ink onto border
          const darkTone = 25; // Deep crisp black
          outPixels[idx] = darkTone;
          outPixels[idx + 1] = darkTone;
          outPixels[idx + 2] = darkTone;
          outPixels[idx + 3] = 255;
        }
      } else if (!boldenText && isInk[pIdx]) {
        // Original text without boldening: preserve 100% original ink
        outPixels[idx] = r;
        outPixels[idx + 1] = g;
        outPixels[idx + 2] = b;
        outPixels[idx + 3] = a;
      } else {
        // Paper background (L >= threshold): dye with highlight color
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
