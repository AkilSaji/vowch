import type { Gig } from "./types";
import { demoGigs } from "./data";

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE !== "false";
let accessToken = process.env.EXPO_PUBLIC_ACCESS_TOKEN?.trim();

/** Set after the mobile email OTP flow completes; never persisted in source code. */
export const setAccessToken = (token?: string) => { accessToken = token?.trim(); };

const toGig = (value: any): Gig => ({
  gigId: String(value.gigId),
  title: String(value.title ?? "Untitled request"),
  description: String(value.description ?? ""),
  skill: String(value.skill ?? "General help"),
  mode:
    value.workMode === "ONSITE" || value.mode === "ONSITE"
      ? "ONSITE"
      : "REMOTE",
  area: value.location ?? value.area ?? null,
  budgetPaise: Number(value.budgetPaise ?? 0),
  status: value.status ?? "OPEN",
  poster: value.poster ?? value.posterName ?? "Local neighbour",
  vowches: Number(value.vowches ?? value.cred ?? 0),
  postedAt: value.postedAt ?? value.createdAt ?? "just now",
});

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiUrl) throw new Error("API URL is not configured");
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

type ProfileAvatar =
  | { kind: "default"; id: string }
  | { kind: "upload"; key: string; contentType: string };

type UploadAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

export const api = {
  async gigs(): Promise<Gig[]> {
    try {
      return (await request<any[]>("/v1/gigs")).map(toGig);
    } catch (error) {
      if (demoMode) return demoGigs;
      throw error;
    }
  },
  async createGig(
    input: Pick<
      Gig,
      "title" | "description" | "skill" | "mode" | "area" | "budgetPaise"
    >,
  ) {
    const created = await request<any>("/v1/gigs", {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        skill: input.skill,
        budgetPaise: input.budgetPaise,
        workMode: input.mode,
        location: input.area,
      }),
    });
    return toGig(created);
  },
  async applyGig(gigId: string, proposal: string, proposedAmountPaise: number) {
    return request(`/v1/gigs/${gigId}/applications`, {
      method: "POST",
      body: JSON.stringify({ proposal, proposedAmountPaise }),
    });
  },
  async messages(gigId: string) {
    return request(`/v1/gigs/${gigId}/messages`);
  },
  async sendMessage(gigId: string, message: string) {
    return request(`/v1/gigs/${gigId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },
  async profile() {
    return request<any>("/v1/me");
  },
  async updateProfile(input: {
    displayName: string;
    primarySkill: string;
    location: string;
    avatar: ProfileAvatar;
  }) {
    return request<any>("/v1/me", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  async uploadProfileImage(asset: UploadAsset): Promise<ProfileAvatar> {
    const contentType = asset.mimeType || "image/jpeg";
    const filename = asset.fileName || `profile-${Date.now()}.jpg`;
    const sizeBytes = asset.fileSize || 5 * 1024 * 1024;
    const signed = await request<{ key: string; uploadUrl: string }>(
      "/v1/uploads/presign",
      {
        method: "POST",
        body: JSON.stringify({ filename, contentType, sizeBytes }),
      },
    );
    const localFile = await fetch(asset.uri);
    const upload = await fetch(signed.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: await localFile.blob(),
    });
    if (!upload.ok) throw new Error("PROFILE_IMAGE_UPLOAD_FAILED");
    return { kind: "upload", key: signed.key, contentType };
  },
  get configured() { return Boolean(apiUrl && accessToken); },
};
