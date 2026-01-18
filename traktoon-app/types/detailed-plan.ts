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

export interface DetailedEmail {
  scheduledDate: string; // ISO format
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}

export interface DetailedPlan {
  accountSetup: AccountSetup;
  posts?: DetailedPost[]; // Pour réseaux sociaux
  emails?: DetailedEmail[]; // Pour canal Email (mutuellement exclusif)
}
