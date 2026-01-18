export interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

export interface RedditUser {
  id: string;
  name: string;
  created_utc: number;
}

export interface RedditPostResponse {
  json: {
    data: {
      id: string;
      name: string;
      url: string;
    };
    errors: Array<Array<string>>;
  };
}

export interface RedditPostRequest {
  subreddit: string;
  title: string;
  text: string;
}

export interface RedditAuthState {
  state: string;
  userId: string;
}
