export interface ExploreRead {
  read_id: string
  title: string
  author?: string | null
  article_image_url?: string | null
  cover_image_urls?: {
    large?: string | null
    medium?: string | null
    thumbnail?: string | null
  } | null
  audio_duration_seconds?: number | null
  language?: string | null
}

export interface SearchResponse {
  items?: Array<{ type: string; explore_read?: ExploreRead }>
}

export interface DetailSection {
  type: string
  title?: string | null
  author?: string | null
  subtitle?: string | null
  description?: string | null
  narrated_by?: string | null
  image?: { image_url?: string | null } | null
  collection_tags?: Array<{ title: string }> | null
  items?: Array<{ title: string; value: string }>
}

export interface DetailsResponse {
  sections?: DetailSection[]
}
