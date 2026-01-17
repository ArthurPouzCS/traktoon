export type SocialProvider = "reddit" | "twitter" | "instagram" | "linkedin" | "facebook" | "tiktok" | "youtube";

export interface SocialConnection {
  id: string;
  user_id: string;
  provider: SocialProvider;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  provider_user_id: string | null;
  provider_username: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialConnectionPublic {
  provider: SocialProvider;
  provider_username: string | null;
  created_at: string;
}

export interface SocialProviderConfig {
  id: SocialProvider;
  name: string;
  logo: string;
  enabled: boolean;
  description?: string;
}
