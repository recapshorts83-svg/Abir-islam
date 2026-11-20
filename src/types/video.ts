export type VideoSourceType = 'youtube' | 'direct';

export interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
  sort_order: number;
  video_count?: number;
  created_at: string;
}

export interface Video {
  id: number;
  title: string;
  description: string;
  category_id: number | null;
  category_name?: string | null;
  category_slug?: string | null;
  category_color?: string | null;
  source_type: VideoSourceType;
  video_url: string;
  playable_url?: string;
  thumbnail_url: string;
  duration: string;
  views: number;
  is_featured: number;
  is_published: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HomepageSection {
  id: number;
  section_key: 'featured' | 'popular' | 'latest' | 'categories' | string;
  title: string;
  subtitle: string;
  is_enabled: number;
  item_limit: number;
  sort_order: number;
}

export interface SiteSettings {
  site_name: string;
  site_tagline: string;
  notice: string;
  footer_text: string;
  default_language: 'en' | 'bn';
}

export interface AdminUser {
  id: number;
  username: string;
  name: string;
}

export interface AdminDashboardStats {
  totalVideos: number;
  publishedVideos: number;
  unpublishedVideos: number;
  totalViews: number;
  totalCategories: number;
  topVideos: Video[];
  recentVideos: Video[];
}
