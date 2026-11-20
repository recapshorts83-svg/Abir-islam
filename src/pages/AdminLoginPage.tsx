import React, { useState } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import type { AdminUser, SiteSettings } from '../types/video';
import { adminLogin } from '../api/client';

interface AdminLoginPageProps {
  settings: SiteSettings;
  onLoginSuccess: (admin: AdminUser) => void;
  onNavigate: (path: string) => void;
}

export function AdminLoginPage({ settings, onLoginSuccess, onNavigate }: AdminLoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const admin = await adminLogin(username.trim(), password);
      onLoginSuccess(admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="rounded-[22px] vvp-card p-7 sm:p-8 shadow-2xl backdrop-blur-md space-y-5">
          <div className="flex items-center gap-3">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/');
              }}
              className="w-11 h-11 rounded-[14px] vvp-brand-dot flex items-center justify-center font-bold text-xl text-white shrink-0"
            >
              V
            </a>
            <div>
              <h1 className="text-xl font-bold text-[#eaf0ff]">Administrator Login</h1>
              <p className="text-xs text-[#98a5c8]">{settings.site_name} Control Panel</p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-xl bg-[#f87171]/12 border border-[#f87171]/35 text-sm text-[#fecaca]"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-[#98a5c8]">Admin Username</span>
              <input
                type="text"
                value={username ?? ''}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder="admin"
                className="w-full h-11 px-3.5 rounded-xl text-sm vvp-input"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-[#98a5c8]">Password</span>
              <input
                type="password"
                value={password ?? ''}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full h-11 px-3.5 rounded-xl text-sm vvp-input"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl text-sm font-semibold vvp-btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Lock className="w-4 h-4" />
              <span>{submitting ? 'Signing in...' : 'Sign In to Admin'}</span>
            </button>
          </form>
        </div>

        <div className="mt-5 text-center">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#98a5c8] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to {settings.site_name}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
