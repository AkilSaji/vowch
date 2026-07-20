const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export type ApiGig = { gigId: string; title: string; description: string; skill: string; workMode?: 'REMOTE' | 'ONSITE'; location?: string | null; budgetPaise: number; status: string; posterId?: string; createdAt?: string; deadlineAt?: string };
export type Profile = { userId: string; displayName?: string; email?: string; primarySkill?: string; location?: string; cred?: number; onboardingComplete?: boolean; identityStatus?: string; passportNo?: string; posterVerificationStatus?: string; verificationStatus?: string; tier?: string; trustScore?: number; vouchCount?: number };

export function createApi(accessToken: string) {
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!baseUrl) throw new Error('The Vowch API URL is not configured.');
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data as T;
  };
  return {
    me: () => request<Profile>('/v1/me'),
    updateProfile: (input: Partial<Profile>) => request<Profile>('/v1/me', { method: 'PUT', body: JSON.stringify(input) }),
    onboarding: (input: { displayName: string; primarySkill: string; inviteCode: string; identityReference?: string; identityNotes?: string }) => request<{ status: string; message?: string }>('/v1/onboarding/complete', { method: 'POST', body: JSON.stringify(input) }),
    gigs: () => request<ApiGig[]>('/v1/gigs'),
    gig: (gigId: string) => request<ApiGig>(`/v1/gigs/${gigId}`),
    createGig: (input: Record<string, unknown>) => request<ApiGig>('/v1/gigs', { method: 'POST', body: JSON.stringify(input) }),
    apply: (gigId: string, input: { proposal: string; proposedAmountPaise?: number }) => request(`/v1/gigs/${gigId}/applications`, { method: 'POST', body: JSON.stringify(input) }),
    applications: () => request<{ items: Record<string, unknown>[] }>('/v1/worker/applications'),
    workerGigs: () => request<ApiGig[]>('/v1/worker/gigs'),
    earnings: () => request<{ items: Record<string, unknown>[]; totalReleasedPaise: number }>('/v1/worker/earnings'),
    poster: () => request<{ gigs: ApiGig[]; counts: Record<string, number>; poster: Record<string, unknown> }>('/v1/poster/dashboard'),
    passports: () => request<Record<string, unknown>[]>('/v1/passports'),
    notifications: () => request<{ items: Record<string, unknown>[] }>('/v1/notifications'),
    houseStats: () => request<Record<string, unknown>>('/v1/house/stats'),
    communities: () => request<Record<string, unknown>[]>('/v1/communities'),
    messages: (gigId: string) => request<{ items: Record<string, unknown>[] }>(`/v1/gigs/${gigId}/messages`),
    sendMessage: (gigId: string, message: string) => request(`/v1/gigs/${gigId}/messages`, { method: 'POST', body: JSON.stringify({ message }) }),
  };
}
