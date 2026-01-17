export type Channel = "X" | "Instagram" | "TikTok" | "Email" | "LinkedIn" | "GoogleAds" | "LandingPage";

export type PlanStatus = "à faire" | "en cours" | "terminé";

export interface PlanStep {
  sequence: string;
  content: string;
  target: string;
  status: PlanStatus;
}

export interface ChannelPlan {
  channel: Channel;
  sequence: string;
  content: string;
  target: string;
  description?: string;
  steps: PlanStep[];
}

export interface GoToMarketPlan {
  channels: ChannelPlan[];
}
