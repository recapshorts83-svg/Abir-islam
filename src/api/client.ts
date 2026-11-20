import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  STARTER_CATEGORIES,
  STARTER_SECTIONS,
  STARTER_SETTINGS,
  STARTER_VIDEOS,
} from '../data/starterCatalog';
import type {
  AdminDashboardStats,
  AdminUser,
  Category,
  HomepageSection,
  SiteSettings,
  Video,
  VideoSourceType,
} from '../types/video';
import { compressThumbnailToDataUrl } from '../utils/imageUpload';
import { selectRelatedVideos, slugifyCategory, validateVideoInput } from '../utils/video';

/* ==================== HELPERS ==================== */

function toIsoDate(val: unknown, fallback = '2026-11-12T10:00:00Z'): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.trim() !== '') {
    return val;
  }
  return fallback;
}

function clampString(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(val));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function mapCategoryDoc(id: string, data: DocumentData): Category {
  return {
    id,
    name: String(data.name ?? 'Category'),
    slug: String(data.slug ?? id),
    color: String(data.color ?? '#7c5cff'),
    sort_order: Number(data.sort_order ?? 0),
    created_at: toIsoDate(data.createdAt),
  };
}

function mapSectionDoc(id: string, data: DocumentData): HomepageSection {
  return {
    id,
    section_key: String(data.section_key ?? id),
    title: String(data.title ?? ''),
    subtitle: String(data.subtitle ?? ''),
    is_enabled: Number(data.is_enabled ?? 1),
    item_limit: Number(data.item_limit ?? 8),
    sort_order: Number(data.sort_order ?? 0),
  };
}

function mapVideoDoc(
  id: string,
  data: DocumentData,
  categoryMap?: Map<string, Category>,
): Video {
  const categoryId = typeof data.category_id === 'string' && data.category_id ? data.category_id : null;
  const cat = categoryId && categoryMap ? categoryMap.get(categoryId) : undefined;
  return {
    id,
    title: String(data.title ?? 'Untitled Video'),
    description: String(data.description ?? ''),
    category_id: categoryId,
    category_name: cat?.name ?? (typeof data.category_name === 'string' ? data.category_name : null),
    category_slug: cat?.slug ?? (typeof data.category_slug === 'string' ? data.category_slug : null),
    category_color: cat?.color ?? null,
    source_type: data.source_type === 'youtube' ? 'youtube' : 'direct',
    video_url: String(data.video_url ?? ''),
    thumbnail_url: String(data.thumbnail_url ?? ''),
    duration: String(data.duration ?? '00:00'),
    views: Number(data.views ?? 0),
    is_featured: Number(data.is_featured ?? 0),
    is_published: Number(data.is_published ?? 1),
    sort_order: Number(data.sort_order ?? 0),
    created_at: toIsoDate(data.createdAt),
    updated_at: toIsoDate(data.updatedAt),
  };
}

function mapSettingsDoc(data: DocumentData): SiteSettings {
  return {
    site_name: String(data.site_name ?? STARTER_SETTINGS.site_name),
    site_tagline: String(data.site_tagline ?? STARTER_SETTINGS.site_tagline),
    notice: String(data.notice ?? ''),
    footer_text: String(data.footer_text ?? STARTER_SETTINGS.footer_text),
    default_language: data.default_language === 'bn' ? 'bn' : 'en',
  };
}

async function fetchCategoriesMap(): Promise<{ list: Category[]; map: Map<string, Category> }> {
  let snap;
  try {
    snap = await getDocs(collection(db, 'categories'));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'categories');
  }
  const list = snap.docs
    .map((d) => mapCategoryDoc(d.id, d.data()))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const map = new Map(list.map((c) => [c.id, c]));
  return { list, map };
}

async function isCatalogInitializedInFirestore(): Promise<boolean> {
  try {
    const siteDoc = await getDoc(doc(db, 'settings', 'site'));
    return siteDoc.exists();
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'settings/site');
  }
}

/* ==================== PUBLIC API ==================== */

export interface SiteBootstrapResponse {
  ok: true;
  settings: SiteSettings;
  sections: HomepageSection[];
  categories: Category[];
}

export async function fetchSiteData(): Promise<SiteBootstrapResponse> {
  const [siteSnap, sectionsSnap, categoriesSnap, pubVideosSnap] = await Promise.all([
    getDoc(doc(db, 'settings', 'site')).catch((err) =>
      handleFirestoreError(err, OperationType.GET, 'settings/site'),
    ),
    getDocs(collection(db, 'homepage_sections')).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'homepage_sections'),
    ),
    getDocs(collection(db, 'categories')).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'categories'),
    ),
    getDocs(query(collection(db, 'videos'), where('is_published', '==', 1))).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'videos'),
    ),
  ]);

  // Graceful first-boot catalog before admin initializes Firestore for the first time
  if (!siteSnap.exists() && categoriesSnap.empty && pubVideosSnap.empty) {
    return {
      ok: true,
      settings: STARTER_SETTINGS,
      sections: STARTER_SECTIONS,
      categories: STARTER_CATEGORIES,
    };
  }

  const countByCat = new Map<string, number>();
  for (const d of pubVideosSnap.docs) {
    const cid = d.data().category_id;
    if (typeof cid === 'string' && cid) {
      countByCat.set(cid, (countByCat.get(cid) ?? 0) + 1);
    }
  }

  const settings = siteSnap.exists() ? mapSettingsDoc(siteSnap.data()) : STARTER_SETTINGS;
  const sections = (
    sectionsSnap.empty
      ? STARTER_SECTIONS
      : sectionsSnap.docs.map((d) => mapSectionDoc(d.id, d.data()))
  ).sort((a, b) => a.sort_order - b.sort_order);

  const categories = categoriesSnap.docs
    .map((d) => {
      const cat = mapCategoryDoc(d.id, d.data());
      return { ...cat, video_count: countByCat.get(cat.id) ?? 0 };
    })
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  return { ok: true, settings, sections, categories };
}

export async function fetchPublicVideos(
  params: {
    q?: string;
    category?: string;
    sort?: 'latest' | 'popular' | 'featured';
    limit?: number;
    offset?: number;
  },
  signal?: AbortSignal,
): Promise<Video[]> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const initialized = await isCatalogInitializedInFirestore();
  let videos: Video[] = [];

  if (!initialized) {
    videos = [...STARTER_VIDEOS];
  } else {
    let pubSnap;
    let catMap = new Map<string, Category>();
    try {
      const [videosRes, catsRes] = await Promise.all([
        getDocs(query(collection(db, 'videos'), where('is_published', '==', 1))),
        fetchCategoriesMap(),
      ]);
      pubSnap = videosRes;
      catMap = catsRes.map;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'videos');
    }
    videos = pubSnap.docs.map((d) => mapVideoDoc(d.id, d.data(), catMap));
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  let filtered = videos.filter((v) => v.is_published === 1);

  if (params.category && params.category !== 'all') {
    const targetSlug = params.category.toLowerCase();
    filtered = filtered.filter((v) => (v.category_slug ?? '').toLowerCase() === targetSlug);
  }

  if (params.q && params.q.trim() !== '') {
    const qLower = params.q.trim().toLowerCase();
    filtered = filtered.filter(
      (v) =>
        v.title.toLowerCase().includes(qLower) ||
        v.description.toLowerCase().includes(qLower) ||
        (v.category_name ?? '').toLowerCase().includes(qLower),
    );
  }

  if (params.sort === 'popular') {
    filtered.sort((a, b) => b.views - a.views || b.created_at.localeCompare(a.created_at));
  } else if (params.sort === 'featured') {
    filtered.sort(
      (a, b) =>
        b.is_featured - a.is_featured ||
        a.sort_order - b.sort_order ||
        b.views - a.views,
    );
  } else {
    filtered.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.sort_order - b.sort_order);
  }

  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.max(1, params.limit ?? 60);
  return filtered.slice(offset, offset + limit);
}

export async function fetchVideoDetail(
  id: string,
  signal?: AbortSignal,
): Promise<{ video: Video; related: Video[] }> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const initialized = await isCatalogInitializedInFirestore();
  if (!initialized) {
    const found = STARTER_VIDEOS.find((v) => v.id === id);
    if (!found) {
      throw new Error('Video not found.');
    }
    return {
      video: found,
      related: selectRelatedVideos(found, STARTER_VIDEOS, 6),
    };
  }

  let videoSnap;
  try {
    videoSnap = await getDoc(doc(db, 'videos', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `videos/${id}`);
  }

  if (!videoSnap.exists() || videoSnap.data().is_published !== 1) {
    throw new Error('Video not found or unpublished.');
  }

  const { map: catMap } = await fetchCategoriesMap();
  const video = mapVideoDoc(videoSnap.id, videoSnap.data(), catMap);

  let pubSnap;
  try {
    pubSnap = await getDocs(query(collection(db, 'videos'), where('is_published', '==', 1)));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'videos');
  }

  const candidates = pubSnap.docs.map((d) => mapVideoDoc(d.id, d.data(), catMap));
  return {
    video,
    related: selectRelatedVideos(video, candidates, 6),
  };
}

export async function incrementVideoView(id: string): Promise<number | null> {
  const initialized = await isCatalogInitializedInFirestore();
  if (!initialized) return null;

  try {
    const ref = doc(db, 'videos', id);
    await updateDoc(ref, {
      views: increment(1),
      updatedAt: serverTimestamp(),
    });
    const updated = await getDoc(ref);
    return updated.exists() ? Number(updated.data().views ?? 0) : null;
  } catch {
    return null;
  }
}

/* ==================== ADMIN AUTH API ==================== */

async function ensureFirestoreSeeded(): Promise<void> {
  const siteRef = doc(db, 'settings', 'site');
  let siteSnap;
  try {
    siteSnap = await getDoc(siteRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'settings/site');
  }
  if (siteSnap.exists()) return;

  const batch = writeBatch(db);
  batch.set(siteRef, {
    site_name: STARTER_SETTINGS.site_name,
    site_tagline: STARTER_SETTINGS.site_tagline,
    notice: STARTER_SETTINGS.notice,
    footer_text: STARTER_SETTINGS.footer_text,
    default_language: STARTER_SETTINGS.default_language,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const sec of STARTER_SECTIONS) {
    batch.set(doc(db, 'homepage_sections', sec.id), {
      section_key: sec.section_key,
      title: sec.title,
      subtitle: sec.subtitle,
      is_enabled: sec.is_enabled,
      item_limit: sec.item_limit,
      sort_order: sec.sort_order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const cat of STARTER_CATEGORIES) {
    batch.set(doc(db, 'categories', cat.id), {
      name: cat.name,
      slug: cat.slug,
      color: cat.color,
      sort_order: cat.sort_order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const vid of STARTER_VIDEOS) {
    batch.set(doc(db, 'videos', vid.id), {
      title: vid.title,
      description: vid.description,
      category_id: vid.category_id,
      category_name: vid.category_name ?? null,
      category_slug: vid.category_slug ?? null,
      source_type: vid.source_type,
      video_url: vid.video_url,
      thumbnail_url: vid.thumbnail_url,
      duration: vid.duration,
      views: vid.views,
      is_featured: vid.is_featured,
      is_published: vid.is_published,
      sort_order: vid.sort_order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/site');
  }
}

async function resolveVerifiedAdmin(user: User | null): Promise<AdminUser | null> {
  if (!user || !user.email || !user.emailVerified) {
    return null;
  }

  const isBootstrapped = user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
  const adminRef = doc(db, 'admins', user.uid);

  let isWhitelisted = isBootstrapped;
  if (!isWhitelisted) {
    try {
      const snap = await getDoc(adminRef);
      isWhitelisted = snap.exists() && snap.data().role === 'admin';
    } catch {
      isWhitelisted = false;
    }
  } else {
    try {
      const snap = await getDoc(adminRef);
      if (!snap.exists()) {
        await setDoc(adminRef, {
          email: clampString(user.email, 160),
          name: clampString(user.displayName || 'Administrator', 100) || 'Administrator',
          role: 'admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Non-blocking admin record sync
    }
  }

  if (!isWhitelisted) return null;

  await ensureFirestoreSeeded();

  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName || 'Administrator',
  };
}

export function subscribeAdminAuth(
  onChange: (admin: AdminUser | null, ready: boolean) => void,
): () => void {
  return onAuthStateChanged(auth, (user) => {
    resolveVerifiedAdmin(user)
      .then((admin) => onChange(admin, true))
      .catch(() => onChange(null, true));
  });
}

export async function adminLoginWithGoogle(): Promise<AdminUser> {
  const cred = await signInWithPopup(auth, googleProvider);
  const admin = await resolveVerifiedAdmin(cred.user);
  if (!admin) {
    await signOut(auth);
    throw new Error(
      `Access denied for ${cred.user.email || 'this account'}. Only authorized administrator Google accounts can open the admin panel.`,
    );
  }
  return admin;
}

export async function adminLogout(): Promise<void> {
  await signOut(auth);
}

/* ==================== ADMIN MANAGEMENT API ==================== */

export async function fetchAdminDashboard(): Promise<AdminDashboardStats> {
  let videosSnap;
  let categoriesRes;
  try {
    [videosSnap, categoriesRes] = await Promise.all([
      getDocs(collection(db, 'videos')),
      fetchCategoriesMap(),
    ]);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'videos');
  }

  const allVideos = videosSnap.docs.map((d) => mapVideoDoc(d.id, d.data(), categoriesRes.map));
  const published = allVideos.filter((v) => v.is_published === 1);
  const totalViews = allVideos.reduce((acc, v) => acc + v.views, 0);

  const topVideos = [...allVideos]
    .sort((a, b) => b.views - a.views || b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  const recentVideos = [...allVideos]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);

  return {
    totalVideos: allVideos.length,
    publishedVideos: published.length,
    unpublishedVideos: allVideos.length - published.length,
    totalViews,
    totalCategories: categoriesRes.list.length,
    topVideos,
    recentVideos,
  };
}

export async function fetchAdminVideos(params?: {
  q?: string;
  status?: string;
  categoryId?: string;
}): Promise<Video[]> {
  let videosSnap;
  let categoriesRes;
  try {
    [videosSnap, categoriesRes] = await Promise.all([
      getDocs(collection(db, 'videos')),
      fetchCategoriesMap(),
    ]);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'videos');
  }

  let list = videosSnap.docs
    .map((d) => mapVideoDoc(d.id, d.data(), categoriesRes.map))
    .sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at));

  if (params?.status === 'published') {
    list = list.filter((v) => v.is_published === 1);
  } else if (params?.status === 'unpublished') {
    list = list.filter((v) => v.is_published === 0);
  }

  if (params?.categoryId && params.categoryId !== 'all') {
    list = list.filter((v) => v.category_id === params.categoryId);
  }

  if (params?.q && params.q.trim() !== '') {
    const qLower = params.q.trim().toLowerCase();
    list = list.filter(
      (v) =>
        v.title.toLowerCase().includes(qLower) ||
        v.description.toLowerCase().includes(qLower) ||
        (v.category_name ?? '').toLowerCase().includes(qLower),
    );
  }

  return list;
}

export async function uploadThumbnailFile(file: File): Promise<string> {
  return compressThumbnailToDataUrl(file);
}

export interface UpsertVideoPayload {
  title: string;
  description: string;
  category_id: string | null;
  source_type: VideoSourceType;
  video_url: string;
  thumbnail_url: string;
  duration: string;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
}

async function resolveCategoryMeta(
  categoryId: string | null,
): Promise<{ category_id: string | null; category_name: string | null; category_slug: string | null }> {
  if (!categoryId) {
    return { category_id: null, category_name: null, category_slug: null };
  }
  try {
    const snap = await getDoc(doc(db, 'categories', categoryId));
    if (!snap.exists()) {
      throw new Error('Selected category no longer exists.');
    }
    const d = snap.data();
    return {
      category_id: snap.id,
      category_name: clampString(d.name, 60),
      category_slug: clampString(d.slug, 80),
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('no longer exists')) throw err;
    handleFirestoreError(err, OperationType.GET, `categories/${categoryId}`);
  }
}

export async function createAdminVideo(payload: UpsertVideoPayload): Promise<Video> {
  const validation = validateVideoInput({
    title: payload.title,
    description: payload.description,
    category_id: payload.category_id,
    source_type: payload.source_type,
    video_url: payload.video_url,
    thumbnail_url: payload.thumbnail_url,
  });
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const catMeta = await resolveCategoryMeta(payload.category_id);
  const newRef = doc(collection(db, 'videos'));
  const writeData = {
    title: clampString(payload.title, 160),
    description: clampString(payload.description, 2000),
    category_id: catMeta.category_id,
    category_name: catMeta.category_name,
    category_slug: catMeta.category_slug,
    source_type: payload.source_type === 'youtube' ? 'youtube' : 'direct',
    video_url: clampString(payload.video_url, 1000),
    thumbnail_url: clampString(payload.thumbnail_url, 350000),
    duration: clampString(payload.duration || '00:00', 20) || '00:00',
    views: 0,
    is_featured: payload.is_featured ? 1 : 0,
    is_published: payload.is_published ? 1 : 0,
    sort_order: clampInt(payload.sort_order, -1000, 10000, 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(newRef, writeData);
    const createdSnap = await getDoc(newRef);
    return mapVideoDoc(createdSnap.id, createdSnap.data() ?? writeData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `videos/${newRef.id}`);
  }
}

export async function updateAdminVideo(id: string, payload: UpsertVideoPayload): Promise<Video> {
  const validation = validateVideoInput({
    title: payload.title,
    description: payload.description,
    category_id: payload.category_id,
    source_type: payload.source_type,
    video_url: payload.video_url,
    thumbnail_url: payload.thumbnail_url,
  });
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const catMeta = await resolveCategoryMeta(payload.category_id);
  const ref = doc(db, 'videos', id);

  try {
    await updateDoc(ref, {
      title: clampString(payload.title, 160),
      description: clampString(payload.description, 2000),
      category_id: catMeta.category_id,
      category_name: catMeta.category_name,
      category_slug: catMeta.category_slug,
      source_type: payload.source_type === 'youtube' ? 'youtube' : 'direct',
      video_url: clampString(payload.video_url, 1000),
      thumbnail_url: clampString(payload.thumbnail_url, 350000),
      duration: clampString(payload.duration || '00:00', 20) || '00:00',
      is_featured: payload.is_featured ? 1 : 0,
      is_published: payload.is_published ? 1 : 0,
      sort_order: clampInt(payload.sort_order, -1000, 10000, 0),
      updatedAt: serverTimestamp(),
    });
    const updatedSnap = await getDoc(ref);
    return mapVideoDoc(updatedSnap.id, updatedSnap.data() ?? {});
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `videos/${id}`);
  }
}

export async function toggleAdminVideoPublish(id: string, isPublished: boolean): Promise<number> {
  const ref = doc(db, 'videos', id);
  const nextVal = isPublished ? 1 : 0;
  try {
    await updateDoc(ref, {
      is_published: nextVal,
      updatedAt: serverTimestamp(),
    });
    return nextVal;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `videos/${id}`);
  }
}

export async function deleteAdminVideo(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'videos', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `videos/${id}`);
  }
}

export async function fetchAdminCategories(): Promise<Category[]> {
  let categoriesRes;
  let videosSnap;
  try {
    [categoriesRes, videosSnap] = await Promise.all([
      fetchCategoriesMap(),
      getDocs(collection(db, 'videos')),
    ]);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'categories');
  }

  const counts = new Map<string, number>();
  for (const d of videosSnap.docs) {
    const cid = d.data().category_id;
    if (typeof cid === 'string' && cid) {
      counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
  }

  return categoriesRes.list.map((c) => ({
    ...c,
    video_count: counts.get(c.id) ?? 0,
  }));
}

function normalizeColor(raw: string): string {
  const trimmed = raw.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : '#7c5cff';
}

export async function createAdminCategory(payload: {
  name: string;
  color: string;
  sort_order: number;
}): Promise<Category> {
  const name = clampString(payload.name, 60);
  if (name.length < 2) {
    throw new Error('Category name must be between 2 and 60 characters.');
  }
  const slug = slugifyCategory(name).slice(0, 80);
  const newRef = doc(collection(db, 'categories'));
  const writeData = {
    name,
    slug,
    color: normalizeColor(payload.color),
    sort_order: clampInt(payload.sort_order, -1000, 10000, 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(newRef, writeData);
    const snap = await getDoc(newRef);
    return mapCategoryDoc(snap.id, snap.data() ?? writeData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `categories/${newRef.id}`);
  }
}

export async function updateAdminCategory(
  id: string,
  payload: { name: string; color: string; sort_order: number },
): Promise<Category> {
  const name = clampString(payload.name, 60);
  if (name.length < 2) {
    throw new Error('Category name must be between 2 and 60 characters.');
  }
  const slug = slugifyCategory(name).slice(0, 80);
  const ref = doc(db, 'categories', id);

  try {
    await updateDoc(ref, {
      name,
      slug,
      color: normalizeColor(payload.color),
      sort_order: clampInt(payload.sort_order, -1000, 10000, 0),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapCategoryDoc(snap.id, snap.data() ?? {});
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `categories/${id}`);
  }
}

export async function deleteAdminCategory(id: string): Promise<void> {
  try {
    const affectedSnap = await getDocs(
      query(collection(db, 'videos'), where('category_id', '==', id)),
    );
    const batch = writeBatch(db);
    for (const vDoc of affectedSnap.docs) {
      batch.update(vDoc.ref, {
        category_id: null,
        category_name: null,
        category_slug: null,
        updatedAt: serverTimestamp(),
      });
    }
    batch.delete(doc(db, 'categories', id));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `categories/${id}`);
  }
}

export async function fetchAdminSections(): Promise<HomepageSection[]> {
  let snap;
  try {
    snap = await getDocs(collection(db, 'homepage_sections'));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'homepage_sections');
  }
  return snap.docs
    .map((d) => mapSectionDoc(d.id, d.data()))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function updateAdminSections(sections: HomepageSection[]): Promise<HomepageSection[]> {
  const batch = writeBatch(db);
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const ref = doc(db, 'homepage_sections', sec.id);
    batch.update(ref, {
      section_key: clampString(sec.section_key, 40),
      title: clampString(sec.title || 'Section', 80) || 'Section',
      subtitle: clampString(sec.subtitle, 160),
      is_enabled: sec.is_enabled === 1 ? 1 : 0,
      item_limit: clampInt(sec.item_limit, 1, 24, 8),
      sort_order: clampInt(sec.sort_order ?? i + 1, 0, 100, i + 1),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return fetchAdminSections();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'homepage_sections');
  }
}

export async function updateAdminSettings(settings: SiteSettings): Promise<SiteSettings> {
  const siteName = clampString(settings.site_name, 60);
  if (siteName.length < 2) {
    throw new Error('Website name must be at least 2 characters.');
  }

  const ref = doc(db, 'settings', 'site');
  const nextData: SiteSettings = {
    site_name: siteName,
    site_tagline: clampString(settings.site_tagline, 140),
    notice: clampString(settings.notice, 200),
    footer_text: clampString(settings.footer_text, 200),
    default_language: settings.default_language === 'bn' ? 'bn' : 'en',
  };

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        ...nextData,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...nextData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return nextData;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'settings/site');
  }
}
