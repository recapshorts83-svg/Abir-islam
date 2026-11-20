import React, { useState } from 'react';
import { Play } from 'lucide-react';
import type { Video } from '../types/video';
import { formatViews, resolveThumbnail } from '../utils/video';
import type { Language } from '../utils/i18n';
import { COPY } from '../utils/i18n';

interface VideoCardProps {
  video: Video;
  lang: Language;
  onNavigate: (path: string) => void;
  compact?: boolean;
}

export function VideoCard({ video, lang, onNavigate, compact = false }: VideoCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const thumb = resolveThumbnail(video);
  const t = COPY[lang];

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onNavigate(`/watch/${video.id}`);
  };

  if (compact) {
    return (
      <a
        href={`/watch/${video.id}`}
        onClick={handleClick}
        className="group flex items-start gap-3 p-2.5 rounded-xl vvp-card-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]"
      >
        <div className="relative w-36 sm:w-40 aspect-video rounded-lg overflow-hidden bg-[#0c1330] shrink-0 border border-white/10">
          {thumb && !imgFailed ? (
            <img
              src={thumb}
              alt={video.title}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#7c5cff]/30 to-[#22d3ee]/20">
              <Play className="w-5 h-5 text-white/80" />
            </div>
          )}
          {video.duration && (
            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[11px] font-medium tabular-nums bg-black/75 text-white">
              {video.duration}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="text-sm font-semibold text-[#eaf0ff] line-clamp-2 leading-snug group-hover:text-[#22d3ee] transition-colors">
            {video.title}
          </h3>
          <p className="mt-1.5 text-xs text-[#98a5c8] truncate">
            <span>{video.category_name || t.uncategorized}</span>
            <span aria-hidden="true"> · </span>
            <span className="tabular-nums">{formatViews(video.views, lang)}</span>
          </p>
        </div>
      </a>
    );
  }

  return (
    <a
      href={`/watch/${video.id}`}
      onClick={handleClick}
      className="group flex flex-col rounded-2xl overflow-hidden vvp-card-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]"
    >
      <div className="relative w-full aspect-video bg-[#0c1330] overflow-hidden border-b border-white/10">
        {thumb && !imgFailed ? (
          <img
            src={thumb}
            alt={video.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#7c5cff]/30 via-[#0c1330] to-[#22d3ee]/20">
            <Play className="w-8 h-8 text-white/80" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-80 pointer-events-none" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
          <span className="w-11 h-11 rounded-full bg-black/70 border border-white/30 flex items-center justify-center backdrop-blur-sm">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </span>
        </div>
        {video.duration && (
          <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md text-xs font-medium tabular-nums bg-black/80 text-white border border-white/15">
            {video.duration}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-[#eaf0ff] line-clamp-2 leading-snug group-hover:text-[#22d3ee] transition-colors">
          {video.title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-[#98a5c8] truncate">
          <span className="truncate">{video.category_name || t.uncategorized}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums shrink-0">{formatViews(video.views, lang)}</span>
        </div>
      </div>
    </a>
  );
}
