export interface CosplayItem {
  name: string;
  description: string;
  searchQuery: string;
  estimatedPrice?: string;
  material?: string; 
  recommendedStore?: string;
  shopUrl?: string;
}
export interface GeneratedLook {
  mediaId: string;
  base64: string;
  mimeType: string;
  prompt: string;
  timestamp: number;
  videoMediaId?: string; 
  videoBase64?: string;
  isSpread?: boolean;
}
export interface UserImage {
  mediaId: string;
  base64: string;
  mimeType: string;
}
export type PriceLevel = 'Budget' | 'Standard' | 'Premium';
export type LookFormat = 'Portrait' | 'Spread';
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
  selectedModel: string;
  searchTerm: string;
  isGenerating: boolean;
  isAnalyzing: boolean;
  isAnimating: boolean; 
  workshopStatus: string; 
  error: string | null;
}
