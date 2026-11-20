import React, { useEffect, useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import type { AdminUser, SiteSettings } from '../../types/video';
import { updateAdminPassword, updateAdminSettings } from '../../api/client';
import { useToast } from '../../components/Toast';

interface AdminSettingsProps {
  settings: SiteSettings;
  admin: AdminUser;
  onSettingsUpdated: (next: SiteSettings) => void;
  onAdminUpdated: (next: AdminUser) => void;
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

export function AdminSettings({
  settings,
  admin,
  onSettingsUpdated,
  onAdminUpdated,
}: AdminSettingsProps) {
  const [form, setForm] = useState<SiteSettings>(() => normalizeSettings(settings));
  const [savingSite, setSavingSite] = useState(false);

  const [username, setUsername] = useState(() => admin?.username ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    setForm(normalizeSettings(settings));
  }, [settings]);

  useEffect(() => {
    setUsername(admin?.username ?? '');
  }, [admin?.username]);

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

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'err');
      return;
    }
    setSavingPassword(true);
    try {
      const updatedAdmin = await updateAdminPassword({
        username: username.trim(),
        currentPassword,
        newPassword,
      });
      onAdminUpdated(updatedAdmin);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Administrator credentials updated.', 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Password update failed.', 'err');
    } finally {
      setSavingPassword(false);
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

      <form onSubmit={handleSavePassword} className="lg:col-span-5 rounded-2xl vvp-card p-6 space-y-4">
        <h2 className="text-base font-bold text-[#eaf0ff]">Administrator Security</h2>

        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-[#98a5c8]">Admin Username</span>
          <input
            type="text"
            required
            pattern="[a-z0-9_]{3,30}"
            value={username ?? ''}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-[#98a5c8]">Current Password</span>
          <input
            type="password"
            required
            value={currentPassword ?? ''}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-[#98a5c8]">New Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={newPassword ?? ''}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-[#98a5c8]">Confirm New Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={confirmPassword ?? ''}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
          />
        </label>

        <div className="pt-2">
          <button
            type="submit"
            disabled={savingPassword}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 border border-white/15 hover:bg-white/15 text-white disabled:opacity-60"
          >
            <KeyRound className="w-4 h-4" />
            <span>{savingPassword ? 'Updating...' : 'Update Admin Credentials'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
