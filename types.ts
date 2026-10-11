export interface CosplayItem {
  name: string;
  description: string;
  searchQuery: string;
  estimatedPrice?: string;
  material?: string;
  recommendedStore?: string;
  shopUrl: string;
  tags?: string[];
}

export interface GeneratedLook {
  id: string;
  imageUrl: string;
  blob: Blob;
  mimeType: string;
  prompt: string;
  timestamp: number;
  isSpread: boolean;
  historyId?: string;
}

export interface StoredHistoryEntry {
  id: string;
  prompt: string;
  style: string;
  hair: string;
  format: LookFormat;
  aspectRatio: string;
  provider: ImageProvider;
  designMode: DesignMode;
  createdAt: number;
  updatedAt: number;
  mimeType: string;
  priceLevel?: PriceLevel;
  selectedStores?: string[];
  items: CosplayItem[];
  tags: string[];
}

export interface UserImage {
  id: string;
  previewUrl: string;
  data: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
}

export type PriceLevel = 'Budget' | 'Standard' | 'Premium';
export type LookFormat = 'Portrait' | 'Spread';
export type ImageProvider = 'cloudflare' | 'gemini';
export type DesignMode = 'original' | 'match-partner';

export interface AppState {
  userImages: UserImage[];
  currentLook: GeneratedLook | null;
  history: GeneratedLook[];
  items: CosplayItem[];
  priceRange: PriceLevel;
  lookFormat: LookFormat;
  selectedStores: string[];
  selectedStyle: string;
  selectedHair: string;
  designMode: DesignMode;
  searchTerm: string;
  isGenerating: boolean;
  isAnalyzing: boolean;
  workshopStatus: string;
  error: string | null;
}
