import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { CosplayItem, DesignMode, ImageProvider, LookFormat, PriceLevel, StoredHistoryEntry } from '../types';
import { auth, db, firebaseConfigured } from './firebase';

export interface NewHistoryEntry {
  prompt: string;
  style: string;
  hair: string;
  format: LookFormat;
  aspectRatio: string;
  provider: ImageProvider;
  designMode: DesignMode;
  mimeType: string;
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

function historyCollection(userId: string) {
  if (!db) throw new Error('Firebase is not configured.');
  return collection(db, 'users', userId, 'history');
}

function normalizeEntry(snapshot: QueryDocumentSnapshot<DocumentData>): StoredHistoryEntry {
  const data = snapshot.data();
  const createdAt = typeof data.createdAt === 'number' ? data.createdAt : data.createdAt?.toMillis?.() ?? Date.now();
  const updatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : data.updatedAt?.toMillis?.() ?? createdAt;
  return {
    id: snapshot.id,
    prompt: String(data.prompt ?? ''),
    style: String(data.style ?? 'None'),
    hair: String(data.hair ?? 'Original / No Change'),
    format: data.format === 'Spread' ? 'Spread' : 'Portrait',
    aspectRatio: String(data.aspectRatio ?? '9:16'),
    provider: data.provider === 'gemini' ? 'gemini' : 'cloudflare',
    designMode: data.designMode === 'match-partner' ? 'match-partner' : 'original',
    createdAt,
    updatedAt,
    mimeType: String(data.mimeType ?? 'image/png'),
    priceLevel: data.priceLevel,
    selectedStores: Array.isArray(data.selectedStores) ? data.selectedStores : undefined,
    items: Array.isArray(data.items) ? data.items : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
  };
}

export function startAuth(onUser: (user: User | null) => void, onError: (message: string) => void): Unsubscribe {
  if (!firebaseConfigured || !auth) {
    onError('History sync is not configured for this deployment.');
    return () => undefined;
  }
  const firebaseAuth = auth;
  return onAuthStateChanged(firebaseAuth, async (user) => {
    if (user) {
      onUser(user);
      return;
    }
    try {
      const credential = await signInAnonymously(firebaseAuth);
      onUser(credential.user);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not start private history sync.');
    }
  }, (error) => onError(error.message));
}

export function subscribeToHistory(userId: string, onEntries: (entries: StoredHistoryEntry[]) => void, onError: (message: string) => void): Unsubscribe {
  const historyQuery = query(historyCollection(userId), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(historyQuery, (snapshot) => onEntries(snapshot.docs.map(normalizeEntry)), (error) => onError(error.message));
}

export async function saveLook(userId: string, entry: NewHistoryEntry): Promise<string> {
  const now = Date.now();
  const reference = await addDoc(historyCollection(userId), {
    ...entry,
    ownerId: userId,
    createdAt: now,
    updatedAt: now,
    serverCreatedAt: serverTimestamp(),
    items: [],
    tags: [],
  });
  return reference.id;
}

export async function saveCuration(
  userId: string,
  historyId: string,
  items: CosplayItem[],
  priceLevel: PriceLevel,
  selectedStores: string[],
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  const tags = [...new Set(items.flatMap((item) => item.tags ?? []))];
  await updateDoc(doc(db, 'users', userId, 'history', historyId), {
    items,
    tags,
    priceLevel,
    selectedStores,
    updatedAt: Date.now(),
  });
}

async function copyAnonymousHistory(fromUserId: string, toUserId: string, entries: StoredHistoryEntry[]): Promise<void> {
  if (!db || fromUserId === toUserId) return;
  const firestore = db;
  await Promise.all(entries.map((entry) => setDoc(doc(firestore, 'users', toUserId, 'history', entry.id), {
    ...entry,
    ownerId: toUserId,
    migratedFrom: fromUserId,
  })));
}

export async function continueWithGoogle(currentUser: User | null, entries: StoredHistoryEntry[]): Promise<User> {
  if (!auth) throw new Error('Firebase is not configured.');
  if (!currentUser || !currentUser.isAnonymous) return (await signInWithPopup(auth, provider)).user;
  const anonymousId = currentUser.uid;
  try {
    return (await linkWithPopup(currentUser, provider)).user;
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code !== 'auth/credential-already-in-use' && code !== 'auth/email-already-in-use') throw error;
    const signedIn = (await signInWithPopup(auth, provider)).user;
    await copyAnonymousHistory(anonymousId, signedIn.uid, entries);
    return signedIn;
  }
}
