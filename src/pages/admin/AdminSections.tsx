import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Save } from 'lucide-react';
import type { HomepageSection } from '../../types/video';
import { fetchAdminSections, updateAdminSections } from '../../api/client';
import { useToast } from '../../components/Toast';

interface AdminSectionsProps {
  onDataChanged: () => void;
}

export function AdminSections({ onDataChanged }: AdminSectionsProps) {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchAdminSections()
      .then((rows) => setSections(rows))
      .catch((err) => showToast(err instanceof Error ? err.message : 'Failed to load sections.', 'err'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const copy = [...sections];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    setSections(copy.map((s, idx) => ({ ...s, sort_order: idx + 1 })));
  };

  const updateField = (id: number, patch: Partial<HomepageSection>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateAdminSections(sections);
      setSections(updated);
      showToast('Homepage sections updated.', 'ok');
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save sections.', 'err');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl vvp-card p-8 text-center text-sm text-[#98a5c8]">Loading homepage sections...</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-4xl">
      <section className="rounded-2xl vvp-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#eaf0ff]">Homepage Video Sections</h2>
            <p className="text-xs text-[#98a5c8] mt-0.5">
              Enable, rename, set video counts, and reorder sections shown on the homepage.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold vvp-btn-primary whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Layout'}</span>
          </button>
        </div>

        <div className="divide-y divide-white/10">
          {sections.map((section, idx) => (
            <div key={section.id} className="py-4 first:pt-2 last:pb-1 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={section.is_enabled === 1}
                    onChange={(e) => updateField(section.id, { is_enabled: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 accent-[#7c5cff]"
                  />
                  <span className="text-sm font-bold text-[#eaf0ff] capitalize">
                    {section.section_key} section
                  </span>
                </label>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveSection(idx, -1)}
                    aria-label={`Move ${section.title} up`}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-[#eaf0ff] hover:bg-white/10 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === sections.length - 1}
                    onClick={() => moveSection(idx, 1)}
                    aria-label={`Move ${section.title} down`}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-[#eaf0ff] hover:bg-white/10 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <label className="sm:col-span-4 block space-y-1">
                  <span className="block text-[11px] font-medium text-[#98a5c8]">Section Heading</span>
                  <input
                    type="text"
                    value={section.title ?? ''}
                    maxLength={80}
                    onChange={(e) => updateField(section.id, { title: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl text-sm vvp-input"
                  />
                </label>

                <label className="sm:col-span-6 block space-y-1">
                  <span className="block text-[11px] font-medium text-[#98a5c8]">Subtitle</span>
                  <input
                    type="text"
                    value={section.subtitle ?? ''}
                    maxLength={140}
                    onChange={(e) => updateField(section.id, { subtitle: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl text-sm vvp-input"
                  />
                </label>

                <label className="sm:col-span-2 block space-y-1">
                  <span className="block text-[11px] font-medium text-[#98a5c8]">Max Items</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={Number.isFinite(section.item_limit) ? section.item_limit : 8}
                    onChange={(e) => updateField(section.id, { item_limit: Number(e.target.value) || 1 })}
                    className="w-full h-9 px-3 rounded-xl text-sm vvp-input tabular-nums"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>
    </form>
  );
}
