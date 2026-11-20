import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import type { Video } from '../types/video';
import { fetchVideoDetail, incrementVideoView } from '../api/client';
import {
  formatShortDate,
  formatViews,
  getEmbedUrl,
  resolveThumbnail,
} from '../utils/video';
import type { Language } from '../utils/i18n';
import { COPY } from '../utils/i18n';
import { VideoCard } from '../components/VideoCard';
import { useToast } from '../components/Toast';

interface WatchPageProps {
  videoId: string;
  lang: Language;
  onNavigate: (path: string) => void;
}

export function WatchPage({ videoId, lang, onNavigate }: WatchPageProps) {
  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [streamFailed, setStreamFailed] = useState(false);
  const countedRef = useRef<string | null>(null);
  const { showToast } = useToast();
  const t = COPY[lang];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setStreamFailed(false);

    fetchVideoDetail(videoId)
      .then(({ video: loadedVideo, related: loadedRelated }) => {
        if (!active) return;
        setVideo(loadedVideo);
        setRelated(loadedRelated);

        if (countedRef.current !== videoId) {
          countedRef.current = videoId;
          incrementVideoView(videoId)
            .then((nextViews) => {
              if (active && typeof nextViews === 'number') {
                setVideo((prev) => (prev ? { ...prev, views: nextViews } : prev));
              }
            })
            .catch(() => {
              // Non-blocking view counter update
            });
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load video.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [videoId]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(t.linkCopied, 'ok');
    } catch {
      showToast(shareUrl, 'info');
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
        <div className="lg:col-span-8 space-y-4">
          <div className="aspect-video rounded-2xl vvp-card" />
          <div className="h-7 bg-white/10 rounded w-2/3" />
          <div className="h-24 rounded-2xl vvp-card" />
        </div>
        <div className="lg:col-span-4 space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-xl vvp-card" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="rounded-2xl vvp-card p-10 text-center max-w-xl mx-auto">
        <p className="text-lg font-bold text-[#eaf0ff]">{error || 'Video not found.'}</p>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold vvp-btn-primary"
        >
          {t.backToVideos}
        </button>
      </div>
    );
  }

  const embedUrl = getEmbedUrl(video.video_url, video.source_type);
  const directStreamUrl = video.playable_url || (embedUrl ? '' : video.video_url);
  const useIframe = Boolean(embedUrl) && (!directStreamUrl || streamFailed);
  const posterThumb = resolveThumbnail(video);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => onNavigate('/')}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#98a5c8] hover:text-white transition-colors min-h-[40px]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t.backToVideos}</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Primary Video Player & Details */}
        <div className="lg:col-span-8 space-y-4">
          <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl">
            {useIframe && embedUrl ? (
              <iframe
                key={embedUrl}
                src={embedUrl}
                title={video.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : !streamFailed && directStreamUrl ? (
              <video
                key={directStreamUrl}
                src={directStreamUrl}
                controls
                playsInline
                preload="metadata"
                poster={posterThumb || undefined}
                onError={() => setStreamFailed(true)}
                className="w-full h-full object-contain bg-black"
              >
                Your browser does not support HTML5 video playback.
              </video>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#090d1a] gap-3">
                <p className="text-sm text-[#cbd5f1] max-w-md">{t.playbackError}</p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStreamFailed(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold vvp-btn-primary"
                  >
                    {t.retryPlayback}
                  </button>
                  <a
                    href={video.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl text-xs font-medium vvp-card text-[#eaf0ff] hover:bg-white/10"
                  >
                    {t.openSource}
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl vvp-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#eaf0ff] leading-snug text-balance">
                  {video.title}
                </h1>
                <p className="text-xs sm:text-sm text-[#98a5c8] flex flex-wrap items-center gap-x-2 gap-y-1">
                  {video.category_slug ? (
                    <a
                      href={`/categories?cat=${encodeURIComponent(video.category_slug)}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(`/categories?cat=${encodeURIComponent(video.category_slug!)}`);
                      }}
                      className="text-[#22d3ee] font-medium hover:underline"
                    >
                      {video.category_name}
                    </a>
                  ) : (
                    <span>{t.uncategorized}</span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{formatViews(video.views, lang)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatShortDate(video.created_at, lang)}</span>
                  {video.duration && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{video.duration}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{video.source_type === 'youtube' ? t.youtubeLabel : t.directLabel}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold vvp-card hover:bg-white/10 text-[#eaf0ff] whitespace-nowrap shrink-0 min-h-[40px]"
              >
                <Share2 className="w-4 h-4" />
                <span>{t.shareLink}</span>
              </button>
            </div>

            {video.description && (
              <div className="pt-4 border-t border-white/10">
                <p className="text-sm text-[#cbd5f1] leading-relaxed whitespace-pre-line">
                  {video.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Related Videos Column */}
        <aside aria-label={t.relatedVideos} className="lg:col-span-4 space-y-3">
          <h2 className="text-base font-bold text-[#eaf0ff] px-1">{t.relatedVideos}</h2>
          {related.length === 0 ? (
            <div className="rounded-2xl vvp-card p-6 text-sm text-[#98a5c8]">
              {t.noVideosFound}
            </div>
          ) : (
            <div className="space-y-3">
              {related.map((item) => (
                <VideoCard
                  key={item.id}
                  video={item}
                  lang={lang}
                  onNavigate={onNavigate}
                  compact
                />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
