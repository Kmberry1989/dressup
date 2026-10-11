import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Checkbox, FieldDropdown, PillButton, SectionLabel, SegmentedToggle, TextInput } from './components/Primitives';
import { prepareImage, requestGeneratedLook, requestLookAnalysis } from './src/client';
import { continueWithGoogle, saveCuration, saveLook, startAuth, subscribeToHistory } from './src/history';
import { googleSignInEnabled } from './src/firebase';
import type { AppState, GeneratedLook, ImageProvider, LookFormat, PriceLevel, StoredHistoryEntry, UserImage } from './types';

const STORE_CATEGORIES = [
  { name: 'Global Marketplaces', stores: ['AliExpress', 'Amazon', 'eBay', 'Etsy', 'Google Shopping', 'Mercari', 'Walmart'] },
  { name: 'Specialized Cosplay', stores: ['CosplaySky', 'DokiDoki Cosplay', 'EZCosplay', 'FM-Anime', 'Miccostumes', 'Procosplay', 'RoleCosplay', 'SimCosplay', 'SkyCostume', 'Uwowo', 'XCoser'] },
  { name: 'Wigs & Artistry', stores: ['Arda Wigs', 'Coscraft', 'Ehire', 'Epic Cosplay', 'WigIsFashion'] },
  { name: 'Editorial & High Street', stores: ['ASOS', 'H&M', "Kohl's", "Macy's", 'Nordstrom', 'Target', 'Zara'] },
  { name: 'Footwear & Finishing', stores: ['Aldo', 'Christian Louboutin', 'DSW', 'Famous Footwear', 'Jimmy Choo', 'Nike', 'Steve Madden', 'Zappos'] },
];

const STYLE_OPTIONS = ['None', 'Avant-Garde', 'Classic Tuxedo', 'Ballroom Gown', 'High-Fashion Editorial', 'Silk Drape', 'Velvet Noir', 'Met Gala Concept', 'Futuristic Formal', 'Period Drama Royale', 'Celestial Couture', 'Gold Embroidery', 'Minimalist Luxury'];
const HAIR_OPTIONS = ['Original / No Change', 'Sleek Low Bun', 'Hollywood Waves', 'Intricate Braided Crown', 'Sharp Bob', 'Textured High Updo', 'Polished Fade', 'Tapered Curls', 'Chignon', 'Slicked Back', 'Long Glossy Straight'];
const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];
type ViewMode = 'design' | 'preview' | 'breakdown';

function getClientId(): string {
  const stored = window.sessionStorage.getItem('cosplay-compass-client-id');
  if (stored) return stored;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem('cosplay-compass-client-id', created);
  return created;
}

const initialPrompt = 'Avant-garde high-fashion gala attire for a black-tie event, architectural obsidian silk silhouette with intricate gold metallic embroidery, cinematic red carpet lighting, photorealistic luxury textures.';
const matchingPrompt = 'A polished black-tie tuxedo that complements the referenced dress through coordinated color, texture, formality, and subtle accessory accents. Keep the styling sophisticated and let the dress remain the visual lead.';

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'The request timed out. Please try again.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function withTimeout(milliseconds: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), milliseconds);
  return { signal: controller.signal, clear: () => window.clearTimeout(timer) };
}

export default function App() {
  const allStores = useMemo(() => STORE_CATEGORIES.flatMap((category) => category.stores), []);
  const [activeTab, setActiveTab] = useState<ViewMode>('design');
  const [showSearch, setShowSearch] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [imageProvider, setImageProvider] = useState<ImageProvider>('cloudflare');
  const [clientId] = useState(getClientId);
  const [toast, setToast] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [savedHistory, setSavedHistory] = useState<StoredHistoryEntry[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [tagDrafts, setTagDrafts] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());
  const [state, setState] = useState<AppState>({
    userImages: [],
    currentLook: null,
    history: [],
    items: [],
    priceRange: 'Premium',
    lookFormat: 'Portrait',
    selectedStores: allStores,
    selectedStyle: 'High-Fashion Editorial',
    selectedHair: 'Original / No Change',
    designMode: 'original',
    searchTerm: '',
    isGenerating: false,
    isAnalyzing: false,
    workshopStatus: '',
    error: null,
  });

  useEffect(() => {
    document.documentElement.style.backgroundColor = '#09090b';
    return () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => startAuth(setFirebaseUser, setSyncError), []);

  useEffect(() => {
    if (!firebaseUser) {
      setSavedHistory([]);
      return;
    }
    return subscribeToHistory(firebaseUser.uid, setSavedHistory, setSyncError);
  }, [firebaseUser]);

  useEffect(() => {
    window.render_game_to_text = () => JSON.stringify({
      screen: activeTab,
      coordinateSystem: 'Responsive DOM layout; no gameplay coordinates.',
      references: state.userImages.length,
      designMode: state.designMode,
      hasGeneratedLook: Boolean(state.currentLook),
      historyCount: state.history.length,
      shoppingItemCount: state.items.length,
      isGenerating: state.isGenerating,
      isAnalyzing: state.isAnalyzing,
      error: state.error,
    });
    window.advanceTime = () => undefined;
  }, [activeTab, state]);

  const filteredItems = useMemo(() => {
    const term = state.searchTerm.trim().toLowerCase();
    const indexed = state.items.map((item, index) => ({ item, index }));
    if (!term) return indexed;
    return indexed.filter(({ item }) => [item.name, item.description, item.material, item.recommendedStore, ...(item.tags ?? [])]
      .some((value) => value?.toLowerCase().includes(term)));
  }, [state.items, state.searchTerm]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  };

  const trackUrl = (blob: Blob): string => {
    const url = URL.createObjectURL(blob);
    objectUrls.current.add(url);
    return url;
  };

  const releaseUrl = (url: string) => {
    URL.revokeObjectURL(url);
    objectUrls.current.delete(url);
  };

  const addUserImage = async (file: File) => {
    if (state.userImages.length >= 2) return;
    setState((current) => ({ ...current, error: null, workshopStatus: 'Preparing reference...' }));
    try {
      const prepared = await prepareImage(file);
      const userImage: UserImage = {
        ...prepared,
        id: crypto.randomUUID(),
        previewUrl: trackUrl(file),
      };
      setState((current) => ({ ...current, userImages: [...current.userImages, userImage], workshopStatus: '' }));
    } catch (error) {
      setState((current) => ({ ...current, workshopStatus: '', error: errorMessage(error) }));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeUserImage = (id: string) => {
    setState((current) => {
      const removed = current.userImages.find((image) => image.id === id);
      if (removed) releaseUrl(removed.previewUrl);
      return { ...current, userImages: current.userImages.filter((image) => image.id !== id) };
    });
  };

  const generateLook = async () => {
    if (state.isGenerating || state.isAnalyzing) return;
    if (prompt.trim().length < 10) {
      setState((current) => ({ ...current, error: 'Describe the look in at least 10 characters.' }));
      return;
    }
    if (state.designMode === 'match-partner' && state.userImages.length === 0) {
      setState((current) => ({ ...current, error: 'Add a clear photo of her dress first so the tux can match it accurately.' }));
      return;
    }
    setState((current) => ({ ...current, isGenerating: true, error: null, items: [], workshopStatus: 'Sculpting silhouette...' }));
    if (window.innerWidth < 1024) setActiveTab('preview');
    const timeout = withTimeout(110_000);
    try {
      const generated = await requestGeneratedLook({
        prompt: prompt.trim(),
        style: state.selectedStyle,
        hair: state.selectedHair,
        format: state.lookFormat,
        aspectRatio,
        provider: imageProvider,
        designMode: state.designMode,
        clientId,
        images: state.userImages,
      }, timeout.signal);
      const look: GeneratedLook = {
        ...generated,
        id: crypto.randomUUID(),
        imageUrl: trackUrl(generated.blob),
        timestamp: Date.now(),
      };
      if (firebaseUser) {
        try {
          look.historyId = await saveLook(firebaseUser.uid, {
            prompt: look.prompt,
            style: state.selectedStyle,
            hair: state.selectedHair,
            format: state.lookFormat,
            aspectRatio,
            provider: imageProvider,
            designMode: state.designMode,
            mimeType: look.mimeType,
          });
        } catch (historyError) {
          setSyncError(errorMessage(historyError));
        }
      }
      setState((current) => {
        const history = [look, ...current.history].slice(0, 10);
        for (const evicted of current.history.slice(9)) releaseUrl(evicted.imageUrl);
        return { ...current, currentLook: look, history, isGenerating: false, workshopStatus: '' };
      });
      showToast('Look developed');
    } catch (error) {
      setState((current) => ({ ...current, isGenerating: false, workshopStatus: '', error: errorMessage(error) }));
    } finally {
      timeout.clear();
    }
  };

  const analyzeLook = async () => {
    if (!state.currentLook || state.isAnalyzing || state.isGenerating) return;
    setState((current) => ({ ...current, isAnalyzing: true, error: null, workshopStatus: 'Curating shopping list...' }));
    const timeout = withTimeout(60_000);
    try {
      const items = await requestLookAnalysis(state.currentLook, state.priceRange, state.selectedStores, state.currentLook.isSpread ? 'Spread' : 'Portrait', timeout.signal);
      setState((current) => ({ ...current, items, isAnalyzing: false, workshopStatus: '' }));
      if (firebaseUser && state.currentLook.historyId) {
        try {
          await saveCuration(firebaseUser.uid, state.currentLook.historyId, items, state.priceRange, state.selectedStores);
        } catch (historyError) {
          setSyncError(errorMessage(historyError));
        }
      }
      if (window.innerWidth < 1024) setActiveTab('breakdown');
      showToast(`${items.length} pieces curated`);
    } catch (error) {
      setState((current) => ({ ...current, isAnalyzing: false, workshopStatus: '', error: errorMessage(error) }));
    } finally {
      timeout.clear();
    }
  };

  const downloadLook = () => {
    if (!state.currentLook) return;
    const extension = state.currentLook.mimeType.includes('jpeg') ? 'jpg' : state.currentLook.mimeType.split('/')[1] || 'png';
    const anchor = document.createElement('a');
    anchor.href = state.currentLook.imageUrl;
    anchor.download = `cosplay-compass-${state.currentLook.timestamp}.${extension}`;
    anchor.click();
    showToast('Download started');
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch {
      setState((current) => ({ ...current, error: 'Clipboard access was blocked. Copy the text manually.' }));
    }
  };

  const linkGoogleAccount = async () => {
    if (isLinkingGoogle) return;
    setIsLinkingGoogle(true);
    setSyncError(null);
    try {
      const user = await continueWithGoogle(firebaseUser, savedHistory);
      setFirebaseUser(user);
      showToast('History connected to Google');
    } catch (error) {
      setSyncError(errorMessage(error));
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const openSavedEntry = (entry: StoredHistoryEntry) => {
    const sessionLook = state.history.find((look) => look.historyId === entry.id);
    setPrompt(entry.prompt);
    setAspectRatio(entry.aspectRatio);
    setImageProvider(entry.provider);
    setState((current) => ({
      ...current,
      currentLook: sessionLook ?? current.currentLook,
      selectedStyle: entry.style,
      selectedHair: entry.hair,
      designMode: entry.designMode,
      lookFormat: entry.format,
      priceRange: entry.priceLevel ?? current.priceRange,
      selectedStores: entry.selectedStores ?? current.selectedStores,
      items: entry.items,
    }));
    if (!sessionLook) showToast('Settings and curation restored; image was session-only');
  };

  const setDesignMode = (mode: AppState['designMode']) => {
    setState((current) => ({ ...current, designMode: mode, error: null }));
    if (mode === 'match-partner' && prompt === initialPrompt) setPrompt(matchingPrompt);
    if (mode === 'original' && prompt === matchingPrompt) setPrompt(initialPrompt);
  };

  const addItemTag = async (itemIndex: number) => {
    const tag = (tagDrafts[itemIndex] ?? '').trim().replace(/^#/, '').slice(0, 30);
    if (!tag) return;
    const items = state.items.map((item, index) => index === itemIndex
      ? { ...item, tags: [...new Set([...(item.tags ?? []), tag])] }
      : item);
    setState((current) => ({ ...current, items }));
    setTagDrafts((current) => ({ ...current, [itemIndex]: '' }));
    if (firebaseUser && state.currentLook?.historyId) {
      try {
        await saveCuration(firebaseUser.uid, state.currentLook.historyId, items, state.priceRange, state.selectedStores);
      } catch (error) {
        setSyncError(errorMessage(error));
      }
    }
  };

  return (
    <main className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#09090b] text-[#f5f5f7] lg:flex-row">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_40%,#1a1a1c_0%,#09090b_65%)]" />

      {toast && <div role="status" className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 bg-[#c2a35d] px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black shadow-2xl lg:bottom-12">{toast}</div>}
      {state.error && <div role="alert" className="fixed bottom-24 left-4 right-4 z-[110] flex items-start justify-between gap-4 border border-red-500/40 bg-red-950/95 px-5 py-3 text-[10px] font-bold text-red-100 shadow-2xl lg:bottom-10 lg:left-1/2 lg:right-auto lg:w-full lg:max-w-xl lg:-translate-x-1/2">
        <span>{state.error}</span>
        <button type="button" aria-label="Dismiss error" onClick={() => setState((current) => ({ ...current, error: null }))} className="text-red-200"><span className="material-symbols-outlined text-base">close</span></button>
      </div>}

      <section aria-label="Design studio" className={`${activeTab === 'design' ? 'flex' : 'hidden lg:flex'} relative z-10 h-[calc(100dvh-76px)] w-full flex-col border-r border-white/5 bg-[#0f0f11]/95 px-4 py-6 shadow-2xl lg:h-full lg:w-[350px]`}>
        <header className="mb-6 flex items-center justify-between border-b border-white/5 pb-5">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.35em] text-[#c2a35d]">AI atelier</p>
            <h1 className="mt-1 text-2xl italic">Cosplay Compass</h1>
          </div>
          {firebaseUser?.isAnonymous && googleSignInEnabled ? (
            <button type="button" onClick={() => void linkGoogleAccount()} disabled={isLinkingGoogle || !firebaseUser} className="border border-[#c2a35d]/35 px-3 py-2 text-[8px] font-black uppercase tracking-widest text-[#c2a35d] transition-colors hover:bg-[#c2a35d] hover:text-black disabled:opacity-40">
              {isLinkingGoogle ? 'Connecting...' : 'Sync with Google'}
            </button>
          ) : firebaseUser?.isAnonymous ? (
            <div className="flex items-center gap-2 text-[#c2a35d]" title="History is saved privately in this browser">
              <span className="material-symbols-outlined text-xl">lock</span>
              <span className="text-[8px] font-black uppercase tracking-widest">Private history</span>
            </div>
          ) : firebaseUser ? (
            <div className="flex items-center gap-2" title={firebaseUser.email ?? 'Google account'}>
              {firebaseUser.photoURL ? <img src={firebaseUser.photoURL} alt="" className="h-8 w-8 rounded-full border border-[#c2a35d]/40" /> : <span className="material-symbols-outlined text-[#c2a35d]">account_circle</span>}
              <span className="text-[8px] font-black uppercase tracking-widest text-[#c2a35d]">Synced</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white/30"><span className="material-symbols-outlined animate-pulse text-xl">lock</span><span className="text-[8px] font-black uppercase tracking-widest">Starting history</span></div>
          )}
        </header>

        {syncError && <div role="status" className="mb-4 flex items-start justify-between gap-3 border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-[9px] leading-relaxed text-amber-100">
          <span>History sync: {syncError}</span>
          <button type="button" aria-label="Dismiss sync message" onClick={() => setSyncError(null)}><span className="material-symbols-outlined text-sm">close</span></button>
        </div>}

        <div className="no-scrollbar flex flex-1 flex-col gap-7 overflow-y-auto pb-6">
          <div>
            <SectionLabel>Design Goal</SectionLabel>
            <SegmentedToggle value={state.designMode} onChange={(value) => setDesignMode(value as AppState['designMode'])} items={[{ value: 'original', label: 'Create a Look' }, { value: 'match-partner', label: 'Match Her Dress' }]} />
            {state.designMode === 'match-partner' && <div className="mt-3 border border-[#c2a35d]/20 bg-[#c2a35d]/5 px-3 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#c2a35d]">Her look is already decided</p>
              <p className="mt-1 text-[9px] leading-relaxed text-white/45">Upload her dress first. The result will show only your coordinating tux—not a couple or a replacement dress.</p>
            </div>}
          </div>

          <div>
            <SectionLabel>{state.designMode === 'match-partner' ? 'Dress Reference' : 'Inspiration Subjects'}</SectionLabel>
            <p className="mb-3 text-[9px] leading-relaxed text-white/35">{state.designMode === 'match-partner' ? 'Required: her dress photo first. Optional: add your portrait second for likeness.' : 'Optional. Add one adult portrait, or two for a coordinated look.'}</p>
            <div className="grid grid-cols-2 gap-3">
              {state.userImages.map((image, index) => (
                <div key={image.id} className="group relative aspect-square overflow-hidden border border-white/10 bg-[#1a1a1c]">
                  <img src={image.previewUrl} className="h-full w-full object-cover" alt={state.designMode === 'match-partner' ? (index === 0 ? 'Partner dress reference' : 'Your portrait reference') : 'Uploaded reference'} />
                  {state.designMode === 'match-partner' && <span className="absolute bottom-1 left-1 bg-black/80 px-2 py-1 text-[7px] font-black uppercase tracking-widest text-[#c2a35d]">{index === 0 ? 'Her dress' : 'Your portrait'}</span>}
                  <button type="button" aria-label="Remove reference image" onClick={() => removeUserImage(image.id)} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center border border-[#c2a35d]/30 bg-black/75 text-[#c2a35d] opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              ))}
              {state.userImages.length < 2 && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-2 border border-dashed border-white/15 bg-[#1a1a1c] text-white/35 transition-colors hover:border-[#c2a35d]/60 hover:text-[#c2a35d]">
                  <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                  <span className="px-2 text-center text-[8px] font-bold uppercase tracking-widest">{state.designMode === 'match-partner' ? (state.userImages.length === 0 ? 'Add her dress' : 'Add your portrait') : 'Add portrait'}</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose reference image" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addUserImage(file); }} />
            </div>
          </div>

          <div>
            <SectionLabel>Couture Concept</SectionLabel>
            <TextInput value={prompt} onChange={setPrompt} placeholder="Describe the fabrics, silhouette, and event mood..." />
            <p className="mt-2 text-right text-[8px] text-white/25">{prompt.length} / 2000</p>
          </div>

          <div className="flex flex-col gap-4">
            <SectionLabel>Studio Tuning</SectionLabel>
            <div>
              <p className="mb-1.5 ml-1 text-[8px] font-black uppercase tracking-widest text-[#c2a35d]">Look format</p>
              <SegmentedToggle value={state.lookFormat} onChange={(value) => setState((current) => ({ ...current, lookFormat: value as LookFormat }))} items={[{ value: 'Portrait', label: 'Spotlight' }, { value: 'Spread', label: 'Full Look' }]} />
            </div>
            <FieldDropdown label="Aesthetic Thread" value={state.selectedStyle} options={STYLE_OPTIONS} onChange={(value) => setState((current) => ({ ...current, selectedStyle: value }))} />
            <FieldDropdown label="Grooming Blueprint" value={state.selectedHair} options={HAIR_OPTIONS} onChange={(value) => setState((current) => ({ ...current, selectedHair: value }))} />
            <FieldDropdown label="Aspect Ratio" value={aspectRatio} options={ASPECT_RATIOS} onChange={setAspectRatio} />
            <div>
              <p className="mb-1.5 ml-1 text-[8px] font-black uppercase tracking-widest text-[#c2a35d]">Generation provider</p>
              <SegmentedToggle value={imageProvider} onChange={(value) => setImageProvider(value as ImageProvider)} items={[{ value: 'cloudflare', label: 'Free' }, { value: 'gemini', label: 'Higher Quality' }]} />
            </div>
            <div className="border border-white/5 bg-black/30 px-3 py-2">
              <p className="text-[8px] font-black uppercase tracking-widest text-[#c2a35d]">Image engine</p>
              <p className="mt-1 text-[10px] text-white/55">{imageProvider === 'cloudflare' ? 'Cloudflare FLUX.2 Klein · free daily allowance' : 'Gemini 3.1 Flash Lite Image · paid higher quality'}</p>
              <p className="mt-1 text-[9px] leading-relaxed text-white/30">{imageProvider === 'cloudflare' ? 'Up to 3 requests per minute per browser session. Reference likeness may be looser.' : 'Approximately $0.0336 per successful 1K image.'}</p>
            </div>
          </div>

          {state.history.length > 0 && (
            <div>
              <SectionLabel>Look History</SectionLabel>
              <div className="grid grid-cols-4 gap-2">
                {state.history.map((look) => (
                  <button type="button" key={look.id} aria-label="Open generated look" onClick={() => setState((current) => ({ ...current, currentLook: look, items: [] }))} className={`relative aspect-[3/4] overflow-hidden border transition-all ${state.currentLook?.id === look.id ? 'border-[#c2a35d]' : 'border-white/5 opacity-50 hover:opacity-100'}`}>
                    <img src={look.imageUrl} className="h-full w-full object-cover" alt="Generated look thumbnail" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {savedHistory.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <SectionLabel>Saved History</SectionLabel>
                <span className="mb-2 text-[7px] font-black uppercase tracking-widest text-white/25">{firebaseUser?.isAnonymous ? 'This browser' : 'Google sync'}</span>
              </div>
              <div className="flex flex-col gap-2">
                {savedHistory.slice(0, 12).map((entry) => (
                  <button type="button" key={entry.id} onClick={() => openSavedEntry(entry)} className="border border-white/5 bg-black/25 px-3 py-3 text-left transition-colors hover:border-[#c2a35d]/40">
                    <span className="line-clamp-2 text-[10px] leading-relaxed text-white/65">{entry.prompt}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-[7px] font-black uppercase tracking-widest text-[#c2a35d]/65">
                      <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                      <span>{entry.items.length} items</span>
                      {entry.tags.slice(0, 3).map((tag) => <span key={tag} className="border border-[#c2a35d]/20 px-1.5 py-0.5">#{tag}</span>)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <PillButton variant="solid" onClick={() => void generateLook()} disabled={state.isGenerating || state.isAnalyzing} icon={<span className="material-symbols-outlined text-xl">brush</span>}>
          {state.isGenerating ? 'Rendering...' : state.designMode === 'match-partner' ? 'Design My Matching Tux' : `Design ${state.lookFormat === 'Spread' ? 'Full Look' : 'Gala Look'}`}
        </PillButton>
      </section>

      <section aria-label="Generated look preview" className={`${activeTab === 'preview' ? 'flex' : 'hidden lg:flex'} relative z-10 flex-1 flex-col items-center justify-center overflow-hidden p-5 lg:p-8`}>
        {state.workshopStatus && <div role="status" className="absolute top-5 z-20 border border-[#c2a35d]/30 bg-[#0f0f11] px-6 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-[#c2a35d] shadow-2xl lg:top-10">{state.workshopStatus}</div>}
        {!state.currentLook && !state.isGenerating ? (
          <div className="flex max-w-sm flex-col items-center gap-5 text-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border border-[#c2a35d]/15 bg-[#c2a35d]/5">
              <span className="material-symbols-outlined text-6xl font-thin text-[#c2a35d]/45">camera_front</span>
            </div>
            <div>
              <h2 className="text-3xl italic text-white/80">The spotlight is ready.</h2>
              <p className="mt-3 text-[10px] uppercase leading-loose tracking-[0.2em] text-white/30">{state.designMode === 'match-partner' ? 'Add her dress photo, then design a solo tux that belongs beside it.' : 'Add an optional portrait, shape the concept, then design your gala look.'}</p>
            </div>
          </div>
        ) : state.isGenerating ? (
          <div className="flex aspect-[9/16] max-h-[78vh] w-full max-w-[440px] flex-col items-center justify-center gap-6 border border-white/5 bg-white/[0.02] shadow-2xl">
            <div className="h-16 w-16 animate-spin rounded-full border-r-2 border-t-2 border-[#c2a35d]" />
            <p className="animate-pulse text-[11px] font-medium uppercase tracking-[0.3em] text-[#c2a35d]">Developing look...</p>
          </div>
        ) : state.currentLook && (
          <div className="group relative max-h-full">
            <div className="absolute -inset-4 -z-10 border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent" />
            <img src={state.currentLook.imageUrl} alt="AI-generated gala cosplay look" className="max-h-[80vh] max-w-full border border-white/10 object-contain shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)]" />
            {state.currentLook.isSpread && <div className="absolute left-4 top-4 bg-[#c2a35d] px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-black">Editorial spread</div>}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 border border-white/10 bg-black/80 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#c2a35d]">
              <span className="material-symbols-outlined text-base">photo_camera</span>
              Edition #{(state.currentLook.timestamp % 1000).toString().padStart(3, '0')}
            </div>
            <button type="button" onClick={downloadLook} aria-label="Download generated look" className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center border border-white/15 bg-black/75 text-white transition-colors hover:bg-[#c2a35d] hover:text-black">
              <span className="material-symbols-outlined">download</span>
            </button>
          </div>
        )}
      </section>

      <section aria-label="Shopping breakdown" className={`${activeTab === 'breakdown' ? 'flex' : 'hidden lg:flex'} relative z-10 h-[calc(100dvh-76px)] w-full flex-col border-l border-white/5 bg-[#0f0f11]/95 px-4 py-6 lg:h-full lg:w-[360px]`}>
        <div className="mb-5 flex items-center justify-between border-b border-white/5 pb-5">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.35em] text-[#c2a35d]">Sourcing desk</p>
            <h2 className="mt-1 text-2xl italic">The Boutique</h2>
          </div>
          <button type="button" aria-label={showSearch ? 'Close item filter' : 'Filter items'} onClick={() => { setShowSearch((open) => !open); if (showSearch) setState((current) => ({ ...current, searchTerm: '' })); }} className={`flex h-10 w-10 items-center justify-center border ${showSearch ? 'border-[#c2a35d] bg-[#c2a35d] text-black' : 'border-white/10 text-white/40'}`}>
            <span className="material-symbols-outlined">{showSearch ? 'close' : 'search'}</span>
          </button>
        </div>

        {showSearch && <input autoFocus value={state.searchTerm} onChange={(event) => setState((current) => ({ ...current, searchTerm: event.target.value }))} placeholder="FILTER COUTURE ELEMENTS..." aria-label="Filter shopping items" className="mb-4 w-full border border-white/10 bg-black/40 px-3 py-4 text-[10px] font-bold uppercase tracking-widest text-[#c2a35d] outline-none placeholder:text-white/15" />}

        <div className="no-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto pr-1">
          <div>
            <SectionLabel>Market Bracket</SectionLabel>
            <SegmentedToggle value={state.priceRange} onChange={(value) => setState((current) => ({ ...current, priceRange: value as PriceLevel }))} items={[{ value: 'Budget', label: 'Ready' }, { value: 'Standard', label: 'Boutique' }, { value: 'Premium', label: 'Couture' }]} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <SectionLabel>Preferred Boutiques</SectionLabel>
              <div className="mb-2 flex gap-2">
                <button type="button" onClick={() => setState((current) => ({ ...current, selectedStores: allStores }))} className="text-[7px] font-black uppercase tracking-widest text-[#c2a35d]">All</button>
                <button type="button" onClick={() => setState((current) => ({ ...current, selectedStores: [] }))} className="text-[7px] font-black uppercase tracking-widest text-white/35">Clear</button>
              </div>
            </div>
            {STORE_CATEGORIES.map((category) => (
              <div key={category.name} className="mb-5">
                <p className="mb-2 flex justify-between border-b border-white/5 pb-1 text-[7px] font-black uppercase tracking-[0.2em] text-[#c2a35d]/55"><span>{category.name}</span><span>{category.stores.filter((store) => state.selectedStores.includes(store)).length}/{category.stores.length}</span></p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {category.stores.map((store) => <Checkbox key={store} label={store} checked={state.selectedStores.includes(store)} onChange={() => setState((current) => ({ ...current, selectedStores: current.selectedStores.includes(store) ? current.selectedStores.filter((value) => value !== store) : [...current.selectedStores, store] }))} />)}
                </div>
              </div>
            ))}
          </div>

          {state.currentLook && <PillButton variant="outline" onClick={() => void analyzeLook()} disabled={state.isAnalyzing || state.isGenerating} icon={<span className="material-symbols-outlined text-xl">diamond</span>}>{state.isAnalyzing ? 'Curating...' : state.items.length ? 'Refresh Essentials' : 'Inspect Essentials'}</PillButton>}

          {state.items.length === 0 ? (
            <div className="border border-dashed border-white/10 px-5 py-8 text-center text-[9px] uppercase leading-loose tracking-[0.18em] text-white/25">{state.currentLook ? 'Inspect the look to build a shopping guide.' : 'Generate a look to unlock sourcing.'}</div>
          ) : filteredItems.length === 0 ? (
            <div className="border border-dashed border-white/10 px-5 py-8 text-center text-[9px] uppercase tracking-[0.18em] text-white/25">No pieces match that filter.</div>
          ) : (
            <div className="flex flex-col gap-4 border-t border-white/5 pt-5">
              <p className="text-[8px] font-black uppercase tracking-[0.25em] text-[#c2a35d]">{filteredItems.length} curated pieces</p>
              {filteredItems.map(({ item, index }) => (
                <article key={`${item.name}-${item.searchQuery}`} className="border border-white/5 bg-white/[0.025] p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="text-[12px] font-black uppercase leading-tight">{item.name}</h3>
                    {item.estimatedPrice && <span className="whitespace-nowrap bg-[#c2a35d] px-2 py-0.5 text-[8px] font-black text-black">{item.estimatedPrice}</span>}
                  </div>
                  {item.recommendedStore && <p className="mb-2 text-[8px] font-bold uppercase tracking-widest text-[#c2a35d]/70">{item.recommendedStore}</p>}
                  <p className="mb-4 text-[10px] leading-relaxed text-white/45">{item.description}</p>
                  {(item.tags?.length ?? 0) > 0 && <div className="mb-3 flex flex-wrap gap-1.5">{item.tags?.map((tag) => <span key={tag} className="border border-[#c2a35d]/25 bg-[#c2a35d]/5 px-2 py-1 text-[7px] font-black uppercase tracking-wider text-[#c2a35d]">#{tag}</span>)}</div>}
                  <div className="mb-3 flex gap-2">
                    <input value={tagDrafts[index] ?? ''} onChange={(event) => setTagDrafts((current) => ({ ...current, [index]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') void addItemTag(index); }} maxLength={30} placeholder="ADD A TAG" aria-label={`Add tag to ${item.name}`} className="min-w-0 flex-1 border border-white/10 bg-black/30 px-2 py-2 text-[8px] font-bold uppercase tracking-wider text-white outline-none placeholder:text-white/20 focus:border-[#c2a35d]/50" />
                    <button type="button" onClick={() => void addItemTag(index)} className="border border-white/10 px-3 text-[8px] font-black uppercase tracking-wider text-white/55 hover:text-[#c2a35d]">Add</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => void copyText(item.searchQuery, 'Search tag')} className="border border-white/10 bg-black/30 py-2 text-[8px] font-black uppercase tracking-wider text-white/55 hover:text-[#c2a35d]">Copy tag</button>
                    <a href={item.shopUrl} target="_blank" rel="noreferrer" className="border border-[#c2a35d]/25 bg-[#c2a35d]/10 py-2 text-center text-[8px] font-black uppercase tracking-wider text-[#c2a35d] hover:bg-[#c2a35d] hover:text-black">Shop search</a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <nav aria-label="Mobile workspace" className="relative z-20 flex h-[76px] shrink-0 items-center justify-around border-t border-white/5 bg-[#0f0f11] px-4 pb-3 lg:hidden">
        {([
          { id: 'design', icon: 'auto_fix_high', label: 'Studio' },
          { id: 'preview', icon: 'flare', label: 'Spotlight' },
          { id: 'breakdown', icon: 'diamond', label: 'Boutique' },
        ] as const).map((tab) => (
          <button type="button" key={tab.id} aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'text-[#c2a35d]' : 'text-white/25'}`}>
            <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
            <span className="text-[8px] font-black uppercase tracking-[0.2em]">{tab.label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
