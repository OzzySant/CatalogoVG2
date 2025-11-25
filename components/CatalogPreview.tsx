import React, { useRef, useState } from 'react';
import { Product, CatalogSettings, ExportOptions } from '../types';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Eye, EyeOff, X, Check } from 'lucide-react';
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
  const pageRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null); // For invisible rendering

  const itemsPerPage = settings.gridCols * settings.gridRows;
  const emptySlots = Math.max(0, itemsPerPage - products.length);

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
      backgroundRepeat: settings.watermarkType === 'text' ? 'repeat' : 'repeat',
      backgroundPosition: 'center',
      backgroundSize: settings.watermarkType === 'text' ? '300px 300px' : '150px',
      opacity: settings.watermarkOpacity,
      pointerEvents: 'none',
      position: 'absolute', inset: 0, zIndex: 0
  } : {};

  // --- STYLING HELPERS ---
  const getCardStyle = () => ({
      backgroundColor: settings.cardImgBg,
      borderWidth: `${settings.cardBorderWidth}px`,
      borderColor: settings.cardBorderColor,
      borderRadius: settings.cardStyle === 'modern' ? '8px' : '4px',
      boxShadow: settings.cardStyle === 'modern' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
  });

  const getIdStyle = () => ({
      backgroundColor: settings.cardIdBg,
      color: settings.cardIdTextColor
  });

  const getDescStyle = () => ({
      backgroundColor: settings.cardDescBg,
      color: settings.cardDescTextColor
  });

  // --- EXPORT LOGIC (GHOST RENDER) ---
  const performExport = async () => {
      if (!ghostRef.current) return;
      setIsExporting(true);
      setExportProgress(0);

      try {
          // 1. Determine pages to export
          let pagesToExport: number[] = [];
          if (exportOpts.range === 'current') pagesToExport = [currentPage];
          else if (exportOpts.range === 'all') pagesToExport = Array.from({length: totalPages}, (_, i) => i + 1);
          else {
              // Simple parser for "1, 3-5"
              const parts = exportOpts.customRange.split(',');
              parts.forEach(p => {
                  if(p.includes('-')) {
                      const [s, e] = p.split('-').map(Number);
                      for(let i=s; i<=e; i++) if(i>0 && i<=totalPages) pagesToExport.push(i);
                  } else {
                      const n = Number(p);
                      if(n>0 && n<=totalPages) pagesToExport.push(n);
                  }
              });
          }
          
          // Unique & Sort
          pagesToExport = [...new Set(pagesToExport)].sort((a,b) => a-b);
          if(pagesToExport.length === 0) throw new Error("Nenhuma página selecionada.");

          // 2. Fetch ALL data if needed (for multipage)
          let allProducts = products;
          if (pagesToExport.length > 1 || (pagesToExport[0] !== currentPage)) {
              allProducts = await fetchAllProducts();
          }

          // 3. Setup PDF
          const pdf = new jsPDF('p', 'mm', 'a4');
          
          // 4. Loop and Render
          for (let i = 0; i < pagesToExport.length; i++) {
              const pNum = pagesToExport[i];
              setExportProgress(Math.round(((i) / pagesToExport.length) * 100));

              // Slice products for this page
              const start = (pNum - 1) * itemsPerPage;
              const end = start + itemsPerPage;
              const pageProducts = allProducts.slice(start, end);

              // RENDER TO GHOST DOM
              // We use a helper function/component logic here, but for simplicity we reactively render
              // inside the hidden div by passing these props to a "PageRenderer" inside the ghost div
              // Actually, to keep it simple in this file, we will manually update the Ghost DOM content 
              // via React State just for the render cycle, or force a re-render.
              // BETTER APPROACH: The GhostRef contains a separate <PageContent> component that we pass props to.
              // But since we can't easily invoke a React render sync, we will iterate:
              
              // Since React state updates are async, we can't loop efficiently.
              // Fallback: We will use the current 'products' prop for 'Current Page' export (fast).
              // For 'All Pages', we might block the UI.
              // To fix "Layout Bug", the ghost element is key.
              
              // *Hack for "All Pages" in client-side React without complex architecture*:
              // We will fetch images and build HTML string? No, styles are complex.
              // We will render the <PageTemplate> into the GhostDiv using a temporary root?
              // Let's simplify: Only support "Current Page" perfectly for now, or...
              // wait, the requirement is "Exportar por pagina atual, total".
              // We will simulate it by changing the `displayedGhostData` state and waiting for a tick.
              
              setGhostPageData({ products: pageProducts, pageNum: pNum });
              await new Promise(r => setTimeout(r, 100)); // Wait for React Render

              const canvas = await html2canvas(ghostRef.current.querySelector('.a4-page') as HTMLElement, {
                  scale: exportOpts.quality === 1 ? 3 : 2, // High res
                  useCORS: true,
                  logging: false,
                  allowTaint: true
              });

              if (exportOpts.format === 'png') {
                  const link = document.createElement('a');
                  link.download = `catalogo_p${pNum}.png`;
                  link.href = canvas.toDataURL('image/png');
                  link.click();
              } else {
                  const imgData = canvas.toDataURL('image/jpeg', exportOpts.quality);
                  const w = pdf.internal.pageSize.getWidth();
                  const h = pdf.internal.pageSize.getHeight();
                  if (i > 0) pdf.addPage();
                  pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
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

  // State for Ghost Renderer
  const [ghostPageData, setGhostPageData] = useState<{products: Product[], pageNum: number}>({ products: [], pageNum: 1 });


  // --- RENDER HELPERS ---
  // Reusable Page Content Component
  const PageContent = ({ items, pNum }: { items: Product[], pNum: number }) => {
      const localEmptySlots = Math.max(0, itemsPerPage - items.length);
      
      return (
        <div className="a4-page text-gray-900 relative flex flex-col h-full box-border"
             style={{
                paddingTop: `${settings.pageMarginTop}mm`,
                paddingBottom: `${settings.pageMarginBottom}mm`,
                paddingLeft: `${settings.pageMarginLeft}mm`,
                paddingRight: `${settings.pageMarginRight}mm`,
             }}>
            
            {/* Watermark */}
            <div style={watermarkStyle}></div>

            {/* Header */}
            <header className="mb-4 border-b-2 border-gray-200 pb-2 flex items-center justify-between h-[25mm] shrink-0 relative z-10">
                {settings.headerLogoData && <img src={settings.headerLogoData} alt="Logo" className="h-full object-contain max-w-[150px]" />}
                <div className="flex-1 px-4 font-bold" style={{ textAlign: settings.headerAlign, color: settings.headerTextColor, fontSize: `${settings.headerTextSize}px` }}>
                    {settings.headerText}
                </div>
            </header>

            {/* Grid */}
            <div className="grid h-full content-start relative z-10"
                style={{
                    gridTemplateColumns: `repeat(${settings.gridCols}, 1fr)`,
                    gridTemplateRows: `repeat(${settings.gridRows}, 1fr)`,
                    gap: `${settings.gridGap}mm`,
                    height: 'calc(100% - 40mm)',
                }}>
                
                {items.map(product => (
                    <div key={product.id} className="flex flex-col overflow-hidden relative z-10 h-full" style={getCardStyle()}>
                        <div className="flex-1 p-2 flex items-center justify-center overflow-hidden relative">
                            {product.imageUrl ? (
                                <img src={product.imageUrl} className="max-w-full max-h-full object-contain relative z-10" />
                            ) : (
                                <span className="text-gray-300 text-xs text-center">Sem Imagem</span>
                            )}
                        </div>
                        
                        <div className="flex min-h-[45px] items-stretch border-t" style={{ borderColor: settings.cardBorderColor }}>
                            {settings.showProductId && (
                                <div className="flex items-center justify-center px-2 text-xs font-bold min-w-[60px]" style={getIdStyle()}>
                                    {product.id}
                                </div>
                            )}
                            <div className="flex-1 flex items-center p-2 text-[10px] leading-tight" style={getDescStyle()}>
                                <span className="line-clamp-2">{product.description}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {Array.from({ length: localEmptySlots }).map((_, i) => (
                    <div key={`empty-${i}`} className="border border-dashed border-gray-200 rounded opacity-30"></div>
                ))}
            </div>

            {/* Footer */}
            <footer className="absolute bottom-0 left-0 right-0 h-[15mm] border-t border-gray-200 flex items-center px-[10mm] justify-between text-xs text-gray-500 bg-white z-20">
                <span className="font-bold">{settings.showPageNumbers ? `Página ${pNum}` : ''}</span>
                <span style={{ textAlign: settings.footerAlign }} className="flex-1 px-4 italic">
                    {settings.footerText}
                </span>
            </footer>
        </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-gray-200 dark:bg-dark-bg relative overflow-hidden">
      
      {/* Ghost Render Container (Invisible) - Fixed Size A4 */}
      <div className="absolute top-0 left-0 pointer-events-none opacity-0 overflow-hidden" style={{ width: '210mm', height: '297mm', zIndex: -100 }} ref={ghostRef}>
          {/* We render the ghost content here based on state */}
          <PageContent items={ghostPageData.products} pNum={ghostPageData.pageNum} />
      </div>

      {/* Toolbar */}
      {!cleanMode && (
        <div className="flex items-center justify-between p-3 bg-white dark:bg-dark-card border-b shadow-sm z-30">
            <div className="flex items-center gap-3">
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded p-1">
                    <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"><ChevronLeft size={20}/></button>
                    <span className="px-3 text-sm font-medium min-w-[80px] text-center">{currentPage} / {totalPages}</span>
                    <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"><ChevronRight size={20}/></button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-2 hover:bg-gray-100 rounded"><ZoomOut size={18}/></button>
                    <span className="text-xs font-medium w-10 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-2 hover:bg-gray-100 rounded"><ZoomIn size={18}/></button>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setCleanMode(true)} className="p-2 hover:bg-gray-100 rounded" title="Modo Limpo"><EyeOff size={20}/></button>
                <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium"><Download size={18}/> Exportar</button>
            </div>
        </div>
      )}

      {cleanMode && <button onClick={() => setCleanMode(false)} className="absolute top-4 right-4 z-50 bg-black/50 text-white p-3 rounded-full hover:bg-black/70"><Eye size={24}/></button>}

      {/* Main Preview */}
      <div className="flex-1 overflow-auto p-8 flex justify-center items-start bg-gray-200 dark:bg-[#121212]">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }} className="transition-transform duration-200 shadow-2xl">
            <PageContent items={products} pNum={currentPage} />
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-md p-6">
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
                                    className="border rounded p-1 text-sm w-32" 
                                    value={exportOpts.customRange} 
                                    onChange={e => setExportOpts(p => ({...p, customRange: e.target.value, range: 'custom'}))}
                                    disabled={exportOpts.range !== 'custom'}
                                  />
                              </label>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-medium mb-1">Formato</label>
                          <select className="w-full border rounded p-2" value={exportOpts.format} onChange={(e) => setExportOpts(p => ({...p, format: e.target.value as any}))}>
                              <option value="pdf">PDF (Arquivo Único)</option>
                              <option value="png">PNG (Imagens Separadas)</option>
                          </select>
                      </div>

                      <div>
                          <label className="block text-sm font-medium mb-1">Qualidade / Compressão ({Math.round(exportOpts.quality * 100)}%)</label>
                          <input type="range" min="0.5" max="1" step="0.1" value={exportOpts.quality} onChange={(e) => setExportOpts(p => ({...p, quality: Number(e.target.value)}))} className="w-full" />
                          <p className="text-xs text-gray-500">Menor qualidade = Arquivo menor.</p>
                      </div>
                  </div>

                  {isExporting && (
                      <div className="mt-4">
                          <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                              <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${exportProgress}%` }}></div>
                          </div>
                          <p className="text-center text-xs mt-1">Processando página...</p>
                      </div>
                  )}

                  <div className="flex justify-end gap-3 mt-6">
                      <button onClick={() => setShowExportModal(false)} disabled={isExporting} className="px-4 py-2 rounded text-gray-600 hover:bg-gray-100">Cancelar</button>
                      <button onClick={performExport} disabled={isExporting} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2">
                          {isExporting ? <span className="animate-spin">⏳</span> : <Check size={16} />} Iniciar Exportação
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CatalogPreview;