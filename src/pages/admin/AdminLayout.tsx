import React from 'react';
import {
  ExternalLink,
  Film,
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Settings,
} from 'lucide-react';
import type { AdminUser, SiteSettings } from '../../types/video';

export type AdminTabKey = 'dashboard' | 'videos' | 'categories' | 'sections' | 'settings';

interface AdminLayoutProps {
  settings: SiteSettings;
  admin: AdminUser;
  activeTab: AdminTabKey;
  pageTitle: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export function AdminLayout({
  settings,
  admin,
  activeTab,
  pageTitle,
  onNavigate,
  onLogout,
  children,
}: AdminLayoutProps) {
  const navItems: Array<{ key: AdminTabKey; label: string; href: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'dashboard', label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { key: 'videos', label: 'Videos', href: '/admin/videos', icon: Film },
    { key: 'categories', label: 'Categories', href: '/admin/categories', icon: FolderKanban },
    { key: 'sections', label: 'Homepage Sections', href: '/admin/sections', icon: LayoutTemplate },
    { key: 'settings', label: 'Site Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Sidebar preserving original .admin-side */}
      <aside className="lg:w-60 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#080c18]/85 backdrop-blur-md lg:sticky lg:top-0 lg:h-screen flex flex-col p-3.5 gap-4">
        <a
          href="/admin"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/admin');
          }}
          className="flex items-center gap-2.5 px-2 py-1"
        >
          <span className="w-8 h-8 rounded-[10px] vvp-brand-dot flex items-center justify-center font-bold text-base text-white shrink-0">
            V
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#eaf0ff] truncate">{settings.site_name}</p>
            <p className="text-[11px] text-[#98a5c8]">Admin Panel</p>
          </div>
        </a>

        <nav aria-label="Admin Navigation" className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <a
                key={item.key}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.href);
                }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 border transition-colors ${
                  isActive
                    ? 'bg-gradient-to-r from-[#7c5cff]/25 to-[#22d3ee]/15 border-[#7c5cff]/40 text-white font-semibold'
                    : 'border-transparent text-[#98a5c8] hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="lg:mt-auto flex lg:flex-col gap-1 pt-2 border-t border-white/10">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[#98a5c8] hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span>View Website</span>
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[#f87171] hover:bg-[#f87171]/10 transition-colors whitespace-nowrap text-left"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
          <p className="hidden lg:block px-3 pt-2 text-[11px] text-[#98a5c8] truncate" title={admin.email}>
            Signed in as {admin.email}
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 px-4 sm:px-6 lg:px-8 py-4 bg-[#070b16]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between gap-4">
          <h1 className="text-lg sm:text-xl font-bold text-[#eaf0ff] truncate">{pageTitle}</h1>
          {activeTab !== 'videos' && (
            <button
              type="button"
              onClick={() => onNavigate('/admin/videos?new=1')}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold vvp-btn-primary whitespace-nowrap shrink-0"
            >
              + Add Video
            </button>
          )}
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">{children}</main>
      </div>
    </div>
  );
}
