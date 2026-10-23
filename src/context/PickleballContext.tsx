import React, { createContext, useCallback, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { Player, MatchResult, ClubInfo, ClubRole, UserAccount, AppNotification } from '../types/pickleball';
import { api, NewClubInput } from '../services/api';
import { useAuth } from './AuthContext';
import { ClubOnboarding } from '../components/ClubOnboarding';
import { ALL_DAYS, MatchDayFilter } from '../utils/matchDayFilter';

export type AppTab = 'home' | 'members' | 'standings' | 'matches' | 'calculator' | 'scoreboard' | 'tournament' | 'guide' | 'profile' | 'play' | 'clubSettings';
export type ViewMode = 'desktop' | 'mobile';

// All club data lives on the server and is scoped to the signed-in account:
// `clubs` are the clubs that account belongs to, and every mutation below is sent
// to the API and the affected data re-read, so nothing is kept in browser storage.
interface PickleballContextType {
  clubs: ClubInfo[];
  selectedClub: ClubInfo;
  setSelectedClub: (club: ClubInfo) => void;
  defaultClubId: string | null;
  setDefaultClub: (clubId: string) => Promise<void>;
  players: Player[];
  matches: MatchResult[];
  // The signed-in account's own member record in the selected club
  myPlayer: Player | null;
  // Whether the signed-in account is an owner/admin of the selected club
  isManager: boolean;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  // Member profile opened over the current tab. Opening one and switching tabs are browser
  // history entries, so the Back button returns to the previous screen instead of leaving.
  viewedPlayer: Player | null;
  openPlayer: (player: Player) => void;
  closePlayer: () => void;
  // Day picked in the match history; the standings follow the same day
  matchDayFilter: MatchDayFilter;
  setMatchDayFilter: (filter: MatchDayFilter) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  lang: 'vi' | 'en';
  setLang: (lang: 'vi' | 'en') => void;
  refreshClub: () => Promise<void>;
  recordNewMatch: (newMatch: MatchResult & { isSubsequentMatch?: boolean }) => Promise<{ match: MatchResult; autoConfirmed?: boolean; newlyConfirmed?: boolean; message?: string }>;
  updateMatch: (matchId: string, updatedMatch: MatchResult) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  addNewPlayer: (name: string, doublesRating: number, singlesRating: number, email?: string) => Promise<Player>;
  getPlayerById: (id: string) => Player | undefined;
  updateClub: (patch: Partial<Pick<ClubInfo, 'name' | 'description'>>) => Promise<void>;
  removePlayer: (id: string) => Promise<void>;
  updatePlayerRole: (id: string, role: ClubRole) => Promise<void>;
  createClub: (input: NewClubInput) => Promise<ClubInfo>;
  joinClub: (code: string) => Promise<ClubInfo>;
  deleteClub: () => Promise<void>;
  // `avatar` is only sent when the user picked a new one
  updateMyProfile: (name: string, doublesRating: number, singlesRating: number, avatar?: string) => Promise<void>;
  // Notifications & Match Confirmation / Appeal
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  confirmMatch: (matchId: string, playerId?: string) => Promise<void>;
  appealMatch: (matchId: string, reason: string) => Promise<void>;
}

const PickleballContext = createContext<PickleballContextType | undefined>(undefined);

const CLUB_QUERY_PARAM = 'club';
const JOIN_QUERY_PARAM = 'join';
const TAB_QUERY_PARAM = 'tab';

const APP_TABS: AppTab[] = ['home', 'members', 'standings', 'matches', 'calculator', 'scoreboard', 'tournament', 'guide', 'profile', 'play', 'clubSettings'];

// What each browser history entry of the app holds
interface NavState {
  tab: AppTab;
  player: Player | null;
}

const tabFromUrl = (): AppTab => {
  const tab = new URLSearchParams(window.location.search).get(TAB_QUERY_PARAM) as AppTab | null;
  return tab && APP_TABS.includes(tab) ? tab : 'home';
};

const urlForTab = (tab: AppTab): URL => {
  const url = new URL(window.location.href);
  if (tab === 'home') url.searchParams.delete(TAB_QUERY_PARAM);
  else url.searchParams.set(TAB_QUERY_PARAM, tab);
  return url;
};

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định';

const setQueryParam = (name: string, value: string | null) => {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  // Keep the entry's navigation state; only the address changes
  window.history.replaceState(window.history.state, '', url);
};

const StatusScreen: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    textAlign: 'center',
  }}>
    <span style={{ fontSize: '2.4rem' }}>🏓</span>
    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#475569', maxWidth: 360 }}>{message}</div>
    {onRetry && (
      <button className="btn-court" onClick={onRetry}>Thử lại</button>
    )}
  </div>
);

export const PickleballProvider: React.FC<{ user: UserAccount; children: React.ReactNode }> = ({ user, children }) => {
  const { logout, setCurrentUser } = useAuth();

  const [clubs, setClubs] = useState<ClubInfo[] | null>(null);
  // Default club preference from localStorage or user profile
  const [defaultClubId, setDefaultClubId] = useState<string | null>(() =>
    localStorage.getItem('xgame_default_club_id') || user?.defaultClubId || null
  );

  // The selected club is carried in the URL so a reload opens the same club, or falls back to defaultClubId
  const [selectedClubId, setSelectedClubId] = useState<string | null>(() => {
    const urlParam = new URLSearchParams(window.location.search).get(CLUB_QUERY_PARAM);
    if (urlParam) return urlParam;
    return localStorage.getItem('xgame_default_club_id') || user?.defaultClubId || null;
  });
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loadedClubId, setLoadedClubId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTabState] = useState<AppTab>(() => (window.history.state as NavState | null)?.tab ?? tabFromUrl());
  const [viewedPlayer, setViewedPlayer] = useState<Player | null>(() => (window.history.state as NavState | null)?.player ?? null);

  // A page opened straight on an inner tab (shared link, bookmark) gets Home beneath it,
  // so Back goes to Home first rather than off the site
  const historySeeded = useRef(false);
  useEffect(() => {
    if (historySeeded.current || window.history.state) return;
    historySeeded.current = true;
    const tab = tabFromUrl();
    window.history.replaceState({ tab: 'home', player: null } satisfies NavState, '', urlForTab('home'));
    if (tab !== 'home') window.history.pushState({ tab, player: null } satisfies NavState, '', urlForTab(tab));
  }, []);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as NavState | null;
      setActiveTabState(state?.tab ?? tabFromUrl());
      setViewedPlayer(state?.player ?? null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((tab: AppTab, player: Player | null) => {
    window.history.pushState({ tab, player } satisfies NavState, '', urlForTab(tab));
    setActiveTabState(tab);
    setViewedPlayer(player);
    window.scrollTo(0, 0);
  }, []);

  const setActiveTab = useCallback((tab: AppTab) => {
    if (tab !== activeTab || viewedPlayer) navigate(tab, null);
  }, [activeTab, viewedPlayer, navigate]);

  const openPlayer = useCallback((player: Player) => navigate(activeTab, player), [activeTab, navigate]);

  // Closing a profile is the same as pressing Back when the profile has its own entry
  const closePlayer = useCallback(() => {
    if ((window.history.state as NavState | null)?.player) window.history.back();
    else setViewedPlayer(null);
  }, []);
  const [matchDayFilter, setMatchDayFilter] = useState<MatchDayFilter>(ALL_DAYS);
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [viewMode, setViewMode] = useState<ViewMode>(() => (window.innerWidth < 768 ? 'mobile' : 'desktop'));

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications);
      setUnreadNotificationsCount(res.unreadCount);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshNotifications();
    const timer = setInterval(refreshNotifications, 15000);
    return () => clearInterval(timer);
  }, [refreshNotifications]);

  // Sync defaultClubId from user profile if changed
  useEffect(() => {
    if (user?.defaultClubId && !localStorage.getItem('xgame_default_club_id')) {
      setDefaultClubId(user.defaultClubId);
      localStorage.setItem('xgame_default_club_id', user.defaultClubId);
    }
  }, [user?.defaultClubId]);

  const selectedClub = useMemo(() => {
    if (!clubs || clubs.length === 0) return undefined;
    if (selectedClubId) {
      const match = clubs.find((c) => c.id === selectedClubId);
      if (match) return match;
    }
    if (defaultClubId) {
      const defaultMatch = clubs.find((c) => c.id === defaultClubId);
      if (defaultMatch) return defaultMatch;
    }
    return clubs[0];
  }, [clubs, selectedClubId, defaultClubId]);

  const clubId = selectedClub?.id;

  const selectClub = useCallback((id: string) => {
    setSelectedClubId(id);
    setQueryParam(CLUB_QUERY_PARAM, id);
  }, []);

  const handleSetDefaultClub = useCallback(async (id: string) => {
    setDefaultClubId(id);
    localStorage.setItem('xgame_default_club_id', id);
    selectClub(id);
    try {
      await api.setDefaultClub(id);
    } catch (err) {
      console.warn('Failed to persist default club to server:', err);
    }
  }, [selectClub]);

  // Loads the account's clubs. An invite link (?join=CODE) is redeemed first.
  const loadClubs = useCallback(async () => {
    setError(null);
    try {
      const inviteCode = new URLSearchParams(window.location.search).get(JOIN_QUERY_PARAM);
      let joinedId: string | null = null;
      if (inviteCode) {
        setQueryParam(JOIN_QUERY_PARAM, null);
        try {
          joinedId = (await api.joinClub(inviteCode)).id;
        } catch (err) {
          window.alert(`Không tham gia được CLB: ${errorMessage(err)}`);
        }
      }
      setClubs(await api.getClubs());
      if (joinedId) selectClub(joinedId);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [selectClub]);

  const loadClubData = useCallback(async (id: string) => {
    const [clubPlayers, clubMatches] = await Promise.all([api.getPlayers(id), api.getMatches(id)]);
    return { clubPlayers, clubMatches };
  }, []);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  // Load the selected club's members and matches
  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    loadClubData(clubId)
      .then(({ clubPlayers, clubMatches }) => {
        if (cancelled) return;
        setPlayers(clubPlayers);
        setMatches(clubMatches);
        setLoadedClubId(clubId);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [clubId, loadClubData]);

  // Auto-detect Mobile vs Desktop viewport
  useEffect(() => {
    const handleResize = () => {
      setViewMode(window.innerWidth < 768 ? 'mobile' : 'desktop');
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Used by the screens below and by the context: add the club to the list and open it
  const openClub = async (club: ClubInfo): Promise<ClubInfo> => {
    setClubs(await api.getClubs());
    selectClub(club.id);
    return club;
  };
  const createClub = async (input: NewClubInput) => openClub(await api.createClub(input));
  const joinClub = async (code: string) => openClub(await api.joinClub(code));

  if (error) {
    return (
      <StatusScreen
        message={error}
        onRetry={() => {
          // Start over from the club list (the account may have left or lost the club)
          setLoadedClubId(null);
          setClubs(null);
          loadClubs();
        }}
      />
    );
  }
  if (!clubs) {
    return <StatusScreen message="Đang tải dữ liệu từ máy chủ..." />;
  }
  if (!selectedClub) {
    return <ClubOnboarding user={user} onCreate={createClub} onJoin={joinClub} onLogout={logout} />;
  }
  // Never render one club's screens with another club's data
  if (loadedClubId !== selectedClub.id) {
    return <StatusScreen message="Đang tải dữ liệu câu lạc bộ..." />;
  }

  const refreshClub = async () => {
    const [nextClubs, { clubPlayers, clubMatches }] = await Promise.all([
      api.getClubs(),
      loadClubData(selectedClub.id),
    ]);
    setClubs(nextClubs);
    setPlayers(clubPlayers);
    setMatches(clubMatches);
  };

  const getPlayerById = (id: string) => players.find((p) => p.id === id);

  const addNewPlayer = async (name: string, doublesRating: number, singlesRating: number, email?: string): Promise<Player> => {
    const player = await api.createPlayer({
      name: name.trim(),
      email: email?.trim() || undefined,
      clubId: selectedClub.id,
      doublesRating: parseFloat(doublesRating.toFixed(3)),
      singlesRating: parseFloat(singlesRating.toFixed(3)),
    });
    await refreshClub();
    return player;
  };

  const updateClub = async (patch: Partial<Pick<ClubInfo, 'name' | 'description'>>) => {
    await api.updateClub(selectedClub.id, patch);
    await refreshClub();
  };

  const removePlayer = async (id: string) => {
    await api.removePlayer(id);
    await refreshClub();
  };

  const updatePlayerRole = async (id: string, role: ClubRole) => {
    await api.updatePlayerRole(id, role);
    await refreshClub();
  };

  const deleteClub = async () => {
    await api.deleteClub(selectedClub.id);
    setQueryParam(CLUB_QUERY_PARAM, null);
    setSelectedClubId(null);
    setActiveTab('home');
    setClubs(await api.getClubs());
  };

  const updateMyProfile = async (name: string, doublesRating: number, singlesRating: number, avatar?: string) => {
    setCurrentUser(await api.updateMe({ name, avatar, doublesRating, singlesRating, clubId: selectedClub.id }));
    await refreshClub();
  };

  // The server stores the match and updates the participants' ratings and records
  const recordNewMatch = async (newMatch: MatchResult & { isSubsequentMatch?: boolean }) => {
    const result = await api.recordMatch(selectedClub.id, newMatch);
    await Promise.all([refreshClub(), refreshNotifications()]);
    return result;
  };

  const updateMatch = async (matchId: string, updatedMatch: MatchResult) => {
    await api.updateMatch(matchId, { ...updatedMatch, clubId: selectedClub.id });
    await Promise.all([refreshClub(), refreshNotifications()]);
  };

  const deleteMatch = async (matchId: string) => {
    await api.deleteMatch(matchId);
    await refreshClub();
  };

  const markNotificationRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('markNotificationRead error:', err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadNotificationsCount(0);
    } catch (err) {
      console.error('markAllNotificationsRead error:', err);
    }
  };

  const confirmMatch = async (matchId: string, playerId?: string) => {
    const updated = await api.confirmMatch(matchId, playerId);
    setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    await refreshNotifications();
  };

  const appealMatch = async (matchId: string, reason: string) => {
    const updated = await api.appealMatch(matchId, reason);
    setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    await refreshNotifications();
  };

  return (
    <PickleballContext.Provider
      value={{
        clubs,
        selectedClub,
        setSelectedClub: (club) => selectClub(club.id),
        defaultClubId,
        setDefaultClub: handleSetDefaultClub,
        players,
        matches,
        myPlayer: players.find((p) => p.userId === user.id) || null,
        isManager: selectedClub.myRole === 'owner' || selectedClub.myRole === 'admin',
        activeTab,
        setActiveTab,
        // The history entry keeps a snapshot; show the member's current record when they are loaded
        viewedPlayer: viewedPlayer ? players.find((p) => p.id === viewedPlayer.id) ?? viewedPlayer : null,
        openPlayer,
        closePlayer,
        matchDayFilter,
        setMatchDayFilter,
        viewMode,
        setViewMode,
        lang,
        setLang,
        refreshClub,
        recordNewMatch,
        updateMatch,
        deleteMatch,
        addNewPlayer,
        getPlayerById,
        updateClub,
        removePlayer,
        updatePlayerRole,
        createClub,
        joinClub,
        deleteClub,
        updateMyProfile,
        notifications,
        unreadNotificationsCount,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        confirmMatch,
        appealMatch,
      }}
    >
      {children}
    </PickleballContext.Provider>
  );
};

export const usePickleball = () => {
  const context = useContext(PickleballContext);
  if (!context) {
    throw new Error('usePickleball must be used within a PickleballProvider');
  }
  return context;
};
