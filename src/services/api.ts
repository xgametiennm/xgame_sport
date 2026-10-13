import { ClubInfo, ClubRole, Player, MatchResult, UserAccount } from '../types/pickleball';
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

  async logout(): Promise<void> {
    await this.request('/auth/logout', 'POST');
  }
}

export const api = new ApiService();
