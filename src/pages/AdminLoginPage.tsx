import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import type { AdminUser, SiteSettings } from '../types/video';
import { adminLoginWithGoogle } from '../api/client';

interface AdminLoginPageProps {
  settings: SiteSettings;
  onLoginSuccess: (admin: AdminUser) => void;
  onNavigate: (path: string) => void;
}

export function AdminLoginPage({ settings, onLoginSuccess, onNavigate }: AdminLoginPageProps) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setSubmitting(true);
    try {
      const admin = await adminLoginWithGoogle();
      onLoginSuccess(admin);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      if (msg.includes('popup-closed-by-user')) {
        setError('Sign-in popup was closed before completing.');
      } else if (msg.includes('unauthorized-domain')) {
        setError(
          'This domain is not yet authorized in Firebase Authentication. Add this domain under Firebase Console → Authentication → Settings → Authorized domains.',
        );
      } else {
        setError(msg);
      }
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

          <p className="text-sm text-[#cbd5f1] leading-relaxed">
            Sign in with your authorized administrator Google account to manage videos, categories, and site settings.
          </p>

          {error && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-xl bg-[#f87171]/12 border border-[#f87171]/35 text-sm text-[#fecaca]"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogleSignIn}
            className="w-full h-11 rounded-xl text-sm font-semibold vvp-btn-primary inline-flex items-center justify-center gap-2.5 disabled:opacity-60"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{submitting ? 'Verifying Google account...' : 'Sign in with Google'}</span>
          </button>
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
