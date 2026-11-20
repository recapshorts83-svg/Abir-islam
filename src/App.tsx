import React, { useCallback, useEffect, useState } from 'react';
import type { AdminUser, Category, HomepageSection, SiteSettings } from './types/video';
import { adminLogout, fetchSiteData, subscribeAdminAuth } from './api/client';
import type { Language } from './utils/i18n';
import { ToastProvider, useToast } from './components/Toast';
import { PublicLayout } from './components/PublicLayout';
import { HomePage } from './pages/HomePage';
import { BrowsePage } from './pages/BrowsePage';
import { WatchPage } from './pages/WatchPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminLayout, type AdminTabKey } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminVideos } from './pages/admin/AdminVideos';
import { AdminCategories } from './pages/admin/AdminCategories';
import { AdminSections } from './pages/admin/AdminSections';
import { AdminSettings } from './pages/admin/AdminSettings';

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: 'Viral Video Pro',
  site_tagline: 'Curated HD videos, seamless playback',
  notice: '',
  footer_text: 'Stream curated videos seamlessly on any device.',
  default_language: 'en',
};

function AppShell() {
  const [route, setRoute] = useState(() => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
  }));
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lang, setLang] = useState<Language>('en');
  const [searchQuery, setSearchQuery] = useState('');
  const initialLangAppliedRef = React.useRef(false);

  const [adminChecked, setAdminChecked] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const unsubscribe = subscribeAdminAuth((admin, ready) => {
      setAdminUser(admin);
      if (ready) setAdminChecked(true);
    });
    return () => unsubscribe();
  }, []);

  const loadSite = useCallback(async () => {
    try {
      const data = await fetchSiteData();
      setSettings(data.settings);
      setSections(data.sections);
      setCategories(data.categories);
      if (!initialLangAppliedRef.current) {
        initialLangAppliedRef.current = true;
        setLang(data.settings.default_language);
      }
      document.title = `${data.settings.site_name} — Video Streaming`;
    } catch {
      // Keep graceful defaults if bootstrap fails briefly
    }
  }, []);

  useEffect(() => {
    void loadSite();
  }, [loadSite]);

  useEffect(() => {
    const onPopState = () => {
      setRoute({
        pathname: window.location.pathname || '/',
        search: window.location.search || '',
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const parsed = new URL(to, window.location.origin);
    window.history.pushState({}, '', `${parsed.pathname}${parsed.search}`);
    setRoute({ pathname: parsed.pathname, search: parsed.search });
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const isAdminRoute = route.pathname.startsWith('/admin');

  const handleSearchSubmit = (q: string) => {
    setSearchQuery(q);
    if (route.pathname.startsWith('/watch') || route.pathname.startsWith('/admin')) {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    setAdminUser(null);
    showToast('Signed out of admin panel.', 'info');
    navigate('/admin/login');
  };

  /* -------------------- ADMIN ROUTES -------------------- */
  if (isAdminRoute) {
    if (!adminChecked) {
      return (
        <div className="min-h-screen flex items-center justify-center text-sm text-[#98a5c8]">
          Verifying administrator session...
        </div>
      );
    }

    if (!adminUser || route.pathname === '/admin/login') {
      return (
        <AdminLoginPage
          settings={settings}
          onLoginSuccess={(admin) => {
            setAdminUser(admin);
            setAdminChecked(true);
            void loadSite();
            showToast(`Welcome back, ${admin.name}`, 'ok');
            navigate('/admin');
          }}
          onNavigate={navigate}
        />
      );
    }

    let activeTab: AdminTabKey = 'dashboard';
    let pageTitle = 'Admin Dashboard';
    if (route.pathname.startsWith('/admin/videos')) {
      activeTab = 'videos';
      pageTitle = 'Video Management';
    } else if (route.pathname.startsWith('/admin/categories')) {
      activeTab = 'categories';
      pageTitle = 'Category Management';
    } else if (route.pathname.startsWith('/admin/sections')) {
      activeTab = 'sections';
      pageTitle = 'Homepage Video Sections';
    } else if (route.pathname.startsWith('/admin/settings')) {
      activeTab = 'settings';
      pageTitle = 'Website & Account Settings';
    }

    return (
      <AdminLayout
        settings={settings}
        admin={adminUser}
        activeTab={activeTab}
        pageTitle={pageTitle}
        onNavigate={navigate}
        onLogout={handleLogout}
      >
        {activeTab === 'dashboard' && <AdminDashboard onNavigate={navigate} />}
        {activeTab === 'videos' && (
          <AdminVideos queryString={route.search} onDataChanged={() => void loadSite()} />
        )}
        {activeTab === 'categories' && <AdminCategories onDataChanged={() => void loadSite()} />}
        {activeTab === 'sections' && <AdminSections onDataChanged={() => void loadSite()} />}
        {activeTab === 'settings' && (
          <AdminSettings
            settings={settings}
            admin={adminUser}
            onSettingsUpdated={(next) => {
              setSettings(next);
              document.title = `${next.site_name} — Video Streaming`;
              void loadSite();
            }}
          />
        )}
      </AdminLayout>
    );
  }

  /* -------------------- PUBLIC VIDEO ROUTES -------------------- */
  const watchMatch = route.pathname.match(/^\/watch\/([^/]+)$/);
  const searchParams = new URLSearchParams(route.search);
  const initialCategory = searchParams.get('cat') || 'all';

  return (
    <PublicLayout
      settings={settings}
      currentPath={route.pathname}
      searchQuery={searchQuery}
      lang={lang}
      onLangChange={(nextLang) => setLang(nextLang)}
      onSearchSubmit={handleSearchSubmit}
      onNavigate={navigate}
    >
      {watchMatch ? (
        <WatchPage
          videoId={decodeURIComponent(watchMatch[1])}
          lang={lang}
          onNavigate={navigate}
        />
      ) : route.pathname.startsWith('/categories') ? (
        <BrowsePage
          mode="categories"
          categories={categories}
          initialCategory={initialCategory}
          searchQuery={searchQuery}
          lang={lang}
          onClearSearch={() => setSearchQuery('')}
          onNavigate={navigate}
        />
      ) : route.pathname.startsWith('/popular') ? (
        <BrowsePage
          mode="popular"
          categories={categories}
          initialCategory={initialCategory}
          searchQuery={searchQuery}
          lang={lang}
          onClearSearch={() => setSearchQuery('')}
          onNavigate={navigate}
        />
      ) : route.pathname.startsWith('/latest') ? (
        <BrowsePage
          mode="latest"
          categories={categories}
          initialCategory={initialCategory}
          searchQuery={searchQuery}
          lang={lang}
          onClearSearch={() => setSearchQuery('')}
          onNavigate={navigate}
        />
      ) : (
        <HomePage
          settings={settings}
          sections={sections}
          categories={categories}
          searchQuery={searchQuery}
          lang={lang}
          onClearSearch={() => setSearchQuery('')}
          onNavigate={navigate}
        />
      )}
    </PublicLayout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
