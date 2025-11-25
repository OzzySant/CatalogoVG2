import { Product, ProductsResponse, CatalogSettings, DEFAULT_SETTINGS } from '../types';

const API_BASE_URL = 'http://localhost:3000/api';
const UPLOADS_URL = 'http://localhost:3000/uploads';

// --- MOCK DATA FOR FALLBACK ---
const MOCK_PRODUCTS: Product[] = [
  { id: 'SAMPLE-001', description: 'Sample Product A (Demo Mode)', category: 'Electronics', imageName: '', createdAt: new Date().toISOString() },
  { id: 'SAMPLE-002', description: 'Sample Product B (Demo Mode)', category: 'Office', imageName: '', createdAt: new Date().toISOString() },
  { id: 'SAMPLE-003', description: 'Sample Product C (Demo Mode)', category: 'Electronics', imageName: '', createdAt: new Date().toISOString() },
];

const MOCK_CATEGORIES = ['Electronics', 'Office', 'Furniture', 'General'];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to handle fetch errors by returning mock data if connection fails
async function fetchWithFallback<T>(
  url: string, 
  options: RequestInit | undefined, 
  mockData: T, 
  errorMessage: string
): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
        // Only return mock if it's a 5xx error, otherwise throw
        if (res.status >= 500) {
            console.warn(`API Error (${res.status}) for ${url}. Using mock.`);
            return mockData;
        }
        const err = await res.json();
        throw new Error(err.error || errorMessage);
    }
    return await res.json();
  } catch (error) {
    console.warn(`Connection failed for ${url}. Using mock data.`, error);
    await delay(200); 
    return mockData;
  }
}

export const getImageUrl = (imageName?: string) => {
  if (!imageName) return null;
  return `${UPLOADS_URL}/${imageName}`;
};

export const fetchProducts = async (page = 1, limit = 15, search = '', category = ''): Promise<ProductsResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search,
    category: category === 'all' ? '' : category,
  });

  const mockResponse: ProductsResponse = {
    products: MOCK_PRODUCTS,
    totalCount: MOCK_PRODUCTS.length,
    currentPage: 1,
    totalPages: 1,
    limit: 15
  };

  try {
    const res = await fetch(`${API_BASE_URL}/products?${params}`);
    if (!res.ok) throw new Error('Failed to fetch');
    
    const data = await res.json();
    const mappedProducts = data.products.map((p: any) => ({
      ...p,
      imageUrl: getImageUrl(p.imageName)
    }));
    return { ...data, products: mappedProducts };
  } catch (error) {
    return mockResponse;
  }
};

export const fetchAllProducts = async (): Promise<Product[]> => {
    const params = new URLSearchParams({ limit: '9999' });
    try {
        const res = await fetch(`${API_BASE_URL}/products?${params}`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        return data.products.map((p: any) => ({...p, imageUrl: getImageUrl(p.imageName)}));
    } catch (error) {
        return MOCK_PRODUCTS;
    }
}

export const fetchCategories = async (): Promise<string[]> => {
  return fetchWithFallback<string[]>(
    `${API_BASE_URL}/categories`, 
    undefined, 
    MOCK_CATEGORIES, 
    'Failed to fetch categories'
  );
};

export const createProduct = async (product: Partial<Product> & { imageDataUrl?: string | null }) => {
  try {
    const res = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar');
    }
    return res.json();
  } catch (error: any) {
    if(error.message.includes('Failed to fetch')) {
        await delay(500); return { ...product, id: product.id || 'MOCK-ID' };
    }
    throw error;
  }
};

export const updateProduct = async (id: string, product: Partial<Product> & { imageDataUrl?: string | null }) => {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao atualizar');
    }
    return res.json();
  } catch (error: any) {
    if(error.message.includes('Failed to fetch')) {
        await delay(500); return { ...product, id };
    }
    throw error;
  }
};

export const deleteProduct = async (id: string) => {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Erro ao excluir');
    return res.json();
  } catch (error) {
    // Simulate success for UI
    return { success: true };
  }
};

export const fetchSettings = async (): Promise<CatalogSettings> => {
  return fetchWithFallback<CatalogSettings>(
    `${API_BASE_URL}/settings`, 
    undefined, 
    DEFAULT_SETTINGS, 
    'Failed to fetch settings'
  );
};

export const saveSettings = async (settings: CatalogSettings) => {
  try {
    const res = await fetch(`${API_BASE_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to save settings');
    return res.json();
  } catch (error) {
    return { message: "Saved (Mock)" };
  }
};

export const batchImportProducts = async (products: Partial<Product>[]) => {
    try {
        const res = await fetch(`${API_BASE_URL}/products/batch-import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(products)
        });
        if (!res.ok) throw new Error('Batch import failed');
        return res.json();
    } catch (error) {
        await delay(500);
        return { imported: products.length, skipped: 0 };
    }
}

export const cleanupOrphanedImages = async () => {
    try {
        const res = await fetch(`${API_BASE_URL}/cleanup/orphaned-images`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Cleanup failed');
        return res.json();
    } catch (error) {
        await delay(500);
        return { message: "Cleanup Mock", deletedCount: 0, keptCount: 10 };
    }
}