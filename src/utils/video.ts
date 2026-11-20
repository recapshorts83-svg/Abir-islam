import type { Video, VideoSourceType } from '../types/video';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i,
  );
  return match ? match[1] : null;
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const id = extractYouTubeId(url);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
}

export function extractStreamableId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/streamable\.com\/(?:[eo]\/)?([A-Za-z0-9]+)/i);
  return match ? match[1] : null;
}

export function getEmbedUrl(url: string, sourceType?: VideoSourceType): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const yt = getYouTubeEmbedUrl(trimmed);
  if (yt) return yt;
  if (sourceType === 'youtube') return null;

  const streamableId = extractStreamableId(trimmed);
  if (streamableId) {
    return `https://streamable.com/o/${streamableId}`;
  }

  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  const dmMatch = trimmed.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([A-Za-z0-9]+)/i);
  if (dmMatch) {
    return `https://www.dailymotion.com/embed/video/${dmMatch[1]}`;
  }

  const gdriveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/i);
  if (gdriveMatch) {
    return `https://drive.google.com/file/d/${gdriveMatch[1]}/preview`;
  }

  return null;
}

export function getYouTubeThumbnailUrl(url: string): string | null {
  const id = extractYouTubeId(url);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function detectSourceType(url: string): VideoSourceType {
  return extractYouTubeId(url) ? 'youtube' : 'direct';
}

export function isValidSafeUrl(raw: string, allowRelativePath = true): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (allowRelativePath && trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return !/[<>"'`]/.test(trimmed);
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function resolveThumbnail(video: Pick<Video, 'thumbnail_url' | 'video_url' | 'source_type'>): string {
  if (video.thumbnail_url && video.thumbnail_url.trim() !== '') {
    return video.thumbnail_url.trim();
  }
  if (video.source_type === 'youtube' || extractYouTubeId(video.video_url)) {
    return getYouTubeThumbnailUrl(video.video_url) ?? '';
  }
  return '';
}

export function formatViews(views: number, lang: 'en' | 'bn' = 'en'): string {
  const n = Math.max(0, Math.floor(views || 0));
  let formatted = '';
  if (n >= 1_000_000) {
    formatted = `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  } else if (n >= 1_000) {
    formatted = `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  } else {
    formatted = String(n);
  }
  if (lang === 'bn') {
    return `${toBengaliDigits(formatted)} বার দেখা`;
  }
  return `${formatted} ${n === 1 ? 'view' : 'views'}`;
}

export function formatShortDate(dateStr: string, lang: 'en' | 'bn' = 'en'): string {
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function slugifyCategory(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || `category-${Date.now().toString(36)}`;
}

export interface VideoInputPayload {
  title: string;
  description?: string;
  category_id?: number | null;
  source_type?: VideoSourceType;
  video_url: string;
  thumbnail_url?: string;
  duration?: string;
  is_featured?: boolean | number;
  is_published?: boolean | number;
  sort_order?: number;
}

export function validateVideoInput(input: VideoInputPayload): { ok: true } | { ok: false; error: string } {
  const title = (input.title ?? '').trim();
  const videoUrl = (input.video_url ?? '').trim();
  const thumbUrl = (input.thumbnail_url ?? '').trim();

  if (title.length < 3 || title.length > 160) {
    return { ok: false, error: 'Video title must be between 3 and 160 characters.' };
  }
  if (!isValidSafeUrl(videoUrl, true)) {
    return { ok: false, error: 'Please provide a valid HTTP(S) or local video URL.' };
  }
  const sourceType = input.source_type ?? detectSourceType(videoUrl);
  if (sourceType === 'youtube' && !extractYouTubeId(videoUrl)) {
    return { ok: false, error: 'Please provide a valid YouTube video URL.' };
  }
  if (thumbUrl !== '' && !isValidSafeUrl(thumbUrl, true)) {
    return { ok: false, error: 'Thumbnail URL must be a valid image URL or uploaded path.' };
  }
  return { ok: true };
}

export function selectRelatedVideos(currentVideo: Video, candidates: Video[], limit = 6): Video[] {
  return candidates
    .filter((v) => v.id !== currentVideo.id && v.is_published === 1)
    .sort((a, b) => {
      const aSameCat = a.category_id && a.category_id === currentVideo.category_id ? 1 : 0;
      const bSameCat = b.category_id && b.category_id === currentVideo.category_id ? 1 : 0;
      if (aSameCat !== bSameCat) return bSameCat - aSameCat;
      if (b.views !== a.views) return b.views - a.views;
      return b.id - a.id;
    })
    .slice(0, limit);
}
