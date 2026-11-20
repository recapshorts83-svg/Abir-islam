import React, { useEffect, useState } from 'react';
import { SearchX } from 'lucide-react';
import type { Category, Video } from '../types/video';
import { fetchPublicVideos } from '../api/client';
import type { Language } from '../utils/i18n';
import { COPY } from '../utils/i18n';
import { VideoCard } from '../components/VideoCard';

interface BrowsePageProps {
  mode: 'categories' | 'popular' | 'latest';
  categories: Category[];
  initialCategory?: string;
  searchQuery: string;
  lang: Language;
  onClearSearch: () => void;
  onNavigate: (path: string) => void;
}

export function BrowsePage({
  mode,
  categories,
  initialCategory = 'all',
  searchQuery,
  lang,
  onClearSearch,
  onNavigate,
}: BrowsePageProps) {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [sort, setSort] = useState<'latest' | 'popular'>(mode === 'popular' ? 'popular' : 'latest');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const t = COPY[lang];

  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setSort(mode === 'popular' ? 'popular' : 'latest');
  }, [mode]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);

    fetchPublicVideos(
      {
        q: searchQuery.trim() || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        sort,
        limit: 60,
      },
      controller.signal,
    )
      .then((rows) => {
        if (active) setVideos(rows);
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [searchQuery, selectedCategory, sort, reloadTick]);

  const heading =
    mode === 'popular' ? t.popularVideos : mode === 'latest' ? t.latestVideos : t.browseCategories;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#eaf0ff]">{heading}</h1>
          {searchQuery.trim() !== '' && (
            <p className="text-sm text-[#98a5c8] mt-1">
              {t.resultsFor} &ldquo;{searchQuery}&rdquo;
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center p-1 rounded-xl bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => setSort('latest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                sort === 'latest' ? 'bg-white/15 text-white' : 'text-[#98a5c8] hover:text-white'
              }`}
            >
              {t.latest}
            </button>
            <button
              type="button"
              onClick={() => setSort('popular')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                sort === 'popular' ? 'bg-white/15 text-white' : 'text-[#98a5c8] hover:text-white'
              }`}
            >
              {t.popular}
            </button>
          </div>
          {searchQuery.trim() !== '' && (
            <button
              type="button"
              onClick={onClearSearch}
              className="px-3 py-2 rounded-xl text-xs font-medium vvp-card text-[#eaf0ff] hover:bg-white/10 whitespace-nowrap"
            >
              {t.clear}
            </button>
          )}
        </div>
      </div>

      {/* Category filter strip */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 min-h-[40px] transition-colors ${
            selectedCategory === 'all'
              ? 'vvp-btn-primary'
              : 'vvp-card text-[#98a5c8] hover:text-white'
          }`}
        >
          {t.allCategories}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.slug)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 min-h-[40px] transition-colors ${
              selectedCategory === cat.slug
                ? 'vvp-btn-primary'
                : 'vvp-card text-[#98a5c8] hover:text-white'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="rounded-2xl vvp-card overflow-hidden animate-pulse">
              <div className="aspect-video bg-white/5" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-2xl vvp-card p-10 text-center space-y-4">
          <p className="text-sm text-[#cbd5f1]">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold vvp-btn-primary"
          >
            {t.retryPlayback}
          </button>
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl vvp-card p-10 text-center">
          <SearchX className="w-10 h-10 text-[#98a5c8] mx-auto mb-3" />
          <p className="text-base font-semibold text-[#eaf0ff]">{t.noVideosFound}</p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              onClearSearch();
            }}
            className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold vvp-btn-primary"
          >
            {t.resetFilters}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} lang={lang} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}
