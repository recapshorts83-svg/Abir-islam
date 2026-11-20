import React, { useEffect, useState } from 'react';
import { Eye, Film, FolderKanban, Globe } from 'lucide-react';
import type { AdminDashboardStats } from '../../types/video';
import { fetchAdminDashboard } from '../../api/client';
import { formatViews } from '../../utils/video';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchAdminDashboard()
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 rounded-2xl vvp-card" />
          ))}
        </div>
        <div className="h-64 rounded-2xl vvp-card" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl vvp-card p-6 text-sm text-[#fecaca]">
        {error || 'Dashboard metrics unavailable.'}
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Videos',
      value: stats.totalVideos,
      note: `${stats.unpublishedVideos} unpublished draft(s)`,
      icon: Film,
    },
    {
      label: 'Published Videos',
      value: stats.publishedVideos,
      note: 'Live on public catalog',
      icon: Globe,
    },
    {
      label: 'Total Views',
      value: stats.totalViews.toLocaleString(),
      note: 'Across all videos',
      icon: Eye,
    },
    {
      label: 'Video Categories',
      value: stats.totalCategories,
      note: 'Active catalog groups',
      icon: FolderKanban,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl vvp-card p-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#98a5c8]">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-[#eaf0ff] tabular-nums">{card.value}</p>
                <p className="mt-1 text-xs text-[#98a5c8]">{card.note}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#22d3ee] shrink-0">
                <Icon className="w-4 h-4" />
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Recent Videos */}
        <section className="rounded-2xl vvp-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#eaf0ff]">Recently Added Videos</h2>
            <button
              type="button"
              onClick={() => onNavigate('/admin/videos')}
              className="text-xs font-semibold text-[#22d3ee] hover:underline"
            >
              Manage all →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-[#98a5c8]">
                  <th className="py-2 pr-3 font-semibold">Title</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                  <th className="py-2 pl-3 text-right font-semibold">Views</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentVideos.map((video) => (
                  <tr key={video.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() => onNavigate(`/admin/videos?edit=${video.id}`)}
                        className="text-left font-medium text-[#eaf0ff] hover:text-[#22d3ee] line-clamp-1"
                      >
                        {video.title}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                      <span className={video.is_published ? 'text-[#34d399]' : 'text-[#fbbf24]'}>
                        {video.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right text-xs text-[#98a5c8] tabular-nums whitespace-nowrap">
                      {video.views.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {stats.recentVideos.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-sm text-[#98a5c8]">
                      No videos uploaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Popular Videos */}
        <section className="rounded-2xl vvp-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#eaf0ff]">Top Popular Videos</h2>
            <button
              type="button"
              onClick={() => onNavigate('/admin/sections')}
              className="text-xs font-semibold text-[#22d3ee] hover:underline"
            >
              Homepage sections →
            </button>
          </div>
          <ul className="divide-y divide-white/5">
            {stats.topVideos.map((video, idx) => (
              <li key={video.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#eaf0ff] truncate">
                    {idx + 1}. {video.title}
                  </p>
                  <p className="text-xs text-[#98a5c8]">
                    {video.category_name || 'General'} · {video.source_type === 'youtube' ? 'YouTube' : 'Direct URL'}
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#34d399] tabular-nums whitespace-nowrap">
                  {formatViews(video.views, 'en')}
                </span>
              </li>
            ))}
            {stats.topVideos.length === 0 && (
              <li className="py-6 text-center text-sm text-[#98a5c8]">No videos available yet.</li>
            )}
          </ul>
        </section>
      </div>

      {/* Quick Actions */}
      <section className="rounded-2xl vvp-card p-5 space-y-3">
        <h2 className="text-base font-bold text-[#eaf0ff]">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/admin/videos?new=1')}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold vvp-btn-primary whitespace-nowrap"
          >
            + Add New Video
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/admin/categories')}
            className="px-4 py-2.5 rounded-xl text-sm font-medium vvp-card hover:bg-white/10 text-[#eaf0ff] whitespace-nowrap"
          >
            Manage Categories
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/admin/sections')}
            className="px-4 py-2.5 rounded-xl text-sm font-medium vvp-card hover:bg-white/10 text-[#eaf0ff] whitespace-nowrap"
          >
            Configure Homepage
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/admin/settings')}
            className="px-4 py-2.5 rounded-xl text-sm font-medium vvp-card hover:bg-white/10 text-[#eaf0ff] whitespace-nowrap"
          >
            Website Settings
          </button>
        </div>
      </section>
    </div>
  );
}
