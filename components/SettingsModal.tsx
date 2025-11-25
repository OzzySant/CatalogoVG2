import React, { useState, useEffect } from 'react';
import { CatalogSettings } from '../types';
import { X, Save, FileImage, Upload, Download, Trash2, FolderInput, Palette, Layout, Database, Type, AlignCenter, AlignLeft, AlignRight, ArrowUpToLine, ArrowDownToLine, MoveVertical } from 'lucide-react';
import { cleanupOrphanedImages } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: CatalogSettings;
  onSave: (settings: CatalogSettings) => void;
  onImportXLSX: () => void;
  onExportXLSX: () => void;
  onBatchImages: () => void;
}

type Tab = 'layout' | 'style' | 'data';

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    currentSettings, 
    onSave,
    onImportXLSX,
    onExportXLSX,
    onBatchImages
}) => {
  const [formData, setFormData] = useState<CatalogSettings>(currentSettings);
  const [activeTab, setActiveTab] = useState<Tab>('layout');
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    setFormData(currentSettings);
  }, [currentSettings, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let newValue: any = value;
    if (type === 'number') newValue = Number(value);
    if (type === 'checkbox') newValue = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: newValue }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'headerLogoData' | 'watermarkLogoData') => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setFormData(prev => ({ ...prev, [field]: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleCleanup = async () => {
      if(!confirm("Atenção! Isso irá apagar permanentemente imagens não usadas. Continuar?")) return;
      setCleaning(true);
      try {
          const res = await cleanupOrphanedImages();
          alert(`Limpeza:\nDeletados: ${res.deletedCount}\nMantidos: ${res.keptCount}`);
      } catch (e) {
          alert("Erro na limpeza");
      } finally {
          setCleaning(false);
      }
  };

  const TabButton = ({ id, label, icon: Icon }: { id: Tab, label: string, icon: any }) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors ${activeTab === id ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
      >
          <Icon size={18} /> {label}
      </button>
  );

  // Reusable Input Class for Dark/Light Mode
  const inputClass = "w-full p-2 border rounded mt-1 text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none";
  const selectClass = "w-full p-2 border rounded mt-1 text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Configurações</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
            <X size={24} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg px-5">
            <TabButton id="layout" label="Layout & Estrutura" icon={Layout} />
            <TabButton id="style" label="Estilo & Cores" icon={Palette} />
            <TabButton id="data" label="Dados & Manutenção" icon={Database} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-dark-card text-gray-800 dark:text-gray-200">
            <form id="settingsForm" onSubmit={(e) => { e.preventDefault(); onSave(formData); }}>
                
                {/* LAYOUT TAB */}
                {activeTab === 'layout' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="font-semibold text-lg border-b dark:border-gray-700 pb-2 mb-4">Página & Margens (mm)</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-medium">Superior</label><input type="number" name="pageMarginTop" value={formData.pageMarginTop} onChange={handleChange} className={inputClass} /></div>
                                <div><label className="text-xs font-medium">Inferior</label><input type="number" name="pageMarginBottom" value={formData.pageMarginBottom} onChange={handleChange} className={inputClass} /></div>
                                <div><label className="text-xs font-medium">Esquerda</label><input type="number" name="pageMarginLeft" value={formData.pageMarginLeft} onChange={handleChange} className={inputClass} /></div>
                                <div><label className="text-xs font-medium">Direita</label><input type="number" name="pageMarginRight" value={formData.pageMarginRight} onChange={handleChange} className={inputClass} /></div>
                            </div>

                            <h3 className="font-semibold text-lg border-b dark:border-gray-700 pb-2 mb-4 mt-6">Grade de Produtos</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-medium">Colunas</label><input type="number" name="gridCols" min="1" max="10" value={formData.gridCols} onChange={handleChange} className={inputClass} /></div>
                                <div><label className="text-xs font-medium">Linhas</label><input type="number" name="gridRows" min="1" max="20" value={formData.gridRows} onChange={handleChange} className={inputClass} /></div>
                                <div className="col-span-2"><label className="text-xs font-medium">Espaçamento (mm)</label><input type="number" name="gridGap" value={formData.gridGap} onChange={handleChange} className={inputClass} /></div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-semibold text-lg border-b dark:border-gray-700 pb-2 mb-4">Cabeçalho & Rodapé</h3>
                            <div><label className="text-xs font-medium">Texto Cabeçalho</label><input type="text" name="headerText" value={formData.headerText} onChange={handleChange} className={inputClass} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-medium">Tamanho Texto (px)</label><input type="number" name="headerTextSize" value={formData.headerTextSize} onChange={handleChange} className={inputClass} /></div>
                                <div>
                                    <label className="text-xs font-medium">Alinhamento</label>
                                    <select name="headerAlign" value={formData.headerAlign} onChange={handleChange} className={selectClass}>
                                        <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-2">
                                <label className="text-xs font-medium block mb-1">Logo do Cabeçalho</label>
                                <div className="flex items-center gap-2">
                                    <label className="cursor-pointer bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded text-sm border dark:border-gray-600 flex items-center gap-2">
                                        <FileImage size={16}/> Selecionar
                                        <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'headerLogoData')} className="hidden" />
                                    </label>
                                    {formData.headerLogoData && <span className="text-xs text-green-600 dark:text-green-400">Carregado</span>}
                                </div>
                            </div>

                            <div className="mt-4"><label className="text-xs font-medium">Texto Rodapé</label><input type="text" name="footerText" value={formData.footerText} onChange={handleChange} className={inputClass} /></div>
                            <div className="flex items-center mt-2 gap-2"><input type="checkbox" name="showPageNumbers" checked={formData.showPageNumbers} onChange={handleChange} /><span className="text-sm">Numeração de Página</span></div>
                        </div>
                    </div>
                )}

                {/* STYLE TAB */}
                {activeTab === 'style' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="font-semibold text-lg border-b dark:border-gray-700 pb-2 mb-4">Estilo dos Cards</h3>
                            
                            <div>
                                <label className="text-xs font-medium block mb-1">Tipo de Layout</label>
                                <select name="cardStyle" value={formData.cardStyle} onChange={handleChange} className={selectClass}>
                                    <option value="classic">Clássico (Borda Completa)</option>
                                    <option value="modern">Moderno (Sombra Suave)</option>
                                    <option value="minimal">Minimalista (Sem Bordas)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-medium block">Espessura Borda (px)</label><input type="number" name="cardBorderWidth" value={formData.cardBorderWidth} onChange={handleChange} className={inputClass} min="0" /></div>
                                <div><label className="text-xs font-medium block">Cor da Borda</label><div className="flex gap-2 mt-1"><input type="color" name="cardBorderColor" value={formData.cardBorderColor} onChange={handleChange} className="h-10 w-10 p-0 border-0 bg-transparent" /><input type="text" name="cardBorderColor" value={formData.cardBorderColor} onChange={handleChange} className={`flex-1 ${inputClass} mt-0`} /></div></div>
                            </div>

                            <div className="flex items-center gap-2 mt-2"><input type="checkbox" name="showProductId" checked={formData.showProductId} onChange={handleChange} /><span className="text-sm font-medium">Mostrar Código/ID no Card</span></div>

                            <h3 className="font-semibold text-lg border-b dark:border-gray-700 pb-2 mb-4 mt-6">Tipografia & Alinhamento</h3>
                            
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded">
                                <div className="col-span-2 font-medium text-sm text-primary-600 dark:text-primary-400">Campo ID</div>
                                <div><label className="text-xs font-medium">Tamanho Fonte</label><input type="number" name="cardIdFontSize" value={formData.cardIdFontSize} onChange={handleChange} className={inputClass} /></div>
                                <div>
                                    <label className="text-xs font-medium">Alinhamento Horiz.</label>
                                    <select name="cardIdAlignHoriz" value={formData.cardIdAlignHoriz} onChange={handleChange} className={selectClass}>
                                        <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">Alinhamento Vert.</label>
                                    <select name="cardIdAlignVert" value={formData.cardIdAlignVert} onChange={handleChange} className={selectClass}>
                                        <option value="start">Topo</option><option value="center">Meio</option><option value="end">Baixo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded">
                                <div className="col-span-2 font-medium text-sm text-primary-600 dark:text-primary-400">Campo Descrição</div>
                                <div><label className="text-xs font-medium">Tamanho Fonte</label><input type="number" name="cardDescFontSize" value={formData.cardDescFontSize} onChange={handleChange} className={inputClass} /></div>
                                <div>
                                    <label className="text-xs font-medium">Alinhamento Horiz.</label>
                                    <select name="cardDescAlignHoriz" value={formData.cardDescAlignHoriz} onChange={handleChange} className={selectClass}>
                                        <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">Alinhamento Vert.</label>
                                    <select name="cardDescAlignVert" value={formData.cardDescAlignVert} onChange={handleChange} className={selectClass}>
                                        <option value="start">Topo</option><option value="center">Meio</option><option value="end">Baixo</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-semibold text-lg border-b dark:border-gray-700 pb-2 mb-4">Cores de Fundo & Texto</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-medium block">Fundo Imagem</label><div className="flex gap-2 mt-1"><input type="color" name="cardImgBg" value={formData.cardImgBg} onChange={handleChange} className="h-8 w-8 p-0 border-0 bg-transparent" /><span className="text-xs self-center uppercase">{formData.cardImgBg}</span></div></div>
                                
                                <div><label className="text-xs font-medium block">Fundo ID</label><div className="flex gap-2 mt-1"><input type="color" name="cardIdBg" value={formData.cardIdBg} onChange={handleChange} className="h-8 w-8 p-0 border-0 bg-transparent" /><span className="text-xs self-center uppercase">{formData.cardIdBg}</span></div></div>
                                
                                <div><label className="text-xs font-medium block">Fundo Descrição</label><div className="flex gap-2 mt-1"><input type="color" name="cardDescBg" value={formData.cardDescBg} onChange={handleChange} className="h-8 w-8 p-0 border-0 bg-transparent" /><span className="text-xs self-center uppercase">{formData.cardDescBg}</span></div></div>
                                
                                <div><label className="text-xs font-medium block">Texto ID</label><div className="flex gap-2 mt-1"><input type="color" name="cardIdTextColor" value={formData.cardIdTextColor} onChange={handleChange} className="h-8 w-8 p-0 border-0 bg-transparent" /><span className="text-xs self-center uppercase">{formData.cardIdTextColor}</span></div></div>
                                
                                <div><label className="text-xs font-medium block">Texto Descrição</label><div className="flex gap-2 mt-1"><input type="color" name="cardDescTextColor" value={formData.cardDescTextColor} onChange={handleChange} className="h-8 w-8 p-0 border-0 bg-transparent" /><span className="text-xs self-center uppercase">{formData.cardDescTextColor}</span></div></div>
                            </div>

                            <h3 className="font-semibold text-lg border-b dark:border-gray-700 pb-2 mb-4 mt-6">Marca D'água</h3>
                            <div className="flex items-center gap-2 mb-2"><input type="checkbox" name="watermarkEnabled" checked={formData.watermarkEnabled} onChange={handleChange} /><span className="text-sm font-medium">Habilitar</span></div>
                            
                            {formData.watermarkEnabled && (
                                <div className="space-y-3 bg-gray-50 dark:bg-gray-800 p-3 rounded border dark:border-gray-700">
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setFormData(p => ({...p, watermarkType: 'logo'}))} className={`flex-1 text-xs py-1 border rounded dark:border-gray-600 ${formData.watermarkType==='logo'?'bg-blue-100 border-blue-300 dark:bg-blue-900 dark:border-blue-700':''}`}>Logo</button>
                                        <button type="button" onClick={() => setFormData(p => ({...p, watermarkType: 'text'}))} className={`flex-1 text-xs py-1 border rounded dark:border-gray-600 ${formData.watermarkType==='text'?'bg-blue-100 border-blue-300 dark:bg-blue-900 dark:border-blue-700':''}`}>Texto</button>
                                    </div>
                                    {formData.watermarkType === 'text' ? (
                                        <input type="text" name="watermarkText" value={formData.watermarkText||''} onChange={handleChange} placeholder="Texto da marca d'água" className={inputClass} />
                                    ) : (
                                        <label className="cursor-pointer block bg-white dark:bg-gray-700 p-2 border dark:border-gray-600 rounded text-center text-xs hover:bg-gray-100 dark:hover:bg-gray-600">
                                            Escolher Imagem Específica
                                            <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'watermarkLogoData')} className="hidden" />
                                        </label>
                                    )}
                                    <div>
                                        <label className="text-xs block mb-1">Tamanho (mm)</label>
                                        <input type="number" name="watermarkSizeMm" value={formData.watermarkSizeMm} onChange={handleChange} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="text-xs block mb-1">Opacidade</label>
                                        <input type="range" name="watermarkOpacity" min="0.05" max="0.5" step="0.05" value={formData.watermarkOpacity} onChange={handleChange} className="w-full" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* DATA TAB */}
                {activeTab === 'data' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="border dark:border-gray-700 rounded p-6 flex flex-col gap-4 bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-bold">Importar/Exportar Produtos</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Use arquivos Excel (.xlsx) com colunas: ID, DESCRIÇÃO, CATEGORIA.</p>
                            <div className="flex gap-2 mt-auto">
                                <button type="button" onClick={onImportXLSX} className="flex-1 bg-gray-600 text-white py-2 rounded text-sm flex items-center justify-center gap-2 hover:bg-gray-700"><Upload size={16}/> Importar XLSX</button>
                                <button type="button" onClick={onExportXLSX} className="flex-1 bg-gray-600 text-white py-2 rounded text-sm flex items-center justify-center gap-2 hover:bg-gray-700"><Download size={16}/> Exportar XLSX</button>
                            </div>
                        </div>
                        <div className="border dark:border-gray-700 rounded p-6 flex flex-col gap-4 bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-bold">Imagens</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Importe múltiplas imagens (nome do arquivo = ID do produto) ou limpe imagens órfãs.</p>
                            <div className="flex gap-2 mt-auto">
                                <button type="button" onClick={onBatchImages} className="flex-1 bg-blue-600 text-white py-2 rounded text-sm flex items-center justify-center gap-2 hover:bg-blue-700"><FolderInput size={16}/> Lote Imagens</button>
                                <button type="button" onClick={handleCleanup} disabled={cleaning} className="flex-1 bg-red-600 text-white py-2 rounded text-sm flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-50"><Trash2 size={16}/> Limpar Servidor</button>
                            </div>
                        </div>
                    </div>
                )}

            </form>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">Cancelar</button>
            <button onClick={() => onSave(formData)} className="px-6 py-2 rounded bg-primary-600 text-white hover:bg-primary-700 flex items-center gap-2 font-medium"><Save size={18}/> Salvar Tudo</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;