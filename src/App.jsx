import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Copy, 
  ChevronUp, 
  ChevronDown, 
  Square, 
  Paintbrush, 
  Highlighter, 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  Layers, 
  RotateCw, 
  XCircle,
  Sparkles,
  Settings,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  FolderOpen,
  Undo,
  Redo,
  Mail,
  Phone
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Utilities
import { exportPdf, hexToRgb } from './utils/pdfHelper';
import { inpaintLaplacian } from './utils/inpaint';
import { 
  orderQuadPoints, 
  getPointsBounds, 
  applyLuminanceMask, 
  HIGHLIGHT_PRESET_COLORS 
} from './utils/quadHighlight';

// Configure PDF.js Worker using Vite's asset URL import
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Helper to generate simple random IDs
const generateId = () => Math.random().toString(36).substring(2, 11);

// Helper to convert hex (#ffffff) to rgba style
function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

// Sub-component for Facebook SVG Icon
const FacebookIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-facebook">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

// Sub-component for YouTube SVG Icon
const YoutubeIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-youtube">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

// Sub-component for TikTok SVG Icon
const TikTokIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tiktok">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

// Sub-component for Help SVG Icon
const HelpIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-help-circle">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// Sub-component for Quad-Point Highlighter SVG Icon
const QuadIcon = ({ size = 16, style = {} }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    style={style}
  >
    <polygon points="4 7 19 4 21 17 5 20" fill="currentColor" fillOpacity="0.25" />
    <circle cx="4" cy="7" r="1.8" fill="currentColor" />
    <circle cx="19" cy="4" r="1.8" fill="currentColor" />
    <circle cx="21" cy="17" r="1.8" fill="currentColor" />
    <circle cx="5" cy="20" r="1.8" fill="currentColor" />
  </svg>
);

// Sub-component: Renders individual page thumbnail in the sidebar
function ThumbnailCanvas({ pdfDoc, pageConfig }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (pageConfig.originalIndex === null) {
      // Draw placeholder for blank pages
      canvas.width = 100;
      canvas.height = 141;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 100, 141);
      ctx.strokeStyle = '#e5e7eb';
      ctx.strokeRect(0, 0, 100, 141);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'center';
      ctx.fillText('Trang Trống', 50, 75);
      return;
    }

    let active = true;
    const renderThumbnail = async () => {
      try {
        const page = await pdfDoc.getPage(pageConfig.originalIndex);
        const viewport = page.getViewport({ scale: 0.5, rotation: pageConfig.rotation });
        
        if (!active) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };
        await page.render(renderContext).promise;
      } catch (error) {
        console.error('Error rendering thumbnail:', error);
      }
    };

    renderThumbnail();

    return () => {
      active = false;
    };
  }, [pdfDoc, pageConfig.originalIndex, pageConfig.rotation]);

  return <canvas ref={canvasRef} />;
}

export default function App() {
  // Main State
  const [pdfFile, setPdfFile] = useState(null); // ArrayBuffer of original PDF
  const [pdfjsDoc, setPdfjsDoc] = useState(null); // pdfjs object
  const [pages, setPages] = useState([]); // List of page configs
  const [currentPageId, setCurrentPageId] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const [tool, setTool] = useState('view'); // 'view' | 'highlight' | 'solid-highlight' | 'solid' | 'inpaint'
  
  // Collapsible panels
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  // Customization Options
  const [highlightColor, setHighlightColor] = useState('#EFDE05'); // Default highlight color
  const [eraseColor, setEraseColor] = useState('#ffffff'); // White default

  // Quad-Point Highlighter Options
  const [quadHighlightColor, setQuadHighlightColor] = useState('#FFF176'); // Fluorescent yellow default
  const [quadOpacity, setQuadOpacity] = useState(0.65); // Default opacity
  const [quadBlendMode, setQuadBlendMode] = useState('multiply'); // 'multiply' | 'luminance'
  const [quadThreshold, setQuadThreshold] = useState(120); // Default luminance threshold
  const [quadBoldenText, setQuadBoldenText] = useState(false); // Bật/Tắt tô đậm chữ & nét khác màu bên trong
  const [quadDarkenStrength, setQuadDarkenStrength] = useState(0.7); // Mức độ tô đậm nét chữ
  const [quadThickenStroke, setQuadThickenStroke] = useState(true); // In đậm / Làm dày nét
  const [quadPointsInProgress, setQuadPointsInProgress] = useState([]); // Array of 0 to 3 points {x, y}
  const [currentMousePos, setCurrentMousePos] = useState({ x: 0, y: 0 });
  
  // Selected Annotation ID for color editing / deletion
  const [selectedAnnId, setSelectedAnnId] = useState(null);

  // Sync page state
  const [syncEdits, setSyncEdits] = useState(false);
  const [syncMode, setSyncMode] = useState('all'); // 'all' | 'manual'
  const [selectedSyncPages, setSelectedSyncPages] = useState([]); // list of page IDs to sync

  // Processing indicators
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // Undo / Redo History States
  const [history, setHistory] = useState([]); // Undo stack
  const [redoStack, setRedoStack] = useState([]); // Redo stack

  // Show/hide annotation bounding frames (default: hidden)
  const [showAnnotationFrames, setShowAnnotationFrames] = useState(false);

  // Support / Donation QR modal
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Inpaint Help modal
  const [showInpaintHelpModal, setShowInpaintHelpModal] = useState(false);

  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  // Editor viewport & elements reference
  const [editorViewport, setEditorViewport] = useState(null);
  const editorCanvasRef = useRef(null);
  const drawingAreaRef = useRef(null);
  const editorContainerRef = useRef(null);

  // Drawing state
  const [drawingBox, setDrawingBox] = useState(null);
  const isDrawingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  // Custom Toast helper
  const showToast = (message, type = 'info') => {
    const id = generateId();
    setToasts(prev => {
      const next = [...prev, { id, message, type }];
      return next.slice(-3); // Only show the 3 newest toasts
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Handle mouse wheel zoom directly
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY;
      if (delta < 0) {
        // Zoom in smoothly
        setZoom(z => Math.min(3.0, z + 0.08));
      } else {
        // Zoom out smoothly
        setZoom(z => Math.max(0.5, z - 0.08));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Get active page
  const currentPage = useMemo(() => {
    return pages.find(p => p.id === currentPageId);
  }, [pages, currentPageId]);

  // Find currently selected annotation details
  const selectedAnn = useMemo(() => {
    if (!currentPage || !selectedAnnId) return null;
    return currentPage.annotations.find(a => a.id === selectedAnnId);
  }, [currentPage, selectedAnnId]);

  // Derived state: target page IDs for sync
  const targetPageIdsForSync = useMemo(() => {
    if (!syncEdits) return [];
    if (syncMode === 'all') {
      return pages.filter(p => p.id !== currentPageId).map(p => p.id);
    } else {
      return selectedSyncPages.filter(id => id !== currentPageId);
    }
  }, [syncEdits, syncMode, pages, currentPageId, selectedSyncPages]);

  // Reset selected annotation if page changes
  useEffect(() => {
    setSelectedAnnId(null);
  }, [currentPageId]);

  // Reset selected annotation if edit frames are hidden
  useEffect(() => {
    if (!showAnnotationFrames) {
      setSelectedAnnId(null);
    }
  }, [showAnnotationFrames]);

  // Helper to save current state to undo history
  const saveToHistory = (currentPages = pages) => {
    const deepCopied = JSON.parse(JSON.stringify(currentPages));
    setHistory(prev => [...prev, deepCopied]);
    setRedoStack([]); // Clear redo stack on new action
  };

  // Undo trigger
  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(prevHistory => prevHistory.slice(0, -1));
    setRedoStack(prevRedo => [...prevRedo, JSON.parse(JSON.stringify(pages))]);
    setPages(prev);
    setSelectedAnnId(null);
    showToast('Đã trở lại (Hoàn tác).', 'info');
  };

  // Redo trigger
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prevRedo => prevRedo.slice(0, -1));
    setHistory(prevHistory => [...prevHistory, JSON.parse(JSON.stringify(pages))]);
    setPages(next);
    setSelectedAnnId(null);
    showToast('Đã tiếp tục (Làm lại).', 'info');
  };

  // Render the current page in the main viewer
  useEffect(() => {
    if (!pdfjsDoc || !currentPage) return;
    
    let active = true;
    const renderEditorPage = async () => {
      try {
        if (currentPage.originalIndex === null) {
          // Render a custom blank page
          const canvas = editorCanvasRef.current;
          if (!canvas) return;
          const scale = zoom;
          const w = (currentPage.width || 595.276) * scale;
          const h = (currentPage.height || 841.890) * scale;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          
          const fakeViewport = {
            width: w,
            height: h,
            convertToPdfPoint: (x, y) => [x / scale, (h - y) / scale],
            convertToViewportPoint: (pdfX, pdfY) => [pdfX * scale, h - pdfY * scale]
          };
          if (active) {
            setEditorViewport(fakeViewport);
          }
          return;
        }
        
        // Render a page from the PDF document
        const page = await pdfjsDoc.getPage(currentPage.originalIndex);
        const viewport = page.getViewport({ scale: zoom, rotation: currentPage.rotation });
        
        if (!active) return;
        const canvas = editorCanvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        
        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };
        await page.render(renderContext).promise;
        
        if (active) {
          setEditorViewport(viewport);
        }
      } catch (err) {
        console.error('Error rendering main editor page:', err);
      }
    };
    
    renderEditorPage();
    return () => {
      active = false;
    };
  }, [pdfjsDoc, currentPage?.id, currentPage?.originalIndex, currentPage?.rotation, zoom]);

  // Apply inpainting in the background to sync'ed pages
  const applyInpaintToPage = async (pageConfig, pdfRect, scale) => {
    if (pageConfig.originalIndex === null) return null; // Skip blank pages
    if (!pdfjsDoc) return null;
    
    try {
      const page = await pdfjsDoc.getPage(pageConfig.originalIndex);
      const viewport = page.getViewport({ scale, rotation: pageConfig.rotation });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      
      await page.render({ canvasContext: ctx, viewport }).promise;
      
      // Convert PDF rect to canvas coordinates for this page viewport
      const p1 = viewport.convertToViewportPoint(pdfRect.x, pdfRect.y);
      const p2 = viewport.convertToViewportPoint(pdfRect.x + pdfRect.w, pdfRect.y + pdfRect.h);
      
      const rect = {
        x: Math.min(p1[0], p2[0]),
        y: Math.min(p1[1], p2[1]),
        w: Math.abs(p1[0] - p2[0]),
        h: Math.abs(p1[1] - p2[1])
      };
      
      return inpaintLaplacian(ctx, rect);
    } catch (err) {
      console.error(`Failed to run offscreen inpaint on page index ${pageConfig.originalIndex}:`, err);
      return null;
    }
  };

  // Mapped annotations for absolute CSS / SVG rendering
  const mappedAnnotations = useMemo(() => {
    if (!editorViewport || !currentPage || !currentPage.annotations) return [];
    
    return currentPage.annotations.map(ann => {
      if (ann.type === 'quad-highlight' && ann.points && ann.points.length >= 4) {
        const screenPoints = ann.points.map(pt => {
          const sp = editorViewport.convertToViewportPoint(pt.x, pt.y);
          return { x: sp[0], y: sp[1] };
        });
        const bounds = getPointsBounds(screenPoints);
        return {
          ...ann,
          screenPoints,
          left: bounds.minX,
          top: bounds.minY,
          width: bounds.w,
          height: bounds.h
        };
      }

      const p1 = editorViewport.convertToViewportPoint(ann.rect.x, ann.rect.y);
      const p2 = editorViewport.convertToViewportPoint(ann.rect.x + ann.rect.w, ann.rect.y + ann.rect.h);
      
      const left = Math.min(p1[0], p2[0]);
      const top = Math.min(p1[1], p2[1]);
      const w = Math.abs(p1[0] - p2[0]);
      const h = Math.abs(p1[1] - p2[1]);
      
      return {
        ...ann,
        left,
        top,
        width: w,
        height: h
      };
    });
  }, [currentPage?.annotations, editorViewport]);

  // Create an annotation on current page and sync to selected pages
  const createAnnotation = async (type, pdfRect, color, imageSrc = null, extraProps = {}) => {
    saveToHistory();
    const annId = generateId();
    const syncGroupId = generateId(); // Unique ID to link synchronized edits together
    
    const newAnn = {
      id: annId,
      syncGroupId,
      type,
      rect: pdfRect,
      color,
      imageSrc,
      ...extraProps
    };
    
    // Add to current page
    setPages(prevPages => prevPages.map(p => {
      if (p.id === currentPageId) {
        return {
          ...p,
          annotations: [...p.annotations, newAnn]
        };
      }
      return p;
    }));
    
    // Replicate to selected pages
    if (targetPageIdsForSync.length > 0) {
      if (type === 'inpaint-erase') {
        setIsProcessing(true);
        setProcessingMessage('Đang xử lý xóa hòa nhập đồng bộ trên các trang đã chọn...');
        try {
          const promises = targetPageIdsForSync.map(async (tId) => {
            const targetPage = pages.find(p => p.id === tId);
            if (!targetPage || targetPage.originalIndex === null) return null;
            
            // Run inpaint on target page
            const inpaintImg = await applyInpaintToPage(targetPage, pdfRect, zoom);
            if (inpaintImg) {
              return {
                pageId: tId,
                ann: {
                  id: generateId(),
                  syncGroupId,
                  type: 'inpaint-erase',
                  rect: pdfRect,
                  imageSrc: inpaintImg
                }
              };
            }
            return null;
          });
          
          const results = await Promise.all(promises);
          
          setPages(prevPages => prevPages.map(p => {
            const result = results.find(r => r && r.pageId === p.id);
            if (result) {
              return {
                ...p,
                annotations: [...p.annotations, result.ann]
              };
            }
            return p;
          }));
          showToast(`Đã đồng bộ xóa hòa nhập thành công trên ${results.filter(Boolean).length} trang.`, 'success');
        } catch (err) {
          console.error('Failed to sync inpaint edits:', err);
          showToast('Đồng bộ xóa hòa nhập bị lỗi.', 'error');
        } finally {
          setIsProcessing(false);
        }
      } else {
        // Coordinate copy for highlights and solid covers
        setPages(prevPages => prevPages.map(p => {
          if (targetPageIdsForSync.includes(p.id)) {
            return {
              ...p,
              annotations: [...p.annotations, {
                id: generateId(),
                syncGroupId,
                type,
                rect: pdfRect,
                color,
                ...extraProps
              }]
            };
          }
          return p;
        }));
        showToast(`Đã đồng bộ nét sửa đến ${targetPageIdsForSync.length} trang khác.`, 'success');
      }
    }
    return annId;
  };

  // Delete specific annotation (and synchronized group if editing in sync mode)
  const deleteAnnotation = useCallback((pageId, annId) => {
    saveToHistory();
    const pageObj = pages.find(p => p.id === pageId);
    const annObj = pageObj?.annotations.find(a => a.id === annId);
    const sGroupId = annObj?.syncGroupId;

    setPages(prevPages => prevPages.map(p => {
      if (syncEdits && sGroupId && (p.id === pageId || targetPageIdsForSync.includes(p.id))) {
        return {
          ...p,
          annotations: p.annotations.filter(a => a.syncGroupId !== sGroupId)
        };
      }
      if (p.id === pageId) {
        return {
          ...p,
          annotations: p.annotations.filter(a => a.id !== annId)
        };
      }
      return p;
    }));
    
    if (selectedAnnId === annId) {
      setSelectedAnnId(null);
    }
  }, [pages, syncEdits, targetPageIdsForSync, selectedAnnId]);

  // Update annotation properties (Color), sync'ing color edits to group copies if in sync mode
  const updateAnnotationColor = (newColor) => {
    if (!currentPageId || !selectedAnnId) return;
    saveToHistory();
    const sGroupId = selectedAnn?.syncGroupId;

    setPages(prevPages => prevPages.map(p => {
      if (syncEdits && sGroupId && (p.id === currentPageId || targetPageIdsForSync.includes(p.id))) {
        return {
          ...p,
          annotations: p.annotations.map(a => a.syncGroupId === sGroupId ? { ...a, color: newColor, imageSrc: a.type === 'quad-highlight' && a.blendMode === 'luminance' ? null : a.imageSrc } : a)
        };
      }
      if (p.id === currentPageId) {
        return {
          ...p,
          annotations: p.annotations.map(a => a.id === selectedAnnId ? { ...a, color: newColor, imageSrc: a.type === 'quad-highlight' && a.blendMode === 'luminance' ? null : a.imageSrc } : a)
        };
      }
      return p;
    }));
    showToast('Đã cập nhật màu sắc của nét sửa.', 'success');
  };

  // Update annotation opacity
  const updateAnnotationOpacity = (newOpacity) => {
    if (!currentPageId || !selectedAnnId) return;
    setPages(prevPages => prevPages.map(p => {
      if (p.id === currentPageId) {
        return {
          ...p,
          annotations: p.annotations.map(a => a.id === selectedAnnId ? { ...a, opacity: newOpacity } : a)
        };
      }
      return p;
    }));
  };

  // Corner handle dragging for Quad-Point Highlight
  const handlePointHandleMouseDown = (e, annId, pointIndex) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedAnnId(annId);

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      if (!drawingAreaRef.current || !editorViewport) return;
      const rect = drawingAreaRef.current.getBoundingClientRect();
      const currentScreenX = moveEvent.clientX - rect.left;
      const currentScreenY = moveEvent.clientY - rect.top;

      const [pdfX, pdfY] = editorViewport.convertToPdfPoint(currentScreenX, currentScreenY);

      setPages(prevPages => prevPages.map(p => {
        if (p.id === currentPageId) {
          return {
            ...p,
            annotations: p.annotations.map(a => {
              if (a.id === annId && a.points) {
                const newPoints = [...a.points];
                newPoints[pointIndex] = { x: pdfX, y: pdfY };
                const bounds = getPointsBounds(newPoints);
                return {
                  ...a,
                  points: newPoints,
                  rect: { x: bounds.minX, y: bounds.minY, w: bounds.w, h: bounds.h },
                  imageSrc: a.blendMode === 'luminance' ? null : a.imageSrc
                };
              }
              return a;
            })
          };
        }
        return p;
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      saveToHistory();
      // If boldenText or luminance mode is active, refresh the patch mask with new coordinates
      const currentAnn = currentPage?.annotations.find(a => a.id === annId);
      if (currentAnn && (currentAnn.boldenText || currentAnn.blendMode === 'luminance')) {
        refreshQuadMask(annId);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Dragging entire quad body
  const handleQuadBodyMouseDown = (e, annId) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedAnnId(annId);

    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const ann = currentPage?.annotations.find(a => a.id === annId);
    if (!ann || !ann.points) return;
    const initialPoints = ann.points.map(p => ({ ...p }));

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      if (!drawingAreaRef.current || !editorViewport) return;

      const deltaX = moveEvent.clientX - startClientX;
      const deltaY = moveEvent.clientY - startClientY;

      const pOrigin = editorViewport.convertToPdfPoint(0, 0);
      const pDelta = editorViewport.convertToPdfPoint(deltaX, deltaY);
      const dPdfX = pDelta[0] - pOrigin[0];
      const dPdfY = pDelta[1] - pOrigin[1];

      setPages(prevPages => prevPages.map(p => {
        if (p.id === currentPageId) {
          return {
            ...p,
            annotations: p.annotations.map(a => {
              if (a.id === annId && a.points) {
                const newPoints = initialPoints.map(pt => ({
                  x: pt.x + dPdfX,
                  y: pt.y + dPdfY
                }));
                const bounds = getPointsBounds(newPoints);
                return {
                  ...a,
                  points: newPoints,
                  rect: { x: bounds.minX, y: bounds.minY, w: bounds.w, h: bounds.h },
                  imageSrc: a.blendMode === 'luminance' ? null : a.imageSrc
                };
              }
              return a;
            })
          };
        }
        return p;
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      saveToHistory();
      const currentAnn = currentPage?.annotations.find(a => a.id === annId);
      if (currentAnn && (currentAnn.boldenText || currentAnn.blendMode === 'luminance')) {
        refreshQuadMask(annId);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Helper to re-render the luminance / boldenText mask patch
  const refreshQuadMask = (annId, pointsToUse = null, overrideProps = {}) => {
    const ann = currentPage?.annotations.find(a => a.id === annId);
    if (!ann || !editorCanvasRef.current || !editorViewport) return;

    const points = pointsToUse || ann.points;
    if (!points || points.length < 4) return;

    const bolden = overrideProps.boldenText !== undefined ? overrideProps.boldenText : !!ann.boldenText;
    const isLuminance = overrideProps.blendMode ? overrideProps.blendMode === 'luminance' : ann.blendMode === 'luminance';

    if (!bolden && !isLuminance) {
      setPages(prevPages => prevPages.map(p => {
        if (p.id === currentPageId) {
          return {
            ...p,
            annotations: p.annotations.map(a => a.id === annId ? { ...a, imageSrc: null, ...overrideProps } : a)
          };
        }
        return p;
      }));
      return;
    }

    const screenPoints = points.map(pt => {
      const sp = editorViewport.convertToViewportPoint(pt.x, pt.y);
      return { x: sp[0], y: sp[1] };
    });

    const maskResult = applyLuminanceMask(
      editorCanvasRef.current,
      screenPoints,
      overrideProps.color || ann.color || quadHighlightColor,
      overrideProps.threshold !== undefined ? overrideProps.threshold : (ann.threshold || quadThreshold),
      overrideProps.opacity !== undefined ? overrideProps.opacity : (ann.opacity !== undefined ? ann.opacity : quadOpacity),
      {
        boldenText: bolden,
        darkenStrength: overrideProps.darkenStrength !== undefined ? overrideProps.darkenStrength : (ann.darkenStrength !== undefined ? ann.darkenStrength : 0.7),
        thickenStroke: overrideProps.thickenStroke !== undefined ? overrideProps.thickenStroke : (ann.thickenStroke !== false)
      }
    );

    if (maskResult) {
      setPages(prevPages => prevPages.map(p => {
        if (p.id === currentPageId) {
          return {
            ...p,
            annotations: p.annotations.map(a => a.id === annId ? { ...a, imageSrc: maskResult.dataUrl, ...overrideProps } : a)
          };
        }
        return p;
      }));
    }
  };

  // Toggle boldenText on selected Quad annotation
  const handleToggleBoldenText = (annId) => {
    const ann = currentPage?.annotations.find(a => a.id === annId);
    if (!ann) return;
    saveToHistory();
    const nextVal = !ann.boldenText;
    refreshQuadMask(annId, null, { boldenText: nextVal });
    showToast(nextVal ? 'Đã bật: Tô đậm nét chữ & màu khác bên trong vùng highlight!' : 'Đã tắt tô đậm nét chữ.', 'info');
  };

  // Update darken strength (mức độ tô đậm)
  const handleUpdateDarkenStrength = (annId, newStrength) => {
    refreshQuadMask(annId, null, { darkenStrength: newStrength });
  };

  // Toggle thicken stroke (in đậm nét chữ)
  const handleToggleThickenStroke = (annId, checked) => {
    saveToHistory();
    refreshQuadMask(annId, null, { thickenStroke: checked });
    showToast(checked ? 'Đã bật làm dày nét chữ.' : 'Đã tắt làm dày nét chữ.', 'info');
  };

  // Auto reorder quad points into standard convex order
  const handleReorderQuadPoints = (annId) => {
    if (!currentPageId) return;
    saveToHistory();
    setPages(prevPages => prevPages.map(p => {
      if (p.id === currentPageId) {
        return {
          ...p,
          annotations: p.annotations.map(a => {
            if (a.id === annId && a.points) {
              const reordered = orderQuadPoints(a.points);
              return { ...a, points: reordered };
            }
            return a;
          })
        };
      }
      return p;
    }));
    showToast('Đã tự động sắp xếp lại 4 đỉnh theo thứ tự chuẩn.', 'success');
  };

  // Run pixel luminance masking for Quad Highlight (Algorithm Option 2)
  const handleApplyLuminanceMask = (annId, threshold = 120) => {
    saveToHistory();
    refreshQuadMask(annId, null, { blendMode: 'luminance', threshold });
    showToast('Đã áp dụng quét pixel lọc ngưỡng Luminance (giữ chữ đen)!', 'success');
  };

  // Revert back to real-time Multiply Vector blend mode
  const handleRevertToMultiplyBlend = (annId) => {
    saveToHistory();
    setPages(prevPages => prevPages.map(p => {
      if (p.id === currentPageId) {
        return {
          ...p,
          annotations: p.annotations.map(a => {
            if (a.id === annId) {
              return {
                ...a,
                blendMode: 'multiply',
                imageSrc: a.boldenText ? a.imageSrc : null
              };
            }
            return a;
          })
        };
      }
      return p;
    }));
    showToast('Đã chuyển sang chế độ hòa trộn Multiply Vector mượt mà!', 'info');
  };

  // Global keydown handler for Escape (cancel 4-point selection) and Delete (delete selected annotation)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (quadPointsInProgress.length > 0) {
          setQuadPointsInProgress([]);
          showToast('Đã hủy vẽ tứ giác.', 'info');
        } else if (selectedAnnId) {
          setSelectedAnnId(null);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
        if (selectedAnnId && currentPageId && !isInput) {
          deleteAnnotation(currentPageId, selectedAnnId);
          showToast('Đã xóa nét sửa.', 'info');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quadPointsInProgress, selectedAnnId, currentPageId, deleteAnnotation]);

  // Drawing Event Handlers
  const handleMouseDown = (e) => {
    if (tool === 'view' || !editorViewport) return;
    const rect = drawingAreaRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'quad-highlight') {
      const newPts = [...quadPointsInProgress, { x, y }];
      if (newPts.length < 4) {
        setQuadPointsInProgress(newPts);
      } else {
        // Complete Quad!
        const ordered = orderQuadPoints(newPts);
        const pdfPoints = ordered.map(pt => {
          const [px, py] = editorViewport.convertToPdfPoint(pt.x, pt.y);
          return { x: px, y: py };
        });
        const bounds = getPointsBounds(pdfPoints);

        let initialImageSrc = null;
        if ((quadBlendMode === 'luminance' || quadBoldenText) && editorCanvasRef.current) {
          const maskResult = applyLuminanceMask(
            editorCanvasRef.current,
            ordered,
            quadHighlightColor,
            quadThreshold,
            quadOpacity,
            {
              boldenText: quadBoldenText,
              darkenStrength: quadDarkenStrength,
              thickenStroke: quadThickenStroke
            }
          );
          if (maskResult) {
            initialImageSrc = maskResult.dataUrl;
          }
        }

        createAnnotation(
          'quad-highlight',
          {
            x: bounds.minX,
            y: bounds.minY,
            w: bounds.w,
            h: bounds.h
          },
          quadHighlightColor,
          initialImageSrc,
          {
            points: pdfPoints,
            opacity: quadOpacity,
            blendMode: quadBlendMode,
            threshold: quadThreshold,
            boldenText: quadBoldenText,
            darkenStrength: quadDarkenStrength,
            thickenStroke: quadThickenStroke
          }
        ).then(newAnnId => {
          if (newAnnId) setSelectedAnnId(newAnnId);
        });

        setQuadPointsInProgress([]);
        showToast('Đã tạo Highlight 4 điểm! Bạn có thể kéo các đỉnh A, B, C, D để căn chỉnh.', 'success');
      }
      return;
    }

    isDrawingRef.current = true;
    startPosRef.current = { x, y };
    setDrawingBox({ x, y, w: 0, h: 0 });
    setSelectedAnnId(null); // Clear selection when drawing
  };

  const handleMouseMove = (e) => {
    if (!editorViewport || !drawingAreaRef.current) return;
    const rect = drawingAreaRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'quad-highlight') {
      setCurrentMousePos({ x, y });
      return;
    }

    if (!isDrawingRef.current || !drawingBox) return;
    
    const startX = startPosRef.current.x;
    const startY = startPosRef.current.y;
    
    setDrawingBox({
      x: Math.min(startX, x),
      y: Math.min(startY, y),
      w: Math.abs(startX - x),
      h: Math.abs(startY - y)
    });
  };

  const handleMouseUp = async () => {
    if (tool === 'quad-highlight') return;
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    
    if (drawingBox && drawingBox.w > 5 && drawingBox.h > 5) {
      const rect = { ...drawingBox };
      setDrawingBox(null);
      
      // Calculate PDF coordinates using the viewport conversion tool
      const p1 = editorViewport.convertToPdfPoint(rect.x, rect.y);
      const p2 = editorViewport.convertToPdfPoint(rect.x + rect.w, rect.y + rect.h);
      const pdfRect = {
        x: Math.min(p1[0], p2[0]),
        y: Math.min(p1[1], p2[1]),
        w: Math.abs(p1[0] - p2[0]),
        h: Math.abs(p1[1] - p2[1])
      };
      
      if (tool === 'highlight') {
        createAnnotation('highlight', pdfRect, highlightColor);
      } else if (tool === 'text-highlight') {
        createAnnotation('text-highlight', pdfRect, highlightColor);
      } else if (tool === 'solid-highlight') {
        createAnnotation('solid-highlight', pdfRect, highlightColor);
      } else if (tool === 'solid') {
        createAnnotation('solid-erase', pdfRect, eraseColor);
      } else if (tool === 'inpaint') {
        // Run Coons Patch Inpaint on the active canvas
        const ctx = editorCanvasRef.current.getContext('2d');
        const imageSrc = inpaintLaplacian(ctx, rect);
        if (imageSrc) {
          createAnnotation('inpaint-erase', pdfRect, null, imageSrc);
          showToast('Đã xóa hòa nhập vùng chọn.', 'success');
        } else {
          showToast('Không thể lấy vùng ảnh để xóa hòa nhập.', 'error');
        }
      }
    } else {
      setDrawingBox(null);
    }
  };

  // File Upload Handlers
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      showToast('Vui lòng tải lên file PDF hợp lệ!', 'error');
      return;
    }
    
    setIsProcessing(true);
    setProcessingMessage('Đang tải và phân tích cấu trúc file PDF...');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      setPdfFile(arrayBuffer);
      
      // Slice arrayBuffer to avoid detaching it in main thread when passing to worker
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      setPdfjsDoc(doc);
      
      const pageConfigs = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        pageConfigs.push({
          id: generateId(),
          originalIndex: i,
          rotation: 0,
          width: viewport.width,
          height: viewport.height,
          annotations: []
        });
      }
      
      setPages(pageConfigs);
      setCurrentPageId(pageConfigs[0].id);
      setSelectedSyncPages([]);
      setHistory([]);
      setRedoStack([]);
      showToast('Tải PDF thành công!', 'success');
    } catch (err) {
      console.error('Error loading PDF file:', err);
      showToast('Không thể đọc file PDF. Vui lòng kiểm tra lại.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reordering, Duplicating, Inserting, and Deleting pages
  const movePage = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pages.length) return;
    saveToHistory();
    setPages(prevPages => {
      const nextPages = [...prevPages];
      const temp = nextPages[index];
      nextPages[index] = nextPages[targetIndex];
      nextPages[targetIndex] = temp;
      return nextPages;
    });
    showToast('Đã thay đổi thứ tự trang.', 'info');
  };

  const duplicatePage = (pageId) => {
    saveToHistory();
    setPages(prevPages => {
      const index = prevPages.findIndex(p => p.id === pageId);
      if (index === -1) return prevPages;
      const pageToDuplicate = prevPages[index];
      const newPage = {
        ...pageToDuplicate,
        id: generateId(),
        annotations: pageToDuplicate.annotations.map(ann => ({
          ...ann,
          id: generateId()
        }))
      };
      const nextPages = [...prevPages];
      nextPages.splice(index + 1, 0, newPage);
      return nextPages;
    });
    showToast('Đã nhân bản trang.', 'success');
  };

  const addBlankPage = () => {
    saveToHistory();
    const newPage = {
      id: generateId(),
      originalIndex: null,
      rotation: 0,
      width: 595.276, // A4 dimensions
      height: 841.890,
      annotations: []
    };
    
    setPages(prevPages => {
      const currentIndex = prevPages.findIndex(p => p.id === currentPageId);
      const nextPages = [...prevPages];
      if (currentIndex !== -1) {
        nextPages.splice(currentIndex + 1, 0, newPage);
      } else {
        nextPages.push(newPage);
      }
      return nextPages;
    });
    setCurrentPageId(newPage.id);
    showToast('Đã thêm trang trống mới.', 'success');
  };

  const deletePage = (pageId) => {
    if (pages.length <= 1) {
      showToast('Tài liệu phải chứa ít nhất 1 trang!', 'error');
      return;
    }
    saveToHistory();
    setPages(prevPages => prevPages.filter(p => p.id !== pageId));
    if (currentPageId === pageId) {
      const remaining = pages.filter(p => p.id !== pageId);
      setCurrentPageId(remaining[0].id);
    }
    setSelectedSyncPages(prev => prev.filter(id => id !== pageId));
    showToast('Đã xóa trang.', 'info');
  };

  const rotatePage = (pageId) => {
    saveToHistory();
    setPages(prevPages => prevPages.map(p => {
      if (p.id === pageId) {
        return {
          ...p,
          rotation: (p.rotation + 90) % 360
        };
      }
      return p;
    }));
    showToast('Đã xoay trang 90°.', 'info');
  };

  // Toggle sync targeting
  const toggleSyncSelection = (pageId) => {
    if (pageId === currentPageId) return;
    setSelectedSyncPages(prev => {
      if (prev.includes(pageId)) {
        return prev.filter(id => id !== pageId);
      } else {
        return [...prev, pageId];
      }
    });
  };

  // Export PDF triggered
  const handleExport = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    setProcessingMessage('Đang kết xuất và đóng gói file PDF chỉnh sửa...');
    try {
      const editedBytes = await exportPdf(pdfFile, pages);
      
      const blob = new Blob([editedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'edited_document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Xuất tệp PDF và tải về thành công!', 'success');
    } catch (err) {
      console.error('Error exporting PDF:', err);
      showToast('Đã xảy ra lỗi khi kết xuất PDF.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset tool / Close document
  const executeCloseDocument = () => {
    setPdfFile(null);
    setPdfjsDoc(null);
    setPages([]);
    setCurrentPageId('');
    setSelectedSyncPages([]);
    setSelectedAnnId(null);
    setZoom(1.5);
    setTool('view');
    setHistory([]);
    setRedoStack([]);
    showToast('Đã đóng tài liệu.', 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {toast.type === 'success' && <CheckCircle2 size={16} color="#10b981" />}
              {toast.type === 'error' && <AlertTriangle size={16} color="#ef4444" />}
              {toast.type === 'info' && <Info size={16} color="var(--accent-primary)" />}
              <span>{toast.message}</span>
            </div>
            <button className="toast-close-btn" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <div className="loading-text">{processingMessage}</div>
        </div>
      )}

      {/* Support Modal (QR BIDV) */}
      {showSupportModal && (
        <div className="loading-overlay" style={{ cursor: 'default', zIndex: 1000 }} onClick={() => setShowSupportModal(false)}>
          <div 
            className="upload-card" 
            style={{ maxWidth: '340px', padding: '24px', border: '1px solid var(--border-color)', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <button 
              className="modal-close-btn" 
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              onClick={() => setShowSupportModal(false)}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'white', textAlign: 'center' }}>Ủng hộ tác giả</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', textAlign: 'center', lineHeight: '1.4' }}>
              Quét mã QR sau để ủng hộ nhà phát triển PDFSuper Editor qua ngân hàng BIDV. Cảm ơn bạn!
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px', background: 'white', borderRadius: '12px', marginBottom: '16px' }}>
              <img 
                src="/bidv.png" 
                alt="Ủng hộ BIDV" 
                style={{ width: '100%', maxHeight: '380px', objectFit: 'contain', borderRadius: '8px' }} 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://placehold.co/280x380?text=BIDV+QR+Code';
                }}
              />
            </div>
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowSupportModal(false)}>
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Inpaint Help Modal */}
      {showInpaintHelpModal && (
        <div className="loading-overlay" style={{ cursor: 'default', zIndex: 1000 }} onClick={() => setShowInpaintHelpModal(false)}>
          <div 
            className="upload-card" 
            style={{ maxWidth: '780px', width: '95%', padding: '24px', border: '1px solid var(--border-color)', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <button 
              className="modal-close-btn" 
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              onClick={() => setShowInpaintHelpModal(false)}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'white', textAlign: 'center' }}>Hướng dẫn xóa hòa nhập hoàn hảo</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', textAlign: 'center', lineHeight: '1.4' }}>
              Thuật toán Bilinear Coons Patch hoạt động tốt nhất khi bạn vẽ khung chọn bao quanh rộng hơn logo từ 3-5px để lấy chính xác màu sắc của nền xung quanh.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
                  <img src="/inpaint_step1.png" alt="Bước 1" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>1. Logo gốc trên nền</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
                  <img src="/inpaint_step2.png" alt="Bước 2" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>2. Vẽ viền rộng hơn 3-5px</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
                  <img src="/inpaint_step3.png" alt="Bước 3" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>3. Nền tự động hòa hợp</span>
              </div>
            </div>
            
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowInpaintHelpModal(false)}>
              Đã hiểu, tiếp tục chỉnh sửa
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon">
            <img 
              src="/logo.png" 
              alt="Logo" 
              style={{ width: '26px', height: '26px', objectFit: 'contain' }} 
              onError={(e) => {
                e.target.onerror = null;
                // fallback to a generic logo styling if logo.png doesn't load
                e.target.style.display = 'none';
              }}
            />
          </div>
          <div className="logo-text">
            <h1>PDFSuper Editor</h1>
            <span>Trình chỉnh sửa & xóa logo PDF chuyên nghiệp</span>
          </div>
        </div>

        {/* Contact Links & Support Row */}
        <div className="header-contacts-container">
          <div className="social-links-row">
            <a href="https://facebook.com/annc19324" target="_blank" rel="noopener noreferrer" className="contact-item facebook" title="Facebook">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href="https://www.tiktok.com/@annc19324" target="_blank" rel="noopener noreferrer" className="contact-item tiktok" title="TikTok">
              <TikTokIcon size={20} />
            </a>
            <a href="https://www.youtube.com/@annc19324" target="_blank" rel="noopener noreferrer" className="contact-item youtube" title="YouTube">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.377.505 9.377.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
            
            <div className="contact-divider"></div>
            
            <a href="mailto:annc19324@gmail.com" className="contact-item text-item email" title="Mail: annc19324@gmail.com">
              <Mail size={17} />
              <span>annc19324@gmail.com</span>
            </a>
            <a href="tel:0337090061" className="contact-item text-item phone" title="SĐT: 0337090061">
              <Phone size={17} />
              <span>0337090061</span>
            </a>
          </div>

          <button className="btn-support" onClick={() => setShowSupportModal(true)} title="Nhấn để xem thông tin ủng hộ">
            ☕ Ủng hộ
          </button>
        </div>

        <div className="header-actions">
          {pdfFile && (
            <>
              {/* Sidebar toggle buttons */}
              <button 
                className={`sidebar-toggle-btn ${showLeftSidebar ? 'active' : ''}`} 
                onClick={() => setShowLeftSidebar(!showLeftSidebar)}
                title="Bật/Tắt danh sách trang"
              >
                <Layers size={18} />
              </button>
              <button 
                className={`sidebar-toggle-btn ${showRightSidebar ? 'active' : ''}`} 
                onClick={() => setShowRightSidebar(!showRightSidebar)}
                title="Bật/Tắt cài đặt chi tiết"
              >
                <Settings size={18} />
              </button>
              <div className="toolbar-divider" style={{ height: 24, margin: '0 8px' }}></div>
              <button className="btn-secondary" onClick={executeCloseDocument}>
                <XCircle size={16} /> Đóng tài liệu
              </button>
              <button className="btn-primary" onClick={handleExport}>
                <Download size={16} /> Tải file về
              </button>
            </>
          )}
        </div>
      </header>

      {!pdfFile ? (
        /* Upload Dashboard */
        <div className="upload-dashboard">
          <div className="upload-card" onClick={() => document.getElementById('pdf-upload-input').click()}>
            <div className="upload-icon-wrapper">
              <Upload size={32} />
            </div>
            <h2>Tải lên tài liệu PDF</h2>
            <p>Kéo thả tệp PDF hoặc nhấp để duyệt tìm tập tin trong máy tính của bạn</p>
            <button className="btn-primary">
              <FolderOpen size={16} /> Chọn tệp PDF
            </button>
            <input
              id="pdf-upload-input"
              type="file"
              accept="application/pdf"
              className="file-input-hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      ) : (
        /* Workspace */
        <div className="app-workspace">
          
          {/* Left Sidebar: Thumbnails & Page Controls */}
          <aside className={`app-sidebar ${showLeftSidebar ? '' : 'collapsed'}`}>
            <div className="sidebar-header">
              <h3>Danh sách trang ({pages.length})</h3>
              <button 
                className="tool-btn" 
                onClick={addBlankPage} 
                title="Thêm trang trống mới"
                style={{ color: 'var(--accent-primary)', backgroundColor: 'var(--bg-panel-hover)' }}
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Quick Bulk Selection buttons for manual sync mode */}
            {syncEdits && syncMode === 'manual' && (
              <div style={{ display: 'flex', gap: '8px', padding: '4px 12px 12px 12px', borderBottom: '1px solid var(--border-color)' }}>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '6px 10px', fontSize: '12px', flex: 1, height: '32px', justifyContent: 'center' }}
                  onClick={() => setSelectedSyncPages(pages.filter(p => p.id !== currentPageId).map(p => p.id))}
                >
                  Chọn tất cả
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '6px 10px', fontSize: '12px', flex: 1, height: '32px', justifyContent: 'center' }}
                  onClick={() => setSelectedSyncPages([])}
                >
                  Bỏ chọn
                </button>
              </div>
            )}
            
            <div className="thumbnail-list">
              {pages.map((page, idx) => {
                const isActive = page.id === currentPageId;
                const isTarget = targetPageIdsForSync.includes(page.id);
                
                return (
                  <div 
                    key={page.id} 
                    className={`thumbnail-card ${isActive ? 'active' : ''} ${isTarget ? 'sync-target' : ''}`}
                    onClick={() => setCurrentPageId(page.id)}
                  >
                    {/* Sync Checkbox selection */}
                    {syncEdits && syncMode === 'manual' && page.id !== currentPageId && (
                      <input 
                        type="checkbox"
                        className="thumbnail-select-checkbox"
                        checked={selectedSyncPages.includes(page.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSyncSelection(page.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}

                    <div className="thumbnail-wrapper">
                      <ThumbnailCanvas pdfDoc={pdfjsDoc} pageConfig={page} />
                    </div>

                    <div className="thumbnail-info">
                      <span className="thumbnail-number">Trang {idx + 1}</span>
                      
                      {isActive && <span className="thumbnail-badge sync" style={{backgroundColor: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)'}}>Đang sửa</span>}
                      {!isActive && isTarget && <span className="thumbnail-badge sync">Đang đồng bộ</span>}
                    </div>

                    {/* Quick controls */}
                    <div className="thumbnail-actions" onClick={e => e.stopPropagation()}>
                      <button 
                        className="thumbnail-btn" 
                        disabled={idx === 0} 
                        onClick={() => movePage(idx, -1)}
                        title="Di chuyển lên"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button 
                        className="thumbnail-btn" 
                        disabled={idx === pages.length - 1} 
                        onClick={() => movePage(idx, 1)}
                        title="Di chuyển xuống"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button 
                        className="thumbnail-btn" 
                        onClick={() => rotatePage(page.id)}
                        title="Xoay 90°"
                      >
                        <RotateCw size={14} />
                      </button>
                      <button 
                        className="thumbnail-btn" 
                        onClick={() => duplicatePage(page.id)}
                        title="Nhân bản trang"
                      >
                        <Copy size={14} />
                      </button>
                      <button 
                        className="thumbnail-btn danger" 
                        onClick={() => deletePage(page.id)}
                        title="Xóa trang"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Main workspace with top toolbar and center viewport */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            
            {/* Toolbar */}
            <div className="app-toolbar">
              
              {/* Tool Selection Group */}
              <div className="toolbar-group">
                <span className="toolbar-label">Công cụ:</span>
                <button 
                  className={`tool-btn-labeled ${tool === 'view' ? 'active' : ''}`}
                  onClick={() => { setTool('view'); setSelectedAnnId(null); setQuadPointsInProgress([]); }}
                >
                  <Eye size={16} /> Xem
                </button>
                <button 
                  className={`tool-btn-labeled ${tool === 'highlight' ? 'active' : ''}`}
                  onClick={() => { setTool('highlight'); setSelectedAnnId(null); setQuadPointsInProgress([]); }}
                  title="Tô màu mờ trộn với nền văn bản"
                >
                  <Highlighter size={16} /> Highlight trộn
                </button>
                <button 
                  className={`tool-btn-labeled ${tool === 'text-highlight' ? 'active' : ''}`}
                  onClick={() => { setTool('text-highlight'); setSelectedAnnId(null); setQuadPointsInProgress([]); }}
                  title="Tô màu đậm vẽ dưới chữ giúp chữ rõ nét"
                >
                  <Highlighter size={16} style={{ transform: 'rotate(90deg)' }} /> Highlight rõ chữ
                </button>
                <button 
                  className={`tool-btn-labeled ${tool === 'solid-highlight' ? 'active' : ''}`}
                  onClick={() => { setTool('solid-highlight'); setSelectedAnnId(null); setQuadPointsInProgress([]); }}
                  title="Tô màu vàng đậm nguyên bản đè lên nền"
                >
                  <Paintbrush size={16} /> Highlight đè
                </button>
                <button 
                  className={`tool-btn-labeled ${tool === 'quad-highlight' ? 'active' : ''}`}
                  onClick={() => { setTool('quad-highlight'); setSelectedAnnId(null); setQuadPointsInProgress([]); }}
                  title="Highlight 4 điểm (Quad/Phối cảnh) cho dòng & ô bảng bị nghiêng lệch góc"
                  style={tool === 'quad-highlight' ? { borderColor: '#FFF176' } : {}}
                >
                  <QuadIcon size={16} /> Quad Highlight
                </button>
                <button 
                  className={`tool-btn-labeled ${tool === 'solid' ? 'active' : ''}`}
                  onClick={() => { setTool('solid'); setSelectedAnnId(null); setQuadPointsInProgress([]); }}
                >
                  <Square size={16} /> Xóa che màu
                </button>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <button 
                    className={`tool-btn-labeled ${tool === 'inpaint' ? 'active' : ''}`}
                    onClick={() => { setTool('inpaint'); setSelectedAnnId(null); setQuadPointsInProgress([]); }}
                  >
                    <Sparkles size={16} /> Xóa hòa nhập
                  </button>
                  <button 
                    className="help-btn"
                    onClick={() => setShowInpaintHelpModal(true)}
                    title="Hướng dẫn xóa hòa nhập hiệu quả nhất"
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-panel-hover)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      height: '38px',
                      width: '38px',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <HelpIcon size={16} />
                  </button>
                </div>
              </div>

              {/* Color Customization picker */}
              {(tool === 'highlight' || tool === 'text-highlight' || tool === 'solid-highlight' || tool === 'solid') && (
                <>
                  <div className="toolbar-divider"></div>
                  <div className="toolbar-group">
                    <span className="toolbar-label">Màu sắc:</span>
                    {(tool === 'highlight' || tool === 'text-highlight' || tool === 'solid-highlight') && (
                      <div className="color-picker-wrapper">
                        <input 
                          type="color" 
                          className="color-input" 
                          value={highlightColor} 
                          onChange={(e) => setHighlightColor(e.target.value)} 
                        />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Highlight</span>
                      </div>
                    )}
                    {tool === 'solid' && (
                      <div className="color-picker-wrapper">
                        <input 
                          type="color" 
                          className="color-input" 
                          value={eraseColor} 
                          onChange={(e) => setEraseColor(e.target.value)} 
                        />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Màu che</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Quad-Point Highlight Customization Settings */}
              {tool === 'quad-highlight' && (
                <>
                  <div className="toolbar-divider"></div>
                  <div className="toolbar-group">
                    <span className="toolbar-label">Màu Quad:</span>
                    <div className="color-picker-wrapper" title="Bảng chọn màu tùy chỉnh">
                      <input 
                        type="color" 
                        className="color-input" 
                        value={quadHighlightColor} 
                        onChange={(e) => setQuadHighlightColor(e.target.value)} 
                      />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{quadHighlightColor}</span>
                    </div>

                    {/* Quick Preset Palette */}
                    <div className="color-presets-row" style={{ marginLeft: '4px' }}>
                      {HIGHLIGHT_PRESET_COLORS.map(c => (
                        <div
                          key={c.value}
                          className={`color-preset-chip ${quadHighlightColor.toLowerCase() === c.value.toLowerCase() ? 'active' : ''}`}
                          style={{ backgroundColor: c.value }}
                          onClick={() => setQuadHighlightColor(c.value)}
                          title={`${c.label} (${c.value})`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="toolbar-divider"></div>
                  <div className="toolbar-group">
                    <span className="toolbar-label">Độ mờ:</span>
                    <div className="setting-slider-row" style={{ width: 110 }}>
                      <input 
                        type="range"
                        min="0.25"
                        max="0.95"
                        step="0.05"
                        value={quadOpacity}
                        onChange={(e) => setQuadOpacity(parseFloat(e.target.value))}
                        className="setting-slider"
                      />
                      <span style={{ fontSize: 12, minWidth: 30, color: 'var(--text-secondary)' }}>
                        {Math.round(quadOpacity * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="toolbar-divider"></div>
                  <div className="toolbar-group">
                    <span className="toolbar-label">Thuật toán:</span>
                    <button
                      className={`tool-btn-labeled ${quadBlendMode === 'multiply' ? 'active' : ''}`}
                      style={{ height: 32, fontSize: 12, padding: '0 8px' }}
                      onClick={() => setQuadBlendMode('multiply')}
                      title="Chế độ hòa trộn Multiply: Giữ 100% mực chữ đen, nền giấy biến thành màu highlight"
                    >
                      Multiply (Mượt)
                    </button>
                    <button
                      className={`tool-btn-labeled ${quadBlendMode === 'luminance' ? 'active' : ''}`}
                      style={{ height: 32, fontSize: 12, padding: '0 8px' }}
                      onClick={() => setQuadBlendMode('luminance')}
                      title="Chế độ quét pixel lọc ngưỡng Luminance (L < Threshold giữ chữ đen)"
                    >
                      Lọc chữ đen (Pixel)
                    </button>

                    {quadBlendMode === 'luminance' && (
                      <div className="setting-slider-row" style={{ width: 120, marginLeft: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ngưỡng:</span>
                        <input 
                          type="range"
                          min="60"
                          max="200"
                          step="5"
                          value={quadThreshold}
                          onChange={(e) => setQuadThreshold(parseInt(e.target.value, 10))}
                          className="setting-slider"
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{quadThreshold}</span>
                      </div>
                    )}
                  </div>

                  <div className="toolbar-divider"></div>
                  <div className="toolbar-group">
                    <button
                      className={`tool-btn-labeled ${quadBoldenText ? 'active' : ''}`}
                      style={{
                        height: 32,
                        fontSize: 12,
                        padding: '0 10px',
                        ...(quadBoldenText ? { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderColor: '#10b981', color: '#fff' } : {})
                      }}
                      onClick={() => setQuadBoldenText(!quadBoldenText)}
                      title="Bật/Tắt: Tô đậm nét chữ và phần khác màu highlight bên trong vùng tứ giác"
                    >
                      <span style={{ fontWeight: 800, fontSize: 13, marginRight: 2 }}>B</span>
                      Tô đậm chữ: {quadBoldenText ? 'BẬT' : 'TẮT'}
                    </button>
                    {quadBoldenText && (
                      <>
                        <div className="setting-slider-row" style={{ width: 105, marginLeft: 4 }} title="Mức độ tô đậm nét chữ">
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Đậm:</span>
                          <input 
                            type="range"
                            min="0.3"
                            max="1.0"
                            step="0.05"
                            value={quadDarkenStrength}
                            onChange={(e) => setQuadDarkenStrength(parseFloat(e.target.value))}
                            className="setting-slider"
                          />
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {Math.round(quadDarkenStrength * 100)}%
                          </span>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-secondary)', marginLeft: 4 }} title="Làm dày viền nét (in đậm chữ)">
                          <input
                            type="checkbox"
                            checked={quadThickenStroke}
                            onChange={(e) => setQuadThickenStroke(e.target.checked)}
                          />
                          <span>Dày nét</span>
                        </label>
                      </>
                    )}
                  </div>
                </>
              )}

              <div className="toolbar-divider"></div>

              {/* Sync Pages Control Group */}
              <div className={`sync-panel ${syncEdits ? 'active' : ''}`}>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={syncEdits} 
                    onChange={(e) => {
                      setSyncEdits(e.target.checked);
                      if (e.target.checked) {
                        showToast("Đã bật chế độ sửa đồng bộ.", "info");
                      }
                    }} 
                  />
                  <span className="slider"></span>
                </label>
                <span style={{ fontSize: 13, fontWeight: 600, color: syncEdits ? 'white' : 'var(--text-secondary)' }}>
                  Sửa đồng bộ ({targetPageIdsForSync.length} trang)
                </span>
                
                {syncEdits && (
                  <select 
                    value={syncMode} 
                    onChange={(e) => setSyncMode(e.target.value)}
                    style={{
                      background: 'var(--bg-panel)',
                      color: 'white',
                      border: '1px solid var(--border-color)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    <option value="all">Tất cả trang khác</option>
                    <option value="manual">Trang được chọn</option>
                  </select>
                )}
              </div>

              <div className="toolbar-divider"></div>

              {/* Toggle Frames Control Group */}
              <div className="toolbar-group" style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                  <input 
                    type="checkbox" 
                    checked={showAnnotationFrames} 
                    onChange={(e) => setShowAnnotationFrames(e.target.checked)} 
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: showAnnotationFrames ? 'white' : 'var(--text-secondary)', fontWeight: showAnnotationFrames ? 600 : 400 }}>Hiện viền sửa</span>
                </label>
              </div>

              {/* Undo / Redo Group */}
              <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
                <button 
                  className="tool-btn" 
                  onClick={handleUndo} 
                  disabled={history.length === 0}
                  title="Trở lại (Undo)"
                >
                  <Undo size={16} />
                </button>
                <button 
                  className="tool-btn" 
                  onClick={handleRedo} 
                  disabled={redoStack.length === 0}
                  title="Tiếp (Redo)"
                >
                  <Redo size={16} />
                </button>
              </div>

              <div className="toolbar-divider"></div>

              {/* Zoom Controls */}
              <div className="toolbar-group">
                <button className="tool-btn" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} title="Thu nhỏ">
                  <ZoomOut size={16} />
                </button>
                <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
                <button className="tool-btn" onClick={() => setZoom(z => Math.min(3.0, z + 0.25))} title="Phóng to">
                  <ZoomIn size={16} />
                </button>
              </div>

            </div>

            {/* Canvas Editor Container */}
            <div ref={editorContainerRef} className="app-editor-container" onClick={() => setSelectedAnnId(null)}>
              {currentPage && (
                <div 
                  className="editor-workspace-wrapper"
                  style={{
                    width: editorViewport ? `${editorViewport.width}px` : 'auto',
                    height: editorViewport ? `${editorViewport.height}px` : 'auto',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Underlay PDF Page Canvas */}
                  <canvas ref={editorCanvasRef} className="editor-page-canvas" />

                  {/* Interactive Drawing and Annotation Overlay */}
                  <div 
                    ref={drawingAreaRef}
                    className={`editor-drawing-overlay tool-${tool}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  >
                    {/* Floating Guide Banner for Quad-Point Tool */}
                    {tool === 'quad-highlight' && (
                      <div className="quad-guide-banner">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <QuadIcon size={16} style={{ color: quadHighlightColor }} />
                          <span>
                            {quadPointsInProgress.length === 0 && 'Nhấp chuột chọn điểm A (Góc 1) trên dòng/ô nghiêng'}
                            {quadPointsInProgress.length === 1 && 'Nhấp chọn điểm B (Góc 2)'}
                            {quadPointsInProgress.length === 2 && 'Nhấp chọn điểm C (Góc 3)'}
                            {quadPointsInProgress.length === 3 && 'Nhấp chọn điểm D (Góc 4) để chốt vùng highlight'}
                          </span>
                        </div>
                        <div className="quad-guide-steps">
                          {['A', 'B', 'C', 'D'].map((letter, idx) => (
                            <div 
                              key={letter}
                              className={`quad-step-dot ${quadPointsInProgress.length > idx ? 'completed' : (quadPointsInProgress.length === idx ? 'active' : '')}`}
                            >
                              {letter}
                            </div>
                          ))}
                        </div>
                        {quadPointsInProgress.length > 0 && (
                          <button 
                            className="quad-banner-cancel-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuadPointsInProgress([]);
                              showToast('Đã hủy vẽ tứ giác.', 'info');
                            }}
                            title="Hủy vẽ (Phím Esc)"
                          >
                            <X size={12} /> Hủy (Esc)
                          </button>
                        )}
                      </div>
                    )}

                    {/* Render existing rectangular annotations */}
                    {mappedAnnotations.filter(ann => ann.type !== 'quad-highlight').map(ann => {
                      const isSelected = ann.id === selectedAnnId;
                      const isHighlightType = ann.type === 'highlight' || ann.type === 'solid-highlight' || ann.type === 'text-highlight';
                      const isMultiplyBlend = ann.type === 'highlight' || ann.type === 'text-highlight';
                      const shouldShowFrame = showAnnotationFrames || isSelected;
                      
                      let borderStyle = 'none';
                      if (shouldShowFrame) {
                        if (isHighlightType) {
                          borderStyle = `1px dashed ${ann.color || '#EFDE05'}`;
                        } else if (ann.type === 'solid-erase') {
                          borderStyle = `1px dashed #6366f1`; // Purple dashed for solid-erase frame
                        } else if (ann.type === 'inpaint-erase') {
                          borderStyle = `1px dashed #10b981`; // Green dashed for inpaint frame
                        }
                      }

                      return (
                        <div
                          key={ann.id}
                          className={`placed-annotation type-${ann.type} ${isSelected ? 'selected' : ''}`}
                          style={{
                            left: `${ann.left}px`,
                            top: `${ann.top}px`,
                            width: `${ann.width}px`,
                            height: `${ann.height}px`,
                            mixBlendMode: isMultiplyBlend ? 'multiply' : 'normal',
                            backgroundColor: ann.type === 'highlight' 
                              ? hexToRgba(ann.color || '#EFDE05', 0.35) 
                              : (ann.type === 'text-highlight' ? hexToRgba(ann.color || '#EFDE05', 0.8) : (ann.type === 'solid-highlight' ? hexToRgba(ann.color || '#EFDE05', 0.9) : (ann.type === 'solid-erase' ? ann.color : 'transparent'))),
                            border: borderStyle,
                            pointerEvents: showAnnotationFrames ? 'auto' : 'none'
                          }}
                          onClick={(e) => {
                            if (!showAnnotationFrames) return;
                            e.stopPropagation();
                            setSelectedAnnId(ann.id);
                          }}
                        >
                          {ann.type === 'inpaint-erase' && (
                            <img src={ann.imageSrc} className="placed-annotation-image" alt="Patched logo" />
                          )}
                          
                          {shouldShowFrame && (
                            <button
                              className="placed-annotation-delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAnnotation(currentPage.id, ann.id);
                                showToast('Đã xóa nét sửa.', 'info');
                              }}
                              title="Xóa nét sửa này"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* SVG Layer for Quad-Point Highlights (Perspective Polygons & Interactive Handles) */}
                    <svg className="quad-svg-overlay">
                      {/* Render existing Quad-Point Highlight annotations */}
                      {mappedAnnotations.filter(ann => ann.type === 'quad-highlight' && ann.screenPoints && ann.screenPoints.length >= 4).map(ann => {
                        const isSelected = ann.id === selectedAnnId;
                        const shouldShowHandles = isSelected || showAnnotationFrames;
                        const pts = ann.screenPoints;
                        const ptsString = pts.map(p => `${p.x},${p.y}`).join(' ');

                        return (
                          <g key={ann.id}>
                            {/* Luminance mask raster overlay if applied */}
                            {ann.imageSrc && (
                              <image
                                href={ann.imageSrc}
                                x={ann.left}
                                y={ann.top}
                                width={ann.width}
                                height={ann.height}
                                preserveAspectRatio="none"
                              />
                            )}

                            {/* Anti-aliased Vector Quadrilateral */}
                            <polygon
                              points={ptsString}
                              fill={ann.imageSrc ? 'transparent' : (ann.color || '#FFF176')}
                              fillOpacity={ann.opacity !== undefined ? ann.opacity : 0.65}
                              stroke={isSelected ? '#6366f1' : (shouldShowHandles ? (ann.color || '#FFF176') : 'none')}
                              strokeWidth={isSelected ? 2 : 1}
                              strokeDasharray={isSelected ? '4,4' : (shouldShowHandles ? '3,3' : 'none')}
                              className="quad-polygon-body"
                              style={{
                                mixBlendMode: ann.blendMode === 'multiply' || !ann.blendMode ? 'multiply' : 'normal',
                                pointerEvents: (shouldShowHandles || tool === 'view' || (tool === 'quad-highlight' && quadPointsInProgress.length === 0)) ? 'auto' : 'none'
                              }}
                              onMouseDown={(e) => {
                                if (tool === 'quad-highlight' && quadPointsInProgress.length > 0) return;
                                handleQuadBodyMouseDown(e, ann.id);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAnnId(ann.id);
                              }}
                            />

                            {/* Draggable Corner Handles (A, B, C, D) */}
                            {shouldShowHandles && pts.map((pt, idx) => (
                              <g
                                key={`quad-h-${ann.id}-${idx}`}
                                className="quad-handle-group"
                                onMouseDown={(e) => handlePointHandleMouseDown(e, ann.id, idx)}
                                title={`Kéo góc ${['A', 'B', 'C', 'D'][idx]} để căn chỉnh`}
                              >
                                <circle
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={9}
                                  className="quad-handle-circle"
                                  fill={isSelected ? '#6366f1' : (ann.color || '#FFF176')}
                                />
                                <text
                                  x={pt.x}
                                  y={pt.y}
                                  className="quad-handle-text"
                                >
                                  {['A', 'B', 'C', 'D'][idx]}
                                </text>
                              </g>
                            ))}
                          </g>
                        );
                      })}

                      {/* In-Progress Guide Lines & Corner Points while user is clicking 4 points */}
                      {tool === 'quad-highlight' && quadPointsInProgress.length > 0 && (
                        <g>
                          {/* Segment lines between placed points */}
                          {quadPointsInProgress.map((pt, i) => {
                            if (i === 0) return null;
                            const prev = quadPointsInProgress[i - 1];
                            return (
                              <line
                                key={`inprog-line-${i}`}
                                x1={prev.x}
                                y1={prev.y}
                                x2={pt.x}
                                y2={pt.y}
                                stroke="#6366f1"
                                strokeWidth={2}
                              />
                            );
                          })}

                          {/* Rubberband dashed line to current cursor */}
                          <line
                            x1={quadPointsInProgress[quadPointsInProgress.length - 1].x}
                            y1={quadPointsInProgress[quadPointsInProgress.length - 1].y}
                            x2={currentMousePos.x}
                            y2={currentMousePos.y}
                            stroke="#6366f1"
                            strokeWidth={1.5}
                            strokeDasharray="4,4"
                          />

                          {/* When 3 points are placed, show closing preview to point A */}
                          {quadPointsInProgress.length === 3 && (
                            <>
                              <line
                                x1={currentMousePos.x}
                                y1={currentMousePos.y}
                                x2={quadPointsInProgress[0].x}
                                y2={quadPointsInProgress[0].y}
                                stroke="#6366f1"
                                strokeWidth={1.5}
                                strokeDasharray="4,4"
                              />
                              <polygon
                                points={`${quadPointsInProgress[0].x},${quadPointsInProgress[0].y} ${quadPointsInProgress[1].x},${quadPointsInProgress[1].y} ${quadPointsInProgress[2].x},${quadPointsInProgress[2].y} ${currentMousePos.x},${currentMousePos.y}`}
                                fill={quadHighlightColor}
                                fillOpacity={quadOpacity * 0.5}
                                style={{ mixBlendMode: 'multiply' }}
                              />
                            </>
                          )}

                          {/* Badges for already placed points (A, B, C) */}
                          {quadPointsInProgress.map((pt, i) => (
                            <g key={`inprog-pin-${i}`}>
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={10}
                                fill="#10b981"
                                stroke="#ffffff"
                                strokeWidth={2}
                              />
                              <text
                                x={pt.x}
                                y={pt.y}
                                className="quad-handle-text"
                              >
                                {['A', 'B', 'C'][i]}
                              </text>
                            </g>
                          ))}

                          {/* Active cursor badge showing next point letter */}
                          <g>
                            <circle
                              cx={currentMousePos.x}
                              cy={currentMousePos.y}
                              r={10}
                              fill="#6366f1"
                              stroke="#ffffff"
                              strokeWidth={2}
                              strokeDasharray="2,2"
                            />
                            <text
                              x={currentMousePos.x}
                              y={currentMousePos.y}
                              className="quad-handle-text"
                            >
                              {['A', 'B', 'C', 'D'][quadPointsInProgress.length]}
                            </text>
                          </g>
                        </g>
                      )}
                    </svg>

                    {/* Dotted indicator box while drawing */}
                    {drawingBox && (
                      <div 
                        className="drawing-box-indicator"
                        style={{
                          left: `${drawingBox.x}px`,
                          top: `${drawingBox.y}px`,
                          width: `${drawingBox.w}px`,
                          height: `${drawingBox.h}px`,
                          borderColor: (tool === 'highlight' || tool === 'solid-highlight') ? highlightColor : (tool === 'solid' ? eraseColor : 'var(--accent-primary)')
                        }}
                      />
                    )}

                  </div>

                </div>
              )}
            </div>

          </div>

          {/* Right Panel: Active Page Details & Annotation list */}
          <aside className={`app-right-panel ${showRightSidebar ? '' : 'collapsed'}`}>
            <div className="panel-section">
              <h3 className="panel-section-title">Chi tiết trang hiện tại</h3>
              {currentPage ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Loại trang:</span>
                    <span style={{ fontWeight: 500 }}>
                      {currentPage.originalIndex === null ? 'Trang trắng tự thêm' : `Trang ${currentPage.originalIndex} gốc`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Kích thước:</span>
                    <span style={{ fontWeight: 500 }}>
                      {Math.round(currentPage.width)} x {Math.round(currentPage.height)} pt
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Góc xoay hiện tại:</span>
                    <span style={{ fontWeight: 500 }}>{currentPage.rotation}°</span>
                  </div>
                </div>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Chưa mở trang nào</span>
              )}
            </div>

            {/* Dynamic Edit Panel for Selected Annotation */}
            {selectedAnn && (
              <div className="panel-section">
                <h3 className="panel-section-title" style={{ color: 'var(--accent-primary)' }}>Chỉnh sửa nét vẽ</h3>
                <div className="edit-ann-panel">
                  <div className="edit-ann-title">
                    {selectedAnn.type === 'highlight' && 'Loại nét: Highlight trộn'}
                    {selectedAnn.type === 'text-highlight' && 'Loại nét: Highlight rõ chữ'}
                    {selectedAnn.type === 'solid-highlight' && 'Loại nét: Highlight đè'}
                    {selectedAnn.type === 'solid-erase' && 'Loại nét: Che màu nền'}
                    {selectedAnn.type === 'inpaint-erase' && 'Loại nét: Xóa hòa nhập'}
                    {selectedAnn.type === 'quad-highlight' && 'Loại nét: Highlight 4 điểm (Quad)'}
                  </div>
                  
                  {/* Color picker for vector and quad types */}
                  {(selectedAnn.type === 'highlight' || selectedAnn.type === 'text-highlight' || selectedAnn.type === 'solid-highlight' || selectedAnn.type === 'solid-erase' || selectedAnn.type === 'quad-highlight') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Đổi màu:</span>
                        <div className="color-picker-wrapper" style={{ padding: '2px 6px' }}>
                          <input 
                            type="color" 
                            className="color-input" 
                            style={{ width: '20px', height: '20px' }}
                            value={selectedAnn.color || (selectedAnn.type === 'solid-erase' ? '#ffffff' : '#FFF176')} 
                            onChange={(e) => updateAnnotationColor(e.target.value)} 
                          />
                        </div>
                      </div>

                      {selectedAnn.type === 'quad-highlight' && (
                        <div className="color-presets-row" style={{ justifyContent: 'flex-end' }}>
                          {HIGHLIGHT_PRESET_COLORS.map(c => (
                            <div
                              key={c.value}
                              className={`color-preset-chip ${selectedAnn.color?.toLowerCase() === c.value.toLowerCase() ? 'active' : ''}`}
                              style={{ backgroundColor: c.value, width: 18, height: 18 }}
                              onClick={() => updateAnnotationColor(c.value)}
                              title={c.label}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quad-Point Highlight Specific Properties */}
                  {selectedAnn.type === 'quad-highlight' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px', padding: '8px', backgroundColor: 'var(--bg-panel-hover)', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Độ trong suốt:</span>
                        <div className="setting-slider-row" style={{ width: 110 }}>
                          <input 
                            type="range"
                            min="0.25"
                            max="0.95"
                            step="0.05"
                            value={selectedAnn.opacity !== undefined ? selectedAnn.opacity : 0.65}
                            onChange={(e) => updateAnnotationOpacity(parseFloat(e.target.value))}
                            className="setting-slider"
                          />
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: 28 }}>
                            {Math.round((selectedAnn.opacity !== undefined ? selectedAnn.opacity : 0.65) * 100)}%
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Thuật toán:</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                          {selectedAnn.blendMode === 'luminance' ? 'Lọc ngưỡng Pixel' : 'Multiply Vector'}
                        </span>
                      </div>

                      {selectedAnn.blendMode === 'luminance' ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ngưỡng mực:</span>
                            <input 
                              type="range"
                              min="60"
                              max="200"
                              step="5"
                              value={selectedAnn.threshold || 120}
                              onChange={(e) => {
                                const th = parseInt(e.target.value, 10);
                                handleApplyLuminanceMask(selectedAnn.id, th);
                              }}
                              className="setting-slider"
                              style={{ width: 90 }}
                            />
                            <span style={{ fontSize: '11px' }}>{selectedAnn.threshold || 120}</span>
                          </div>
                          <button
                            className="btn-secondary"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                            onClick={() => handleRevertToMultiplyBlend(selectedAnn.id)}
                          >
                            Chuyển về Multiply Vector
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn-secondary"
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                          onClick={() => handleApplyLuminanceMask(selectedAnn.id, 120)}
                          title="Quét từng pixel và chỉ nhuộm nền giấy L >= 120, giữ nguyên chữ đen 100%"
                        >
                          Chuyển sang lọc ngưỡng Pixel
                        </button>
                      )}

                      <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>Tô đậm chữ/nét bên trong:</span>
                          <button
                            className={`tool-btn-labeled ${selectedAnn.boldenText ? 'active' : ''}`}
                            style={{
                              height: 26,
                              fontSize: 11,
                              padding: '0 8px',
                              ...(selectedAnn.boldenText ? { background: '#10b981', borderColor: '#10b981', color: '#fff' } : {})
                            }}
                            onClick={() => handleToggleBoldenText(selectedAnn.id)}
                            title="Tô đậm chữ và các chi tiết có màu khác màu highlight bên trong tứ giác"
                          >
                            {selectedAnn.boldenText ? 'Đang BẬT' : 'Đang TẮT'}
                          </button>
                        </div>

                        {selectedAnn.boldenText && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Mức độ đậm chữ:</span>
                              <input
                                type="range"
                                min="0.3"
                                max="1.0"
                                step="0.05"
                                value={selectedAnn.darkenStrength !== undefined ? selectedAnn.darkenStrength : 0.7}
                                onChange={(e) => handleUpdateDarkenStrength(selectedAnn.id, parseFloat(e.target.value))}
                                className="setting-slider"
                                style={{ width: 85 }}
                              />
                              <span style={{ fontSize: '11px', minWidth: 26 }}>
                                {Math.round((selectedAnn.darkenStrength !== undefined ? selectedAnn.darkenStrength : 0.7) * 100)}%
                              </span>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                              <input
                                type="checkbox"
                                checked={selectedAnn.thickenStroke !== false}
                                onChange={(e) => handleToggleThickenStroke(selectedAnn.id, e.target.checked)}
                              />
                              <span>In đậm nét chữ (Làm dày viền nét)</span>
                            </label>
                          </div>
                        )}
                      </div>

                      <button
                        className="btn-secondary"
                        style={{ fontSize: '11px', padding: '4px 8px', marginTop: '4px' }}
                        onClick={() => handleReorderQuadPoints(selectedAnn.id)}
                        title="Tự động sửa thứ tự 4 góc theo hình tứ giác lồi chuẩn A-B-C-D"
                      >
                        Căn chuẩn thứ tự 4 góc (A-B-C-D)
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button 
                      className="btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '12px', flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                      onClick={() => {
                        deleteAnnotation(currentPage.id, selectedAnn.id);
                        showToast('Đã xóa nét sửa.', 'info');
                      }}
                    >
                      <Trash2 size={12} style={{ marginRight: '4px', display: 'inline-block' }} /> Xóa
                    </button>
                    <button 
                      className="btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '12px', flex: 1 }}
                      onClick={() => setSelectedAnnId(null)}
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="panel-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <h3 className="panel-section-title">Các nét sửa trên trang ({currentPage?.annotations?.length || 0})</h3>
              
              <div className="annotation-list" style={{ flex: 1 }}>
                {currentPage && currentPage.annotations && currentPage.annotations.length > 0 ? (
                  currentPage.annotations.map((ann, aIdx) => (
                    <div 
                      key={ann.id} 
                      className={`annotation-item ${ann.id === selectedAnnId ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedAnnId(ann.id);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="annotation-item-info">
                        {ann.type === 'highlight' && (
                          <>
                            <div className="annotation-color-dot" style={{ backgroundColor: ann.color || '#EFDE05' }} />
                            <span className="annotation-type-badge">H.Light Trộn #{aIdx + 1}</span>
                          </>
                        )}
                        {ann.type === 'text-highlight' && (
                          <>
                            <div className="annotation-color-dot" style={{ backgroundColor: ann.color || '#EFDE05' }} />
                            <span className="annotation-type-badge">H.Light Rõ Chữ #{aIdx + 1}</span>
                          </>
                        )}
                        {ann.type === 'solid-highlight' && (
                          <>
                            <div className="annotation-color-dot" style={{ backgroundColor: ann.color || '#EFDE05' }} />
                            <span className="annotation-type-badge">H.Light Đè #{aIdx + 1}</span>
                          </>
                        )}
                        {ann.type === 'quad-highlight' && (
                          <>
                            <div className="annotation-color-dot" style={{ backgroundColor: ann.color || '#FFF176' }} />
                            <span className="annotation-type-badge">Quad #{aIdx + 1}</span>
                          </>
                        )}
                        {ann.type === 'solid-erase' && (
                          <>
                            <div className="annotation-color-dot" style={{ backgroundColor: ann.color || '#ffffff' }} />
                            <span className="annotation-type-badge">Che màu #{aIdx + 1}</span>
                          </>
                        )}
                        {ann.type === 'inpaint-erase' && (
                          <>
                            <div className="annotation-color-dot" style={{ background: 'var(--accent-gradient)' }} />
                            <span className="annotation-type-badge">Hòa nhập #{aIdx + 1}</span>
                          </>
                        )}
                      </div>
                      
                      <button 
                        className="annotation-delete-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAnnotation(currentPage.id, ann.id);
                          showToast('Đã xóa nét sửa.', 'info');
                        }}
                        title="Xóa nét sửa này"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-annotation-placeholder">
                    Chưa có nét chỉnh sửa nào trên trang này. Hãy chọn một công cụ và vẽ lên trang.
                  </div>
                )}
              </div>
            </div>

        </aside>

        </div>
      )}
    </div>
  );
}
