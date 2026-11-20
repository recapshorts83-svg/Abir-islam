import React, { useEffect, useState } from 'react';
import { ArrowRight, Play, SearchX } from 'lucide-react';
import type { Category, HomepageSection, SiteSettings, Video } from '../types/video';
import { fetchPublicVideos } from '../api/client';
import { formatShortDate, formatViews, resolveThumbnail, toBengaliDigits } from '../utils/video';
import type { Language } from '../utils/i18n';
import { COPY } from '../utils/i18n';
import { VideoCard } from '../components/VideoCard';

interface HomePageProps {
  settings: SiteSettings;
  sections: HomepageSection[];
  categories: Category[];
  searchQuery: string;
  lang: Language;
  onClearSearch: () => void;
  onNavigate: (path: string) => void;
}

export function HomePage({
  settings,
  sections,
  categories,
  searchQuery,
  lang,
  onClearSearch,
  onNavigate,
}: HomePageProps) {
  const [featuredVideos, setFeaturedVideos] = useState<Video[]>([]);
  const [popularVideos, setPopularVideos] = useState<Video[]>([]);
  const [latestVideos, setLatestVideos] = useState<Video[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const t = COPY[lang];
  const isFiltering = searchQuery.trim() !== '' || selectedCategory !== 'all';

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);

    if (isFiltering) {
      fetchPublicVideos(
        {
          q: searchQuery.trim() || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          sort: 'latest',
          limit: 48,
        },
        controller.signal,
      )
        .then((rows) => {
          if (active) setFilteredVideos(rows);
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
    }

    const popularLimit = sections.find((s) => s.section_key === 'popular')?.item_limit ?? 8;
    const latestLimit = sections.find((s) => s.section_key === 'latest')?.item_limit ?? 8;

    Promise.all([
      fetchPublicVideos({ sort: 'featured', limit: 3 }, controller.signal),
      fetchPublicVideos({ sort: 'popular', limit: popularLimit }, controller.signal),
      fetchPublicVideos({ sort: 'latest', limit: latestLimit }, controller.signal),
    ])
      .then(([feat, pop, lat]) => {
        if (!active) return;
        setFeaturedVideos(feat.length > 0 ? feat : pop.slice(0, 1));
        setPopularVideos(pop);
        setLatestVideos(lat);
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
  }, [isFiltering, searchQuery, selectedCategory, sections, reloadTick]);

  const enabledSections = [...sections]
    .filter((s) => s.is_enabled === 1)
    .sort((a, b) => a.sort_order - b.sort_order);

  const heroVideo = featuredVideos[0] ?? latestVideos[0] ?? null;
  const heroThumb = heroVideo ? resolveThumbnail(heroVideo) : '';

  const renderCategoryBar = () => (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      <button
        type="button"
        onClick={() => setSelectedCategory('all')}
        className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors min-h-[40px] ${
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
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors min-h-[40px] ${
            selectedCategory === cat.slug
              ? 'vvp-btn-primary'
              : 'vvp-card text-[#98a5c8] hover:text-white'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );

  if (isFiltering) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#eaf0ff]">
              {searchQuery ? `${t.resultsFor} "${searchQuery}"` : t.allVideos}
            </h1>
            <p className="text-sm text-[#98a5c8] mt-1">{settings.site_tagline}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              onClearSearch();
            }}
            className="self-start sm:self-auto px-4 py-2 rounded-xl text-sm font-medium vvp-card text-[#eaf0ff] hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            {t.resetFilters}
          </button>
        </div>

        {renderCategoryBar()}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((n) => (
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
        ) : filteredVideos.length === 0 ? (
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
            {filteredVideos.map((video) => (
              <VideoCard key={video.id} video={video} lang={lang} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Category quick filter bar */}
      {categories.length > 0 && (
        <section aria-label="Category filter">
          {renderCategoryBar()}
        </section>
      )}

      {loading ? (
        <div className="space-y-8">
          <div className="rounded-2xl vvp-card h-72 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="rounded-2xl vvp-card aspect-video animate-pulse" />
            ))}
          </div>
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
      ) : (
        enabledSections.map((section) => {
          if (section.section_key === 'featured' && heroVideo) {
            return (
              <section key={section.id} aria-labelledby="featured-heading">
                <div className="rounded-2xl vvp-card overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  <a
                    href={`/watch/${heroVideo.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(`/watch/${heroVideo.id}`);
                    }}
                    className="lg:col-span-7 relative aspect-video lg:aspect-auto lg:min-h-[340px] bg-[#0c1330] group overflow-hidden"
                  >
                    {heroThumb && !heroImgFailed ? (
                      <img
                        src={heroThumb}
                        alt={heroVideo.title}
                        referrerPolicy="no-referrer"
                        onError={() => setHeroImgFailed(true)}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#7c5cff]/35 to-[#22d3ee]/20">
                        <Play className="w-12 h-12 text-white/80" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="w-14 h-14 rounded-full bg-black/65 border border-white/35 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                      </span>
                    </div>
                  </a>

                  <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between gap-6">
                    <div>
                      <p className="text-xs font-semibold tracking-wider uppercase text-[#22d3ee]">
                        {section.title}
                      </p>
                      <h1
                        id="featured-heading"
                        className="mt-2 text-2xl sm:text-3xl font-bold text-[#eaf0ff] leading-tight text-balance"
                      >
                        {heroVideo.title}
                      </h1>
                      <p className="mt-2.5 text-xs text-[#98a5c8]">
                        <span>{heroVideo.category_name || t.uncategorized}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="tabular-nums">{formatViews(heroVideo.views, lang)}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{formatShortDate(heroVideo.created_at, lang)}</span>
                      </p>
                      {heroVideo.description && (
                        <p className="mt-4 text-sm text-[#98a5c8] leading-relaxed line-clamp-4">
                          {heroVideo.description}
                        </p>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => onNavigate(`/watch/${heroVideo.id}`)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold vvp-btn-primary whitespace-nowrap"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>{t.watchNow}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            );
          }

          if (section.section_key === 'popular' && popularVideos.length > 0) {
            return (
              <section key={section.id} aria-labelledby={`sec-${section.id}`} className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 id={`sec-${section.id}`} className="text-lg sm:text-xl font-bold text-[#eaf0ff]">
                      {section.title}
                    </h2>
                    {section.subtitle && (
                      <p className="text-xs sm:text-sm text-[#98a5c8] mt-0.5">{section.subtitle}</p>
                    )}
                  </div>
                  <a
                    href="/popular"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('/popular');
                    }}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#22d3ee] hover:underline whitespace-nowrap shrink-0"
                  >
                    <span>{t.popular}</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {popularVideos.slice(0, section.item_limit).map((video) => (
                    <VideoCard key={video.id} video={video} lang={lang} onNavigate={onNavigate} />
                  ))}
                </div>
              </section>
            );
          }

          if (section.section_key === 'latest' && latestVideos.length > 0) {
            return (
              <section key={section.id} aria-labelledby={`sec-${section.id}`} className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 id={`sec-${section.id}`} className="text-lg sm:text-xl font-bold text-[#eaf0ff]">
                      {section.title}
                    </h2>
                    {section.subtitle && (
                      <p className="text-xs sm:text-sm text-[#98a5c8] mt-0.5">{section.subtitle}</p>
                    )}
                  </div>
                  <a
                    href="/latest"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('/latest');
                    }}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#22d3ee] hover:underline whitespace-nowrap shrink-0"
                  >
                    <span>{t.latest}</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {latestVideos.slice(0, section.item_limit).map((video) => (
                    <VideoCard key={video.id} video={video} lang={lang} onNavigate={onNavigate} />
                  ))}
                </div>
              </section>
            );
          }

          if (section.section_key === 'categories' && categories.length > 0) {
            return (
              <section key={section.id} aria-labelledby={`sec-${section.id}`} className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 id={`sec-${section.id}`} className="text-lg sm:text-xl font-bold text-[#eaf0ff]">
                      {section.title}
                    </h2>
                    {section.subtitle && (
                      <p className="text-xs sm:text-sm text-[#98a5c8] mt-0.5">{section.subtitle}</p>
                    )}
                  </div>
                  <a
                    href="/categories"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('/categories');
                    }}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#22d3ee] hover:underline whitespace-nowrap shrink-0"
                  >
                    <span>{t.categories}</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  {categories.slice(0, section.item_limit).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => onNavigate(`/categories?cat=${encodeURIComponent(cat.slug)}`)}
                      className="text-left p-4 rounded-2xl vvp-card-interactive flex flex-col justify-between gap-2 min-h-[84px]"
                    >
                      <span className="text-sm font-semibold text-[#eaf0ff] line-clamp-1">{cat.name}</span>
                      <span className="text-xs text-[#98a5c8] tabular-nums">
                        {lang === 'bn'
                          ? `${toBengaliDigits(cat.video_count ?? 0)}টি ভিডিও`
                          : `${cat.video_count ?? 0} ${(cat.video_count ?? 0) === 1 ? 'video' : 'videos'}`}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          }

          return null;
        })
      )}
    </div>
  );
}
