import React, { useState, useMemo, useEffect, useRef } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { ScoringType, Player, LiveCourtState, LiveCourtPlayer } from '../types/pickleball';
import { api } from '../services/api';
import { 
  RotateCcw, 
  ArrowLeftRight, 
  Trophy, 
  Volume2, 
  VolumeX, 
  Sparkles,
  ArrowRight,
  Users,
  Check,
  ChevronDown,
  ChevronUp,
  Radio,
  Eye,
  Share2,
  Maximize2,
  Minimize2,
  PlayCircle,
  Tv,
  Edit3,
  Plus,
  Flag,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ScoreHistoryItem {
  score1: number;
  score2: number;
  serverNumber: 1 | 2;
  servingTeam: 1 | 2;
  t1Right: LiveCourtPlayer;
  t1Left: LiveCourtPlayer;
  t2Right: LiveCourtPlayer;
  t2Left: LiveCourtPlayer;
  activeServerId: string;
}

export const CourtsideScoreboard: React.FC = () => {
  const { lang, setActiveTab, selectedClub, players, myPlayer } = usePickleball();

  // Dynamically generate courts based on club's actual courtsCount setting
  const courtsPresets = useMemo(() => {
    const count = Math.max(1, selectedClub.courtsCount || 4);
    const list = [];
    for (let i = 1; i <= count; i++) {
      list.push({
        idSuffix: `court-${i}`,
        name: i === 1 ? 'Sân Số 1 (Center Court)' : `Sân Số ${i}`,
      });
    }
    return list;
  }, [selectedClub.courtsCount]);

  // Read URL query params on mount for direct share links (?court=...&mode=spectator)
  const initialParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const courtParam = params.get('court');
    const modeParam = params.get('mode');
    return {
      courtId: courtParam || `${selectedClub.id}-court-1`,
      isSpectator: modeParam === 'spectator',
    };
  }, [selectedClub.id]);

  const [courtId, setCourtId] = useState<string>(initialParams.courtId);
  const [courtName, setCourtName] = useState<string>('Sân Số 1 (Center Court)');
  const [isSpectator, setIsSpectator] = useState<boolean>(initialParams.isSpectator);
  const [spectatorsCount, setSpectatorsCount] = useState<number>(1);
  const [activeCourtsList, setActiveCourtsList] = useState<LiveCourtState[]>([]);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [scoringType, setScoringType] = useState<ScoringType>('sideout');
  const [targetScore, setTargetScore] = useState<number>(11);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showRosterConfig, setShowRosterConfig] = useState<boolean>(false);

  // Initialize 4 players on court
  const defaultPlayers: LiveCourtPlayer[] = useMemo(() => {
    const list: LiveCourtPlayer[] = [];
    for (let i = 0; i < 4; i++) {
      if (players[i]) {
        list.push({
          id: players[i].id,
          name: players[i].name,
          avatar: players[i].avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(players[i].name)}`,
          doublesRating: players[i].doublesRating,
        });
      }
    }
    const fallbacks: LiveCourtPlayer[] = [
      { id: 'p1', name: 'Minh Quân', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MinhQuan', doublesRating: 3.5 },
      { id: 'p2', name: 'Thu Hương', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ThuHuong', doublesRating: 3.5 },
      { id: 'p3', name: 'Hoàng Long', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=HoangLong', doublesRating: 3.5 },
      { id: 'p4', name: 'Tuấn Anh', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TuanAnh', doublesRating: 3.5 },
    ];
    while (list.length < 4) {
      list.push(fallbacks[list.length]);
    }
    return list;
  }, [players]);

  // Positions on court:
  // Team 1: Right court (Even) & Left court (Odd)
  const [t1Right, setT1Right] = useState<LiveCourtPlayer>(defaultPlayers[0]);
  const [t1Left, setT1Left] = useState<LiveCourtPlayer>(defaultPlayers[1]);
  // Team 2: Right court (Even) & Left court (Odd)
  const [t2Right, setT2Right] = useState<LiveCourtPlayer>(defaultPlayers[2]);
  const [t2Left, setT2Left] = useState<LiveCourtPlayer>(defaultPlayers[3]);

  // Game state
  const [score1, setScore1] = useState<number>(0);
  const [score2, setScore2] = useState<number>(0);
  const [servingTeam, setServingTeam] = useState<1 | 2>(1);
  // In side-out doubles, first service begins as server 2 (rule 0-0-2)
  const [serverNumber, setServerNumber] = useState<1 | 2>(2);
  const [activeServerId, setActiveServerId] = useState<string>(defaultPlayers[0].id);

  // Auto-sync real club players when loaded from server
  useEffect(() => {
    if (players.length >= 4 && (t1Right.id === 'p1' || !t1Right.id)) {
      setT1Right(defaultPlayers[0]);
      setT1Left(defaultPlayers[1]);
      setT2Right(defaultPlayers[2]);
      setT2Left(defaultPlayers[3]);
      setActiveServerId(defaultPlayers[0].id);
    }
  }, [players, defaultPlayers]);

  // Undo history stack
  const [history, setHistory] = useState<ScoreHistoryItem[]>([]);

  const team1Name = `${t1Right.name} / ${t1Left.name}`;
  const team2Name = `${t2Right.name} / ${t2Left.name}`;

  const isGameOver = (score1 >= targetScore || score2 >= targetScore) && Math.abs(score1 - score2) >= 2;
  const isGamePoint = !isGameOver && ((score1 >= targetScore - 1 && score1 > score2) || (score2 >= targetScore - 1 && score2 > score1));

  // Determine current server and receiver based on court positions and serving state
  const { currentServer, currentReceiver, serverCourtSide, receiverCourtSide } = useMemo(() => {
    let server: LiveCourtPlayer;
    let receiver: LiveCourtPlayer;
    let sSide: 'right' | 'left';
    let rSide: 'right' | 'left';

    if (servingTeam === 1) {
      if (activeServerId === t1Left.id) {
        server = t1Left;
        sSide = 'left';
        receiver = t2Left;
        rSide = 'left';
      } else {
        server = t1Right;
        sSide = 'right';
        receiver = t2Right;
        rSide = 'right';
      }
    } else {
      if (activeServerId === t2Left.id) {
        server = t2Left;
        sSide = 'left';
        receiver = t1Left;
        rSide = 'left';
      } else {
        server = t2Right;
        sSide = 'right';
        receiver = t1Right;
        rSide = 'right';
      }
    }

    return {
      currentServer: server,
      currentReceiver: receiver,
      serverCourtSide: sSide,
      receiverCourtSide: rSide,
    };
  }, [servingTeam, activeServerId, t1Right, t1Left, t2Right, t2Left]);

  // Audio simulation
  const playBeep = (freq = 440, duration = 0.1) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // AudioContext fallback
    }
  };

  // BROADCAST TO SERVER (When in Referee/Scorer Mode)
  const broadcastState = useRef<(overrides?: Partial<LiveCourtState>) => void>(() => {});
  broadcastState.current = (overrides?: Partial<LiveCourtState>) => {
    if (isSpectator) return;
    const payload: Partial<LiveCourtState> = {
      courtName,
      clubId: selectedClub.id,
      clubName: selectedClub.name,
      scoringType,
      targetScore,
      score1,
      score2,
      serverNumber,
      servingTeam,
      t1Right,
      t1Left,
      t2Right,
      t2Left,
      activeServerId,
      isGameOver,
      winnerTeam: isGameOver ? (score1 > score2 ? 1 : 2) : null,
      scorerName: myPlayer ? myPlayer.name : 'Trọng tài',
      ...overrides,
    };
    api.updateLiveCourt(courtId, payload).catch((err) => {
      console.warn('Real-time sync broadcast error:', err);
    });
  };

  // Apply state received from server (For Spectators)
  const lastStateRef = useRef<{ s1: number; s2: number; gameOver: boolean }>({ s1: 0, s2: 0, gameOver: false });
  const applyRemoteState = (data: LiveCourtState) => {
    if (!data) return;
    if (data.courtName) setCourtName(data.courtName);
    if (data.scoringType) setScoringType(data.scoringType);
    if (data.targetScore) setTargetScore(data.targetScore);
    if (data.t1Right) setT1Right(data.t1Right);
    if (data.t1Left) setT1Left(data.t1Left);
    if (data.t2Right) setT2Right(data.t2Right);
    if (data.t2Left) setT2Left(data.t2Left);
    if (data.servingTeam) setServingTeam(data.servingTeam);
    if (data.serverNumber) setServerNumber(data.serverNumber);
    if (data.activeServerId) setActiveServerId(data.activeServerId);
    if (typeof data.spectatorsCount === 'number') setSpectatorsCount(data.spectatorsCount);

    // Audio cue on point change for spectators
    if (data.score1 !== lastStateRef.current.s1 || data.score2 !== lastStateRef.current.s2) {
      playBeep(520, 0.12);
    }
    // Confetti on game win
    if (data.isGameOver && !lastStateRef.current.gameOver) {
      triggerConfetti();
    }

    lastStateRef.current = { s1: data.score1, s2: data.score2, gameOver: data.isGameOver };
    setScore1(data.score1);
    setScore2(data.score2);
  };

  // State for court switching and match actions
  const [isLoadingCourt, setIsLoadingCourt] = useState<boolean>(false);
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);
  const [courtToast, setCourtToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setCourtToast(msg);
    setTimeout(() => setCourtToast(null), 3500);
  };

  // Switch court smoothly and fetch its active state or reset cleanly
  const selectCourt = async (targetCourtId: string, targetCourtName?: string) => {
    if (targetCourtId === courtId) return;
    setIsLoadingCourt(true);

    const preset = courtsPresets.find(p => `${selectedClub.id}-${p.idSuffix}` === targetCourtId);
    const resolvedName = targetCourtName || preset?.name || targetCourtId;

    setCourtId(targetCourtId);
    setCourtName(resolvedName);
    setHistory([]);

    // Update URL query param cleanly without reload
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('court', targetCourtId);
      window.history.replaceState({}, '', url.toString());
    } catch {}

    // Check if target court has active match on server
    try {
      const live = await api.getLiveCourt(targetCourtId);
      if (live && !live.isGameOver && live.isActive !== false) {
        applyRemoteState(live);
        setIsLoadingCourt(false);
        showToast(`Đã chuyển sang ${resolvedName} (Trận đấu đang diễn ra: ${live.score1} - ${live.score2})`);
        return;
      }
    } catch {
      // 404: No active match on this court
    }

    // Target court is empty -> Cleanly reset local state to 0 - 0 with default club players
    setScore1(0);
    setScore2(0);
    setServingTeam(1);
    setServerNumber(2);
    setT1Right(defaultPlayers[0]);
    setT1Left(defaultPlayers[1]);
    setT2Right(defaultPlayers[2]);
    setT2Left(defaultPlayers[3]);
    setActiveServerId(defaultPlayers[0].id);
    setIsLoadingCourt(false);
    showToast(`Đã chuyển sang ${resolvedName} (Sân trống - Sẵn sàng tạo trận)`);
  };

  // Start a fresh new match on current court
  const startNewMatchOnCourt = (customPlayers?: LiveCourtPlayer[]) => {
    if (isSpectator) return;
    const p1 = customPlayers?.[0] || t1Right || defaultPlayers[0];
    const p2 = customPlayers?.[1] || t1Left || defaultPlayers[1];
    const p3 = customPlayers?.[2] || t2Right || defaultPlayers[2];
    const p4 = customPlayers?.[3] || t2Left || defaultPlayers[3];

    setScore1(0);
    setScore2(0);
    setServingTeam(1);
    setServerNumber(2);
    setT1Right(p1);
    setT1Left(p2);
    setT2Right(p3);
    setT2Left(p4);
    setActiveServerId(p1.id);
    setHistory([]);

    broadcastState.current({
      score1: 0,
      score2: 0,
      servingTeam: 1,
      serverNumber: 2,
      t1Right: p1,
      t1Left: p2,
      t2Right: p3,
      t2Left: p4,
      activeServerId: p1.id,
      isGameOver: false,
      winnerTeam: null,
      lastAction: 'start_new_match',
    });

    showToast(`Đã tạo và bắt đầu trận đấu mới trên ${courtName}!`);

    // Refetch active courts list immediately
    setTimeout(() => {
      api.getLiveCourts(selectedClub.id).then((list) => {
        if (Array.isArray(list)) setActiveCourtsList(list);
      }).catch(() => {});
    }, 300);
  };

  // Finish current match and release the court
  const finishCurrentMatch = async () => {
    try {
      await api.finishLiveCourt(courtId);
      setShowFinishModal(false);
      setScore1(0);
      setScore2(0);
      setServingTeam(1);
      setServerNumber(2);
      setHistory([]);

      const updatedCourts = await api.getLiveCourts(selectedClub.id);
      if (Array.isArray(updatedCourts)) setActiveCourtsList(updatedCourts);

      showToast(`Đã kết thúc trận đấu trên ${courtName}. Sân đã được giải phóng!`);
    } catch (err) {
      console.error('Error finishing court:', err);
    }
  };

  // REAL-TIME SSE & POLLING SYNCHRONIZATION
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: any = null;

    // Load initial court state for both referee and spectator
    const loadCourtInitial = async () => {
      try {
        const live = await api.getLiveCourt(courtId);
        if (live && !live.isGameOver && live.isActive !== false) {
          applyRemoteState(live);
        }
      } catch {}
    };
    loadCourtInitial();

    // Connect Server-Sent Events (SSE) for instant pushes (< 50ms)
    try {
      const streamUrl = api.getLiveStreamUrl(courtId, selectedClub.id);
      eventSource = new EventSource(streamUrl);

      eventSource.addEventListener('court_update', (e) => {
        try {
          const data: LiveCourtState = JSON.parse(e.data);
          if (data && data.id === courtId) {
            if (isSpectator) {
              applyRemoteState(data);
            } else if (typeof data.spectatorsCount === 'number') {
              setSpectatorsCount(data.spectatorsCount);
            }
          }
        } catch (err) {
          console.error('SSE court_update parse error:', err);
        }
      });

      eventSource.addEventListener('courts_list', (e) => {
        try {
          const list: LiveCourtState[] = JSON.parse(e.data);
          if (Array.isArray(list)) setActiveCourtsList(list);
        } catch {}
      });

      eventSource.onerror = () => {
        // SSE auto-reconnect fallback
      };
    } catch {}

    // Polling fallback & active courts refresher
    const fetchLatest = async () => {
      try {
        if (isSpectator) {
          const live = await api.getLiveCourt(courtId);
          if (live) applyRemoteState(live);
        }
        const courts = await api.getLiveCourts(selectedClub.id);
        if (Array.isArray(courts)) setActiveCourtsList(courts);
      } catch {}
    };

    fetchLatest();
    pollInterval = setInterval(fetchLatest, isSpectator ? 1800 : 3500);

    return () => {
      eventSource?.close();
      clearInterval(pollInterval);
    };
  }, [courtId, selectedClub.id, isSpectator]);

  const pushState = () => {
    setHistory((prev) => [
      ...prev,
      { score1, score2, serverNumber, servingTeam, t1Right, t1Left, t2Right, t2Left, activeServerId },
    ]);
  };

  const handleUndo = () => {
    if (history.length === 0 || isSpectator) return;
    const last = history[history.length - 1];
    setScore1(last.score1);
    setScore2(last.score2);
    setServerNumber(last.serverNumber);
    setServingTeam(last.servingTeam);
    setT1Right(last.t1Right);
    setT1Left(last.t1Left);
    setT2Right(last.t2Right);
    setT2Left(last.t2Left);
    setActiveServerId(last.activeServerId);
    setHistory((prev) => prev.slice(0, prev.length - 1));

    broadcastState.current({
      score1: last.score1,
      score2: last.score2,
      serverNumber: last.serverNumber,
      servingTeam: last.servingTeam,
      t1Right: last.t1Right,
      t1Left: last.t1Left,
      t2Right: last.t2Right,
      t2Left: last.t2Left,
      activeServerId: last.activeServerId,
      isGameOver: false,
      lastAction: 'undo',
    });
  };

  const handlePointTeam1 = () => {
    if (isGameOver || isSpectator) return;
    pushState();

    let nextScore = score1;
    let nextT1Right = t1Right;
    let nextT1Left = t1Left;
    let nextServingTeam = servingTeam;
    let nextServerNumber = serverNumber;
    let nextActiveServerId = activeServerId;

    if (scoringType === 'rally') {
      nextScore = score1 + 1;
      setScore1(nextScore);
      if (servingTeam === 1) {
        nextT1Right = t1Left;
        nextT1Left = t1Right;
        setT1Right(nextT1Right);
        setT1Left(nextT1Left);
      } else {
        nextServingTeam = 1;
        setServingTeam(1);
        nextActiveServerId = nextScore % 2 === 0 ? t1Right.id : t1Left.id;
        setActiveServerId(nextActiveServerId);
      }
      playBeep(520, 0.12);
      checkWin(nextScore, score2);
    } else {
      // Side-out scoring
      if (servingTeam === 1) {
        nextScore = score1 + 1;
        setScore1(nextScore);
        nextT1Right = t1Left;
        nextT1Left = t1Right;
        setT1Right(nextT1Right);
        setT1Left(nextT1Left);
        playBeep(580, 0.15);
        checkWin(nextScore, score2);
      } else {
        handleSideOut();
        return;
      }
    }

    broadcastState.current({
      score1: nextScore,
      t1Right: nextT1Right,
      t1Left: nextT1Left,
      servingTeam: nextServingTeam,
      serverNumber: nextServerNumber,
      activeServerId: nextActiveServerId,
      isGameOver: (nextScore >= targetScore || score2 >= targetScore) && Math.abs(nextScore - score2) >= 2,
      lastAction: 'point_team1',
    });
  };

  const handlePointTeam2 = () => {
    if (isGameOver || isSpectator) return;
    pushState();

    let nextScore = score2;
    let nextT2Right = t2Right;
    let nextT2Left = t2Left;
    let nextServingTeam = servingTeam;
    let nextServerNumber = serverNumber;
    let nextActiveServerId = activeServerId;

    if (scoringType === 'rally') {
      nextScore = score2 + 1;
      setScore2(nextScore);
      if (servingTeam === 2) {
        nextT2Right = t2Left;
        nextT2Left = t2Right;
        setT2Right(nextT2Right);
        setT2Left(nextT2Left);
      } else {
        nextServingTeam = 2;
        setServingTeam(2);
        nextActiveServerId = nextScore % 2 === 0 ? t2Right.id : t2Left.id;
        setActiveServerId(nextActiveServerId);
      }
      playBeep(480, 0.12);
      checkWin(score1, nextScore);
    } else {
      // Side-out scoring
      if (servingTeam === 2) {
        nextScore = score2 + 1;
        setScore2(nextScore);
        nextT2Right = t2Left;
        nextT2Left = t2Right;
        setT2Right(nextT2Right);
        setT2Left(nextT2Left);
        playBeep(580, 0.15);
        checkWin(score1, nextScore);
      } else {
        handleSideOut();
        return;
      }
    }

    broadcastState.current({
      score2: nextScore,
      t2Right: nextT2Right,
      t2Left: nextT2Left,
      servingTeam: nextServingTeam,
      serverNumber: nextServerNumber,
      activeServerId: nextActiveServerId,
      isGameOver: (score1 >= targetScore || nextScore >= targetScore) && Math.abs(score1 - nextScore) >= 2,
      lastAction: 'point_team2',
    });
  };

  const handleSideOut = () => {
    if (isSpectator) return;
    playBeep(320, 0.15);

    let nextServerNumber: 1 | 2 = serverNumber;
    let nextServingTeam: 1 | 2 = servingTeam;
    let nextActiveServerId = activeServerId;

    if (serverNumber === 1) {
      nextServerNumber = 2;
      setServerNumber(2);
      if (servingTeam === 1) {
        nextActiveServerId = activeServerId === t1Right.id ? t1Left.id : t1Right.id;
      } else {
        nextActiveServerId = activeServerId === t2Right.id ? t2Left.id : t2Right.id;
      }
      setActiveServerId(nextActiveServerId);
    } else {
      nextServerNumber = 1;
      setServerNumber(1);
      nextServingTeam = servingTeam === 1 ? 2 : 1;
      setServingTeam(nextServingTeam);

      if (nextServingTeam === 1) {
        nextActiveServerId = score1 % 2 === 0 ? t1Right.id : t1Left.id;
      } else {
        nextActiveServerId = score2 % 2 === 0 ? t2Right.id : t2Left.id;
      }
      setActiveServerId(nextActiveServerId);
    }

    broadcastState.current({
      serverNumber: nextServerNumber,
      servingTeam: nextServingTeam,
      activeServerId: nextActiveServerId,
      lastAction: 'side_out',
    });
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#059669', '#84cc16', '#0284c7', '#f59e0b', '#ec4899'],
      });
    } catch {}
  };

  const checkWin = (s1: number, s2: number) => {
    if ((s1 >= targetScore || s2 >= targetScore) && Math.abs(s1 - s2) >= 2) {
      triggerConfetti();
    }
  };

  const resetGame = () => {
    if (isSpectator) return;
    setScore1(0);
    setScore2(0);
    setServingTeam(1);
    setServerNumber(2);
    setT1Right(defaultPlayers[0]);
    setT1Left(defaultPlayers[1]);
    setT2Right(defaultPlayers[2]);
    setT2Left(defaultPlayers[3]);
    setActiveServerId(defaultPlayers[0].id);
    setHistory([]);

    broadcastState.current({
      score1: 0,
      score2: 0,
      servingTeam: 1,
      serverNumber: 2,
      t1Right: defaultPlayers[0],
      t1Left: defaultPlayers[1],
      t2Right: defaultPlayers[2],
      t2Left: defaultPlayers[3],
      activeServerId: defaultPlayers[0].id,
      isGameOver: false,
      lastAction: 'reset',
    });
  };

  const swapTeam1Court = () => {
    if (isSpectator) return;
    const r = t1Left;
    const l = t1Right;
    setT1Right(r);
    setT1Left(l);
    broadcastState.current({ t1Right: r, t1Left: l, lastAction: 'swap_team1' });
  };

  const swapTeam2Court = () => {
    if (isSpectator) return;
    const r = t2Left;
    const l = t2Right;
    setT2Right(r);
    setT2Left(l);
    broadcastState.current({ t2Right: r, t2Left: l, lastAction: 'swap_team2' });
  };

  const getCallString = () => {
    if (scoringType === 'rally') {
      return `${score1} — ${score2}`;
    }
    const serverScore = servingTeam === 1 ? score1 : score2;
    const receiverScore = servingTeam === 1 ? score2 : score1;
    return `${serverScore} - ${receiverScore} - ${serverNumber}`;
  };

  // Copy share live link
  const handleCopyShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'scoreboard');
    url.searchParams.set('court', courtId);
    url.searchParams.set('mode', 'spectator');
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    });
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        maxWidth: 1040, 
        margin: '0 auto', 
        padding: isFullscreen ? '24px 20px 60px' : '16px 12px 60px',
        background: isFullscreen ? '#0b1320' : 'transparent',
        minHeight: isFullscreen ? '100vh' : 'auto',
      }}
    >
      <style>{`
        @keyframes serverPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(190, 242, 100, 0.8), 0 0 15px rgba(190, 242, 100, 0.5);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(190, 242, 100, 0), 0 0 25px rgba(190, 242, 100, 0.8);
            transform: scale(1.04);
          }
        }
        @keyframes liveBlink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.9); }
        }
        @keyframes serveTrajectory {
          to {
            stroke-dashoffset: -28;
          }
        }
        @keyframes ballBounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(180deg); }
        }
      `}</style>

      {/* 0. MULTI-COURT & REALTIME BROADCAST BAR */}
      <div className="card" style={{
        marginBottom: 14,
        padding: '12px 16px',
        borderRadius: 18,
        background: isSpectator ? '#0f172a' : '#ffffff',
        color: isSpectator ? '#ffffff' : '#0f172a',
        border: isSpectator ? '1.5px solid #334155' : '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        boxShadow: isSpectator ? '0 8px 32px rgba(0,0,0,0.4)' : 'var(--shadow-sm)',
      }}>
        {/* Left: Court Selector & Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: isSpectator ? '#e11d48' : '#059669',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: '0.74rem',
            fontWeight: 900,
            letterSpacing: '0.04em',
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#ffffff',
              animation: 'liveBlink 1.2s infinite ease-in-out',
            }} />
            <span>{isSpectator ? 'ĐANG XEM TRỰC TIẾP' : 'ĐANG PHÁT SÓNG'}</span>
          </div>

          {/* Court Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', color: isSpectator ? '#94a3b8' : '#64748b', fontWeight: 700 }}>
              Sân:
            </span>
            <select
              value={courtId}
              onChange={(e) => {
                selectCourt(e.target.value);
              }}
              style={{
                background: isSpectator ? '#1e293b' : '#f8fafc',
                color: isSpectator ? '#ffffff' : '#0f172a',
                border: isSpectator ? '1px solid #475569' : '1px solid #cbd5e1',
                padding: '5px 12px',
                borderRadius: 999,
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {courtsPresets.map((c) => {
                const fullId = `${selectedClub.id}-${c.idSuffix}`;
                const live = activeCourtsList.find(a => a.id === fullId);
                const liveLabel = live ? ` (${live.score1}-${live.score2}) 🔴` : '';
                return (
                  <option key={fullId} value={fullId}>
                    {c.name}{liveLabel}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Spectator count badge */}
          <div style={{
            fontSize: '0.75rem',
            color: isSpectator ? '#94a3b8' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <Eye size={14} color={isSpectator ? '#38bdf8' : '#059669'} />
            <span>{spectatorsCount} người xem trực tiếp</span>
          </div>
        </div>

        {/* Right: Mode Switcher & Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Mode Switch: Umpire vs Spectator */}
          <div style={{
            display: 'flex',
            background: isSpectator ? '#1e293b' : '#f1f5f9',
            padding: 2,
            borderRadius: 999,
            border: isSpectator ? '1px solid #334155' : '1px solid #e2e8f0',
          }}>
            <button
              onClick={() => {
                setIsSpectator(false);
                broadcastState.current();
              }}
              style={{
                padding: '4px 12px',
                borderRadius: 999,
                border: 'none',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: !isSpectator ? '#059669' : 'transparent',
                color: !isSpectator ? '#ffffff' : (isSpectator ? '#94a3b8' : '#64748b'),
              }}
            >
              <Edit3 size={13} />
              <span>Trọng Tài (Bấm Điểm)</span>
            </button>
            <button
              onClick={() => setIsSpectator(true)}
              style={{
                padding: '4px 12px',
                borderRadius: 999,
                border: 'none',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: isSpectator ? '#e11d48' : 'transparent',
                color: isSpectator ? '#ffffff' : '#64748b',
              }}
            >
              <Tv size={13} />
              <span>Khán Giả (Xem Trực Tiếp)</span>
            </button>
          </div>

          {/* Share Link Button */}
          <button
            onClick={handleCopyShareLink}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: isSpectator ? '1px solid #475569' : '1px solid #cbd5e1',
              background: isSpectator ? '#1e293b' : '#ffffff',
              color: isSpectator ? '#ffffff' : '#0f172a',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
            title="Sao chép link xem trực tiếp cho các máy khác"
          >
            {copiedToast ? <Check size={14} color="#059669" /> : <Share2 size={14} />}
            <span>{copiedToast ? 'Đã sao chép link!' : 'Chia sẻ link'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: isSpectator ? '1px solid #475569' : '1px solid #cbd5e1',
              background: isSpectator ? '#1e293b' : '#ffffff',
              color: isSpectator ? '#ffffff' : '#0f172a',
              cursor: 'pointer',
            }}
            title="Bật/Tắt Toàn Màn Hình (TV/iPad)"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* SPECTATOR NOTICE BANNER */}
      {isSpectator && (
        <div style={{
          marginBottom: 14,
          padding: '10px 16px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.12), rgba(2, 132, 199, 0.12))',
          border: '1px solid rgba(225, 29, 72, 0.25)',
          color: isFullscreen ? '#f1f5f9' : '#0f172a',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.1rem' }}>📡</span>
            <div>
              <strong>Chế độ Khán Giả:</strong> Bạn đang theo dõi trực tiếp từ sân. Điểm số, người phát và quỹ đạo bóng sẽ tự động nhảy thời gian thực khi trọng tài bấm điểm.
            </div>
          </div>
          <button
            onClick={() => {
              setIsSpectator(false);
              broadcastState.current();
            }}
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.74rem', borderRadius: 8 }}
          >
            Chuyển sang Bấm Điểm
          </button>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {courtToast && (
        <div style={{
          marginBottom: 12,
          padding: '10px 16px',
          borderRadius: 12,
          background: '#064030',
          color: '#bef264',
          border: '1.5px solid #059669',
          fontSize: '0.85rem',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 16px rgba(6, 64, 48, 0.3)',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <Check size={18} color="#bef264" />
          <span>{courtToast}</span>
        </div>
      )}

      {/* 0.5. MULTI-COURT COMMAND BAR & GRID SELECTOR */}
      <div className="card" style={{
        marginBottom: 16,
        padding: '14px 18px',
        borderRadius: 18,
        background: isSpectator ? '#0f172a' : '#ffffff',
        border: isSpectator ? '1.5px solid #334155' : '1px solid #e2e8f0',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>🏟️</span>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 900, color: isSpectator ? '#ffffff' : '#0f172a' }}>
                Hệ Thống Sân Đấu · Quản Lý & Chuyển Sân Tức Thì ({selectedClub.name})
              </div>
              <div style={{ fontSize: '0.74rem', color: isSpectator ? '#94a3b8' : '#64748b' }}>
                {isSpectator 
                  ? 'Bấm vào bất kỳ sân nào để theo dõi tỷ số trực tiếp thời gian thực' 
                  : 'Bấm vào bất kỳ sân nào để tạo trận hoặc tiếp tục chấm điểm. Mỗi sân hoạt động hoàn toàn độc lập.'}
              </div>
            </div>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: isSpectator ? '#1e293b' : '#ecfdf5',
            color: isSpectator ? '#38bdf8' : '#059669',
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: '0.75rem',
            fontWeight: 800,
            border: isSpectator ? '1px solid #334155' : '1px solid #a7f3d0',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669' }} />
            <span>{activeCourtsList.filter(c => !c.isGameOver && c.isActive !== false).length} / {courtsPresets.length} Sân Đang Hoạt Động</span>
          </div>
        </div>

        {/* Responsive Court Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
        }}>
          {courtsPresets.map((c) => {
            const fullId = `${selectedClub.id}-${c.idSuffix}`;
            const isSelected = courtId === fullId;
            const liveMatch = activeCourtsList.find(a => a.id === fullId && !a.isGameOver && a.isActive !== false);

            return (
              <div
                key={fullId}
                onClick={() => selectCourt(fullId, c.name)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: isSelected 
                    ? (isSpectator ? '2.5px solid #38bdf8' : '2.5px solid #059669') 
                    : (isSpectator ? '1px solid #334155' : '1px solid #e2e8f0'),
                  background: isSelected 
                    ? (isSpectator ? 'rgba(56, 189, 248, 0.12)' : '#ecfdf5') 
                    : (isSpectator ? '#1e293b' : '#f8fafc'),
                  boxShadow: isSelected 
                    ? (isSpectator ? '0 0 16px rgba(56, 189, 248, 0.25)' : '0 4px 14px rgba(5, 150, 105, 0.15)') 
                    : 'none',
                  position: 'relative',
                }}
              >
                {/* Top Row: Name and Live Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ 
                    fontSize: '0.86rem', 
                    fontWeight: 900, 
                    color: isSelected ? (isSpectator ? '#38bdf8' : '#064e3b') : (isSpectator ? '#ffffff' : '#0f172a') 
                  }}>
                    {c.name}
                  </span>

                  {liveMatch ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Warning badge if idle >= 20 minutes */}
                      {(() => {
                        const idleMins = liveMatch.updatedAt 
                          ? Math.floor((Date.now() - new Date(liveMatch.updatedAt).getTime()) / 60000) 
                          : 0;
                        if (idleMins >= 20) {
                          return (
                            <span style={{
                              background: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              padding: '1px 6px',
                              borderRadius: 999,
                              fontSize: '0.62rem',
                              fontWeight: 800,
                            }} title={`Không có thao tác nào trong ${idleMins} phút qua. Sẽ tự động giải phóng khi quá hạn.`}>
                              ⚠️ Treo {idleMins}p
                            </span>
                          );
                        }
                        return null;
                      })()}

                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: '#e11d48',
                        color: '#ffffff',
                        padding: '2px 7px',
                        borderRadius: 999,
                        fontSize: '0.66rem',
                        fontWeight: 900,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffffff', animation: 'liveBlink 1.2s infinite ease-in-out' }} />
                        LIVE
                      </span>
                    </div>
                  ) : (
                    <span style={{
                      background: isSpectator ? '#334155' : '#e2e8f0',
                      color: isSpectator ? '#94a3b8' : '#64748b',
                      padding: '2px 7px',
                      borderRadius: 999,
                      fontSize: '0.66rem',
                      fontWeight: 800,
                    }}>
                      Sân trống
                    </span>
                  )}
                </div>

                {/* Middle: Live score or Empty text */}
                {liveMatch ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ 
                        fontFamily: 'var(--font-mono)', 
                        fontSize: '1.35rem', 
                        fontWeight: 900, 
                        color: isSpectator ? '#38bdf8' : '#059669',
                        lineHeight: 1.1 
                      }}>
                        {liveMatch.score1} — {liveMatch.score2}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: isSpectator ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                        (Chạm {liveMatch.targetScore || 11})
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: isSpectator ? '#cbd5e1' : '#334155', 
                      fontWeight: 700, 
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {liveMatch.t1Right?.name?.split(' ').slice(-1) || 'Đ1'}/{liveMatch.t1Left?.name?.split(' ').slice(-1) || 'Đ1'} vs {liveMatch.t2Right?.name?.split(' ').slice(-1) || 'Đ2'}/{liveMatch.t2Left?.name?.split(' ').slice(-1) || 'Đ2'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, fontSize: '0.68rem', color: isSpectator ? '#94a3b8' : '#64748b' }}>
                      <span>Trọng tài: {liveMatch.scorerName || 'Trọng tài'}</span>
                      {liveMatch.updatedAt && (
                        <span style={{ fontSize: '0.64rem', color: isSpectator ? '#64748b' : '#94a3b8' }}>
                          {(() => {
                            const diffM = Math.floor((Date.now() - new Date(liveMatch.updatedAt).getTime()) / 60000);
                            if (diffM < 1) return 'Vừa xong';
                            if (diffM < 60) return `${diffM}p trước`;
                            return `${Math.floor(diffM / 60)}h trước`;
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '0.76rem', color: isSpectator ? '#64748b' : '#94a3b8', fontStyle: 'italic', margin: '4px 0' }}>
                      Chưa có trận đấu nào
                    </div>
                    {!isSpectator && (
                      <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 800 }}>
                        + Bấm để vào tạo trận & chấm điểm
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom: Selection Status */}
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: isSpectator ? '1px solid #334155' : '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: 800, 
                    color: isSelected ? (isSpectator ? '#38bdf8' : '#059669') : (isSpectator ? '#64748b' : '#94a3b8') 
                  }}>
                    {isSelected ? '✓ ĐANG CHỌN SÂN NÀY' : 'Chuyển sang sân này ➔'}
                  </span>
                  {isSelected && (
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: isSpectator ? '#38bdf8' : '#059669',
                    }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1. TOP HEADER & CONTROLS */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 20px', borderRadius: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-court" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                {courtName}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{selectedClub.name}</span>
              
              {/* Active match status badge on current court */}
              {activeCourtsList.some(a => a.id === courtId && !a.isGameOver && a.isActive !== false) ? (
                <span className="badge" style={{ background: '#fee2e2', color: '#e11d48', border: '1px solid #fecdd3', fontWeight: 800, fontSize: '0.72rem' }}>
                  🔴 ĐANG CÓ TRẬN ({score1} - {score2})
                </span>
              ) : (
                <span className="badge" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.72rem' }}>
                  ⚪ SÂN TRỐNG
                </span>
              )}

              {isLoadingCourt && (
                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
                  Đang tải sân...
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 900, marginTop: 4, color: '#0f172a' }}>
              {isSpectator 
                ? 'Màn Hình Trực Tiếp Trận Đấu (Live Match)' 
                : (lang === 'vi' ? 'Bảng Điểm & Sa Bàn Trực Tiếp Trên Sân' : 'Courtside Live Scoreboard & Court Simulation')}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Start New Match Button (Referee Mode Only) */}
            {!isSpectator && (
              <button
                onClick={() => startNewMatchOnCourt()}
                className="btn-court"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 999,
                }}
                title="Bắt đầu trận đấu mới trên sân này (Reset điểm về 0-0)"
              >
                <Plus size={15} strokeWidth={2.5} />
                <span>+ Bắt đầu trận mới</span>
              </button>
            )}

            {/* Finish Match Button (Referee Mode Only) */}
            {!isSpectator && (activeCourtsList.some(a => a.id === courtId && !a.isGameOver && a.isActive !== false) || score1 > 0 || score2 > 0) && (
              <button
                onClick={() => setShowFinishModal(true)}
                className="btn-secondary"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 999,
                  color: '#e11d48',
                  borderColor: '#fca5a5',
                  background: '#fff1f2',
                }}
                title="Kết thúc trận đấu và giải phóng sân này"
              >
                <Flag size={14} />
                <span>🏁 Kết thúc trận</span>
              </button>
            )}

            {/* Configure Roster Button (Only in Referee Mode) */}
            {!isSpectator && (
              <button
                onClick={() => setShowRosterConfig(!showRosterConfig)}
                className="btn-secondary"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 999,
                  background: showRosterConfig ? '#0d5e46' : '#ffffff',
                  color: showRosterConfig ? '#ffffff' : '#334155',
                }}
              >
                <Users size={15} />
                <span>{showRosterConfig ? 'Đóng xếp VĐV' : 'Xếp 4 VĐV sân'}</span>
                {showRosterConfig ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            )}

            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="btn-secondary"
              style={{ padding: '7px 11px', borderRadius: 999 }}
              title="Âm thanh tiếng bíp"
            >
              {soundEnabled ? <Volume2 size={16} color="#059669" /> : <VolumeX size={16} color="#94a3b8" />}
            </button>

            {/* Target Score */}
            <select
              value={targetScore}
              disabled={isSpectator}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setTargetScore(val);
                broadcastState.current({ targetScore: val });
              }}
              className="input-light"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem', borderRadius: 999 }}
            >
              <option value="11">Chạm 11 điểm</option>
              <option value="15">Chạm 15 điểm</option>
              <option value="21">Chạm 21 điểm</option>
            </select>

            {/* Scoring Type */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 2, borderRadius: 999, border: '1px solid #e2e8f0' }}>
              <button
                disabled={isSpectator}
                onClick={() => {
                  setScoringType('sideout');
                  broadcastState.current({ scoringType: 'sideout' });
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: isSpectator ? 'default' : 'pointer',
                  background: scoringType === 'sideout' ? '#0d5e46' : 'transparent',
                  color: scoringType === 'sideout' ? '#ffffff' : '#64748b',
                }}
              >
                Side-Out
              </button>
              <button
                disabled={isSpectator}
                onClick={() => {
                  setScoringType('rally');
                  broadcastState.current({ scoringType: 'rally' });
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: isSpectator ? 'default' : 'pointer',
                  background: scoringType === 'rally' ? '#0d5e46' : 'transparent',
                  color: scoringType === 'rally' ? '#ffffff' : '#64748b',
                }}
              >
                Rally
              </button>
            </div>
          </div>
        </div>

        {/* ROSTER CONFIGURATION DRAWER (Referee Mode Only) */}
        {!isSpectator && showRosterConfig && (
          <div style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 14,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                Chọn 4 Vận Động Viên Vào Sân Đấu (Từ Danh Sách CLB)
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Vị trí ô Phải = Giao bóng điểm chẵn, Ô Trái = Giao bóng điểm lẻ
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {/* T1 Right */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#059669', marginBottom: 4 }}>
                  ĐỘI 1 - Ô PHẢI (CHẴN):
                </label>
                <select
                  value={t1Right.id}
                  onChange={(e) => {
                    const found = players.find(p => p.id === e.target.value);
                    if (found) {
                      const updated = { id: found.id, name: found.name, avatar: found.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(found.name)}`, doublesRating: found.doublesRating };
                      setT1Right(updated);
                      broadcastState.current({ t1Right: updated });
                    }
                  }}
                  className="input-light"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                >
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.doublesRating.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              {/* T1 Left */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#059669', marginBottom: 4 }}>
                  ĐỘI 1 - Ô TRÁI (LẺ):
                </label>
                <select
                  value={t1Left.id}
                  onChange={(e) => {
                    const found = players.find(p => p.id === e.target.value);
                    if (found) {
                      const updated = { id: found.id, name: found.name, avatar: found.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(found.name)}`, doublesRating: found.doublesRating };
                      setT1Left(updated);
                      broadcastState.current({ t1Left: updated });
                    }
                  }}
                  className="input-light"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                >
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.doublesRating.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              {/* T2 Right */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#0284c7', marginBottom: 4 }}>
                  ĐỘI 2 - Ô PHẢI (CHẴN):
                </label>
                <select
                  value={t2Right.id}
                  onChange={(e) => {
                    const found = players.find(p => p.id === e.target.value);
                    if (found) {
                      const updated = { id: found.id, name: found.name, avatar: found.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(found.name)}`, doublesRating: found.doublesRating };
                      setT2Right(updated);
                      broadcastState.current({ t2Right: updated });
                    }
                  }}
                  className="input-light"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                >
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.doublesRating.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              {/* T2 Left */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#0284c7', marginBottom: 4 }}>
                  ĐỘI 2 - Ô TRÁI (LẺ):
                </label>
                <select
                  value={t2Left.id}
                  onChange={(e) => {
                    const found = players.find(p => p.id === e.target.value);
                    if (found) {
                      const updated = { id: found.id, name: found.name, avatar: found.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(found.name)}`, doublesRating: found.doublesRating };
                      setT2Left(updated);
                      broadcastState.current({ t2Left: updated });
                    }
                  }}
                  className="input-light"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                >
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.doublesRating.toFixed(2)})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. CALL SCORE BANNER & SERVE INDICATOR */}
      <div style={{
        background: 'linear-gradient(135deg, #064030, #047857)',
        borderRadius: 20,
        padding: '18px 24px',
        marginBottom: 16,
        border: '1px solid rgba(255, 255, 255, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        color: '#ffffff',
        boxShadow: '0 8px 24px rgba(6, 64, 48, 0.2)',
      }}>
        <div>
          <div style={{ fontSize: '0.74rem', color: '#a7f3d0', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            TIẾNG HÔ ĐIỂM CHUẨN (CALL SCORE):
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '2.6rem',
            fontWeight: 900,
            color: '#bef264',
            letterSpacing: '0.04em',
            lineHeight: 1.1,
          }}>
            {getCallString()}
          </div>
          <div style={{
            fontSize: '0.86rem',
            color: '#ffffff',
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}>
            <span style={{
              background: '#84cc16',
              color: '#064030',
              fontWeight: 900,
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}>
              🎾 LƯỢT PHÁT:
            </span>
            <span>
              <strong>{currentServer.name}</strong> (Đội {servingTeam}, Người phát #{serverNumber})
              từ ô <strong>{serverCourtSide === 'right' ? 'Phải (Chẵn)' : 'Trái (Lẻ)'}</strong>
            </span>
            <span style={{ color: '#bef264' }}>➔</span>
            <span>
              Phát chéo sang <strong>{currentReceiver.name}</strong> (Đội {servingTeam === 1 ? 2 : 1})
            </span>
          </div>
        </div>

        {/* Win Status / Match Point */}
        <div>
          {isGameOver ? (
            <div style={{
              background: '#ffffff',
              color: '#064e3b',
              padding: '10px 20px',
              borderRadius: 14,
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: '1.15rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
            }}>
              <Trophy size={20} color="#059669" />
              <span>{score1 > score2 ? team1Name : team2Name} THẮNG!</span>
            </div>
          ) : isGamePoint ? (
            <div style={{
              background: '#e11d48',
              color: '#ffffff',
              padding: '8px 16px',
              borderRadius: 12,
              fontWeight: 900,
              fontSize: '0.95rem',
              boxShadow: '0 0 16px rgba(225, 29, 72, 0.6)',
            }}>
              🔥 GAME POINT!
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.12)',
              padding: '8px 14px',
              borderRadius: 12,
              fontSize: '0.8rem',
              color: '#ffffff',
              textAlign: 'center',
            }}>
              Cách biệt tối thiểu 2 điểm
            </div>
          )}
        </div>
      </div>

      {/* 3. REALISTIC PICKLEBALL COURT SIMULATION */}
      <div className="card" style={{
        marginBottom: 16,
        padding: '16px',
        borderRadius: 22,
        background: '#ffffff',
        border: '1.5px solid #cbd5e1',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>🏟️</span>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                Giả Lập Vị Trí VĐV & Quỹ Đạo Phát Bóng Trên Sân Thực Tế
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Mô phỏng mặt sân chuẩn 20x44ft · Vạch trắng · Khu vực Bếp (Kitchen) · Phát bóng chéo sân
              </div>
            </div>
          </div>

          {/* Quick Swap Controls (Referee Mode Only) */}
          {!isSpectator && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={swapTeam1Court}
                className="btn-secondary"
                style={{ padding: '5px 10px', fontSize: '0.74rem', borderRadius: 8 }}
                title="Đổi vị trí đứng 2 VĐV Đội 1"
              >
                🔄 Đổi Vị Trí Đội 1
              </button>
              <button
                onClick={swapTeam2Court}
                className="btn-secondary"
                style={{ padding: '5px 10px', fontSize: '0.74rem', borderRadius: 8 }}
                title="Đổi vị trí đứng 2 VĐV Đội 2"
              >
                🔄 Đổi Vị Trí Đội 2
              </button>
            </div>
          )}
        </div>

        {/* COURT GRAPHIC CONTAINER */}
        <div style={{
          position: 'relative',
          width: '100%',
          borderRadius: 16,
          background: '#064030', // Outdoor court apron
          padding: '16px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.4)',
        }}>
          {/* Pickleball Court Playing Surface (20ft x 44ft ratio) */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: 310,
            background: '#0284c7', // Professional tournament blue surface
            borderRadius: 8,
            border: '4px solid #ffffff',
            boxSizing: 'border-box',
            display: 'flex',
          }}>
            {/* SVG OVERLAY FOR SERVE TRAJECTORY */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 20,
              }}
            >
              <defs>
                <linearGradient id="serveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#bef264" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.95" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Dynamic trajectory curve from server court to receiver court */}
              {servingTeam === 1 ? (
                serverCourtSide === 'right' ? (
                  // Team 1 Bottom Right -> Team 2 Top Right (Even side cross court)
                  <path
                    d="M 22% 75% Q 50% 25%, 78% 25%"
                    fill="none"
                    stroke="url(#serveGradient)"
                    strokeWidth="4"
                    strokeDasharray="8 6"
                    style={{ animation: 'serveTrajectory 1s linear infinite' }}
                    filter="url(#glow)"
                  />
                ) : (
                  // Team 1 Top Left -> Team 2 Bottom Left (Odd side cross court)
                  <path
                    d="M 22% 25% Q 50% 75%, 78% 75%"
                    fill="none"
                    stroke="url(#serveGradient)"
                    strokeWidth="4"
                    strokeDasharray="8 6"
                    style={{ animation: 'serveTrajectory 1s linear infinite' }}
                    filter="url(#glow)"
                  />
                )
              ) : (
                serverCourtSide === 'right' ? (
                  // Team 2 Top Right -> Team 1 Bottom Right (Even side cross court)
                  <path
                    d="M 78% 25% Q 50% 75%, 22% 75%"
                    fill="none"
                    stroke="url(#serveGradient)"
                    strokeWidth="4"
                    strokeDasharray="8 6"
                    style={{ animation: 'serveTrajectory 1s linear infinite' }}
                    filter="url(#glow)"
                  />
                ) : (
                  // Team 2 Bottom Left -> Team 1 Top Left (Odd side cross court)
                  <path
                    d="M 78% 75% Q 50% 25%, 22% 25%"
                    fill="none"
                    stroke="url(#serveGradient)"
                    strokeWidth="4"
                    strokeDasharray="8 6"
                    style={{ animation: 'serveTrajectory 1s linear infinite' }}
                    filter="url(#glow)"
                  />
                )
              )}
            </svg>

            {/* LEFT HALF: TEAM 1 (Doubles Courts + Kitchen) */}
            <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
              {/* Team 1 Baseline & Service Boxes (15ft) */}
              <div style={{ flex: '1 1 65%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {/* Center service line */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: 3,
                  background: '#ffffff',
                  transform: 'translateY(-50%)',
                  zIndex: 2,
                }} />

                {/* Team 1 TOP Court (Left / Odd Court) */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  padding: 8,
                }}>
                  <CourtPlayerToken
                    player={t1Left}
                    courtName="Ô Trái (Lẻ)"
                    teamNumber={1}
                    isServer={currentServer.id === t1Left.id}
                    isReceiver={currentReceiver.id === t1Left.id}
                    serverNumber={serverNumber}
                  />
                </div>

                {/* Team 1 BOTTOM Court (Right / Even Court) */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  padding: 8,
                }}>
                  <CourtPlayerToken
                    player={t1Right}
                    courtName="Ô Phải (Chẵn)"
                    teamNumber={1}
                    isServer={currentServer.id === t1Right.id}
                    isReceiver={currentReceiver.id === t1Right.id}
                    serverNumber={serverNumber}
                  />
                </div>
              </div>

              {/* Kitchen Line (NVZ Line, 3px white) */}
              <div style={{ width: 3, background: '#ffffff', zIndex: 5 }} />

              {/* Team 1 Kitchen Area (7ft from net) */}
              <div style={{
                flex: '0 0 35%',
                background: '#047857', // Kitchen Emerald Green
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <span style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  fontSize: '0.66rem',
                  fontWeight: 900,
                  color: 'rgba(255, 255, 255, 0.45)',
                  letterSpacing: '0.2em',
                  userSelect: 'none',
                }}>
                  KITCHEN (NVZ) 7FT
                </span>
              </div>
            </div>

            {/* CENTER NET (LƯỚI) */}
            <div style={{
              width: 14,
              background: '#1e293b',
              position: 'relative',
              zIndex: 10,
              boxShadow: '0 0 10px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              {/* Top net post */}
              <div style={{ width: 14, height: 10, background: '#94a3b8', borderRadius: 2 }} />
              {/* Net white center tape */}
              <div style={{ width: 4, height: '90%', background: '#ffffff', opacity: 0.9 }} />
              {/* Bottom net post */}
              <div style={{ width: 14, height: 10, background: '#94a3b8', borderRadius: 2 }} />
            </div>

            {/* RIGHT HALF: TEAM 2 (Kitchen + Doubles Courts) */}
            <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
              {/* Team 2 Kitchen Area (7ft from net) */}
              <div style={{
                flex: '0 0 35%',
                background: '#047857', // Kitchen Emerald Green
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <span style={{
                  writingMode: 'vertical-rl',
                  fontSize: '0.66rem',
                  fontWeight: 900,
                  color: 'rgba(255, 255, 255, 0.45)',
                  letterSpacing: '0.2em',
                  userSelect: 'none',
                }}>
                  KITCHEN (NVZ) 7FT
                </span>
              </div>

              {/* Kitchen Line (NVZ Line, 3px white) */}
              <div style={{ width: 3, background: '#ffffff', zIndex: 5 }} />

              {/* Team 2 Baseline & Service Boxes (15ft) */}
              <div style={{ flex: '1 1 65%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {/* Center service line */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: 3,
                  background: '#ffffff',
                  transform: 'translateY(-50%)',
                  zIndex: 2,
                }} />

                {/* Team 2 TOP Court (Right / Even Court facing net) */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  padding: 8,
                }}>
                  <CourtPlayerToken
                    player={t2Right}
                    courtName="Ô Phải (Chẵn)"
                    teamNumber={2}
                    isServer={currentServer.id === t2Right.id}
                    isReceiver={currentReceiver.id === t2Right.id}
                    serverNumber={serverNumber}
                  />
                </div>

                {/* Team 2 BOTTOM Court (Left / Odd Court facing net) */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  padding: 8,
                }}>
                  <CourtPlayerToken
                    player={t2Left}
                    courtName="Ô Trái (Lẻ)"
                    teamNumber={2}
                    isServer={currentServer.id === t2Left.id}
                    isReceiver={currentReceiver.id === t2Left.id}
                    serverNumber={serverNumber}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. MASSIVE TOUCH SCOREBOARD GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 20,
      }}>
        {/* TEAM 1 SIDE */}
        <div style={{
          background: servingTeam === 1 ? '#ecfdf5' : '#ffffff',
          border: servingTeam === 1 ? '3px solid #059669' : '1px solid #e2e8f0',
          borderRadius: 24,
          padding: '22px 18px',
          textAlign: 'center',
          boxShadow: servingTeam === 1 ? '0 8px 24px rgba(5, 150, 105, 0.15)' : 'var(--shadow-sm)',
          position: 'relative',
          transition: 'all 0.3s ease',
        }}>
          {/* Serving Pill */}
          {servingTeam === 1 && (
            <div style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: '#059669',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: '0.72rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <span>🎾 GIAO BÓNG (#{serverNumber})</span>
            </div>
          )}

          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>
            {team1Name}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, marginBottom: 8 }}>
            Đội 1 · {servingTeam === 1 ? `Lượt người phát: #${serverNumber} (${currentServer.name})` : 'Đang đỡ bóng'}
          </div>

          {/* Big Score Number */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '5.2rem',
            fontWeight: 900,
            lineHeight: 1,
            color: '#064e3b',
            margin: '12px 0 16px',
          }}>
            {score1}
          </div>

          {/* Touch Button (Disabled in Spectator Mode) */}
          {!isSpectator ? (
            <button
              onClick={handlePointTeam1}
              disabled={isGameOver}
              className="btn-court"
              style={{
                width: '100%',
                padding: '16px 20px',
                fontSize: '1.25rem',
                fontWeight: 900,
                borderRadius: 18,
                opacity: isGameOver ? 0.4 : 1,
              }}
            >
              +1 ĐIỂM (ĐỘI 1)
            </button>
          ) : (
            <div style={{
              padding: '12px',
              borderRadius: 14,
              background: '#f1f5f9',
              color: '#64748b',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}>
              Đang trực tiếp từ sân đấu
            </div>
          )}
        </div>

        {/* TEAM 2 SIDE */}
        <div style={{
          background: servingTeam === 2 ? '#f0f9ff' : '#ffffff',
          border: servingTeam === 2 ? '3px solid #0284c7' : '1px solid #e2e8f0',
          borderRadius: 24,
          padding: '22px 18px',
          textAlign: 'center',
          boxShadow: servingTeam === 2 ? '0 8px 24px rgba(2, 132, 199, 0.15)' : 'var(--shadow-sm)',
          position: 'relative',
          transition: 'all 0.3s ease',
        }}>
          {/* Serving Pill */}
          {servingTeam === 2 && (
            <div style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: '#0284c7',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: '0.72rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <span>🎾 GIAO BÓNG (#{serverNumber})</span>
            </div>
          )}

          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>
            {team2Name}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 700, marginBottom: 8 }}>
            Đội 2 · {servingTeam === 2 ? `Lượt người phát: #${serverNumber} (${currentServer.name})` : 'Đang đỡ bóng'}
          </div>

          {/* Big Score Number */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '5.2rem',
            fontWeight: 900,
            lineHeight: 1,
            color: '#0369a1',
            margin: '12px 0 16px',
          }}>
            {score2}
          </div>

          {/* Touch Button (Disabled in Spectator Mode) */}
          {!isSpectator ? (
            <button
              onClick={handlePointTeam2}
              disabled={isGameOver}
              style={{
                width: '100%',
                padding: '16px 20px',
                fontSize: '1.25rem',
                fontWeight: 900,
                borderRadius: 18,
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff',
                cursor: isGameOver ? 'default' : 'pointer',
                opacity: isGameOver ? 0.4 : 1,
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
              }}
            >
              +1 ĐIỂM (ĐỘI 2)
            </button>
          ) : (
            <div style={{
              padding: '12px',
              borderRadius: 14,
              background: '#f1f5f9',
              color: '#64748b',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}>
              Đang trực tiếp từ sân đấu
            </div>
          )}
        </div>
      </div>

      {/* 5. COURTSIDE ACTIONS BAR (Referee Controls) */}
      {!isSpectator && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {scoringType === 'sideout' && (
            <button
              onClick={handleSideOut}
              disabled={isGameOver}
              className="btn-secondary"
              style={{ padding: '12px 20px', fontSize: '0.92rem', borderRadius: 14 }}
            >
              <ArrowLeftRight size={17} />
              <span>Đổi Lượt Giao Bóng (Side Out)</span>
            </button>
          )}

          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="btn-secondary"
            style={{ padding: '12px 20px', fontSize: '0.92rem', borderRadius: 14, opacity: history.length === 0 ? 0.4 : 1 }}
          >
            <RotateCcw size={17} />
            <span>Hoàn Tác Điểm ({history.length})</span>
          </button>

          <button
            onClick={resetGame}
            className="btn-secondary"
            style={{ padding: '12px 20px', fontSize: '0.92rem', borderRadius: 14 }}
          >
            <RotateCcw size={17} />
            <span>Đặt Lại (0 - 0)</span>
          </button>

          <button
            onClick={() => setShowFinishModal(true)}
            className="btn-secondary"
            style={{ 
              padding: '12px 20px', 
              fontSize: '0.92rem', 
              borderRadius: 14, 
              color: '#e11d48', 
              borderColor: '#fca5a5',
              background: '#fff1f2'
            }}
          >
            <Flag size={17} />
            <span>Kết Thúc Trận (Giải Phóng Sân)</span>
          </button>

          {isGameOver && (
            <button
              onClick={() => setActiveTab('calculator')}
              className="btn-primary"
              style={{ padding: '12px 24px', fontSize: '1rem', borderRadius: 14 }}
            >
              <Sparkles size={18} />
              <span>Tính Điểm DUPR Với Tỷ Số Này ({score1} - {score2})</span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      )}

      {/* FINISH MATCH CONFIRMATION MODAL */}
      {showFinishModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16,
        }}>
          <div className="card" style={{
            maxWidth: 460,
            width: '100%',
            padding: '24px 22px',
            borderRadius: 22,
            background: '#ffffff',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#e11d48',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
              }}>
                🏁
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Kết Thúc Trận Đấu Trên {courtName}?
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Tỷ số hiện tại: <strong style={{ color: '#059669' }}>{score1} — {score2}</strong>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.5, margin: '12px 0 20px' }}>
              Khi xác nhận kết thúc, trận đấu trên <strong>{courtName}</strong> sẽ được đánh dấu hoàn thành và giải phóng khỏi danh sách trực tiếp. Sân sẽ trở về trạng thái trống (0 — 0) để sẵn sàng cho các trận tiếp theo.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowFinishModal(false)}
                className="btn-secondary"
                style={{ padding: '9px 18px', fontSize: '0.86rem', borderRadius: 12 }}
              >
                Hủy Bỏ
              </button>
              <button
                onClick={finishCurrentMatch}
                style={{
                  padding: '9px 20px',
                  fontSize: '0.86rem',
                  fontWeight: 900,
                  borderRadius: 12,
                  border: 'none',
                  background: '#e11d48',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)',
                }}
              >
                <Flag size={15} />
                <span>Xác Nhận Kết Thúc</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// SUB-COMPONENT: VĐV TRÊN Ô SÂN PICKLEBALL
// ---------------------------------------------------------------------------
interface CourtPlayerTokenProps {
  player: LiveCourtPlayer;
  courtName: string;
  teamNumber: 1 | 2;
  isServer: boolean;
  isReceiver: boolean;
  serverNumber: 1 | 2;
}

const CourtPlayerToken: React.FC<CourtPlayerTokenProps> = ({
  player,
  courtName,
  teamNumber,
  isServer,
  isReceiver,
  serverNumber,
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 15,
      position: 'relative',
    }}>
      {/* Avatar Container with Server/Receiver Glow */}
      <div style={{
        position: 'relative',
        width: 50,
        height: 50,
        borderRadius: '50%',
        padding: 2,
        background: isServer 
          ? 'linear-gradient(135deg, #bef264, #84cc16)' 
          : isReceiver 
          ? 'linear-gradient(135deg, #38bdf8, #0284c7)' 
          : '#ffffff',
        boxShadow: isServer 
          ? '0 0 0 3px #bef264, 0 4px 14px rgba(132, 204, 22, 0.6)' 
          : isReceiver 
          ? '0 0 0 3px #38bdf8, 0 4px 14px rgba(2, 132, 199, 0.4)' 
          : '0 2px 8px rgba(0,0,0,0.2)',
        animation: isServer ? 'serverPulse 1.8s infinite' : 'none',
      }}>
        <img
          src={player.avatar}
          alt={player.name}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            background: '#f1f5f9',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}`;
          }}
        />

        {/* Pickleball Icon for Active Server */}
        {isServer && (
          <div style={{
            position: 'absolute',
            bottom: -4,
            right: -6,
            background: '#bef264',
            color: '#064030',
            width: 20,
            height: 20,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            animation: 'ballBounce 1.5s ease-in-out infinite',
            border: '1.5px solid #064030',
          }}>
            🟡
          </div>
        )}
      </div>

      {/* Player Name Tag */}
      <div style={{
        marginTop: 6,
        padding: '2px 8px',
        borderRadius: 999,
        background: isServer ? '#bef264' : isReceiver ? '#38bdf8' : 'rgba(255, 255, 255, 0.95)',
        color: isServer ? '#064030' : isReceiver ? '#0f172a' : '#1e293b',
        fontWeight: 900,
        fontSize: '0.75rem',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
        textAlign: 'center',
      }}>
        {player.name}
      </div>

      {/* Role / Court Indicator */}
      <div style={{
        marginTop: 3,
        fontSize: '0.64rem',
        fontWeight: 800,
        color: '#ffffff',
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        whiteSpace: 'nowrap',
      }}>
        {isServer ? (
          <span style={{ color: '#bef264', textShadow: '0 0 8px rgba(190, 242, 100, 0.8)' }}>
            🎾 PHÁT BÓNG (#{serverNumber})
          </span>
        ) : isReceiver ? (
          <span style={{ color: '#7dd3fc', textShadow: '0 0 8px rgba(56, 189, 248, 0.8)' }}>
            🛡️ ĐỠ BÓNG
          </span>
        ) : (
          <span>{courtName}</span>
        )}
      </div>
    </div>
  );
};
