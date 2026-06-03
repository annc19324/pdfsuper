import { PDFDocument, rgb, degrees } from 'pdf-lib';

// Helper to convert hex (#ffffff) to RGB (0-1)
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 1, g: 1, b: 1 };
}

// Helper to convert base64 PNG data URL to Uint8Array
export function base64ToUint8Array(base64Str) {
  const base64Data = base64Str.split(',')[1] || base64Str;
  const raw = window.atob(base64Data);
  const uint8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    uint8Array[i] = raw.charCodeAt(i);
  }
  return uint8Array;
}

/**
 * Exports a new PDF document based on page configurations and annotations.
 * 
 * @param {ArrayBuffer} originalPdfBytes - The original uploaded PDF file bytes
 * @param {Array} pagesConfig - Array of page configs: { id, originalIndex, rotation, width, height, annotations }
 * @returns {Promise<Uint8Array>} The modified PDF file bytes
 */
export async function exportPdf(originalPdfBytes, pagesConfig) {
  let srcDoc = null;
  if (originalPdfBytes) {
    srcDoc = await PDFDocument.load(originalPdfBytes);
  }
  
  const dstDoc = await PDFDocument.create();
  
  for (const pageConfig of pagesConfig) {
    let dstPage;
    
    if (pageConfig.originalIndex !== null && srcDoc) {
      // Copy page from original PDF
      const [copiedPage] = await dstDoc.copyPages(srcDoc, [pageConfig.originalIndex - 1]);
      dstDoc.addPage(copiedPage);
      dstPage = copiedPage;
    } else {
      // Create a blank page (standard A4 size if not specified)
      const w = pageConfig.width || 595.276;
      const h = pageConfig.height || 841.890;
      dstPage = dstDoc.addPage([w, h]);
    }

    // Apply rotation
    if (pageConfig.rotation !== undefined) {
      dstPage.setRotation(degrees(pageConfig.rotation));
    }

    // Draw annotations on this page
    if (pageConfig.annotations && pageConfig.annotations.length > 0) {
      for (const ann of pageConfig.annotations) {
        const { type, rect, color, imageSrc } = ann;
        const { x, y, w, h } = rect; // PDF coordinate space

        if (type === 'highlight') {
          const { r, g, b } = hexToRgb(color || '#EFDE05');
          dstPage.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: rgb(r, g, b),
            opacity: 0.4, // Standard highlight transparency
          });
        } else if (type === 'text-highlight') {
          const { r, g, b } = hexToRgb(color || '#EFDE05');
          dstPage.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: rgb(r, g, b),
            opacity: 0.95, // Solid highlight color
            prepend: true,  // Draw behind text content stream
          });
        } else if (type === 'solid-highlight') {
          const { r, g, b } = hexToRgb(color || '#EFDE05');
          dstPage.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: rgb(r, g, b),
            opacity: 0.55, // Strong solid highlight but text remains visible
          });
        } else if (type === 'solid-erase') {
          const { r, g, b } = hexToRgb(color || '#ffffff');
          dstPage.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: rgb(r, g, b),
            opacity: 1.0,
          });
        } else if (type === 'inpaint-erase' && imageSrc) {
          try {
            const imgBytes = base64ToUint8Array(imageSrc);
            const embeddedImage = await dstDoc.embedPng(imgBytes);
            dstPage.drawImage(embeddedImage, {
              x,
              y,
              width: w,
              height: h,
            });
          } catch (err) {
            console.error('Failed to embed inpaint image overlay:', err);
          }
        }
      }
    }
  }

  // Save the document to bytes
  return await dstDoc.save();
}
