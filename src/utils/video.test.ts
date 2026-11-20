import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSourceType,
  extractStreamableId,
  extractYouTubeId,
  formatViews,
  getEmbedUrl,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  isValidSafeUrl,
  resolveThumbnail,
  selectRelatedVideos,
  slugifyCategory,
  validateVideoInput,
} from './video';
import type { Video } from '../types/video';

test('extractYouTubeId handles standard, short, embed, and shorts URLs', () => {
  assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=aqz-KE-bpKQ'), 'aqz-KE-bpKQ');
  assert.equal(extractYouTubeId('https://youtu.be/aqz-KE-bpKQ?t=10'), 'aqz-KE-bpKQ');
  assert.equal(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('/media/cyber_city.mp4'), null);
});

test('getYouTubeEmbedUrl and getYouTubeThumbnailUrl build safe URLs', () => {
  assert.equal(
    getYouTubeEmbedUrl('https://youtu.be/aqz-KE-bpKQ'),
    'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=0&modestbranding=1',
  );
  assert.equal(
    getYouTubeThumbnailUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ'),
    'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
  );
  assert.equal(detectSourceType('https://youtu.be/aqz-KE-bpKQ'), 'youtube');
  assert.equal(detectSourceType('https://cdn.example.com/clip.mp4'), 'direct');
});

test('extractStreamableId and getEmbedUrl resolve Streamable, Vimeo, Dailymotion, and Drive URLs', () => {
  assert.equal(extractStreamableId('https://streamable.com/zp7p4y'), 'zp7p4y');
  assert.equal(extractStreamableId('https://streamable.com/e/abc123'), 'abc123');
  assert.equal(getEmbedUrl('https://streamable.com/zp7p4y'), 'https://streamable.com/o/zp7p4y');
  assert.equal(getEmbedUrl('https://vimeo.com/123456789'), 'https://player.vimeo.com/video/123456789');
  assert.equal(
    getEmbedUrl('https://drive.google.com/file/d/1AbCdEfG/view?usp=sharing'),
    'https://drive.google.com/file/d/1AbCdEfG/preview',
  );
  assert.equal(getEmbedUrl('/media/cyber_city.mp4'), null);
});

test('isValidSafeUrl rejects javascript and protocol-relative XSS vectors', () => {
  assert.equal(isValidSafeUrl('https://example.com/video.mp4'), true);
  assert.equal(isValidSafeUrl('/media/cyber_city.mp4'), true);
  assert.equal(isValidSafeUrl('javascript:alert(1)'), false);
  assert.equal(isValidSafeUrl('//evil.com/x.mp4'), false);
  assert.equal(isValidSafeUrl(''), false);
});

test('validateVideoInput enforces title, URL, and YouTube constraints', () => {
  assert.equal(
    validateVideoInput({
      title: 'Hi',
      video_url: '/media/cyber_city.mp4',
    }).ok,
    false,
  );
  assert.equal(
    validateVideoInput({
      title: 'Valid Direct Video',
      video_url: '/media/cyber_city.mp4',
      source_type: 'direct',
    }).ok,
    true,
  );
  assert.equal(
    validateVideoInput({
      title: 'Invalid YouTube Video',
      video_url: 'https://example.com/not-youtube.mp4',
      source_type: 'youtube',
    }).ok,
    false,
  );
});

test('resolveThumbnail prefers explicit thumbnail and falls back to YouTube thumbnail', () => {
  assert.equal(
    resolveThumbnail({
      thumbnail_url: '/uploads/thumbnails/custom.jpg',
      video_url: 'https://youtu.be/aqz-KE-bpKQ',
      source_type: 'youtube',
    }),
    '/uploads/thumbnails/custom.jpg',
  );
  assert.equal(
    resolveThumbnail({
      thumbnail_url: '',
      video_url: 'https://youtu.be/aqz-KE-bpKQ',
      source_type: 'youtube',
    }),
    'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
  );
});

test('formatViews and slugifyCategory format cleanly', () => {
  assert.equal(formatViews(1, 'en'), '1 view');
  assert.equal(formatViews(12650, 'en'), '12.7K views');
  assert.equal(formatViews(1500, 'bn'), '১.৫K বার দেখা');
  assert.equal(slugifyCategory('Tech & Studio!'), 'tech-studio');
});

test('selectRelatedVideos prioritizes same category, published only, excluding current', () => {
  const base: Video = {
    id: 1,
    title: 'Current',
    description: '',
    category_id: 10,
    source_type: 'direct',
    video_url: '/media/a.mp4',
    thumbnail_url: '',
    duration: '01:00',
    views: 500,
    is_featured: 0,
    is_published: 1,
    sort_order: 1,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
  const candidates: Video[] = [
    base,
    { ...base, id: 2, category_id: 20, views: 5000, is_published: 1 },
    { ...base, id: 3, category_id: 10, views: 100, is_published: 1 },
    { ...base, id: 4, category_id: 10, views: 9999, is_published: 0 },
  ];
  const related = selectRelatedVideos(base, candidates, 6);
  assert.deepEqual(
    related.map((v) => v.id),
    [3, 2],
  );
});
