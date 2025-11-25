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

  // Typography & Alignment (New)
  cardIdFontSize: number;
  cardIdAlignHoriz: 'left' | 'center' | 'right';
  cardIdAlignVert: 'start' | 'center' | 'end'; // Flex-box values
  
  cardDescFontSize: number;
  cardDescAlignHoriz: 'left' | 'center' | 'right';
  cardDescAlignVert: 'start' | 'center' | 'end';

  // Watermark
  watermarkEnabled: boolean;
  watermarkType: 'logo' | 'text';
  watermarkText?: string;
  watermarkLogoData?: string | null;
  watermarkOpacity: number;
  watermarkSizeMm: number; // Size in mm
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

  // Typography Defaults
  cardIdFontSize: 14,
  cardIdAlignHoriz: 'center',
  cardIdAlignVert: 'center',
  cardDescFontSize: 10,
  cardDescAlignHoriz: 'left',
  cardDescAlignVert: 'center',

  watermarkEnabled: false,
  watermarkType: 'logo',
  watermarkText: 'CONFIDENCIAL',
  watermarkOpacity: 0.1,
  watermarkSizeMm: 40 // Default 40mm
};

export interface ExportOptions {
    format: 'pdf' | 'png';
    quality: number; // 0.1 to 1.0
    range: 'current' | 'all' | 'custom';
    customRange: string;
}