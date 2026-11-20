import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

let dbInstance: DatabaseSync | null = null;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      color      TEXT NOT NULL DEFAULT '#7c5cff',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS videos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      category_id   INTEGER NULL REFERENCES categories(id) ON DELETE SET NULL,
      source_type   TEXT NOT NULL DEFAULT 'direct' CHECK (source_type IN ('youtube', 'direct')),
      video_url     TEXT NOT NULL,
      thumbnail_url TEXT NOT NULL DEFAULT '',
      duration      TEXT NOT NULL DEFAULT '00:00',
      views         INTEGER NOT NULL DEFAULT 0,
      is_featured   INTEGER NOT NULL DEFAULT 0,
      is_published  INTEGER NOT NULL DEFAULT 1,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS homepage_sections (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      section_key TEXT NOT NULL UNIQUE,
      title       TEXT NOT NULL,
      subtitle    TEXT NOT NULL DEFAULT '',
      is_enabled  INTEGER NOT NULL DEFAULT 1,
      item_limit  INTEGER NOT NULL DEFAULT 8,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      setting_key   TEXT NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_videos_published ON videos (is_published, created_at);
    CREATE INDEX IF NOT EXISTS idx_videos_category ON videos (category_id, is_published);
    CREATE INDEX IF NOT EXISTS idx_videos_views ON videos (views DESC);
  `);

  seedInitialData(db);
  dbInstance = db;
  return db;
}

function seedInitialData(db: DatabaseSync): void {
  const adminCountRow = db.prepare('SELECT COUNT(*) AS count FROM admins').get() as { count: number };
  if (adminCountRow.count === 0) {
    const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    db.prepare('INSERT INTO admins (username, name, password_hash) VALUES (?, ?, ?)').run(
      username,
      'Administrator',
      hashPassword(password),
    );
  }

  const settingCount = db.prepare('SELECT COUNT(*) AS count FROM settings').get() as { count: number };
  if (settingCount.count === 0) {
    const defaultSettings: Array<[string, string]> = [
      ['site_name', 'Viral Video Pro'],
      ['site_tagline', 'Curated HD videos, seamless playback'],
      ['notice', ''],
      ['footer_text', 'Stream curated videos seamlessly on any device.'],
      ['default_language', 'en'],
    ];
    const insertSetting = db.prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)');
    for (const [k, v] of defaultSettings) {
      insertSetting.run(k, v);
    }
  }

  const sectionCount = db.prepare('SELECT COUNT(*) AS count FROM homepage_sections').get() as { count: number };
  if (sectionCount.count === 0) {
    const sections = [
      ['featured', 'Featured Spotlight', 'Editorially highlighted video ready for instant playback', 1, 1, 1],
      ['popular', 'Popular Videos', 'Most watched videos across the platform', 1, 8, 2],
      ['latest', 'Latest Videos', 'Freshly published videos in full resolution', 1, 8, 3],
      ['categories', 'Explore by Category', 'Filter our catalog by topic and style', 1, 6, 4],
    ] as const;
    const insertSection = db.prepare(
      'INSERT INTO homepage_sections (section_key, title, subtitle, is_enabled, item_limit, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const row of sections) {
      insertSection.run(...row);
    }
  }

  const categoryCount = db.prepare('SELECT COUNT(*) AS count FROM categories').get() as { count: number };
  if (categoryCount.count === 0) {
    const categories = [
      ['Urban & Neon', 'urban-neon', '#7c5cff', 1],
      ['Nature & Aerial', 'nature-aerial', '#22d3ee', 2],
      ['Tech & Studio', 'tech-studio', '#3b82f6', 3],
      ['Ocean & Cinema', 'ocean-cinema', '#34d399', 4],
      ['Food & Culture', 'food-culture', '#fbbf24', 5],
    ] as const;
    const insertCategory = db.prepare(
      'INSERT INTO categories (name, slug, color, sort_order) VALUES (?, ?, ?, ?)',
    );
    for (const cat of categories) {
      insertCategory.run(...cat);
    }
  }

  const videoCount = db.prepare('SELECT COUNT(*) AS count FROM videos').get() as { count: number };
  if (videoCount.count === 0) {
    const cats = db.prepare('SELECT id, slug FROM categories').all() as Array<{ id: number; slug: string }>;
    const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));

    const videos = [
      {
        title: 'Midnight Rain Through Neon Metropolis',
        description:
          'A wide-angle nocturnal walk across rain-slicked avenues, glowing transit rails, and vibrant late-night districts captured in crisp motion.',
        category_id: catBySlug.get('urban-neon') ?? null,
        source_type: 'direct',
        video_url: '/media/cyber_city.mp4',
        thumbnail_url: '/src/assets/images/thumb_cyber_city_1795143818765.jpg',
        duration: '00:06',
        views: 18420,
        is_featured: 1,
        is_published: 1,
        sort_order: 1,
        created_at: '2026-11-12 10:00:00',
      },
      {
        title: 'Himalayan Sunrise Ridge — Aerial Drone Flight',
        description:
          'Soaring above snow-covered mountain ridges at first light as golden clouds drift through the high valleys.',
        category_id: catBySlug.get('nature-aerial') ?? null,
        source_type: 'direct',
        video_url: '/media/mountain_drone.mp4',
        thumbnail_url: '/src/assets/images/thumb_mountain_drone_1795143817918.jpg',
        duration: '00:06',
        views: 14280,
        is_featured: 0,
        is_published: 1,
        sort_order: 2,
        created_at: '2026-11-14 14:30:00',
      },
      {
        title: 'Inside the Dark Minimalist Audio & Editing Studio',
        description:
          'Tour a modern creator workstation built around acoustic treatment, dual waveform monitors, and tactile mechanical controls.',
        category_id: catBySlug.get('tech-studio') ?? null,
        source_type: 'direct',
        video_url: '/media/tech_studio.mp4',
        thumbnail_url: '/src/assets/images/thumb_tech_studio_1795143818744.jpg',
        duration: '00:06',
        views: 11340,
        is_featured: 0,
        is_published: 1,
        sort_order: 3,
        created_at: '2026-11-16 09:15:00',
      },
      {
        title: 'Twilight Atlantic Swell in Slow Motion',
        description:
          'High-speed coastal cinematography tracking deep cobalt waves breaking against dark volcanic cliffs at dusk.',
        category_id: catBySlug.get('ocean-cinema') ?? null,
        source_type: 'direct',
        video_url: '/media/ocean_waves.mp4',
        thumbnail_url: '/src/assets/images/thumb_ocean_waves_1795143818295.jpg',
        duration: '00:06',
        views: 9650,
        is_featured: 0,
        is_published: 1,
        sort_order: 4,
        created_at: '2026-11-17 18:45:00',
      },
      {
        title: 'Night Market Wok Masters: Fire & Flavor',
        description:
          'Documentary close-up of open-flame street cooking under hanging bulbs in a bustling midnight food alley.',
        category_id: catBySlug.get('food-culture') ?? null,
        source_type: 'direct',
        video_url: '/media/street_food.mp4',
        thumbnail_url: '/src/assets/images/thumb_street_food_1795143818837.jpg',
        duration: '00:06',
        views: 7890,
        is_featured: 0,
        is_published: 1,
        sort_order: 5,
        created_at: '2026-11-18 20:10:00',
      },
      {
        title: 'Big Buck Bunny 60fps 4K — Open Animation Showcase',
        description:
          'Classic Blender Foundation open-source animated short film streamed via responsive YouTube embed.',
        category_id: catBySlug.get('ocean-cinema') ?? null,
        source_type: 'youtube',
        video_url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        thumbnail_url: '',
        duration: '10:34',
        views: 6410,
        is_featured: 0,
        is_published: 1,
        sort_order: 6,
        created_at: '2026-11-19 12:00:00',
      },
    ];

    const insertVideo = db.prepare(`
      INSERT INTO videos (
        title, description, category_id, source_type, video_url, thumbnail_url,
        duration, views, is_featured, is_published, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const v of videos) {
      insertVideo.run(
        v.title,
        v.description,
        v.category_id,
        v.source_type,
        v.video_url,
        v.thumbnail_url,
        v.duration,
        v.views,
        v.is_featured,
        v.is_published,
        v.sort_order,
        v.created_at,
        v.created_at,
      );
    }
  }
}
