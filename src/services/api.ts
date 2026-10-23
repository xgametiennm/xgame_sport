import { ClubInfo, ClubRole, Player, MatchResult, UserAccount, LiveCourtState, TournamentData, AppNotification, FundOverview, FundLogEntry, FundExpenseCategory, FundSettings } from '../types/pickleball';
import { PlaySession } from '../utils/playSession';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export type NewClubInput = Pick<ClubInfo, 'name' | 'location' | 'description' | 'courtsCount'>;

export interface GoogleLoginPayload {
  email?: string;
  name?: string;
  avatar?: string;
  googleId?: string;
  credential?: string;
}

// A failed request, with the HTTP status and whatever data the server sent back
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly data?: unknown) {
    super(message);
  }
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // Every call goes to the server; the session travels in an httpOnly cookie
  private async request<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        credentials: 'include',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new ApiError(data.error || `Yêu cầu thất bại (${res.status})`, res.status, data.data);
    }
    return data;
  }

  // Clubs the signed-in user belongs to
  async getClubs(): Promise<ClubInfo[]> {
    return (await this.request('/clubs')).data;
  }

  // Creates a club owned by the signed-in user, who becomes its first member
  async createClub(clubData: NewClubInput): Promise<ClubInfo> {
    return (await this.request('/clubs', 'POST', clubData)).data;
  }

  // Joins the club that owns this code as the signed-in user
  async joinClub(code: string): Promise<ClubInfo> {
    return (await this.request('/clubs/join', 'POST', { code })).data;
  }

  async deleteClub(clubId: string): Promise<void> {
    await this.request(`/clubs/${encodeURIComponent(clubId)}`, 'DELETE');
  }

  async updateClub(clubId: string, patch: Partial<Pick<ClubInfo, 'name' | 'description'>>): Promise<void> {
    await this.request(`/clubs/${encodeURIComponent(clubId)}`, 'PATCH', patch);
  }

  // In-progress play session of a club
  async getSession(clubId: string): Promise<PlaySession | null> {
    return (await this.request(`/clubs/${encodeURIComponent(clubId)}/session`)).data;
  }

  // Replaces the schedule. `session.version` must be the latest one seen: a stale save
  // is refused with status 409 and the current session as the error's data.
  async saveSession(clubId: string, session: PlaySession): Promise<PlaySession> {
    return (await this.request(`/clubs/${encodeURIComponent(clubId)}/session`, 'PUT', session)).data;
  }

  // Sets the score of one match; returns the whole session as it now stands
  async updateSessionScore(clubId: string, matchId: string, score1: number | null, score2: number | null): Promise<PlaySession> {
    const path = `/clubs/${encodeURIComponent(clubId)}/session/matches/${encodeURIComponent(matchId)}`;
    return (await this.request(path, 'PATCH', { score1, score2 })).data;
  }

  async deleteSession(clubId: string): Promise<void> {
    await this.request(`/clubs/${encodeURIComponent(clubId)}/session`, 'DELETE');
  }

  // Club fund
  private fundPath(clubId: string, rest = ''): string {
    return `/clubs/${encodeURIComponent(clubId)}/fund${rest}`;
  }

  async getFund(clubId: string): Promise<FundOverview> {
    return (await this.request(this.fundPath(clubId))).data;
  }

  // Who changed what, newest first; `before` (an entry's createdAt) pages back
  async getFundLogs(clubId: string, before?: string): Promise<FundLogEntry[]> {
    const query = before ? `?before=${encodeURIComponent(before)}` : '';
    return (await this.request(this.fundPath(clubId, `/logs${query}`))).data;
  }

  async saveFundCampaign(
    clubId: string,
    campaign: { name: string; amountPerMember: number; dueDate: string | null; note: string },
    campaignId?: string
  ): Promise<void> {
    if (campaignId) await this.request(this.fundPath(clubId, `/campaigns/${encodeURIComponent(campaignId)}`), 'PATCH', campaign);
    else await this.request(this.fundPath(clubId, '/campaigns'), 'POST', campaign);
  }

  async deleteFundCampaign(clubId: string, campaignId: string): Promise<void> {
    await this.request(this.fundPath(clubId, `/campaigns/${encodeURIComponent(campaignId)}`), 'DELETE');
  }

  async setFundContribution(clubId: string, campaignId: string, playerId: string, payment: { amount: number; paidAt: string; note?: string }): Promise<void> {
    const path = this.fundPath(clubId, `/campaigns/${encodeURIComponent(campaignId)}/contributions/${encodeURIComponent(playerId)}`);
    await this.request(path, 'PUT', payment);
  }

  async deleteFundContribution(clubId: string, campaignId: string, playerId: string): Promise<void> {
    const path = this.fundPath(clubId, `/campaigns/${encodeURIComponent(campaignId)}/contributions/${encodeURIComponent(playerId)}`);
    await this.request(path, 'DELETE');
  }

  // Creates the expense (no expenseId) or updates it; returns its id
  async saveFundExpense(
    clubId: string,
    expense: { title: string; category: FundExpenseCategory; amount: number; spentAt: string; note: string },
    expenseId?: string
  ): Promise<string> {
    if (expenseId) {
      await this.request(this.fundPath(clubId, `/expenses/${encodeURIComponent(expenseId)}`), 'PATCH', expense);
      return expenseId;
    }
    return (await this.request(this.fundPath(clubId, '/expenses'), 'POST', expense)).data.id;
  }

  async deleteFundExpense(clubId: string, expenseId: string): Promise<void> {
    await this.request(this.fundPath(clubId, `/expenses/${encodeURIComponent(expenseId)}`), 'DELETE');
  }

  // `data` is the file's content, base64-encoded
  async uploadFundReceipt(clubId: string, expenseId: string, file: { fileName: string; mime: string; data: string }): Promise<void> {
    await this.request(this.fundPath(clubId, `/expenses/${encodeURIComponent(expenseId)}/receipts`), 'POST', file);
  }

  async deleteFundReceipt(clubId: string, receiptId: string): Promise<void> {
    await this.request(this.fundPath(clubId, `/receipts/${encodeURIComponent(receiptId)}`), 'DELETE');
  }

  async saveFundSettings(clubId: string, settings: FundSettings): Promise<void> {
    await this.request(this.fundPath(clubId, '/settings'), 'PUT', settings);
  }

  // A member reports their own transfer for a round; `proof` is an optional screenshot (base64)
  async createFundClaim(
    clubId: string,
    campaignId: string,
    claim: { amount: number; transferredAt: string; note: string; proof?: { fileName: string; mime: string; data: string } }
  ): Promise<void> {
    await this.request(this.fundPath(clubId, `/campaigns/${encodeURIComponent(campaignId)}/claims`), 'POST', claim);
  }

  async cancelFundClaim(clubId: string, claimId: string): Promise<void> {
    await this.request(this.fundPath(clubId, `/claims/${encodeURIComponent(claimId)}`), 'DELETE');
  }

  async approveFundClaim(clubId: string, claimId: string): Promise<void> {
    await this.request(this.fundPath(clubId, `/claims/${encodeURIComponent(claimId)}/approve`), 'POST', {});
  }

  async rejectFundClaim(clubId: string, claimId: string, reason: string): Promise<void> {
    await this.request(this.fundPath(clubId, `/claims/${encodeURIComponent(claimId)}/reject`), 'POST', { reason });
  }

  // The treasurer's payment QR picture (`data` base64-encoded)
  async uploadFundQr(clubId: string, file: { fileName: string; mime: string; data: string }): Promise<void> {
    await this.request(this.fundPath(clubId, '/settings/qr'), 'PUT', file);
  }

  async deleteFundQr(clubId: string): Promise<void> {
    await this.request(this.fundPath(clubId, '/settings/qr'), 'DELETE');
  }

  fundQrUrl(clubId: string, version: number): string {
    return `${this.baseUrl}${this.fundPath(clubId, '/settings/qr')}?v=${version}`;
  }

  fundClaimProofUrl(clubId: string, claimId: string): string {
    return `${this.baseUrl}${this.fundPath(clubId, `/claims/${encodeURIComponent(claimId)}/proof`)}`;
  }

  // Address of a receipt file; the browser sends the session cookie with it
  fundReceiptUrl(clubId: string, receiptId: string): string {
    return `${this.baseUrl}${this.fundPath(clubId, `/receipts/${encodeURIComponent(receiptId)}`)}`;
  }

  // Club tournament (Group stage & Knockout bracket)
  async getTournament(clubId: string): Promise<TournamentData | null> {
    return (await this.request(`/clubs/${encodeURIComponent(clubId)}/tournament`)).data;
  }

  async saveTournament(clubId: string, tournament: TournamentData): Promise<void> {
    await this.request(`/clubs/${encodeURIComponent(clubId)}/tournament`, 'PUT', tournament);
  }

  async deleteTournament(clubId: string): Promise<void> {
    await this.request(`/clubs/${encodeURIComponent(clubId)}/tournament`, 'DELETE');
  }

  // Finished tournaments of the club, newest first
  async getTournamentHistory(clubId: string): Promise<{ tournament: TournamentData; finishedAt: string }[]> {
    return (await this.request(`/clubs/${encodeURIComponent(clubId)}/tournament-history`)).data;
  }

  async deleteTournamentHistory(clubId: string, tournamentId: string): Promise<void> {
    await this.request(`/clubs/${encodeURIComponent(clubId)}/tournament-history/${encodeURIComponent(tournamentId)}`, 'DELETE');
  }

  // Players
  async getPlayers(clubId: string): Promise<Player[]> {
    return (await this.request(`/players?clubId=${encodeURIComponent(clubId)}`)).data;
  }

  async createPlayer(playerData: Pick<Player, 'name' | 'clubId' | 'email' | 'doublesRating' | 'singlesRating'>): Promise<Player> {
    return (await this.request('/players', 'POST', playerData)).data;
  }

  async updatePlayerRole(playerId: string, role: ClubRole): Promise<void> {
    await this.request(`/players/${encodeURIComponent(playerId)}`, 'PATCH', { role });
  }

  async removePlayer(playerId: string): Promise<void> {
    await this.request(`/players/${encodeURIComponent(playerId)}`, 'DELETE');
  }

  // Matches
  async getMatches(clubId: string): Promise<MatchResult[]> {
    return (await this.request(`/matches?clubId=${encodeURIComponent(clubId)}`)).data;
  }

  async recordMatch(
    clubId: string, 
    match: MatchResult & { isSubsequentMatch?: boolean }
  ): Promise<{ match: MatchResult; autoConfirmed?: boolean; newlyConfirmed?: boolean; message?: string }> {
    const res = await this.request('/matches', 'POST', { ...match, clubId });
    return {
      match: res.data,
      autoConfirmed: res.autoConfirmed,
      newlyConfirmed: res.newlyConfirmed,
      message: res.message,
    };
  }

  async updateMatch(matchId: string, payload: Partial<MatchResult> & { clubId?: string }): Promise<MatchResult> {
    return (await this.request(`/matches/${encodeURIComponent(matchId)}`, 'PATCH', payload)).data;
  }

  async deleteMatch(matchId: string): Promise<void> {
    await this.request(`/matches/${encodeURIComponent(matchId)}`, 'DELETE');
  }

  async confirmMatch(matchId: string, playerId?: string): Promise<MatchResult> {
    return (await this.request(`/matches/${encodeURIComponent(matchId)}/confirm`, 'POST', { playerId })).data;
  }

  async appealMatch(matchId: string, reason: string): Promise<MatchResult> {
    return (await this.request(`/matches/${encodeURIComponent(matchId)}/appeal`, 'POST', { reason })).data;
  }

  // Notifications
  async getNotifications(): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
    const res = await this.request('/notifications');
    return { notifications: res.data || [], unreadCount: res.unreadCount || 0 };
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request(`/notifications/${encodeURIComponent(id)}/read`, 'PATCH');
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.request('/notifications/read-all', 'POST');
  }

  // Auth
  async register(email: string, name: string, password?: string): Promise<UserAccount> {
    return (await this.request('/auth/register', 'POST', { email, name, password })).user;
  }

  async login(email: string, password?: string): Promise<UserAccount> {
    return (await this.request('/auth/login', 'POST', { email, password })).user;
  }

  async loginWithGoogle(payload: GoogleLoginPayload): Promise<UserAccount> {
    return (await this.request('/auth/google', 'POST', payload)).user;
  }

  // The signed-in account, or null when there is no valid session
  async getMe(): Promise<UserAccount | null> {
    try {
      return (await this.request('/auth/me')).user;
    } catch {
      return null;
    }
  }

  async updateMe(profile: { name: string; avatar?: string; doublesRating: number; singlesRating: number; clubId: string }): Promise<UserAccount> {
    return (await this.request('/auth/me', 'PATCH', profile)).user;
  }

  async setDefaultClub(clubId: string | null): Promise<void> {
    await this.request('/auth/default-club', 'POST', { clubId });
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', 'POST');
  }

  // Real-time Live Courts
  async getLiveCourts(clubId?: string): Promise<LiveCourtState[]> {
    const q = clubId ? `?clubId=${encodeURIComponent(clubId)}` : '';
    return (await this.request(`/live/courts${q}`)).data;
  }

  async getLiveCourt(courtId: string): Promise<LiveCourtState> {
    return (await this.request(`/live/court/${encodeURIComponent(courtId)}`)).data;
  }

  async updateLiveCourt(courtId: string, data: Partial<LiveCourtState>): Promise<LiveCourtState> {
    return (await this.request(`/live/court/${encodeURIComponent(courtId)}`, 'POST', data)).data;
  }

  async finishLiveCourt(courtId: string): Promise<void> {
    await this.request(`/live/court/${encodeURIComponent(courtId)}/finish`, 'POST');
  }

  getLiveStreamUrl(courtId?: string, clubId?: string): string {
    const params = new URLSearchParams();
    if (courtId) params.append('courtId', courtId);
    if (clubId) params.append('clubId', clubId);
    const qs = params.toString();
    return `${this.baseUrl}/live/stream${qs ? `?${qs}` : ''}`;
  }
}

export const api = new ApiService();
