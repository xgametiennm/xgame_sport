import { ClubInfo, ClubRole, Player, MatchResult, UserAccount, LiveCourtState, TournamentData, AppNotification } from '../types/pickleball';
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
      throw new Error(data.error || `Yêu cầu thất bại (${res.status})`);
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

  async saveSession(clubId: string, session: PlaySession): Promise<void> {
    await this.request(`/clubs/${encodeURIComponent(clubId)}/session`, 'PUT', session);
  }

  async deleteSession(clubId: string): Promise<void> {
    await this.request(`/clubs/${encodeURIComponent(clubId)}/session`, 'DELETE');
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

  async recordMatch(clubId: string, match: MatchResult): Promise<MatchResult> {
    return (await this.request('/matches', 'POST', { ...match, clubId })).data;
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
