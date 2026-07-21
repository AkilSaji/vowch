export type Gig = {
  gigId: string;
  title: string;
  description: string;
  skill: string;
  mode: "REMOTE" | "ONSITE";
  area: string | null;
  budgetPaise: number;
  status: "DRAFT" | "OPEN" | "ASSIGNED" | "IN_REVIEW" | "APPROVED" | "CLOSED";
  poster?: string;
  vowches?: number;
  postedAt?: string;
};

export type Screen =
  | "home"
  | "explore"
  | "create"
  | "inbox"
  | "chat"
  | "passport"
  | "gig"
  | "manage"
  | "notifications"
  | "profile"
  | "house"
  | "apply"
  | "dashboard"
  | "tracking"
  | "wallet"
  | "safety"
  | "settings"
  | "empty"
  | "houses"
  | "housefeed"
  | "directory"
  | "housecreate"
  | "houseadmin"
  | "verify"
  | "sharepassport"
  | "referrals";
