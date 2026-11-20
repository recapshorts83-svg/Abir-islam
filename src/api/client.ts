import type {
  AdminDashboardStats,
  AdminUser,
  Category,
  HomepageSection,
  SiteSettings,
  Video,
  VideoSourceType,
} from '../types/video';

const TOKEN_STORAGE_KEY = 'vvp_admin_token';
const CSRF_STORAGE_KEY = 'vvp_admin_csrf';

function readStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, val: string | null): void {
  try {
    if (val) {
      window.sessionStorage.setItem(key, val);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors in restricted iframes; in-memory cache still works
  }
}

let authTokenCache: string | null = typeof window !== 'undefined' ? readStorage(TOKEN_STORAGE_KEY) : null;
let csrfTokenCache: string | null = typeof window !== 'undefined' ? readStorage(CSRF_STORAGE_KEY) : null;
let onUnauthorizedHandler: (() => void) | null = null;

export function setOnUnauthorized(handler: (() => void) | null): void {
  onUnauthorizedHandler = handler;
}

export function setCsrfToken(token: string | null): void {
  csrfTokenCache = token;
  if (typeof window !== 'undefined') {
    writeStorage(CSRF_STORAGE_KEY, token);
  }
}

export function setAuthTokens(sessionToken: string | null, csrfToken: string | null): void {
  authTokenCache = sessionToken;
  csrfTokenCache = csrfToken;
  if (typeof window !== 'undefined') {
    writeStorage(TOKEN_STORAGE_KEY, sessionToken);
    writeStorage(CSRF_STORAGE_KEY, csrfToken);
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method || 'GET').toUpperCase();

  if (!(init.body instanceof FormData) && !headers.has('Content-Type') && method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }
  if (authTokenCache && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authTokenCache}`);
  }
  if (csrfTokenCache && method !== 'GET' && method !== 'HEAD') {
    headers.set('X-CSRF-Token', csrfTokenCache);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    if (method === 'GET' && !init.signal?.aborted) {
      await new Promise((r) => setTimeout(r, 350));
      if (!init.signal?.aborted) {
        res = await fetch(url, {
          ...init,
          headers,
          credentials: 'include',
        });
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok) {
    if (res.status === 401 && url.startsWith('/api/admin/') && url !== '/api/admin/login') {
      setAuthTokens(null, null);
      onUnauthorizedHandler?.();
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

/* ==================== PUBLIC API ==================== */

export interface SiteBootstrapResponse {
  ok: true;
  settings: SiteSettings;
  sections: HomepageSection[];
  categories: Category[];
}

export async function fetchSiteData(): Promise<SiteBootstrapResponse> {
  return apiFetch<SiteBootstrapResponse>('/api/site');
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
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category && params.category !== 'all') qs.set('category', params.category);
  if (params.sort) qs.set('sort', params.sort);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const data = await apiFetch<{ ok: true; videos: Video[] }>(`/api/videos?${qs.toString()}`, { signal });
  return data.videos;
}

export async function fetchVideoDetail(
  id: number,
  signal?: AbortSignal,
): Promise<{ video: Video; related: Video[] }> {
  const data = await apiFetch<{ ok: true; video: Video; related: Video[] }>(`/api/videos/${id}`, { signal });
  return { video: data.video, related: data.related };
}

export async function incrementVideoView(id: number): Promise<number> {
  const data = await apiFetch<{ ok: true; views: number }>(`/api/videos/${id}/view`, {
    method: 'POST',
  });
  return data.views;
}

/* ==================== ADMIN AUTH API ==================== */

export async function fetchAdminSession(): Promise<{
  authenticated: boolean;
  admin: AdminUser | null;
  csrfToken: string | null;
}> {
  const data = await apiFetch<{
    ok: true;
    authenticated: boolean;
    admin: AdminUser | null;
    csrfToken: string | null;
  }>('/api/admin/session');
  if (!data.authenticated) {
    setAuthTokens(null, null);
  } else {
    setCsrfToken(data.csrfToken);
  }
  return {
    authenticated: data.authenticated,
    admin: data.admin,
    csrfToken: data.csrfToken,
  };
}

export async function adminLogin(username: string, password: string): Promise<AdminUser> {
  const data = await apiFetch<{ ok: true; admin: AdminUser; csrfToken: string; token?: string }>(
    '/api/admin/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
  );
  setAuthTokens(data.token ?? null, data.csrfToken);
  return data.admin;
}

export async function adminLogout(): Promise<void> {
  try {
    await apiFetch<{ ok: true }>('/api/admin/logout', { method: 'POST' });
  } finally {
    setAuthTokens(null, null);
  }
}

/* ==================== ADMIN MANAGEMENT API ==================== */

export async function fetchAdminDashboard(): Promise<AdminDashboardStats> {
  const data = await apiFetch<{ ok: true; stats: AdminDashboardStats }>('/api/admin/dashboard');
  return data.stats;
}

export async function fetchAdminVideos(params?: {
  q?: string;
  status?: string;
  categoryId?: string;
}): Promise<Video[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.status) qs.set('status', params.status);
  if (params?.categoryId) qs.set('categoryId', params.categoryId);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiFetch<{ ok: true; videos: Video[] }>(`/api/admin/videos${query}`);
  return data.videos;
}

export async function uploadThumbnailFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('thumbnail', file);
  const data = await apiFetch<{ ok: true; url: string }>('/api/admin/upload-thumbnail', {
    method: 'POST',
    body: formData,
  });
  return data.url;
}

export interface UpsertVideoPayload {
  title: string;
  description: string;
  category_id: number | null;
  source_type: VideoSourceType;
  video_url: string;
  thumbnail_url: string;
  duration: string;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
}

export async function createAdminVideo(payload: UpsertVideoPayload): Promise<Video> {
  const data = await apiFetch<{ ok: true; video: Video }>('/api/admin/videos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.video;
}

export async function updateAdminVideo(id: number, payload: UpsertVideoPayload): Promise<Video> {
  const data = await apiFetch<{ ok: true; video: Video }>(`/api/admin/videos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return data.video;
}

export async function toggleAdminVideoPublish(id: number, isPublished: boolean): Promise<number> {
  const data = await apiFetch<{ ok: true; is_published: number }>(`/api/admin/videos/${id}/publish`, {
    method: 'PATCH',
    body: JSON.stringify({ is_published: isPublished }),
  });
  return data.is_published;
}

export async function deleteAdminVideo(id: number): Promise<void> {
  await apiFetch<{ ok: true }>(`/api/admin/videos/${id}`, { method: 'DELETE' });
}

export async function fetchAdminCategories(): Promise<Category[]> {
  const data = await apiFetch<{ ok: true; categories: Category[] }>('/api/admin/categories');
  return data.categories;
}

export async function createAdminCategory(payload: {
  name: string;
  color: string;
  sort_order: number;
}): Promise<Category> {
  const data = await apiFetch<{ ok: true; category: Category }>('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.category;
}

export async function updateAdminCategory(
  id: number,
  payload: { name: string; color: string; sort_order: number },
): Promise<Category> {
  const data = await apiFetch<{ ok: true; category: Category }>(`/api/admin/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return data.category;
}

export async function deleteAdminCategory(id: number): Promise<void> {
  await apiFetch<{ ok: true }>(`/api/admin/categories/${id}`, { method: 'DELETE' });
}

export async function fetchAdminSections(): Promise<HomepageSection[]> {
  const data = await apiFetch<{ ok: true; sections: HomepageSection[] }>('/api/admin/sections');
  return data.sections;
}

export async function updateAdminSections(sections: HomepageSection[]): Promise<HomepageSection[]> {
  const data = await apiFetch<{ ok: true; sections: HomepageSection[] }>('/api/admin/sections', {
    method: 'PUT',
    body: JSON.stringify({ sections }),
  });
  return data.sections;
}

export async function updateAdminSettings(settings: SiteSettings): Promise<SiteSettings> {
  const data = await apiFetch<{ ok: true; settings: SiteSettings }>('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  return data.settings;
}

export async function updateAdminPassword(payload: {
  username: string;
  currentPassword: string;
  newPassword: string;
}): Promise<AdminUser> {
  const data = await apiFetch<{ ok: true; admin: AdminUser; csrfToken: string; token?: string }>(
    '/api/admin/password',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
  if (data.token) {
    setAuthTokens(data.token, data.csrfToken);
  } else {
    setCsrfToken(data.csrfToken);
  }
  return data.admin;
}
