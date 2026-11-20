import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Check, X } from 'lucide-react';
import type { Category } from '../../types/video';
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
} from '../../api/client';
import { useToast } from '../../components/Toast';
import { ConfirmModal } from '../../components/ConfirmModal';

interface AdminCategoriesProps {
  onDataChanged: () => void;
}

export function AdminCategories({ onDataChanged }: AdminCategoriesProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#7c5cff');
  const [newOrder, setNewOrder] = useState('1');
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#7c5cff');
  const [editOrder, setEditOrder] = useState('0');

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchAdminCategories();
      setCategories(list);
      setNewOrder(String(list.length + 1));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load categories.', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim().length < 2) {
      showToast('Category name must be at least 2 characters.', 'err');
      return;
    }
    setAdding(true);
    try {
      await createAdminCategory({
        name: newName.trim(),
        color: newColor,
        sort_order: Number(newOrder) || 0,
      });
      setNewName('');
      showToast('Category created.', 'ok');
      await load();
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create category.', 'err');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name ?? '');
    setEditColor(cat.color || '#7c5cff');
    setEditOrder(String(cat.sort_order ?? 0));
  };

  const saveEdit = async (id: string) => {
    if (editName.trim().length < 2) {
      showToast('Category name must be at least 2 characters.', 'err');
      return;
    }
    try {
      await updateAdminCategory(id, {
        name: editName.trim(),
        color: editColor,
        sort_order: Number(editOrder) || 0,
      });
      setEditingId(null);
      showToast('Category updated.', 'ok');
      await load();
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed.', 'err');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdminCategory(deleteTarget.id);
      setDeleteTarget(null);
      showToast('Category deleted.', 'ok');
      await load();
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'err');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <section className="lg:col-span-4 rounded-2xl vvp-card p-5 space-y-4">
        <h2 className="text-base font-bold text-[#eaf0ff]">Add Category</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-[#98a5c8]">Category Name *</span>
            <input
              type="text"
              required
              maxLength={60}
              value={newName ?? ''}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Science & Space"
              className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-[#98a5c8]">Accent Color</span>
              <input
                type="color"
                value={newColor ?? '#7c5cff'}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-full h-10 p-1 rounded-xl vvp-input cursor-pointer"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-[#98a5c8]">Sort Order</span>
              <input
                type="number"
                value={newOrder ?? '0'}
                onChange={(e) => setNewOrder(e.target.value)}
                className="w-full h-10 px-3 rounded-xl text-sm vvp-input"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={adding}
            className="w-full h-10 rounded-xl text-sm font-semibold vvp-btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            <span>{adding ? 'Creating...' : 'Create Category'}</span>
          </button>
        </form>
      </section>

      <section className="lg:col-span-8 rounded-2xl vvp-card p-5 space-y-4">
        <h2 className="text-base font-bold text-[#eaf0ff]">
          All Categories ({categories.length})
        </h2>

        {loading ? (
          <div className="py-10 text-center text-sm text-[#98a5c8]">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#98a5c8]">
            No categories yet. Create your first category on the left.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-[#98a5c8]">
                  <th className="py-2.5 pr-3 font-semibold">Order</th>
                  <th className="py-2.5 px-3 font-semibold">Name</th>
                  <th className="py-2.5 px-3 font-semibold">Slug</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Videos</th>
                  <th className="py-2.5 pl-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const isEditing = editingId === cat.id;
                  return (
                    <tr key={cat.id} className="border-b border-white/5 last:border-0">
                      <td className="py-3 pr-3 tabular-nums text-xs text-[#98a5c8]">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editOrder ?? '0'}
                            onChange={(e) => setEditOrder(e.target.value)}
                            className="w-16 h-8 px-2 rounded-lg text-xs vvp-input"
                          />
                        ) : (
                          cat.sort_order
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editColor ?? '#7c5cff'}
                              onChange={(e) => setEditColor(e.target.value)}
                              className="w-8 h-8 p-0.5 rounded-lg vvp-input shrink-0"
                            />
                            <input
                              type="text"
                              value={editName ?? ''}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 px-2.5 rounded-lg text-xs vvp-input"
                            />
                          </div>
                        ) : (
                          <span className="font-semibold text-[#eaf0ff]">{cat.name}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-[#98a5c8] font-mono">{cat.slug}</td>
                      <td className="py-3 px-3 text-xs text-right text-[#98a5c8] tabular-nums">
                        {cat.video_count ?? 0}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveEdit(cat.id)}
                              aria-label="Save category"
                              className="p-2 rounded-lg bg-[#34d399]/20 border border-[#34d399]/40 text-[#a7f3d0]"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              aria-label="Cancel edit"
                              className="p-2 rounded-lg bg-white/5 border border-white/10 text-[#98a5c8]"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(cat)}
                              aria-label={`Edit ${cat.name}`}
                              className="p-2 rounded-lg bg-white/5 border border-white/10 text-[#eaf0ff] hover:bg-white/10"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(cat)}
                              aria-label={`Delete ${cat.name}`}
                              className="p-2 rounded-lg bg-[#f87171]/15 border border-[#f87171]/35 text-[#fecaca] hover:bg-[#f87171]/25"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Category"
        message={`Delete "${deleteTarget?.name ?? ''}"? Videos in this category will remain published as General.`}
        confirmLabel="Delete Category"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
