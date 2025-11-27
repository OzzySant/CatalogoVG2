
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Product, CatalogSettings, DEFAULT_SETTINGS } from './types';
import * as api from './services/api';
import ProductForm from './components/ProductForm';
import CatalogPreview from './components/CatalogPreview';
import SettingsModal from './components/SettingsModal';
import ConfirmationModal from './components/ConfirmationModal';
import { 
  LayoutGrid, 
  Settings, 
  Moon, 
  Sun, 
  Search, 
  Filter, 
  Trash2, 
  AlertCircle,
  X,
  Image as ImageIcon,
  ArrowDownAZ,
  ArrowUpAZ
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Using a simple HashRouter implementation concept for views
type View = 'editor' | 'preview';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('editor');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [settings, setSettings] = useState<CatalogSettings>(DEFAULT_SETTINGS);
  
  // Error State
  const [backendError, setBackendError] = useState(false);
  
  // Filter & Sort State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');
  
  // Edit State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Delete State
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  // Hidden Inputs for File Operations
  const importXLSXRef = useRef<HTMLInputElement>(null);
  const importImagesRef = useRef<HTMLInputElement>(null);

  // Computed Items Per Page based on settings
  const itemsPerPage = settings.gridCols * settings.gridRows;

  // Debounce Logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset page on search change
    }, 500); // 500ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  // --- Effects ---

  useEffect(() => {
    // Load theme
    const savedTheme = localStorage.getItem('catalogTheme') as 'light' | 'dark' | null;
    if (savedTheme) setTheme(savedTheme);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');

    // Load initial data
    loadSettings();
    loadCategories();
  }, []);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('catalogTheme', theme);
  }, [theme]);

  // Fetch products whenever filters or pagination change
  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, debouncedSearch, selectedCategory, sortField, sortOrder, currentView]); 
  // Refetch when view changes to preview to ensure we have fresh data formatted for the grid

  // --- Data Loading ---

  const loadProducts = async () => {
    try {
      const res = await api.fetchProducts(
          currentPage, 
          itemsPerPage, 
          debouncedSearch, 
          selectedCategory, 
          sortField, 
          sortOrder
      );
      setProducts(res.products);
      setTotalCount(res.totalCount);
      setBackendError(false);
      // Adjust page if out of bounds
      if (res.currentPage > res.totalPages && res.totalPages > 0) {
        setCurrentPage(res.totalPages);
      }
    } catch (error) {
      console.error("Error loading products", error);
      setBackendError(true);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await api.fetchCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Error loading categories", error);
    }
  };

  const loadSettings = async () => {
    try {
      const saved = await api.fetchSettings();
      // Merge with default to ensure all keys exist
      setSettings({ ...DEFAULT_SETTINGS, ...saved });
    } catch (error) {
      console.error("Error loading settings", error);
    }
  };

  // --- Handlers ---

  const handleDeleteRequest = (id: string) => {
    setProductToDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await api.deleteProduct(productToDelete);
      loadProducts();
      loadCategories(); // Categories might change if empty
    } catch (error) {
      alert('Erro ao excluir produto');
    } finally {
      setProductToDelete(null);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setCurrentView('editor'); // Switch to editor if likely in a list view
  };

  const handleSaveSettings = async (newSettings: CatalogSettings) => {
    try {
      await api.saveSettings(newSettings);
      setSettings(newSettings);
      setIsSettingsOpen(false);
      // Reload products because grid size might have changed limit per page
      setCurrentPage(1); 
    } catch (error) {
      alert('Erro ao salvar configurações');
    }
  };

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // --- Data Management Handlers ---

  const handleImportXLSX = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const data = new Uint8Array(evt.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
              const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);
              
              // Normalize data
              const productsToImport = jsonData.map(row => ({
                  id: String(row.ID || row.id || row.Código || '').trim(),
                  description: String(row.DESCRIÇÃO || row.descricao || row.Nome || '').trim(),
                  category: String(row.CATEGORIA || row.categoria || '').trim() || undefined
              })).filter(p => p.id && p.description);

              if (productsToImport.length > 0) {
                  const res = await api.batchImportProducts(productsToImport);
                  alert(`Importação concluída.\nImportados: ${res.imported}\nIgnorados: ${res.skipped}`);
                  loadProducts();
                  loadCategories();
              } else {
                  alert("Nenhum produto válido encontrado. Verifique as colunas (ID, DESCRIÇÃO).");
              }
          } catch (err) {
              console.error(err);
              alert("Erro ao ler arquivo Excel.");
          } finally {
              if (importXLSXRef.current) importXLSXRef.current.value = '';
          }
      };
      reader.readAsArrayBuffer(file);
  };

  const handleExportXLSX = async () => {
      try {
          const allProducts = await api.fetchAllProducts();
          const ws = XLSX.utils.json_to_sheet(allProducts.map(p => ({
              ID: p.id,
              DESCRIÇÃO: p.description,
              CATEGORIA: p.category || '',
              IMAGEM: p.imageName || ''
          })));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Produtos");
          XLSX.writeFile(wb, "catalogo_produtos.xlsx");
      } catch (err) {
          alert("Erro ao exportar dados.");
      }
  };

  const handleBatchImages = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      let processed = 0;
      let failed = 0;

      // We process sequentially or in small chunks to avoid blocking UI or overwhelming server
      const processFiles = async () => {
          for (let i = 0; i < files.length; i++) {
              const file = files[i];
              // Assuming filename matches product ID (e.g. "123.jpg" -> ID "123")
              const id = file.name.split('.')[0];
              
              if (id) {
                  try {
                      // Convert to base64
                      const base64 = await new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result as string);
                          reader.readAsDataURL(file);
                      });

                      // Call update (we assume the product exists, logic is handled by API/Backend to match or fail)
                      // Ideally we check existence first, but updateProduct in our API handles "update or create" usually? 
                      // Actually our API separates create/update. Let's try update.
                      await api.updateProduct(id, { imageDataUrl: base64 });
                      processed++;
                  } catch (err) {
                      failed++;
                  }
              }
          }
          alert(`Importação de imagens concluída.\nProcessadas: ${processed}\nFalhas/Não Encontradas: ${failed}`);
          loadProducts();
          if (importImagesRef.current) importImagesRef.current.value = '';
      };

      processFiles();
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200">
      
      {/* Hidden File Inputs */}
      <input type="file" accept=".xlsx, .xls" ref={importXLSXRef} className="hidden" onChange={handleImportXLSX} />
      <input type="file" multiple accept="image/*" ref={importImagesRef} className="hidden" onChange={handleBatchImages} />

      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-gray-900 dark:to-gray-800 text-white shadow-lg sticky top-0 z-20">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid size={24} />
            <h1 className="text-xl font-bold hidden md:block">Gerenciador de Catálogo</h1>
          </div>

          <nav className="absolute left-1/2 transform -translate-x-1/2 flex gap-1 bg-black/20 p-1 rounded-lg backdrop-blur-sm">
            <button 
              onClick={() => setCurrentView('editor')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentView === 'editor' ? 'bg-white text-blue-700 shadow' : 'text-gray-200 hover:bg-white/10'}`}
            >
              Editor
            </button>
            <button 
              onClick={() => setCurrentView('preview')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentView === 'preview' ? 'bg-white text-blue-700 shadow' : 'text-gray-200 hover:bg-white/10'}`}
            >
              Visualizar
            </button>
          </nav>

          <div className="flex items-center gap-3">
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Configurações"
             >
                <Settings size={20} />
             </button>
             <button 
                onClick={toggleTheme}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Alternar Tema"
             >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
             </button>
          </div>
        </div>
      </header>

      {/* Backend Error Banner */}
      {backendError && (
        <div className="bg-red-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <AlertCircle size={16} />
          <span>Erro de conexão com o servidor. Verifique se o backend está rodando em http://localhost:3000 e se o MySQL está ativo.</span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        
        {/* Editor View */}
        <div className={`absolute inset-0 flex flex-col md:flex-row transition-opacity duration-300 ${currentView === 'editor' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
          
          {/* Sidebar List */}
          <div className="w-full md:w-1/3 lg:w-1/4 border-r border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 dark:border-dark-border space-y-3">
               {/* Search */}
               <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar ID ou descrição..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 border rounded text-sm bg-gray-50 dark:bg-dark-bg dark:border-dark-border dark:text-gray-100 focus:ring-1 focus:ring-primary-500 outline-none transition-shadow"
                  />
                  {search && (
                      <button 
                        onClick={() => setSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                          <X size={14} />
                      </button>
                  )}
               </div>
               
               {/* Category Filter */}
               <div className="relative">
                  <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select 
                    value={selectedCategory}
                    onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-9 pr-3 py-2 border rounded text-sm bg-gray-50 dark:bg-dark-bg dark:border-dark-border dark:text-gray-100 focus:ring-1 focus:ring-primary-500 outline-none appearance-none cursor-pointer"
                  >
                     <option value="all">Todas as Categorias</option>
                     {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
               </div>

               {/* Sorting Controls */}
               <div className="flex gap-2 items-center">
                   <select 
                      value={sortField}
                      onChange={(e) => { setSortField(e.target.value); setCurrentPage(1); }}
                      className="flex-1 px-2 py-2 border rounded text-sm bg-gray-50 dark:bg-dark-bg dark:border-dark-border dark:text-gray-100 outline-none"
                   >
                       <option value="createdAt">Data Criação</option>
                       <option value="id">Código / ID</option>
                       <option value="category">Categoria</option>
                       <option value="description">Descrição</option>
                   </select>
                   
                   <button 
                      onClick={() => { setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC'); setCurrentPage(1); }}
                      className="p-2 border rounded bg-gray-50 dark:bg-dark-bg dark:border-dark-border text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title={sortOrder === 'ASC' ? "Crescente (A-Z)" : "Decrescente (Z-A)"}
                   >
                       {sortOrder === 'ASC' ? <ArrowDownAZ size={18} /> : <ArrowUpAZ size={18} />}
                   </button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto">
               {products.length === 0 ? (
                 <div className="p-8 text-center text-gray-500 text-sm">
                     {backendError ? 'Conexão falhou.' : 'Nenhum produto encontrado.'}
                     {search && <p className="mt-2 text-xs">Tente um termo diferente.</p>}
                 </div>
               ) : (
                 <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {products.map(product => (
                      <li 
                        key={product.id} 
                        className={`p-3 hover:bg-gray-50 dark:hover:bg-dark-bg/50 cursor-pointer flex justify-between items-center group transition-colors ${editingProduct?.id === product.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        onClick={() => setEditingProduct(product)}
                      >
                         <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* List Thumbnail */}
                            <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200 dark:border-gray-700">
                                {product.imageUrl ? (
                                    <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon size={16} className="text-gray-400" />
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{product.id}</div>
                                <div className="text-gray-500 text-xs truncate">{product.description}</div>
                            </div>
                         </div>
                         <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteRequest(product.id); }}
                            className="text-red-400 hover:text-red-600 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Excluir"
                         >
                            <Trash2 size={16} />
                         </button>
                      </li>
                    ))}
                 </ul>
               )}
            </div>

            <div className="p-2 border-t border-gray-200 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-bg text-xs text-gray-500">
               <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage <= 1} className="px-2 py-1 disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">Anterior</button>
               <span>Página {currentPage} de {Math.ceil(totalCount / itemsPerPage) || 1}</span>
               <button onClick={() => setCurrentPage(p => p+1)} disabled={currentPage * itemsPerPage >= totalCount} className="px-2 py-1 disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">Próxima</button>
            </div>
          </div>

          {/* Form Area */}
          <div className="flex-1 p-4 md:p-6 overflow-hidden bg-gray-50 dark:bg-dark-bg">
             <ProductForm 
                product={editingProduct} 
                onSuccess={() => {
                   loadProducts();
                   loadCategories();
                   setEditingProduct(null);
                }}
                onCancel={() => setEditingProduct(null)}
                categories={categories}
             />
          </div>
        </div>

        {/* Preview View */}
        <div className={`absolute inset-0 transition-opacity duration-300 ${currentView === 'preview' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
           <CatalogPreview 
              products={products}
              settings={settings}
              totalPages={Math.ceil(totalCount / itemsPerPage) || 1}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
           />
        </div>

      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        currentSettings={settings}
        onSave={handleSaveSettings}
        onImportXLSX={() => importXLSXRef.current?.click()}
        onExportXLSX={handleExportXLSX}
        onBatchImages={() => importImagesRef.current?.click()}
      />

      <ConfirmationModal 
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Produto"
        message="Tem certeza que deseja excluir este produto permanentemente? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
      />

    </div>
  );
};

export default App;
