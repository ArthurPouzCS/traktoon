export interface AccountSetup {
  registrationUrl: string;
  accountName: string;
  steps?: string[];
}

export interface DetailedPost {
  scheduledDate: string; // ISO format
  imageDescription: string;
  postDescription: string;
  hashtags?: string[];
}

export interface DetailedPlan {
  accountSetup: AccountSetup;
  posts: DetailedPost[];
}
