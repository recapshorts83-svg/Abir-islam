import React, { useEffect, useState } from 'react';
import { Clock, Flame, Grid2X2, Home, Search, Settings, X } from 'lucide-react';
import type { SiteSettings } from '../types/video';
import type { Language } from '../utils/i18n';
import { COPY } from '../utils/i18n';

interface PublicLayoutProps {
  settings: SiteSettings;
  currentPath: string;
  searchQuery: string;
  lang: Language;
  onLangChange: (lang: Language) => void;
  onSearchSubmit: (q: string) => void;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export function PublicLayout({
  settings,
  currentPath,
  searchQuery,
  lang,
  onLangChange,
  onSearchSubmit,
  onNavigate,
  children,
}: PublicLayoutProps) {
  const [draftQuery, setDraftQuery] = useState(searchQuery ?? '');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const t = COPY[lang];

  useEffect(() => {
    setDraftQuery(searchQuery ?? '');
  }, [searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit(draftQuery.trim());
    setMobileSearchOpen(false);
  };

  const navItems = [
    { key: 'home', label: t.home, href: '/', icon: Home },
    { key: 'categories', label: t.categories, href: '/categories', icon: Grid2X2 },
    { key: 'popular', label: t.popular, href: '/popular', icon: Flame },
    { key: 'latest', label: t.latest, href: '/latest', icon: Clock },
  ];

  const isNavActive = (href: string) => {
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-0">
      <header className="sticky top-0 z-30 h-14 md:h-16 bg-[#070b16]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 lg:gap-8">
          {/* Zone 1: Brand wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setDraftQuery('');
              onSearchSubmit('');
              onNavigate('/');
            }}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff] rounded-lg"
          >
            <span className="w-8 h-8 rounded-[11px] vvp-brand-dot flex items-center justify-center font-bold text-base text-white shrink-0">
              V
            </span>
            <span className="text-base sm:text-lg font-bold tracking-tight text-[#eaf0ff] whitespace-nowrap">
              {settings.site_name}
            </span>
          </a>

          {/* Zone 2: Concise single-line desktop nav links */}
          <nav aria-label="Primary" className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => {
              const active = isNavActive(item.href);
              return (
                <a
                  key={item.key}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.href);
                  }}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    active
                      ? 'text-white border-[#22d3ee]'
                      : 'text-[#98a5c8] border-transparent hover:text-white'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/admin');
              }}
              className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent text-[#98a5c8] hover:text-white transition-colors"
            >
              {t.admin}
            </a>
          </nav>

          {/* Zone 3: Search bar (desktop) + mobile search toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <form onSubmit={handleSubmit} className="hidden sm:flex items-center relative">
              <label htmlFor="desktop-video-search" className="sr-only">
                {t.searchPlaceholder}
              </label>
              <input
                id="desktop-video-search"
                type="search"
                value={draftQuery ?? ''}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-52 lg:w-64 h-9 pl-3.5 pr-9 rounded-xl text-sm vvp-input"
              />
              <button
                type="submit"
                aria-label={t.search}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-[#98a5c8] hover:text-white transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>

            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/admin');
              }}
              aria-label={t.adminPanel}
              title={t.adminPanel}
              className="md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl vvp-card text-[#98a5c8] hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label={t.search}
              aria-expanded={mobileSearchOpen}
              className="sm:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl vvp-card text-[#eaf0ff]"
            >
              {mobileSearchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {mobileSearchOpen && (
        <div className="sm:hidden bg-[#0c1330]/95 border-b border-white/10 px-4 py-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <label htmlFor="mobile-video-search" className="sr-only">
              {t.searchPlaceholder}
            </label>
            <input
              id="mobile-video-search"
              type="search"
              value={draftQuery ?? ''}
              onChange={(e) => setDraftQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              autoFocus
              className="flex-1 h-10 px-3.5 rounded-xl text-sm vvp-input"
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-xl text-sm font-semibold vvp-btn-primary whitespace-nowrap shrink-0"
            >
              {t.search}
            </button>
          </form>
        </div>
      )}

      {settings.notice && settings.notice.trim() !== '' && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="px-4 py-2.5 rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/30 text-sm text-[#bdf1ff]">
            {settings.notice}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      <footer className="border-t border-white/10 bg-[#05070f]/70 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-[#98a5c8]">
          <div>
            <p className="font-semibold text-[#eaf0ff]">{settings.site_name}</p>
            <p className="text-xs text-[#98a5c8] mt-0.5">
              {settings.footer_text || settings.site_tagline}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-white/5 border border-white/10">
              <button
                type="button"
                onClick={() => onLangChange('en')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  lang === 'en' ? 'bg-white/15 text-white' : 'text-[#98a5c8] hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onLangChange('bn')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  lang === 'bn' ? 'bg-white/15 text-white' : 'text-[#98a5c8] hover:text-white'
                }`}
              >
                বাংলা
              </button>
            </div>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/admin');
              }}
              className="text-xs font-medium text-[#98a5c8] hover:text-[#22d3ee] transition-colors whitespace-nowrap"
            >
              {t.adminPanel}
            </a>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar (under 15% mobile height cap) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-[#090d1a]/95 backdrop-blur-md border-t border-white/10 grid grid-cols-4"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.href);
          return (
            <a
              key={item.key}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.href);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? 'text-[#22d3ee]' : 'text-[#98a5c8] hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-full px-1">{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
