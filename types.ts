export interface Product {
  id: string;
  description: string;
  category?: string;
  imageName?: string; // Stored in DB
  imageUrl?: string; // Computed for display
  createdAt?: string;
}

export interface ProductsResponse {
  products: Product[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}

export interface CatalogSettings {
  // Layout
  pageMarginTop: number;
  pageMarginBottom: number;
  pageMarginLeft: number;
  pageMarginRight: number;
  
  // Grid
  gridCols: number;
  gridRows: number;
  gridGap: number;

  // Header
  headerText: string;
  headerAlign: 'left' | 'center' | 'right';
  headerTextSize: number;
  headerTextColor: string;
  headerLogoData?: string | null;

  // Footer
  footerText: string;
  footerAlign: 'left' | 'center' | 'right';
  showPageNumbers: boolean;

  // Cards Logic
  showProductId: boolean;
  
  // --- Styling (New) ---
  cardStyle: 'classic' | 'modern' | 'minimal';
  cardBorderWidth: number;
  cardBorderColor: string;
  
  // Colors
  cardImgBg: string;
  cardIdBg: string;
  cardDescBg: string;
  cardIdTextColor: string;
  cardDescTextColor: string;

  // Watermark
  watermarkEnabled: boolean;
  watermarkType: 'logo' | 'text';
  watermarkText?: string;
  watermarkLogoData?: string | null;
  watermarkOpacity: number;
}

export const DEFAULT_SETTINGS: CatalogSettings = {
  pageMarginTop: 10,
  pageMarginBottom: 10,
  pageMarginLeft: 10,
  pageMarginRight: 10,
  gridCols: 3,
  gridRows: 5,
  gridGap: 8,
  headerText: 'Catálogo de Produtos',
  headerAlign: 'center',
  headerTextSize: 16,
  headerTextColor: '#333333',
  footerText: 'Tecnologia e inovação',
  footerAlign: 'center',
  showPageNumbers: true,
  
  showProductId: true,
  cardStyle: 'classic',
  cardBorderWidth: 1,
  cardBorderColor: '#e5e7eb',
  cardImgBg: '#ffffff',
  cardIdBg: '#0284c7',
  cardDescBg: '#f9fafb',
  cardIdTextColor: '#ffffff',
  cardDescTextColor: '#1f2937',

  watermarkEnabled: false,
  watermarkType: 'logo',
  watermarkText: 'CONFIDENCIAL',
  watermarkOpacity: 0.1
};

export interface ExportOptions {
    format: 'pdf' | 'png';
    quality: number; // 0.1 to 1.0
    range: 'current' | 'all' | 'custom';
    customRange: string;
}