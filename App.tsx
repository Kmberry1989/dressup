import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Flow } from 'flow-sdk';
import { AppState, CosplayItem, GeneratedLook, PriceLevel, UserImage, LookFormat } from './types';
import { SectionLabel, PillButton, FieldDropdown, TextInput, SegmentedToggle, Checkbox } from './components/Primitives';
const STORE_CATEGORIES = [
  {
    name: 'Global Marketplaces',
    stores: ['AliExpress', 'Amazon', 'eBay', 'Etsy', 'Google Shopping', 'Mercari', 'Walmart']
  },
  {
    name: 'Specialized Cosplay',
    stores: ['CosplaySky', 'DokiDoki Cosplay', 'EZCosplay', 'FM-Anime', 'Miccostumes', 'Procosplay', 'RoleCosplay', 'SimCosplay', 'SkyCostume', 'Uwowo', 'XCoser']
  },
  {
    name: 'Wigs & Artistry',
    stores: ['Arda Wigs', 'Coscraft', 'Ehire', 'Epic Cosplay', 'WigIsFashion']
  },
  {
    name: 'Editorial & High Street',
    stores: ['ASOS', 'H&M', 'Kohl\'s', 'Macy\'s', 'Nordstrom', 'Target', 'Zara']
  },
  {
    name: 'Footwear & Finishing',
    stores: ['Aldo', 'Christian Louboutin', 'DSW', 'Famous Footwear', 'Jimmy Choo', 'Nike', 'Steve Madden', 'Zappos']
  }
];
const STYLE_OPTIONS = [
  'None', 
  'Avant-Garde', 
  'Classic Tuxedo', 
  'Ballroom Gown',
  'High-Fashion Editorial', 
  'Silk Drape', 
  'Velvet Noir', 
  'Met Gala Concept',
  'Futuristic Formal',
  'Period Drama Royale',
  'Celestial Couture',
  'Gold Embroidery',
  'Minimalist Luxury'
];
const HAIR_OPTIONS = [
  'Original / No Change',
  'Sleek Low Bun',
  'Hollywood Waves',
  'Intricate Braided Crown',
  'Sharp Bob',
  'Textured High Updo',
  'Polished Fade',
  'Tapered Curls',
  'Chignon',
  'Slicked Back',
  'Long Glossy Straight'
];
const IMAGE_MODELS = [
  '🍌 Nano Banana Pro',
  '🍌 Nano Banana 2.1',
  '🍌 Nano Banana 2 Lite'
];
const VIDEO_MODEL = 'Omni 1.1 Flash';
type ViewMode = 'design' | 'preview' | 'breakdown';
export default function App() {
  const [activeTab, setActiveTab] = useState<ViewMode>('design');
  const [showSearch, setShowSearch] = useState(false);
  const [prompt, setPrompt] = useState('Avant-garde high-fashion gala attire for a black-tie event, architectural obsidian silk silhouette with intricate gold metallic embroidery, cinematic red carpet lighting, photorealistic, luxury textures, 8k resolution');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('9:16');
  const [toast, setToast] = useState<string | null>(null);
  
  const allStores = useMemo(() => STORE_CATEGORIES.flatMap(cat => cat.stores), []);
  const [state, setState] = useState<AppState>({
    userImages: [],
    currentLook: null,
    history: [],
    items: [],
    priceRange: 'Premium',
    lookFormat: 'Portrait',
    selectedStores: allStores, // Default to select all as requested
    selectedStyle: 'High-Fashion Editorial',
    selectedHair: 'Original / No Change',
    selectedModel: '🍌 Nano Banana Pro',
    searchTerm: '',
    isGenerating: false,
    isAnalyzing: false,
    isAnimating: false,
    workshopStatus: '',
    error: null,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const id = 'gala-editorial-theme-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap');
      
      :root {
        --color-obsidian: #09090b;
        --color-velvet: #1a1a1c;
        --color-gold: #c2a35d;
        --color-silk: #f5f5f7;
      }
      .dark-scrollbar { scrollbar-width: thin; scrollbar-color: var(--color-gold) transparent; }
      .dark-scrollbar::-webkit-scrollbar { width: 3px; }
      .dark-scrollbar::-webkit-scrollbar-thumb { background: var(--color-gold); }
      @keyframes slide-up { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      
      html, body, #root { 
        margin: 0; padding: 0; width: 100%; height: 100%; 
        background-color: var(--color-obsidian);
        background-image: radial-gradient(circle at 50% 50%, #1a1a1c 0%, #09090b 100%);
        font-family: 'Space Mono', monospace;
        color: var(--color-silk);
      }
      h1, h2, h3 { font-family: 'Playfair Display', serif; }
      .silk-overlay {
        position: relative;
      }
      .silk-overlay::before {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 20% 30%, rgba(194, 163, 93, 0.05), transparent 40%);
        pointer-events: none;
      }
      .editorial-panel {
        background: #0f0f11;
        border: 1px solid rgba(255,255,255,0.05);
        box-shadow: 0 10px 40px rgba(0,0,0,0.8);
      }
      .glimmer-status {
        background: linear-gradient(90deg, transparent, rgba(194, 163, 93, 0.15), transparent);
        background-size: 200% 100%;
        animation: glimmer 3s infinite linear;
      }
      @keyframes glimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      .toast-enter { transform: translateY(100%); opacity: 0; }
      .toast-active { transform: translateY(0); opacity: 1; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      .spread-badge {
        position: absolute;
        top: 20px;
        left: 20px;
        background: var(--color-gold);
        color: black;
        font-size: 8px;
        font-weight: 900;
        padding: 4px 8px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      }
    `;
    document.head.appendChild(style);
  }, []);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };
  const updateStatus = (status: string) => {
    setState(prev => ({ ...prev, workshopStatus: status }));
  };
  const addUserImage = async () => {
    if (state.userImages.length >= 2) return;
    try {
      const media = await Flow.media.select({ filter: 'image' });
      if (!media) return;
      setState(prev => ({
        ...prev,
        userImages: [...prev.userImages, { mediaId: media.mediaId, base64: media.base64, mimeType: media.mimeType }]
      }));
    } catch (err) { console.error('Selection failed', err); }
  };
  const removeUserImage = (index: number) => {
    setState(prev => ({ ...prev, userImages: prev.userImages.filter((_, i) => i !== index) }));
  };
  const toggleStore = (store: string) => {
    setState(prev => ({
      ...prev,
      selectedStores: prev.selectedStores.includes(store)
        ? prev.selectedStores.filter(s => s !== store)
        : [...prev.selectedStores, store]
    }));
  };
  const selectAllStores = (select: boolean) => {
    setState(prev => ({
      ...prev,
      selectedStores: select ? allStores : []
    }));
    showToast(select ? "All Boutiques Selected" : "Selection Cleared");
  };
  const generateLook = async () => {
    setState(prev => ({ ...prev, isGenerating: true, error: null, items: [], workshopStatus: 'Draping silk...' }));
    if (window.innerWidth < 1024) setActiveTab('preview');
    
    try {
      updateStatus('Sculpting silhouette...');
      let finalPrompt = prompt;
      
      if (state.lookFormat === 'Spread') {
        finalPrompt = `A high-fashion editorial multi-view spread. The image is split into 3 clear panels. Panel 1: Full body couture walk. Panel 2: Macro close-up of intricate fabric textures and gold embroidery. Panel 3: Detailed shot of custom accessories, jewelry, and headpiece. All matching style. ${finalPrompt}`;
      }
      if (state.userImages.length === 2) finalPrompt = `A power couple in matching high-fashion gala attire. ${finalPrompt}`;
      if (state.selectedStyle !== 'None') finalPrompt = `${finalPrompt}. Attire style: ${state.selectedStyle}.`;
      if (state.selectedHair !== 'Original / No Change') finalPrompt = `${finalPrompt}. Grooming/Hairstyle: ${state.selectedHair}.`;
      const result = await Flow.generate.image({
        prompt: finalPrompt,
        aspectRatio: state.lookFormat === 'Spread' ? '3:4' : aspectRatio,
        modelDisplayName: state.selectedModel,
        referenceImageMediaIds: state.userImages.map(img => img.mediaId)
      });
      
      const newLook: GeneratedLook = {
        mediaId: result.mediaId,
        base64: result.base64,
        mimeType: result.mimeType,
        prompt: finalPrompt,
        timestamp: Date.now(),
        isSpread: state.lookFormat === 'Spread'
      };
      setState(prev => ({
        ...prev,
        currentLook: newLook,
        history: [newLook, ...prev.history].slice(0, 10),
        isGenerating: false,
        workshopStatus: ''
      }));
    } catch (err) {
      setState(prev => ({ ...prev, isGenerating: false, workshopStatus: '', error: 'Collection failed to render.' }));
    }
  };
  const generateRunway = async () => {
    if (!state.currentLook) return;
    setState(prev => ({ ...prev, isAnimating: true, error: null, workshopStatus: 'Setting the flash...' }));
    
    try {
      updateStatus('Simulating movement...');
      const videoResult = await Flow.generate.video({
        prompt: `Elegantly slow-motion red carpet runway walk, high-fashion editorial cinematography, detailed obsidian and gold fabric textures, dramatic flash photography lighting. ${state.currentLook.prompt}`,
        firstFrameImageMediaId: state.currentLook.mediaId,
        modelDisplayName: VIDEO_MODEL,
        durationSeconds: 8,
        aspectRatio: aspectRatio === '9:16' || aspectRatio === '16:9' ? aspectRatio : '16:9'
      });
      setState(prev => {
        const updatedHistory = prev.history.map(look => 
          look.timestamp === prev.currentLook?.timestamp 
            ? { ...look, videoMediaId: videoResult.mediaId, videoBase64: videoResult.base64 }
            : look
        );
        
        return {
          ...prev,
          currentLook: { ...prev.currentLook!, videoMediaId: videoResult.mediaId, videoBase64: videoResult.base64 },
          history: updatedHistory,
          isAnimating: false,
          workshopStatus: ''
        };
      });
    } catch (err) {
      setState(prev => ({ ...prev, isAnimating: false, workshopStatus: '', error: 'Runway feed interrupted.' }));
    }
  };
  const analyzeLook = async () => {
    if (!state.currentLook) return;
    setState(prev => ({ ...prev, isAnalyzing: true, error: null, workshopStatus: 'Analyzing couture...' }));
    try {
      updateStatus('Curating shopping list...');
      const personContext = state.userImages.length === 2 ? "Shopping for two people." : "";
      const storeContext = state.selectedStores.length > 0 ? `Include results from these stores specifically: ${state.selectedStores.join(', ')}.` : '';
      const lookTypeContext = state.currentLook.isSpread ? "This is a multi-view spread showing accessories and fabrics in detail. Be thorough about specific materials shown." : "";
      const { text } = await Flow.generate.text(
        `Identify the luxury items, fabrics, footwear, and grooming in this gala image for a ${state.priceRange} tier. ${personContext} ${storeContext} ${lookTypeContext}
        Return a JSON array of objects: name, description, searchQuery, estimatedPrice, material, recommendedStore, shopUrl.
        For shopUrl, generate a Google Shopping or direct store search URL based on the name and store.`,
        {
          images: [{ base64: state.currentLook.base64, mimeType: state.currentLook.mimeType }],
          systemInstruction: 'Expert high-fashion and luxury concierge. Focus on high-end materials (Silk, Cashmere, Gold Leaf) and elite footwear vendors (Louboutin, Jimmy Choo). Be precise about sourcing links.'
        }
      );
      
      const jsonStr = text.match(/\[.*\]/s)?.[0] || '[]';
      setState(prev => ({ ...prev, items: JSON.parse(jsonStr), isAnalyzing: false, workshopStatus: '' }));
    } catch (err) {
      setState(prev => ({ ...prev, isAnalyzing: false, workshopStatus: '', error: 'Market report failed.' }));
    }
  };
  const filteredItems = useMemo(() => {
    if (!state.searchTerm) return state.items;
    return state.items.filter(item => 
      item.name.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
      item.material?.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
      item.recommendedStore?.toLowerCase().includes(state.searchTerm.toLowerCase())
    );
  }, [state.items, state.searchTerm]);
  const downloadMedia = async () => {
    if (!state.currentLook) return;
    const isVideo = !!state.currentLook.videoBase64;
    await Flow.download({
      base64: isVideo ? state.currentLook.videoBase64! : state.currentLook.base64,
      mimeType: isVideo ? 'video/mp4' : state.currentLook.mimeType,
      filename: `gala-${isVideo ? 'runway' : 'look'}-${Date.now()}.${isVideo ? 'mp4' : 'png'}`
    });
  };
  const copyToClipboard = (text: string, type: 'tag' | 'link') => {
    navigator.clipboard.writeText(text);
    showToast(`${type === 'link' ? 'Couture Link' : 'Search Tag'} Captured`);
  };
  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen bg-[#09090b] overflow-hidden silk-overlay">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 lg:bottom-12 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-[#c2a35d] text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_10px_40px_rgba(194,163,93,0.4)] animate-slide-up">
          {toast}
        </div>
      )}
      {/* Left Panel: Design (The Studio) */}
      <div className={`${activeTab === 'design' ? 'flex' : 'hidden lg:flex'} border-r border-white/5 flex-col items-start justify-between px-3 py-6 w-full lg:w-[340px] h-full overflow-hidden bg-[#0f0f11] editorial-panel shadow-2xl`}>
        <div className="flex flex-col gap-8 items-start w-full overflow-y-auto no-scrollbar pb-6 flex-1">
          <div className="flex flex-col gap-4 items-start w-full">
            <SectionLabel>Inspiration Subjects</SectionLabel>
            <div className="grid grid-cols-2 gap-3 w-full">
              {state.userImages.map((img, i) => (
                <div key={i} className="relative aspect-square bg-[#1a1a1c] border border-white/10 overflow-hidden shadow-2xl group">
                  <img src={`data:${img.mimeType};base64,${img.base64}`} className="w-full h-full object-cover" alt="Ref" />
                  <button onClick={() => removeUserImage(i)} className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-black/60 text-[#c2a35d] border border-[#c2a35d]/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              ))}
              {state.userImages.length < 2 && (
                <button 
                  onClick={addUserImage}
                  className="aspect-square bg-[#1a1a1c] border border-dashed border-white/10 hover:border-[#c2a35d]/40 flex flex-col items-center justify-center gap-2 transition-all group"
                >
                  <span className="material-symbols-outlined text-[24px] text-white/10 group-hover:text-[#c2a35d]/60">add_photo_alternate</span>
                  <span className="text-[8px] text-white/10 uppercase font-bold tracking-[0.2em]">Upload Portrait</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-4 items-start w-full">
            <SectionLabel>Couture Concept</SectionLabel>
            <TextInput value={prompt} onChange={setPrompt} placeholder="Describe the fabrics, silhouette, event vibe..." />
          </div>
          <div className="flex flex-col gap-4 items-start w-full">
            <SectionLabel>Studio Tuning</SectionLabel>
            <div className="w-full mb-2">
              <p className="text-[8px] font-black text-[#c2a35d] uppercase tracking-widest mb-1.5 ml-1">Look Format</p>
              <SegmentedToggle 
                value={state.lookFormat} 
                onChange={(v) => setState(prev => ({ ...prev, lookFormat: v as LookFormat }))}
                items={[
                  { value: 'Portrait', label: 'Spotlight' }, 
                  { value: 'Spread', label: 'Full Look' }
                ]} 
              />
            </div>
            <FieldDropdown label="Aesthetic Thread" value={state.selectedStyle} options={STYLE_OPTIONS} onChange={(v) => setState(prev => ({ ...prev, selectedStyle: v }))} />
            <FieldDropdown label="Grooming Blueprint" value={state.selectedHair} options={HAIR_OPTIONS} onChange={(v) => setState(prev => ({ ...prev, selectedHair: v }))} />
            <FieldDropdown label="Engine" value={state.selectedModel} options={IMAGE_MODELS} onChange={(v) => setState(prev => ({ ...prev, selectedModel: v }))} />
            <FieldDropdown label="Aspect Ratio" value={aspectRatio} options={['1:1', '16:9', '9:16', '4:3', '3:4']} onChange={(v) => setAspectRatio(v as any)} />
          </div>
          {state.history.length > 0 && (
            <div className="flex flex-col gap-4 items-start w-full">
              <SectionLabel>Look History</SectionLabel>
              <div className="grid grid-cols-4 gap-2 w-full">
                {state.history.map((look) => (
                  <button 
                    key={look.timestamp} 
                    onClick={() => setState(prev => ({ ...prev, currentLook: look }))} 
                    className={`relative aspect-[3/4] border transition-all ${state.currentLook?.timestamp === look.timestamp ? 'border-[#c2a35d] scale-105' : 'border-white/5 opacity-40 hover:opacity-100'}`}
                  >
                    <img src={`data:${look.mimeType};base64,${look.base64}`} className="w-full h-full object-cover" alt="H" />
                    {look.isSpread && <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-[#c2a35d] rounded-full shadow-lg" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="w-full pt-4">
          <PillButton variant="solid" onClick={generateLook} disabled={state.isGenerating || state.isAnimating} icon={<span className="material-symbols-outlined text-[20px]">brush</span>}>
            {state.isGenerating ? 'Rendering...' : `Design ${state.lookFormat === 'Spread' ? 'Full Look' : 'Gala Look'}`}
          </PillButton>
        </div>
      </div>
      {/* Main Content: Preview (The Spotlight) */}
      <div className={`${activeTab === 'preview' ? 'flex' : 'hidden lg:flex'} flex-1 flex-col items-center justify-center relative p-8 bg-black/60 overflow-hidden`}>
        {state.workshopStatus && (
          <div className="absolute top-12 z-20 flex flex-col items-center gap-3 animate-slide-up">
            <div className="px-6 py-2 bg-[#0f0f11] border border-[#c2a35d]/30 text-[#c2a35d] text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl glimmer-status">
              {state.workshopStatus}
            </div>
          </div>
        )}
        {!state.currentLook && !state.isGenerating ? (
          <div className="flex flex-col items-center gap-8 text-center opacity-10">
            <span className="material-symbols-outlined text-[120px] font-thin">camera_front</span>
            <p className="text-[14px] font-medium uppercase tracking-[0.4em]">Awaiting Creation</p>
          </div>
        ) : state.isGenerating || state.isAnimating ? (
          <div className="w-full max-w-[480px] aspect-[9/16] border border-white/5 flex flex-col items-center justify-center gap-6 bg-white/[0.01] shadow-2xl">
             <div className="w-16 h-16 border-t-2 border-r-2 border-[#c2a35d] rounded-full animate-spin" />
             <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[#c2a35d] animate-pulse italic">Exposing Negative...</p>
          </div>
        ) : (
          <div className="relative group max-h-full animate-slide-up">
            <div className="absolute -inset-4 border border-white/5 -z-10 bg-gradient-to-b from-white/[0.02] to-transparent" />
            
            {state.currentLook?.videoBase64 ? (
              <video 
                ref={videoRef}
                src={`data:video/mp4;base64,${state.currentLook.videoBase64}`}
                autoPlay loop muted playsInline
                className="max-h-[82vh] rounded-none shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] object-contain border border-white/10"
              />
            ) : (
              <img 
                src={`data:${state.currentLook!.mimeType};base64,${state.currentLook!.base64}`} 
                alt="Look" 
                className="max-h-[82vh] rounded-none shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] object-contain border border-white/10" 
              />
            )}
            {state.currentLook?.isSpread && (
              <div className="spread-badge">Editorial Spread</div>
            )}
            <div className="absolute bottom-6 left-6 bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#c2a35d] flex items-center gap-3">
              <span className="material-symbols-outlined text-[16px]">{state.currentLook?.videoBase64 ? 'movie' : 'photo_camera'}</span>
              Edition #{(state.currentLook!.timestamp % 1000).toString().padStart(3, '0')}
            </div>
            <div className="absolute top-6 right-6 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={downloadMedia} className="w-12 h-12 bg-black/60 text-white border border-white/10 flex items-center justify-center hover:bg-[#c2a35d] hover:text-black transition-all shadow-2xl">
                <span className="material-symbols-outlined text-[22px]">download</span>
              </button>
              {!state.currentLook?.videoBase64 && (
                <button onClick={generateRunway} className="w-12 h-12 bg-black/60 text-[#c2a35d] border border-[#c2a35d]/30 flex items-center justify-center hover:bg-[#c2a35d] hover:text-black transition-all shadow-2xl">
                  <span className="material-symbols-outlined text-[22px]">movie</span>
                </button>
              )}
            </div>
          </div>
        )}
        {state.error && (
          <div className="absolute bottom-12 px-6 py-3 bg-red-950/40 border border-red-500/50 text-red-300 text-[10px] font-bold uppercase tracking-widest">
            {state.error}
          </div>
        )}
      </div>
      {/* Right Panel: Breakdown (The Boutique) */}
      <div className={`${activeTab === 'breakdown' ? 'flex' : 'hidden lg:flex'} border-l border-white/5 flex-col items-start justify-between px-3 py-6 w-full lg:w-[340px] h-full overflow-hidden bg-[#0f0f11] editorial-panel`}>
        <div className="flex flex-col gap-8 items-start w-full h-full overflow-hidden">
          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between">
              <SectionLabel>Look Compass</SectionLabel>
              <button 
                onClick={() => { setShowSearch(!showSearch); if (showSearch) setState(prev => ({ ...prev, searchTerm: '' })); }}
                className={`p-2 rounded-none transition-all border ${showSearch ? 'bg-[#c2a35d] border-[#c2a35d] text-black' : 'border-white/10 text-white/20 hover:text-white/60'}`}
              >
                <span className="material-symbols-outlined text-[18px]">{showSearch ? 'close' : 'search'}</span>
              </button>
            </div>
            
            {showSearch && (
              <div className="animate-slide-up">
                <input 
                  autoFocus
                  type="text" 
                  value={state.searchTerm} 
                  onChange={(e) => setState(prev => ({ ...prev, searchTerm: e.target.value }))}
                  placeholder="FILTER COUTURE ELEMENTS..."
                  className="w-full bg-black/40 border border-white/10 rounded-none px-3 py-4 text-[10px] font-bold text-[#c2a35d] outline-none focus:border-[#c2a35d]/50 transition-colors uppercase tracking-widest placeholder-white/10"
                />
              </div>
            )}
            {state.currentLook && !showSearch && (
              <PillButton variant="outline" onClick={analyzeLook} disabled={state.isAnalyzing} icon={<span className="material-symbols-outlined text-[20px]">diamond</span>}>
                {state.isAnalyzing ? 'Curating List...' : 'Inspect Essentials'}
              </PillButton>
            )}
          </div>
          <div className="flex flex-col gap-6 items-start w-full overflow-hidden flex-1">
            <div className="w-full">
              <SectionLabel>Market Bracket</SectionLabel>
              <SegmentedToggle 
                value={state.priceRange} 
                onChange={(v) => setState(prev => ({ ...prev, priceRange: v as PriceLevel }))}
                items={[
                  { value: 'Budget', label: 'Ready-to-Wear' }, 
                  { value: 'Standard', label: 'Boutique' }, 
                  { value: 'Premium', label: 'Couture' }
                ]} 
              />
            </div>
            <div className="w-full flex-1 overflow-y-auto dark-scrollbar pr-3">
              <div className="flex items-center justify-between mb-4 px-1">
                <SectionLabel>Preferred Boutiques</SectionLabel>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => selectAllStores(true)} className="text-[7px] font-black text-[#c2a35d] uppercase tracking-widest hover:underline">Select All</button>
                  <span className="text-[7px] text-white/10">|</span>
                  <button onClick={() => selectAllStores(false)} className="text-[7px] font-black text-white/30 uppercase tracking-widest hover:text-white/60">Clear</button>
                </div>
              </div>
              
              {STORE_CATEGORIES.map(cat => (
                <div key={cat.name} className="mb-6 last:mb-0">
                  <p className="text-[7px] font-black text-[#c2a35d]/50 uppercase tracking-[0.2em] mb-2 px-1 border-b border-white/5 pb-1 flex justify-between items-center">
                    {cat.name}
                    <span className="text-[6px] opacity-40">{cat.stores.filter(s => state.selectedStores.includes(s)).length} / {cat.stores.length}</span>
                  </p>
                  <div className="grid grid-cols-1 gap-1 w-full">
                    {cat.stores.map(store => (
                      <Checkbox key={store} label={store} checked={state.selectedStores.includes(store)} onChange={() => toggleStore(store)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {filteredItems.length > 0 && (
            <div className="w-full h-1/2 overflow-y-auto dark-scrollbar flex flex-col gap-6 pb-8 mt-2 border-t border-white/5 pt-6">
              {filteredItems.map((item, idx) => (
                <div key={idx} className="p-5 bg-white/[0.02] border border-white/5 relative group hover:bg-white/[0.04] transition-all animate-slide-up" style={{ animationDelay: `${idx * 0.08}s` }}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[12px] font-black text-white uppercase tracking-tight leading-tight">{item.name}</span>
                    {item.estimatedPrice && <span className="bg-[#c2a35d] text-black text-[9px] font-black px-2 py-0.5 whitespace-nowrap ml-2 shadow-xl">{item.estimatedPrice}</span>}
                  </div>
                  
                  {item.recommendedStore && (
                    <div className="flex items-center gap-1.5 mb-2 opacity-60">
                      <span className="material-symbols-outlined text-[12px] text-[#c2a35d]">storefront</span>
                      <span className="text-[8px] font-bold uppercase tracking-widest">{item.recommendedStore}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-white/40 leading-relaxed mb-4 font-medium">{item.description}</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => copyToClipboard(item.searchQuery, 'tag')} 
                      className="flex items-center justify-center gap-2 py-2.5 bg-black/40 border border-white/5 group hover:border-[#c2a35d]/30 transition-all rounded-none"
                    >
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/40 group-hover:text-[#c2a35d]">Copy Tag</span>
                      <span className="material-symbols-outlined text-[14px] text-white/10 group-hover:text-[#c2a35d]">content_copy</span>
                    </button>
                    {item.shopUrl && (
                      <button 
                        onClick={() => copyToClipboard(item.shopUrl!, 'link')} 
                        className="flex items-center justify-center gap-2 py-2.5 bg-[#c2a35d]/10 border border-[#c2a35d]/20 group hover:bg-[#c2a35d] transition-all rounded-none"
                      >
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#c2a35d] group-hover:text-black">Shop Piece</span>
                        <span className="material-symbols-outlined text-[14px] text-[#c2a35d] group-hover:text-black">link</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Mobile Navigation Bar */}
      <div className="lg:hidden flex items-center justify-around border-t border-white/5 bg-[#0f0f11] h-[76px] pb-4 px-4 w-full shrink-0">
        {[
          { id: 'design', icon: 'auto_fix_high', label: 'Studio' },
          { id: 'preview', icon: 'flare', label: 'Spotlight' },
          { id: 'breakdown', icon: 'diamond', label: 'Boutique' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ViewMode)}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === tab.id ? 'text-[#c2a35d] scale-110' : 'text-white/20'}`}
          >
            <span className="material-symbols-outlined text-[26px]">{tab.icon}</span>
            <span className="text-[9px] font-black tracking-[0.2em] uppercase">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
