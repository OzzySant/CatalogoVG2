
import React, { useRef, useState, useEffect } from 'react';
import { Product, CatalogSettings, ExportOptions } from '../types';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Eye, EyeOff, Check } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { fetchAllProducts } from '../services/api';

interface CatalogPreviewProps {
  products: Product[];
  settings: CatalogSettings;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const CatalogPreview: React.FC<CatalogPreviewProps> = ({ products, settings, totalPages, currentPage, onPageChange }) => {
  const [zoom, setZoom] = useState(0.8);
  const [cleanMode, setCleanMode] = useState(false);
  
  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportOpts, setExportOpts] = useState<ExportOptions>({ format: 'pdf', quality: 0.9, range: 'current', customRange: '' });

  // Refs
  const ghostRef = useRef<HTMLDivElement>(null);

  const itemsPerPage = settings.gridCols * settings.gridRows;
  
  // Conversion helpers
  const mmToPx = (mm: number) => mm * 3.7795;

  // --- WATERMARK GENERATION ---
  const generateTextWatermark = (text: string) => {
      const svg = `
        <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
          <style>
            .text { fill: #9ca3af; font-size: 24px; font-family: Arial, sans-serif; font-weight: bold; opacity: 0.5; }
          </style>
          <text x="50%" y="50%" transform="rotate(-45 150 150)" text-anchor="middle" class="text">${text}</text>
        </svg>
      `;
      return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  };

  const watermarkStyle: React.CSSProperties = settings.watermarkEnabled ? {
      backgroundImage: settings.watermarkType === 'text' 
          ? generateTextWatermark(settings.watermarkText || 'CATÁLOGO') 
          : `url(${settings.watermarkLogoData || settings.headerLogoData})`,
      backgroundRepeat: 'repeat', 
      backgroundPosition: 'center',
      backgroundSize: settings.watermarkType === 'text' 
          ? '300px 300px' 
          : `${mmToPx(settings.watermarkSizeMm || 40)}px`, 
      opacity: settings.watermarkOpacity,
      pointerEvents: 'none',
      position: 'absolute', inset: 0, zIndex: 0
  } : {};

  // --- STYLE HELPERS (Refactored for Robustness) ---
  
  const getCardStyle = () => ({
      backgroundColor: settings.cardImgBg,
      borderWidth: `${settings.cardBorderWidth}px`,
      borderColor: settings.cardBorderColor,
      borderRadius: `${settings.cardBorderRadius}px`,
      boxShadow: settings.cardStyle === 'modern' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const,
      boxSizing: 'border-box' as const
  });

  // Helper to map Flex Alignment
  const mapJustifyContent = (val: string) => {
      if (val === 'start') return 'flex-start';
      if (val === 'end') return 'flex-end';
      return 'center';
  };

  // Helper to map Text Align
  const mapTextAlign = (val: string) => {
      if (val === 'left') return 'left';
      if (val === 'right') return 'right';
      return 'center';
  };

  // --- EXPORT LOGIC ---
  const performExport = async () => {
      if (!ghostRef.current) return;
      setIsExporting(true);
      setExportProgress(0);

      try {
          // 1. Determine pages
          let pagesToExport: number[] = [];
          if (exportOpts.range === 'current') pagesToExport = [currentPage];
          else if (exportOpts.range === 'all') pagesToExport = Array.from({length: totalPages}, (_, i) => i + 1);
          else {
              const parts = exportOpts.customRange.split(',');
              parts.forEach(p => {
                  if (p.trim() === '') return;
                  if(p.includes('-')) {
                      const [s, e] = p.split('-').map(Number);
                      if (!isNaN(s) && !isNaN(e)) {
                        for(let i=s; i<=e; i++) if(i>0 && i<=totalPages) pagesToExport.push(i);
                      }
                  } else {
                      const n = Number(p);
                      if(n>0 && n<=totalPages) pagesToExport.push(n);
                  }
              });
          }
          
          pagesToExport = [...new Set(pagesToExport)].sort((a,b) => a-b);
          if(pagesToExport.length === 0) {
             pagesToExport = [currentPage]; // Fallback
          }

          // 2. Fetch Data
          let allProducts = products;
          if (pagesToExport.length > 1 || (pagesToExport[0] !== currentPage)) {
              allProducts = await fetchAllProducts();
          }

          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          
          for (let i = 0; i < pagesToExport.length; i++) {
              const pNum = pagesToExport[i];
              setExportProgress(Math.round(((i) / pagesToExport.length) * 100));

              // Update Ghost Data
              const start = (pNum - 1) * itemsPerPage;
              const end = start + itemsPerPage;
              const pageProducts = allProducts.slice(start, end);
              setGhostPageData({ products: pageProducts, pageNum: pNum });
              
              // Wait for React to Render Ghost
              await new Promise(r => setTimeout(r, 500)); 
              
              const element = ghostRef.current.querySelector('.a4-page') as HTMLElement;
              if(!element) throw new Error("Erro ao renderizar página.");

              // Ensure images loaded
              const imgs = Array.from(element.querySelectorAll('img'));
              await Promise.all(imgs.map(img => {
                  if(img.complete) return Promise.resolve();
                  return new Promise(res => { img.onload=res; img.onerror=res; });
              }));

              // Capture with High Res Settings & Export Optimizations
              const canvas = await html2canvas(element, {
                  scale: 4, // High DPI
                  useCORS: true,
                  allowTaint: true,
                  backgroundColor: '#ffffff',
                  width: 794, // EXACT A4 Width px (96dpi)
                  height: 1123, // EXACT A4 Height px
                  windowWidth: 794, 
                  windowHeight: 1123,
                  onclone: (clonedDoc) => {
                      const el = clonedDoc.querySelector('.a4-page') as HTMLElement;
                      if(el) {
                          el.style.transform = 'none';
                          el.style.margin = '0';
                          (el.style as any).webkitFontSmoothing = 'antialiased';
                          
                          // --- AGGRESSIVE EXPORT FIXES ---
                          
                          // 1. Remove Padding & Margin from containers to prevent overflow
                          const textContainers = el.querySelectorAll('.product-text-container');
                          textContainers.forEach((node: any) => {
                              node.style.padding = '0px'; 
                              node.style.margin = '0px';
                          });

                          // 2. Shrink Text to Fit (Prevent Cutoff/Wrap)
                          const textSpans = el.querySelectorAll('.product-text-span');
                          textSpans.forEach((node: any) => {
                              const style = window.getComputedStyle(node);
                              const currentSize = parseFloat(style.fontSize);
                              // Reduce font size by 15% specifically for export
                              node.style.fontSize = `${currentSize * 0.85}px`; 
                              node.style.lineHeight = '1.0'; // Tighten line height
                              node.style.letterSpacing = '-0.2px'; // Tighten tracking
                          });
                      }
                  }
              });

              if (exportOpts.format === 'png') {
                  const link = document.createElement('a');
                  link.download = `catalogo_p${pNum}.png`;
                  link.href = canvas.toDataURL('image/png');
                  link.click();
              } else {
                  const imgData = canvas.toDataURL('image/jpeg', exportOpts.quality); 
                  if (i > 0) pdf.addPage();
                  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
              }
          }

          if (exportOpts.format === 'pdf') {
              pdf.save('catalogo.pdf');
          }

      } catch (err: any) {
          console.error(err);
          alert("Erro na exportação: " + err.message);
      } finally {
          setIsExporting(false);
          setShowExportModal(false);
          setExportProgress(0);
      }
  };

  const [ghostPageData, setGhostPageData] = useState<{products: Product[], pageNum: number}>({ products: [], pageNum: 1 });

  // --- RENDER CONTENT COMPONENT ---
  const PageContent = ({ items, pNum, isGhost = false }: { items: Product[], pNum: number, isGhost?: boolean }) => {
      const localEmptySlots = Math.max(0, itemsPerPage - items.length);
      
      return (
        <div className="a4-page text-gray-900 relative flex flex-col box-border shrink-0 bg-white"
             style={{
                // Ghost uses strict PIXELS to match html2canvas buffer
                width: isGhost ? '794px' : '210mm',
                height: isGhost ? '1123px' : '297mm',
                paddingTop: `${settings.pageMarginTop}mm`,
                paddingBottom: `${settings.pageMarginBottom}mm`,
                paddingLeft: `${settings.pageMarginLeft}mm`,
                paddingRight: `${settings.pageMarginRight}mm`,
             }}>
            
            {/* Watermark Layer */}
            <div style={watermarkStyle}></div>

            {/* Header */}
            <header className="mb-2 border-b-2 border-gray-200 pb-2 flex items-center justify-between min-h-[25mm] shrink-0 relative z-10 box-border">
                {settings.headerLogoData && <img src={settings.headerLogoData} alt="Logo" className="h-[20mm] object-contain max-w-[150px]" />}
                <div className="flex-1 px-4 font-bold" style={{ textAlign: settings.headerAlign, color: settings.headerTextColor, fontSize: `${settings.headerTextSize}px` }}>
                    {settings.headerText}
                </div>
            </header>

            {/* Grid Container */}
            <div className="grid relative z-10 flex-1 content-start w-full box-border"
                style={{
                    gridTemplateColumns: `repeat(${settings.gridCols}, 1fr)`,
                    gridTemplateRows: `repeat(${settings.gridRows}, 1fr)`,
                    gap: `${settings.gridGap}mm`,
                }}>
                
                {items.map(product => (
                    <div key={product.id} className="relative z-10 h-full bg-white" style={getCardStyle()}>
                        {/* Image Area (Flex Grow) */}
                        <div className="flex-1 p-1 flex items-center justify-center overflow-hidden relative min-h-0 box-border">
                            {product.imageUrl ? (
                                <img src={product.imageUrl} className="max-w-full max-h-full object-contain" alt="" />
                            ) : (
                                <span className="text-gray-300 text-[10px] text-center">Sem Imagem</span>
                            )}
                        </div>
                        
                        {/* Info Area */}
                        <div className="flex min-h-[45px] border-t shrink-0 box-border w-full" style={{ borderColor: settings.cardBorderColor }}>
                            
                            {/* ID Field */}
                            {settings.showProductId && (
                                <div 
                                    className="product-text-container"
                                    style={{
                                        backgroundColor: settings.cardIdBg,
                                        width: '30%', 
                                        flexBasis: '30%',
                                        flexShrink: 0,
                                        borderRight: `1px solid ${settings.cardBorderColor}`,
                                        overflow: 'hidden',
                                        boxSizing: 'border-box',
                                        // Flex Column for Vertical Alignment
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: mapJustifyContent(settings.cardIdAlignVert),
                                        padding: '0 2px', // Minimal padding
                                    }}
                                >
                                    <span 
                                        className="product-text-span"
                                        style={{
                                            color: settings.cardIdTextColor,
                                            fontSize: `${settings.cardIdFontSize}px`,
                                            textAlign: mapTextAlign(settings.cardIdAlignHoriz) as any,
                                            width: '100%',
                                            display: 'block',
                                            lineHeight: '1.1',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word'
                                        }}
                                    >
                                        {product.id}
                                    </span>
                                </div>
                            )}

                            {/* Description Field */}
                            <div 
                                className="product-text-container"
                                style={{ 
                                    backgroundColor: settings.cardDescBg,
                                    width: settings.showProductId ? '70%' : '100%',
                                    flexBasis: settings.showProductId ? '70%' : '100%',
                                    flexShrink: 0,
                                    overflow: 'hidden',
                                    boxSizing: 'border-box',
                                    // Flex Column for Vertical Alignment
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: mapJustifyContent(settings.cardDescAlignVert),
                                    padding: '0 2px', // Minimal padding
                                }}
                            >
                                <span 
                                    className="product-text-span"
                                    style={{
                                        color: settings.cardDescTextColor,
                                        fontSize: `${settings.cardDescFontSize}px`,
                                        textAlign: mapTextAlign(settings.cardDescAlignHoriz) as any,
                                        width: '100%',
                                        display: 'block',
                                        lineHeight: '1.1',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word'
                                    }}
                                >
                                    {product.description}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

                {Array.from({ length: localEmptySlots }).map((_, i) => (
                    <div key={`empty-${i}`} className="border border-dashed border-gray-200 rounded opacity-30 box-border"></div>
                ))}
            </div>

            {/* Footer - Transparent Background to show Watermark */}
            <footer className="h-[15mm] border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 z-20 shrink-0 mt-2 bg-transparent relative box-border">
                <span className="font-bold">{settings.showPageNumbers ? `Página ${pNum}` : ''}</span>
                <span style={{ textAlign: settings.footerAlign, width: '100%' }} className="px-4 italic">
                    {settings.footerText}
                </span>
            </footer>
        </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-gray-200 dark:bg-[#121212] relative overflow-hidden">
      
      {/* Ghost Render Container (Hidden Offscreen) */}
      <div style={{ position: 'absolute', top: 0, left: '-10000px', overflow: 'visible' }} ref={ghostRef}>
          <PageContent items={ghostPageData.products} pNum={ghostPageData.pageNum} isGhost={true} />
      </div>

      {/* Toolbar */}
      {!cleanMode && (
        <div className="flex items-center justify-between p-3 bg-white dark:bg-dark-card border-b shadow-sm z-30 shrink-0 border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded p-1">
                    <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 dark:text-white"><ChevronLeft size={20}/></button>
                    <span className="px-3 text-sm font-medium min-w-[80px] text-center dark:text-white">{currentPage} / {totalPages}</span>
                    <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 dark:text-white"><ChevronRight size={20}/></button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded dark:text-white"><ZoomOut size={18}/></button>
                    <span className="text-xs font-medium w-10 text-center dark:text-white">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded dark:text-white"><ZoomIn size={18}/></button>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setCleanMode(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded dark:text-white" title="Modo Limpo"><EyeOff size={20}/></button>
                <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium"><Download size={18}/> Exportar</button>
            </div>
        </div>
      )}

      {cleanMode && <button onClick={() => setCleanMode(false)} className="absolute top-4 right-4 z-50 bg-black/50 text-white p-3 rounded-full hover:bg-black/70"><Eye size={24}/></button>}

      {/* Main Preview */}
      <div className="flex-1 overflow-auto p-8 flex justify-center items-start bg-gray-200 dark:bg-[#121212]">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }} className="transition-transform duration-200 shadow-2xl shrink-0">
            <PageContent items={products} pNum={currentPage} />
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-md p-6 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold mb-4">Exportar Catálogo</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium mb-1">Páginas</label>
                          <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-2"><input type="radio" checked={exportOpts.range === 'current'} onChange={() => setExportOpts(p => ({...p, range: 'current'}))} /> Atual ({currentPage})</label>
                              <label className="flex items-center gap-2"><input type="radio" checked={exportOpts.range === 'all'} onChange={() => setExportOpts(p => ({...p, range: 'all'}))} /> Todas ({totalPages})</label>
                              <label className="flex items-center gap-2">
                                  <input type="radio" checked={exportOpts.range === 'custom'} onChange={() => setExportOpts(p => ({...p, range: 'custom'}))} /> 
                                  Intervalo:
                                  <input 
                                    type="text" 
                                    placeholder="Ex: 1-3, 5" 
                                    className="border rounded p-1 text-sm w-32 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                    value={exportOpts.customRange} 
                                    onChange={e => setExportOpts(p => ({...p, customRange: e.target.value, range: 'custom'}))}
                                    disabled={exportOpts.range !== 'custom'}
                                  />
                              </label>
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Formato</label>
                          <select className="w-full border rounded p-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={exportOpts.format} onChange={(e) => setExportOpts(p => ({...p, format: e.target.value as any}))}>
                              <option value="pdf">PDF (Arquivo Único)</option>
                              <option value="png">PNG (Imagens Separadas)</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Qualidade / Compressão ({Math.round(exportOpts.quality * 100)}%)</label>
                          <input 
                            type="range" 
                            min="0.1" max="1" step="0.1" 
                            value={exportOpts.quality} 
                            onChange={(e) => setExportOpts(p => ({...p, quality: Number(e.target.value)}))}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">Menor qualidade = Arquivo menor.</p>
                      </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                      <button onClick={() => setShowExportModal(false)} className="px-4 py-2 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600">Cancelar</button>
                      <button onClick={performExport} disabled={isExporting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 disabled:opacity-70">
                          {isExporting ? <Check className="animate-spin" size={16}/> : <Download size={16}/>}
                          {isExporting ? `Exportando ${exportProgress}%` : 'Iniciar Exportação'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CatalogPreview;
