import React, { useEffect, useState } from 'react';
import { CheckCircle2, Save, ShieldCheck } from 'lucide-react';
import type { AdminUser, SiteSettings } from '../../types/video';
import { updateAdminSettings } from '../../api/client';
import { useToast } from '../../components/Toast';

interface AdminSettingsProps {
  settings: SiteSettings;
  admin: AdminUser;
  onSettingsUpdated: (next: SiteSettings) => void;
}

function normalizeSettings(s?: Partial<SiteSettings>): SiteSettings {
  return {
    site_name: s?.site_name ?? 'Viral Video Pro',
    site_tagline: s?.site_tagline ?? '',
    notice: s?.notice ?? '',
    footer_text: s?.footer_text ?? '',
    default_language: s?.default_language === 'bn' ? 'bn' : 'en',
  };
}

export function AdminSettings({ settings, admin, onSettingsUpdated }: AdminSettingsProps) {
  const [form, setForm] = useState<SiteSettings>(() => normalizeSettings(settings));
  const [savingSite, setSavingSite] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    setForm(normalizeSettings(settings));
  }, [settings]);

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSite(true);
    try {
      const updated = await updateAdminSettings(form);
      onSettingsUpdated(updated);
      showToast('Website settings saved.', 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save settings.', 'err');
    } finally {
      setSavingSite(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <form onSubmit={handleSaveSite} className="lg:col-span-7 rounded-2xl vvp-card p-6 space-y-4">
        <h2 className="text-base font-bold text-[#eaf0ff]">Website Name & Basic Settings</h2>

        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-[#98a5c8]">Website Name *</span>
          <input
            type="text"
            required
            maxLength={60}
            value={form.site_name ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, site_name: e.target.value }))}
            className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-[#98a5c8]">Tagline</span>
          <input
            type="text"
            maxLength={140}
            value={form.site_tagline ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, site_tagline: e.target.value }))}
            className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-[#98a5c8]">
            Homepage Notice Banner (leave empty to hide)
          </span>
          <input
            type="text"
            maxLength={200}
            value={form.notice ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, notice: e.target.value }))}
            placeholder="Optional announcement shown below header"
            className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-[#98a5c8]">Footer Text</span>
          <input
            type="text"
            maxLength={200}
            value={form.footer_text ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, footer_text: e.target.value }))}
            className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-[#98a5c8]">Default UI Language</span>
          <select
            value={form.default_language ?? 'en'}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                default_language: e.target.value === 'bn' ? 'bn' : 'en',
              }))
            }
            className="w-full h-10 px-3 rounded-xl text-sm vvp-input"
          >
            <option value="en">English (with বাংলা toggle)</option>
            <option value="bn">বাংলা (with EN toggle)</option>
          </select>
        </label>

        <div className="pt-2">
          <button
            type="submit"
            disabled={savingSite}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold vvp-btn-primary disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{savingSite ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      <section className="lg:col-span-5 rounded-2xl vvp-card p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#7c5cff]/20 border border-[#7c5cff]/40 flex items-center justify-center text-[#22d3ee]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#eaf0ff]">Administrator Security</h2>
            <p className="text-xs text-[#98a5c8]">Google Sign-In &amp; Cloud Firestore</p>
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-2">
          <p className="text-xs text-[#98a5c8]">Signed-in Administrator</p>
          <p className="text-sm font-semibold text-[#eaf0ff]">{admin.name}</p>
          <p className="text-xs text-[#22d3ee] break-all">{admin.email}</p>
        </div>

        <div className="flex items-start gap-2.5 text-xs text-[#cbd5f1] leading-relaxed">
          <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0 mt-0.5" />
          <p>
            Authentication and database persistence run directly on Firebase Cloud, making your built{' '}
            <code className="px-1.5 py-0.5 rounded bg-white/10 text-[#eaf0ff]">dist</code> folder ready for static hosting on Netlify without a Node server.
          </p>
        </div>

        <div className="rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/25 p-3.5 text-xs text-[#bdf1ff] leading-relaxed">
          When publishing on a Netlify URL (such as <code className="font-mono">your-site.netlify.app</code>), add that domain under Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains so Google Sign-In works on your live domain.
        </div>
      </section>
    </div>
  );
}
