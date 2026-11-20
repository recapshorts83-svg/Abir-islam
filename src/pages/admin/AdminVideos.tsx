import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Category, Video, VideoSourceType } from '../../types/video';
import {
  createAdminVideo,
  deleteAdminVideo,
  fetchAdminCategories,
  fetchAdminVideos,
  toggleAdminVideoPublish,
  updateAdminVideo,
  uploadThumbnailFile,
} from '../../api/client';
import {
  detectSourceType,
  getYouTubeThumbnailUrl,
  resolveThumbnail,
  validateVideoInput,
} from '../../utils/video';
import { useToast } from '../../components/Toast';
import { ConfirmModal } from '../../components/ConfirmModal';

interface AdminVideosProps {
  queryString: string;
  onDataChanged: () => void;
}

interface VideoFormState {
  id: string | null;
  title: string;
  description: string;
  category_id: string;
  source_type: VideoSourceType;
  video_url: string;
  thumbnail_url: string;
  duration: string;
  is_featured: boolean;
  is_published: boolean;
  sort_order: string;
}

const EMPTY_FORM: VideoFormState = {
  id: null,
  title: '',
  description: '',
  category_id: '',
  source_type: 'direct',
  video_url: '',
  thumbnail_url: '',
  duration: '03:30',
  is_featured: false,
  is_published: true,
  sort_order: '10',
};

export function AdminVideos({ queryString, onDataChanged }: AdminVideosProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<VideoFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { showToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [vList, cList] = await Promise.all([
        fetchAdminVideos({
          q: searchQ.trim() || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          categoryId: catFilter !== 'all' ? catFilter : undefined,
        }),
        fetchAdminCategories(),
      ]);
      setVideos(vList);
      setCategories(cList);
      return { vList, cList };
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load videos.', 'err');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData().then((res) => {
      if (!res) return;
      const params = new URLSearchParams(queryString);
      if (params.get('new') === '1') {
        setForm({ ...EMPTY_FORM, category_id: res.cList[0]?.id ?? '' });
        setFormError('');
        setEditorOpen(true);
      } else if (params.get('edit')) {
        const targetId = params.get('edit');
        const found = res.vList.find((v) => v.id === targetId);
        if (found) openEdit(found);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 180);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQ, statusFilter, catFilter]);

  const openCreate = () => {
    setForm({
      ...EMPTY_FORM,
      category_id: categories[0]?.id ? String(categories[0].id) : '',
    });
    setFormError('');
    setEditorOpen(true);
  };

  const openEdit = (video: Video) => {
    setForm({
      id: video.id,
      title: video.title ?? '',
      description: video.description ?? '',
      category_id: video.category_id ? String(video.category_id) : '',
      source_type: video.source_type === 'youtube' ? 'youtube' : 'direct',
      video_url: video.video_url ?? '',
      thumbnail_url: video.thumbnail_url ?? '',
      duration: video.duration ?? '00:00',
      is_featured: video.is_featured === 1,
      is_published: video.is_published === 1,
      sort_order: String(video.sort_order ?? 0),
    });
    setFormError('');
    setEditorOpen(true);
  };

  const handleVideoUrlChange = (url: string) => {
    const detected = detectSourceType(url);
    setForm((prev) => ({
      ...prev,
      video_url: url,
      source_type: url.trim() ? detected : prev.source_type,
    }));
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    setFormError('');
    try {
      const uploadedUrl = await uploadThumbnailFile(file);
      setForm((prev) => ({ ...prev, thumbnail_url: uploadedUrl }));
      showToast('Thumbnail uploaded successfully.', 'ok');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thumbnail upload failed.';
      setFormError(msg);
      showToast(msg, 'err');
    } finally {
      setUploadingThumb(false);
      e.target.value = '';
    }
  };

  const handleUseYouTubeThumb = () => {
    const ytThumb = getYouTubeThumbnailUrl(form.video_url);
    if (!ytThumb) {
      showToast('Enter a valid YouTube URL first.', 'err');
      return;
    }
    setForm((prev) => ({ ...prev, thumbnail_url: ytThumb }));
    showToast('YouTube thumbnail applied.', 'ok');
  };

  const handleSaveVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const validation = validateVideoInput({
      title: form.title,
      description: form.description,
      category_id: form.category_id || null,
      source_type: form.source_type,
      video_url: form.video_url,
      thumbnail_url: form.thumbnail_url,
    });
    if (!validation.ok) {
      setFormError(validation.error);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category_id: form.category_id || null,
        source_type: form.source_type,
        video_url: form.video_url.trim(),
        thumbnail_url: form.thumbnail_url.trim(),
        duration: form.duration.trim() || '00:00',
        is_featured: form.is_featured,
        is_published: form.is_published,
        sort_order: Number(form.sort_order) || 0,
      };

      if (form.id) {
        await updateAdminVideo(form.id, payload);
        showToast('Video updated.', 'ok');
      } else {
        await createAdminVideo(payload);
        showToast('New video added.', 'ok');
      }
      setEditorOpen(false);
      await loadData();
      onDataChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save video.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (video: Video) => {
    const nextState = video.is_published !== 1;
    try {
      await toggleAdminVideoPublish(video.id, nextState);
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, is_published: nextState ? 1 : 0 } : v)),
      );
      showToast(nextState ? 'Video published.' : 'Video moved to draft.', 'ok');
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status.', 'err');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdminVideo(deleteTarget.id);
      setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      showToast('Video deleted.', 'ok');
      setDeleteTarget(null);
      onDataChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'err');
    } finally {
      setDeleting(false);
    }
  };

  const previewThumb = resolveThumbnail({
    thumbnail_url: form.thumbnail_url,
    video_url: form.video_url,
    source_type: form.source_type,
  });

  return (
    <div className="space-y-5">
      {/* Toolbar & Filters */}
      <section className="rounded-2xl vvp-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-[#98a5c8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQ ?? ''}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search videos..."
              className="w-full h-10 pl-9 pr-3 rounded-xl text-sm vvp-input"
            />
          </div>

          <select
            aria-label="Filter by category"
            value={catFilter ?? 'all'}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-10 px-3 rounded-xl text-sm vvp-input"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter ?? 'all'}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl text-sm vvp-input"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="h-10 px-4 rounded-xl text-sm font-semibold vvp-btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Video</span>
        </button>
      </section>

      {/* Video Table */}
      <section className="rounded-2xl vvp-card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-[#eaf0ff]">
            Video Catalog ({videos.length})
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-[#98a5c8]">Loading videos...</div>
        ) : videos.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-[#98a5c8]">No videos match your filters.</p>
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 rounded-xl text-sm font-semibold vvp-btn-primary"
            >
              + Add Your First Video
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-[#98a5c8]">
                  <th className="py-2.5 pr-3 font-semibold">Video</th>
                  <th className="py-2.5 px-3 font-semibold">Category</th>
                  <th className="py-2.5 px-3 font-semibold">Source</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Views</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 pl-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((video) => {
                  const thumb = resolveThumbnail(video);
                  return (
                    <tr key={video.id} className="border-b border-white/5 hover:bg-white/[0.03] last:border-0">
                      <td className="py-3 pr-3 max-w-[320px]">
                        <div className="flex items-center gap-3">
                          <div className="w-20 aspect-video rounded-lg overflow-hidden bg-[#0c1330] border border-white/10 shrink-0">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-[#98a5c8]">
                                No Img
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#eaf0ff] line-clamp-1">{video.title}</p>
                            <p className="text-xs text-[#98a5c8] tabular-nums">
                              {video.duration || '00:00'}
                              {video.is_featured === 1 ? ' · Featured' : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-[#cbd5f1] whitespace-nowrap">
                        {video.category_name || 'General'}
                      </td>
                      <td className="py-3 px-3 text-xs text-[#98a5c8] whitespace-nowrap">
                        {video.source_type === 'youtube' ? 'YouTube URL' : 'Direct URL'}
                      </td>
                      <td className="py-3 px-3 text-xs text-[#98a5c8] text-right tabular-nums whitespace-nowrap">
                        {video.views.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap">
                        {video.is_published === 1 ? (
                          <span className="inline-flex items-center gap-1 text-[#34d399] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Published</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#fbbf24] font-medium">
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Draft</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(video)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-[#eaf0ff] hover:bg-white/10"
                          >
                            {video.is_published === 1 ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(video)}
                            aria-label={`Edit ${video.title}`}
                            className="p-2 rounded-lg bg-white/5 border border-white/10 text-[#eaf0ff] hover:bg-white/10"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(video)}
                            aria-label={`Delete ${video.title}`}
                            className="p-2 rounded-lg bg-[#f87171]/15 border border-[#f87171]/35 text-[#fecaca] hover:bg-[#f87171]/25"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add / Edit Video Modal */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-editor-title"
        >
          <div className="w-full max-w-3xl rounded-2xl bg-[#0d1326] border border-white/15 p-6 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
              <h2 id="video-editor-title" className="text-lg font-bold text-[#eaf0ff]">
                {form.id ? 'Edit Video' : 'Add New Video'}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                aria-label="Close editor"
                className="p-2 rounded-lg text-[#98a5c8] hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 px-4 py-2.5 rounded-xl bg-[#f87171]/15 border border-[#f87171]/40 text-sm text-[#fecaca]">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveVideo} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="block text-xs font-medium text-[#98a5c8]">Video Title *</span>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={form.title ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Enter video title"
                    className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="block text-xs font-medium text-[#98a5c8]">Description</span>
                  <textarea
                    rows={4}
                    value={form.description ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Describe what viewers will watch"
                    className="w-full p-3 rounded-xl text-sm vvp-input resize-y"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5">
                    <span className="block text-xs font-medium text-[#98a5c8]">Category</span>
                    <select
                      value={form.category_id ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl text-sm vvp-input"
                    >
                      <option value="">General</option>
                      {categories.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="block text-xs font-medium text-[#98a5c8]">Source Type</span>
                    <select
                      value={form.source_type ?? 'direct'}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, source_type: e.target.value as VideoSourceType }))
                      }
                      className="w-full h-10 px-3 rounded-xl text-sm vvp-input"
                    >
                      <option value="direct">Direct Video URL</option>
                      <option value="youtube">YouTube URL</option>
                    </select>
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <span className="block text-xs font-medium text-[#98a5c8]">
                    {form.source_type === 'youtube' ? 'YouTube Video URL *' : 'Direct Video URL *'}
                  </span>
                  <input
                    type="text"
                    required
                    value={form.video_url ?? ''}
                    onChange={(e) => handleVideoUrlChange(e.target.value)}
                    placeholder={
                      form.source_type === 'youtube'
                        ? 'https://www.youtube.com/watch?v=...'
                        : 'https://example.com/video.mp4 or /media/clip.mp4'
                    }
                    className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
                  />
                </label>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="block text-xs font-medium text-[#98a5c8]">Thumbnail Image</span>
                  <div className="aspect-video rounded-xl overflow-hidden bg-[#070b16] border border-white/10 flex items-center justify-center">
                    {previewThumb ? (
                      <img
                        src={previewThumb}
                        alt="Thumbnail preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-[#98a5c8]">No thumbnail selected</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/15 text-white cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingThumb ? 'Uploading...' : 'Upload Thumbnail'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleThumbUpload}
                        disabled={uploadingThumb}
                        className="sr-only"
                      />
                    </label>
                    {form.source_type === 'youtube' && (
                      <button
                        type="button"
                        onClick={handleUseYouTubeThumb}
                        className="px-3 py-2 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-[#22d3ee] hover:bg-white/10"
                      >
                        Use YouTube Thumbnail
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={form.thumbnail_url ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, thumbnail_url: e.target.value }))}
                    placeholder="Or paste thumbnail URL (https://... or upload an image)"
                    className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5">
                    <span className="block text-xs font-medium text-[#98a5c8]">Duration</span>
                    <input
                      type="text"
                      value={form.duration ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
                      placeholder="04:20"
                      className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="block text-xs font-medium text-[#98a5c8]">Sort Order</span>
                    <input
                      type="number"
                      value={form.sort_order ?? '0'}
                      onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
                      className="w-full h-10 px-3.5 rounded-xl text-sm vvp-input"
                    />
                  </label>
                </div>

                <div className="space-y-2.5 pt-1">
                  <label className="flex items-center gap-2.5 text-sm text-[#eaf0ff] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.is_published)}
                      onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
                      className="w-4 h-4 accent-[#7c5cff]"
                    />
                    <span>Published (visible to visitors)</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-sm text-[#eaf0ff] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.is_featured)}
                      onChange={(e) => setForm((p) => ({ ...p, is_featured: e.target.checked }))}
                      className="w-4 h-4 accent-[#22d3ee]"
                    />
                    <span>Feature on Homepage Spotlight</span>
                  </label>
                </div>
              </div>

              <div className="md:col-span-2 pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-[#eaf0ff] hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingThumb}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold vvp-btn-primary disabled:opacity-60"
                >
                  {saving ? 'Saving...' : form.id ? 'Save Changes' : 'Create Video'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Video"
        message={`Are you sure you want to permanently delete "${deleteTarget?.title ?? ''}"?`}
        confirmLabel="Delete Video"
        busy={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
