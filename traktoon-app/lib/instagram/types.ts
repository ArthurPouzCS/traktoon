export interface InstagramTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

export interface InstagramLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface InstagramUser {
  id: string;
  username: string;
  account_type?: string;
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp: string;
}

export interface InstagramPostResponse {
  id: string;
}

export interface InstagramPostRequest {
  image_url?: string;
  caption?: string;
  media_type?: "IMAGE" | "CAROUSEL_ALBUM" | "VIDEO";
}
