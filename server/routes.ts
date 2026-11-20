import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import type { Request, Response } from 'express';
import { getDb, hashPassword, verifyPassword } from './db.ts';
import {
  checkLoginRateLimit,
  clearAdminSessionCookie,
  clearFailedLogins,
  computeCsrfToken,
  createSessionToken,
  getAuthenticatedAdmin,
  recordFailedLogin,
  requireAdmin,
  setAdminSessionCookie,
} from './auth.ts';
import {
  detectSourceType,
  extractStreamableId,
  isValidSafeUrl,
  selectRelatedVideos,
  slugifyCategory,
  validateVideoInput,
} from '../src/utils/video.ts';
import type { AdminUser, Category, HomepageSection, SiteSettings, Video } from '../src/types/video.ts';

const THUMB_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'thumbnails');

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(THUMB_UPLOAD_DIR)) {
      fs.mkdirSync(THUMB_UPLOAD_DIR, { recursive: true });
    }
    cb(null, THUMB_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype.toLowerCase()] ?? '.jpg';
    cb(null, `thumb-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!MIME_TO_EXT[file.mimetype.toLowerCase()]) {
      cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
      return;
    }
    cb(null, true);
  },
});

function readSettingsMap(): SiteSettings {
  const db = getDb();
  const rows = db.prepare('SELECT setting_key, setting_value FROM settings').all() as Array<{
    setting_key: string;
    setting_value: string;
  }>;
  const map = new Map(rows.map((r) => [r.setting_key, r.setting_value]));
  return {
    site_name: map.get('site_name') || 'Viral Video Pro',
    site_tagline: map.get('site_tagline') || 'Curated HD videos, seamless playback',
    notice: map.get('notice') || '',
    footer_text: map.get('footer_text') || '',
    default_language: map.get('default_language') === 'bn' ? 'bn' : 'en',
  };
}

const streamCache = new Map<string, { url: string; expiresAt: number }>();

async function resolvePlayableVideoUrl(videoUrl: string): Promise<string | undefined> {
  const streamableId = extractStreamableId(videoUrl);
  if (!streamableId) return undefined;

  const cached = streamCache.get(streamableId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const resp = await fetch(`https://api.streamable.com/videos/${encodeURIComponent(streamableId)}`, {
      signal: controller.signal,
    });
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as {
      files?: {
        mp4?: { url?: string };
        'mp4-mobile'?: { url?: string };
      };
    };
    const rawMp4 = data.files?.mp4?.url || data.files?.['mp4-mobile']?.url;
    if (!rawMp4) return undefined;
    const normalized = rawMp4.startsWith('//') ? `https:${rawMp4}` : rawMp4;
    if (!normalized.startsWith('https://') && !normalized.startsWith('http://')) return undefined;
    streamCache.set(streamableId, { url: normalized, expiresAt: Date.now() + 10 * 60 * 1000 });
    return normalized;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export function createApiRouter(): express.Router {
  const router = express.Router();

  /* ==================== PUBLIC SITE & VIDEO ROUTES ==================== */

  router.get('/site', (_req: Request, res: Response) => {
    const db = getDb();
    const settings = readSettingsMap();
    const sections = db
      .prepare('SELECT * FROM homepage_sections ORDER BY sort_order ASC, id ASC')
      .all() as unknown as HomepageSection[];

    const categories = db
      .prepare(`
        SELECT c.*, COUNT(CASE WHEN v.is_published = 1 THEN 1 END) AS video_count
        FROM categories c
        LEFT JOIN videos v ON v.category_id = c.id
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
      `)
      .all() as unknown as Category[];

    res.json({ ok: true, settings, sections, categories });
  });

  router.get('/videos', (req: Request, res: Response) => {
    const db = getDb();
    const q = String(req.query.q ?? '').trim();
    const category = String(req.query.category ?? '').trim();
    const sort = String(req.query.sort ?? 'latest').trim();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 48) || 48));
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);

    const where: string[] = ['v.is_published = 1'];
    const params: Array<string | number> = [];

    if (q !== '') {
      where.push('(v.title LIKE ? OR v.description LIKE ? OR COALESCE(c.name, \'\') LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    if (category !== '' && category !== 'all') {
      if (/^\d+$/.test(category)) {
        where.push('v.category_id = ?');
        params.push(Number(category));
      } else {
        where.push('c.slug = ?');
        params.push(category);
      }
    }

    if (sort === 'featured') {
      where.push('v.is_featured = 1');
    }

    let orderBy = 'v.created_at DESC, v.id DESC';
    if (sort === 'popular') {
      orderBy = 'v.views DESC, v.id DESC';
    } else if (sort === 'featured') {
      orderBy = 'v.sort_order ASC, v.created_at DESC, v.id DESC';
    }

    const sql = `
      SELECT v.*, c.name AS category_name, c.slug AS category_slug, c.color AS category_color
      FROM videos v
      LEFT JOIN categories c ON c.id = v.category_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params, limit, offset) as unknown as Video[];
    res.json({ ok: true, videos: rows });
  });

  router.get('/videos/:id', async (req: Request, res: Response) => {
    const db = getDb();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid video ID.' });
      return;
    }

    const video = db
      .prepare(`
        SELECT v.*, c.name AS category_name, c.slug AS category_slug, c.color AS category_color
        FROM videos v
        LEFT JOIN categories c ON c.id = v.category_id
        WHERE v.id = ? AND v.is_published = 1
        LIMIT 1
      `)
      .get(id) as unknown as Video | undefined;

    if (!video) {
      res.status(404).json({ ok: false, error: 'Video not found.' });
      return;
    }

    const playableUrl = await resolvePlayableVideoUrl(video.video_url);
    const enrichedVideo: Video = playableUrl ? { ...video, playable_url: playableUrl } : video;

    const allPublished = db
      .prepare(`
        SELECT v.*, c.name AS category_name, c.slug AS category_slug, c.color AS category_color
        FROM videos v
        LEFT JOIN categories c ON c.id = v.category_id
        WHERE v.is_published = 1 AND v.id <> ?
        ORDER BY v.views DESC, v.id DESC
        LIMIT 30
      `)
      .all(id) as unknown as Video[];

    const related = selectRelatedVideos(enrichedVideo, allPublished, 6);
    res.json({ ok: true, video: enrichedVideo, related });
  });

  router.post('/videos/:id/view', (req: Request, res: Response) => {
    const db = getDb();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid video ID.' });
      return;
    }

    const result = db
      .prepare('UPDATE videos SET views = views + 1 WHERE id = ? AND is_published = 1')
      .run(id);
    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Video not found.' });
      return;
    }

    const updated = db.prepare('SELECT views FROM videos WHERE id = ?').get(id) as { views: number } | undefined;
    res.json({ ok: true, views: updated?.views ?? 0 });
  });

  /* ==================== ADMIN AUTH ROUTES ==================== */

  router.get('/admin/session', (req: Request, res: Response) => {
    const auth = getAuthenticatedAdmin(req);
    if (!auth) {
      res.json({ ok: true, authenticated: false, admin: null, csrfToken: null });
      return;
    }
    res.json({ ok: true, authenticated: true, admin: auth.admin, csrfToken: auth.csrfToken });
  });

  router.post('/admin/login', (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const rate = checkLoginRateLimit(ip);
    if (!rate.allowed) {
      res.status(429).json({
        ok: false,
        error: `Too many failed login attempts. Try again in ${rate.retryMinutes} minute(s).`,
      });
      return;
    }

    const username = String(req.body?.username ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!username || !password) {
      res.status(400).json({ ok: false, error: 'Username and password are required.' });
      return;
    }

    const db = getDb();
    const adminRow = db
      .prepare('SELECT id, username, name, password_hash FROM admins WHERE username = ? LIMIT 1')
      .get(username) as { id: number; username: string; name: string; password_hash: string } | undefined;

    if (!adminRow || !verifyPassword(password, adminRow.password_hash)) {
      recordFailedLogin(ip);
      res.status(401).json({ ok: false, error: 'Invalid administrator credentials.' });
      return;
    }

    clearFailedLogins(ip);
    const admin: AdminUser = { id: adminRow.id, username: adminRow.username, name: adminRow.name };
    const token = createSessionToken(admin);
    const csrfToken = computeCsrfToken(token);
    setAdminSessionCookie(res, req, token);

    res.json({ ok: true, admin, csrfToken, token });
  });

  router.post('/admin/logout', (req: Request, res: Response) => {
    clearAdminSessionCookie(res, req);
    res.json({ ok: true });
  });

  /* ==================== PROTECTED ADMIN ROUTES ==================== */

  router.use('/admin', requireAdmin);

  router.get('/admin/dashboard', (_req: Request, res: Response) => {
    const db = getDb();
    const counts = db
      .prepare(`
        SELECT
          COUNT(*) AS totalVideos,
          COALESCE(SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END), 0) AS publishedVideos,
          COALESCE(SUM(CASE WHEN is_published = 0 THEN 1 ELSE 0 END), 0) AS unpublishedVideos,
          COALESCE(SUM(views), 0) AS totalViews
        FROM videos
      `)
      .get() as {
      totalVideos: number;
      publishedVideos: number;
      unpublishedVideos: number;
      totalViews: number;
    };

    const catCount = db.prepare('SELECT COUNT(*) AS count FROM categories').get() as { count: number };

    const topVideos = db
      .prepare(`
        SELECT v.*, c.name AS category_name, c.slug AS category_slug, c.color AS category_color
        FROM videos v
        LEFT JOIN categories c ON c.id = v.category_id
        ORDER BY v.views DESC, v.id DESC
        LIMIT 5
      `)
      .all() as unknown as Video[];

    const recentVideos = db
      .prepare(`
        SELECT v.*, c.name AS category_name, c.slug AS category_slug, c.color AS category_color
        FROM videos v
        LEFT JOIN categories c ON c.id = v.category_id
        ORDER BY v.id DESC
        LIMIT 6
      `)
      .all() as unknown as Video[];

    res.json({
      ok: true,
      stats: {
        ...counts,
        totalCategories: catCount.count,
        topVideos,
        recentVideos,
      },
    });
  });

  router.get('/admin/videos', (req: Request, res: Response) => {
    const db = getDb();
    const q = String(req.query.q ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const categoryId = String(req.query.categoryId ?? '').trim();

    const where: string[] = [];
    const params: Array<string | number> = [];

    if (q !== '') {
      where.push('(v.title LIKE ? OR v.description LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like);
    }
    if (status === 'published') {
      where.push('v.is_published = 1');
    } else if (status === 'unpublished') {
      where.push('v.is_published = 0');
    }
    if (/^\d+$/.test(categoryId)) {
      where.push('v.category_id = ?');
      params.push(Number(categoryId));
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const videos = db
      .prepare(`
        SELECT v.*, c.name AS category_name, c.slug AS category_slug, c.color AS category_color
        FROM videos v
        LEFT JOIN categories c ON c.id = v.category_id
        ${whereSql}
        ORDER BY v.sort_order ASC, v.id DESC
      `)
      .all(...params) as unknown as Video[];

    res.json({ ok: true, videos });
  });

  router.post('/admin/upload-thumbnail', (req: Request, res: Response) => {
    upload.single('thumbnail')(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Thumbnail upload failed.';
        res.status(400).json({ ok: false, error: message });
        return;
      }
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        res.status(400).json({ ok: false, error: 'Please select an image file to upload.' });
        return;
      }
      res.json({ ok: true, url: `/uploads/thumbnails/${file.filename}` });
    });
  });

  router.post('/admin/videos', (req: Request, res: Response) => {
    const db = getDb();
    const body = req.body ?? {};
    const title = String(body.title ?? '').trim();
    const description = String(body.description ?? '').trim();
    const videoUrl = String(body.video_url ?? '').trim();
    const thumbnailUrl = String(body.thumbnail_url ?? '').trim();
    const duration = String(body.duration ?? '00:00').trim().slice(0, 16) || '00:00';
    const sourceType = body.source_type === 'youtube' || body.source_type === 'direct'
      ? body.source_type
      : detectSourceType(videoUrl);
    const categoryId = body.category_id ? Number(body.category_id) : null;
    const isFeatured = body.is_featured ? 1 : 0;
    const isPublished = body.is_published === false || body.is_published === 0 ? 0 : 1;
    const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;

    const validation = validateVideoInput({
      title,
      description,
      category_id: categoryId,
      source_type: sourceType,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
    });
    if (!validation.ok) {
      res.status(400).json({ ok: false, error: validation.error });
      return;
    }

    if (categoryId !== null) {
      const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
      if (!cat) {
        res.status(400).json({ ok: false, error: 'Selected category does not exist.' });
        return;
      }
    }

    const result = db
      .prepare(`
        INSERT INTO videos (
          title, description, category_id, source_type, video_url, thumbnail_url,
          duration, is_featured, is_published, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `)
      .run(
        title,
        description,
        categoryId,
        sourceType,
        videoUrl,
        thumbnailUrl,
        duration,
        isFeatured,
        isPublished,
        sortOrder,
      );

    const created = db
      .prepare(`
        SELECT v.*, c.name AS category_name, c.slug AS category_slug, c.color AS category_color
        FROM videos v LEFT JOIN categories c ON c.id = v.category_id
        WHERE v.id = ?
      `)
      .get(Number(result.lastInsertRowid)) as unknown as Video;

    res.status(201).json({ ok: true, video: created });
  });

  router.put('/admin/videos/:id', (req: Request, res: Response) => {
    const db = getDb();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid video ID.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM videos WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ ok: false, error: 'Video not found.' });
      return;
    }

    const body = req.body ?? {};
    const title = String(body.title ?? '').trim();
    const description = String(body.description ?? '').trim();
    const videoUrl = String(body.video_url ?? '').trim();
    const thumbnailUrl = String(body.thumbnail_url ?? '').trim();
    const duration = String(body.duration ?? '00:00').trim().slice(0, 16) || '00:00';
    const sourceType = body.source_type === 'youtube' || body.source_type === 'direct'
      ? body.source_type
      : detectSourceType(videoUrl);
    const categoryId = body.category_id ? Number(body.category_id) : null;
    const isFeatured = body.is_featured ? 1 : 0;
    const isPublished = body.is_published === false || body.is_published === 0 ? 0 : 1;
    const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;

    const validation = validateVideoInput({
      title,
      description,
      category_id: categoryId,
      source_type: sourceType,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
    });
    if (!validation.ok) {
      res.status(400).json({ ok: false, error: validation.error });
      return;
    }

    if (categoryId !== null) {
      const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
      if (!cat) {
        res.status(400).json({ ok: false, error: 'Selected category does not exist.' });
        return;
      }
    }

    db.prepare(`
      UPDATE videos
      SET title = ?, description = ?, category_id = ?, source_type = ?, video_url = ?,
          thumbnail_url = ?, duration = ?, is_featured = ?, is_published = ?, sort_order = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title,
      description,
      categoryId,
      sourceType,
      videoUrl,
      thumbnailUrl,
      duration,
      isFeatured,
      isPublished,
      sortOrder,
      id,
    );

    const updated = db
      .prepare(`
        SELECT v.*, c.name AS category_name, c.slug AS category_slug, c.color AS category_color
        FROM videos v LEFT JOIN categories c ON c.id = v.category_id
        WHERE v.id = ?
      `)
      .get(id) as unknown as Video;

    res.json({ ok: true, video: updated });
  });

  router.patch('/admin/videos/:id/publish', (req: Request, res: Response) => {
    const db = getDb();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid video ID.' });
      return;
    }

    const row = db.prepare('SELECT id, is_published FROM videos WHERE id = ?').get(id) as
      | { id: number; is_published: number }
      | undefined;
    if (!row) {
      res.status(404).json({ ok: false, error: 'Video not found.' });
      return;
    }

    const nextPublished =
      typeof req.body?.is_published === 'boolean' || typeof req.body?.is_published === 'number'
        ? req.body.is_published
          ? 1
          : 0
        : row.is_published === 1
          ? 0
          : 1;

    db.prepare('UPDATE videos SET is_published = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      nextPublished,
      id,
    );
    res.json({ ok: true, is_published: nextPublished });
  });

  router.delete('/admin/videos/:id', (req: Request, res: Response) => {
    const db = getDb();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid video ID.' });
      return;
    }

    const result = db.prepare('DELETE FROM videos WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Video not found.' });
      return;
    }
    res.json({ ok: true });
  });

  /* -------------------- CATEGORIES -------------------- */

  router.get('/admin/categories', (_req: Request, res: Response) => {
    const db = getDb();
    const categories = db
      .prepare(`
        SELECT c.*, COUNT(v.id) AS video_count
        FROM categories c
        LEFT JOIN videos v ON v.category_id = c.id
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
      `)
      .all() as unknown as Category[];
    res.json({ ok: true, categories });
  });

  router.post('/admin/categories', (req: Request, res: Response) => {
    const db = getDb();
    const name = String(req.body?.name ?? '').trim();
    const color = /^#[0-9a-fA-F]{6}$/.test(String(req.body?.color ?? ''))
      ? String(req.body.color)
      : '#7c5cff';
    const sortOrder = Number.isFinite(Number(req.body?.sort_order)) ? Number(req.body.sort_order) : 0;

    if (name.length < 2 || name.length > 60) {
      res.status(400).json({ ok: false, error: 'Category name must be between 2 and 60 characters.' });
      return;
    }

    let slug = slugifyCategory(String(req.body?.slug ?? '') || name);
    const dup = db.prepare('SELECT COUNT(*) AS count FROM categories WHERE slug = ?').get(slug) as {
      count: number;
    };
    if (dup.count > 0) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const result = db
      .prepare('INSERT INTO categories (name, slug, color, sort_order) VALUES (?, ?, ?, ?)')
      .run(name, slug, color, sortOrder);

    const created = db
      .prepare('SELECT *, 0 AS video_count FROM categories WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as unknown as Category;

    res.status(201).json({ ok: true, category: created });
  });

  router.put('/admin/categories/:id', (req: Request, res: Response) => {
    const db = getDb();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid category ID.' });
      return;
    }

    const name = String(req.body?.name ?? '').trim();
    const color = /^#[0-9a-fA-F]{6}$/.test(String(req.body?.color ?? ''))
      ? String(req.body.color)
      : '#7c5cff';
    const sortOrder = Number.isFinite(Number(req.body?.sort_order)) ? Number(req.body.sort_order) : 0;

    if (name.length < 2 || name.length > 60) {
      res.status(400).json({ ok: false, error: 'Category name must be between 2 and 60 characters.' });
      return;
    }

    const result = db
      .prepare('UPDATE categories SET name = ?, color = ?, sort_order = ? WHERE id = ?')
      .run(name, color, sortOrder, id);
    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Category not found.' });
      return;
    }

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as unknown as Category;
    res.json({ ok: true, category: updated });
  });

  router.delete('/admin/categories/:id', (req: Request, res: Response) => {
    const db = getDb();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid category ID.' });
      return;
    }

    db.prepare('UPDATE videos SET category_id = NULL WHERE category_id = ?').run(id);
    const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Category not found.' });
      return;
    }

    res.json({ ok: true });
  });

  /* -------------------- HOMEPAGE SECTIONS -------------------- */

  router.get('/admin/sections', (_req: Request, res: Response) => {
    const db = getDb();
    const sections = db
      .prepare('SELECT * FROM homepage_sections ORDER BY sort_order ASC, id ASC')
      .all() as unknown as HomepageSection[];
    res.json({ ok: true, sections });
  });

  router.put('/admin/sections', (req: Request, res: Response) => {
    const db = getDb();
    const incoming = Array.isArray(req.body?.sections) ? req.body.sections : null;
    if (!incoming) {
      res.status(400).json({ ok: false, error: 'Sections array is required.' });
      return;
    }

    const stmt = db.prepare(`
      UPDATE homepage_sections
      SET title = ?, subtitle = ?, is_enabled = ?, item_limit = ?, sort_order = ?
      WHERE id = ?
    `);

    for (let i = 0; i < incoming.length; i += 1) {
      const item = incoming[i];
      const id = Number(item?.id);
      if (!Number.isInteger(id) || id <= 0) continue;
      const title = String(item?.title ?? '').trim().slice(0, 80) || 'Section';
      const subtitle = String(item?.subtitle ?? '').trim().slice(0, 140);
      const isEnabled = item?.is_enabled ? 1 : 0;
      const itemLimit = Math.min(24, Math.max(1, Number(item?.item_limit) || 8));
      const sortOrder = Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : i + 1;
      stmt.run(title, subtitle, isEnabled, itemLimit, sortOrder, id);
    }

    const updated = db
      .prepare('SELECT * FROM homepage_sections ORDER BY sort_order ASC, id ASC')
      .all() as unknown as HomepageSection[];
    res.json({ ok: true, sections: updated });
  });

  /* -------------------- SETTINGS & PASSWORD -------------------- */

  router.get('/admin/settings', (_req: Request, res: Response) => {
    res.json({ ok: true, settings: readSettingsMap() });
  });

  router.put('/admin/settings', (req: Request, res: Response) => {
    const db = getDb();
    const body = req.body ?? {};
    const siteName = String(body.site_name ?? '').trim().slice(0, 60);
    if (siteName.length < 2) {
      res.status(400).json({ ok: false, error: 'Website name must be at least 2 characters.' });
      return;
    }

    const updates: Array<[string, string]> = [
      ['site_name', siteName],
      ['site_tagline', String(body.site_tagline ?? '').trim().slice(0, 140)],
      ['notice', String(body.notice ?? '').trim().slice(0, 200)],
      ['footer_text', String(body.footer_text ?? '').trim().slice(0, 200)],
      ['default_language', body.default_language === 'bn' ? 'bn' : 'en'],
    ];

    const upsert = db.prepare(`
      INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
    `);

    for (const [k, v] of updates) {
      upsert.run(k, v);
    }

    res.json({ ok: true, settings: readSettingsMap() });
  });

  router.put('/admin/password', (req: Request, res: Response) => {
    const admin = (req as Request & { admin?: AdminUser }).admin;
    if (!admin) {
      res.status(401).json({ ok: false, error: 'Unauthorized.' });
      return;
    }

    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');
    const newUsername = String(req.body?.username ?? admin.username).trim().toLowerCase();

    if (newPassword.length < 6) {
      res.status(400).json({ ok: false, error: 'New password must be at least 6 characters.' });
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(newUsername)) {
      res.status(400).json({ ok: false, error: 'Username must be 3-30 lowercase alphanumeric characters.' });
      return;
    }

    const db = getDb();
    const row = db
      .prepare('SELECT id, password_hash FROM admins WHERE id = ?')
      .get(admin.id) as { id: number; password_hash: string } | undefined;

    if (!row || !verifyPassword(currentPassword, row.password_hash)) {
      res.status(400).json({ ok: false, error: 'Current password is incorrect.' });
      return;
    }

    const nextHash = hashPassword(newPassword);
    db.prepare('UPDATE admins SET username = ?, password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      newUsername,
      nextHash,
      admin.id,
    );

    const updatedAdmin: AdminUser = { ...admin, username: newUsername };
    const nextToken = createSessionToken(updatedAdmin);
    setAdminSessionCookie(res, req, nextToken);

    res.json({ ok: true, admin: updatedAdmin, csrfToken: computeCsrfToken(nextToken), token: nextToken });
  });

  // Unused helper sanity reference to ensure URL validation keeps exported usage consistent
  void isValidSafeUrl;

  return router;
}
