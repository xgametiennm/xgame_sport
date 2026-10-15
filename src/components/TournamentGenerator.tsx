import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { Player, TournamentData, TournamentFormat, TournamentType, PairingMethod, TournamentTeam, TournamentMatch, GroupStanding } from '../types/pickleball';
import { api } from '../services/api';
import {
  Trophy,
  Shuffle,
  Play,
  Check,
  ChevronRight,
  Users,
  User,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Trash2,
  Medal,
  Shield,
  Flag,
  Plus,
  Minus,
  Edit3,
  Crown,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronDown,
  Info,
  ArrowLeftRight,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  createId,
  shortPlayerName,
  pairPlayersRandomly,
  pairPlayersBalanced,
  generateGroupStage,
  calculateGroupStandings,
  generateKnockoutBracket,
  advanceGroupsToKnockout,
  applyMatchResult,
  validatePickleballMatchScore
} from '../utils/tournamentEngine';

export const TournamentGenerator: React.FC = () => {
  const { players, selectedClub, isManager, setActiveTab } = usePickleball();

  // Loading & Persistence state
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [activeTab, setActiveStageTab] = useState<'setup' | 'pairing' | 'groups' | 'knockout' | 'podium'>('setup');

  // Setup form states
  const [tournamentName, setTournamentName] = useState<string>(() => `${selectedClub.name} - Giải Tranh Cúp Vô Địch`);
  const [format, setFormat] = useState<TournamentFormat>('doubles');
  const [type, setType] = useState<TournamentType>('group_and_knockout');
  const [targetScore, setTargetScore] = useState<number>(11);
  const [numGroups, setNumGroups] = useState<number>(2);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Random spin animation states
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [spinProgress, setSpinProgress] = useState<number>(0);
  const [spunTeams, setSpunTeams] = useState<TournamentTeam[]>([]);
  const [pairingMethod, setPairingMethod] = useState<PairingMethod>('random');

  // Score editing modal state
  const [editingMatch, setEditingMatch] = useState<TournamentMatch | null>(null);
  const [editScore1, setEditScore1] = useState<number>(0);
  const [editScore2, setEditScore2] = useState<number>(0);

  // Load tournament from server on mount
  useEffect(() => {
    let cancelled = false;
    const fetchTournament = async () => {
      try {
        setLoading(true);
        const data = await api.getTournament(selectedClub.id);
        if (!cancelled) {
          if (data) {
            setTournament(data);
            setTournamentName(data.name);
            setFormat(data.format);
            setType(data.type);
            setTargetScore(data.targetScore);
            if (data.currentPhase === 'finished') setActiveStageTab('podium');
            else if (data.currentPhase === 'knockout_stage' || data.type === 'knockout_only') setActiveStageTab('knockout');
            else if (data.currentPhase === 'group_stage') setActiveStageTab('groups');
            else if (data.currentPhase === 'pairing') setActiveStageTab('pairing');
            else setActiveStageTab('setup');
          } else {
            // Default select top players
            setSelectedPlayerIds(players.slice(0, 8).map((p) => p.id));
          }
        }
      } catch (err) {
        console.error('Failed to load tournament:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTournament();
    return () => {
      cancelled = true;
    };
  }, [selectedClub.id]);

  // Synchronize player pool defaults if empty
  useEffect(() => {
    if (!tournament && players.length > 0 && selectedPlayerIds.length === 0) {
      setSelectedPlayerIds(players.slice(0, Math.min(12, players.length)).map((p) => p.id));
    }
  }, [players, tournament, selectedPlayerIds.length]);

  // Save tournament to server
  const saveTournamentState = async (updated: TournamentData) => {
    setTournament(updated);
    try {
      await api.saveTournament(selectedClub.id, updated);
    } catch (err) {
      console.error('Failed to save tournament:', err);
    }
  };

  // Filtered players list in setup
  const filteredPlayers = useMemo(() => {
    return players.filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [players, searchQuery]);

  // Toggle player selection
  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedPlayerIds(players.map((p) => p.id));
  const deselectAll = () => setSelectedPlayerIds([]);

  // Calculate minimum players needed
  const minRequired = format === 'doubles' ? 4 : 2;
  const isParticipantCountValid = selectedPlayerIds.length >= minRequired;

  // Trigger Random Pairing with suspense spin animation
  const startRandomSpinPairing = () => {
    const active = players.filter((p) => selectedPlayerIds.includes(p.id));
    if (active.length < minRequired) {
      window.alert(`Cần ít nhất ${minRequired} vận động viên để ghép cặp!`);
      return;
    }

    setIsSpinning(true);
    setSpinProgress(0);

    const interval = setInterval(() => {
      setSpinProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSpinning(false);
          const pairs = pairPlayersRandomly(active, format);
          setSpunTeams(pairs);
          try {
            confetti({
              particleCount: 70,
              spread: 60,
              origin: { y: 0.6 },
            });
          } catch {}
          return 100;
        }
        return prev + 12;
      });
    }, 150);
  };

  // List of active participant players
  const participantPlayers = useMemo(() => {
    return players.filter((p) => selectedPlayerIds.includes(p.id));
  }, [players, selectedPlayerIds]);

  // Swap player in a team slot with automatic displacement/swap
  const handleSwapPlayerInTeam = (teamIndex: number, slot: 1 | 2, newPlayerId: string) => {
    const newPlayer = players.find((p) => p.id === newPlayerId);
    if (!newPlayer) return;

    setSpunTeams((prevTeams) => {
      const teams = prevTeams.map((t) => ({ ...t }));
      const currentTeam = teams[teamIndex];
      const oldPlayer = slot === 1 ? currentTeam.player1 : currentTeam.player2;

      // Find where newPlayer is currently assigned across all teams
      let otherTeamIdx = -1;
      let otherSlot: 1 | 2 = 1;

      for (let i = 0; i < teams.length; i++) {
        if (teams[i].player1.id === newPlayerId) {
          otherTeamIdx = i;
          otherSlot = 1;
          break;
        }
        if (teams[i].player2?.id === newPlayerId) {
          otherTeamIdx = i;
          otherSlot = 2;
          break;
        }
      }

      // If newPlayer is already in this exact slot, do nothing
      if (otherTeamIdx === teamIndex && otherSlot === slot) {
        return prevTeams;
      }

      // If newPlayer is in another team/slot, place oldPlayer into that slot (SWAP)
      if (otherTeamIdx !== -1 && oldPlayer) {
        if (otherSlot === 1) {
          teams[otherTeamIdx].player1 = oldPlayer;
        } else {
          teams[otherTeamIdx].player2 = oldPlayer;
        }
        if (format === 'doubles' && teams[otherTeamIdx].player2) {
          teams[otherTeamIdx].name = `${teams[otherTeamIdx].player1.name} / ${teams[otherTeamIdx].player2!.name}`;
        } else {
          teams[otherTeamIdx].name = teams[otherTeamIdx].player1.name;
        }
      }

      // Update target slot in current team
      if (slot === 1) {
        currentTeam.player1 = newPlayer;
      } else {
        currentTeam.player2 = newPlayer;
      }

      if (format === 'doubles' && currentTeam.player2) {
        currentTeam.name = `${currentTeam.player1.name} / ${currentTeam.player2.name}`;
      } else {
        currentTeam.name = currentTeam.player1.name;
      }

      return teams;
    });

    setPairingMethod('manual');
  };

  // Swap positions of Player 1 and Player 2 inside the same team
  const handleInvertTeamPlayers = (teamIndex: number) => {
    setSpunTeams((prevTeams) => {
      const teams = prevTeams.map((t) => ({ ...t }));
      const team = teams[teamIndex];
      if (!team.player2) return prevTeams;
      const temp = team.player1;
      team.player1 = team.player2;
      team.player2 = temp;
      team.name = `${team.player1.name} / ${team.player2.name}`;
      return teams;
    });
    setPairingMethod('manual');
  };

  // Rename team
  const handleRenameTeam = (teamIndex: number, newName: string) => {
    setSpunTeams((prevTeams) => {
      const teams = [...prevTeams];
      teams[teamIndex] = { ...teams[teamIndex], name: newName };
      return teams;
    });
  };

  // Perform Balanced Pairing
  const applyBalancedPairing = () => {
    const active = players.filter((p) => selectedPlayerIds.includes(p.id));
    if (active.length < minRequired) return;
    const pairs = pairPlayersBalanced(active, format);
    setSpunTeams(pairs);
    setPairingMethod('balanced');
  };

  // Proceed from Setup to Pairing Stage
  const handleProceedToPairing = () => {
    if (!isParticipantCountValid) return;
    const active = players.filter((p) => selectedPlayerIds.includes(p.id));
    const initialPairs = pairPlayersRandomly(active, format);
    setSpunTeams(initialPairs);
    setActiveStageTab('pairing');
  };

  // Confirm Teams and Generate Group / Knockout Matches
  const handleConfirmTeamsAndGenerateMatches = async () => {
    if (spunTeams.length < (type === 'knockout_only' ? 2 : 2)) {
      window.alert('Cần ít nhất 2 đội/cặp thi đấu!');
      return;
    }

    let groupsData: { name: string; teamIds: string[] }[] = [];
    let groupMatchesData: TournamentMatch[] = [];
    let knockoutMatchesData: TournamentMatch[] = [];
    let assignedTeams = [...spunTeams];

    if (type === 'group_and_knockout' || type === 'group_only') {
      const generated = generateGroupStage(spunTeams, numGroups, selectedClub.courtsCount || 4);
      groupsData = generated.groups;
      groupMatchesData = generated.groupMatches;
      assignedTeams = generated.assignedTeams;
    } else {
      // Knockout only directly
      knockoutMatchesData = generateKnockoutBracket(spunTeams, selectedClub.courtsCount || 4);
    }

    const newTournament: TournamentData = {
      id: createId('tourney'),
      clubId: selectedClub.id,
      name: tournamentName.trim() || `${selectedClub.name} - Giải Đấu`,
      format,
      type,
      pairingMethod,
      teams: assignedTeams,
      groups: groupsData,
      groupMatches: groupMatchesData,
      knockoutMatches: knockoutMatchesData,
      targetScore,
      currentPhase: type === 'knockout_only' ? 'knockout_stage' : 'group_stage',
      advancePerGroup: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTournamentState(newTournament);
    setActiveStageTab(type === 'knockout_only' ? 'knockout' : 'groups');

    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.5 },
      });
    } catch {}
  };

  // Group standings computation
  const groupStandings = useMemo(() => {
    if (!tournament || !tournament.teams || tournament.groupMatches.length === 0) return {};
    return calculateGroupStandings(tournament.teams, tournament.groupMatches);
  }, [tournament]);

  // Target score for validation
  const currentTargetScore = tournament?.targetScore || targetScore || 11;

  // Real-time validation for currently edited match score
  const scoreValidation = useMemo(() => {
    return validatePickleballMatchScore(editScore1, editScore2, currentTargetScore);
  }, [editScore1, editScore2, currentTargetScore]);

  // Open Score edit modal
  const handleOpenScoreModal = (match: TournamentMatch) => {
    setEditingMatch(match);
    setEditScore1(match.score1 || 0);
    setEditScore2(match.score2 || 0);
  };

  // Save Match Score
  const handleSaveMatchScore = async () => {
    if (!tournament || !editingMatch) return;

    const validation = validatePickleballMatchScore(editScore1, editScore2, currentTargetScore);
    if (!validation.valid) {
      window.alert(validation.message || 'Tỉ số không hợp lệ theo luật thi đấu!');
      return;
    }

    const isFinished = !validation.isReset;
    const winner = validation.winner;

    if (editingMatch.stage === 'group') {
      const updatedMatches = tournament.groupMatches.map((m) => {
        if (m.id === editingMatch.id) {
          return {
            ...m,
            score1: editScore1,
            score2: editScore2,
            winner,
            completed: isFinished,
          };
        }
        return m;
      });

      const updatedTournament: TournamentData = {
        ...tournament,
        groupMatches: updatedMatches,
        updatedAt: new Date().toISOString(),
      };

      await saveTournamentState(updatedTournament);
    } else {
      // Knockout stage score update
      const { updatedMatches, champion, runnerUp, thirdPlace } = applyMatchResult(
        tournament.knockoutMatches,
        editingMatch.id,
        editScore1,
        editScore2,
        currentTargetScore
      );

      const isTourneyFinished = !!champion;

      const updatedTournament: TournamentData = {
        ...tournament,
        knockoutMatches: updatedMatches,
        champion: champion || tournament.champion,
        runnerUp: runnerUp || tournament.runnerUp,
        thirdPlace: thirdPlace || tournament.thirdPlace,
        currentPhase: isTourneyFinished ? 'finished' : 'knockout_stage',
        updatedAt: new Date().toISOString(),
      };

      await saveTournamentState(updatedTournament);

      if (champion) {
        try {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.4 },
          });
        } catch {}
      }
    }

    setEditingMatch(null);
  };

  // Advance from Group Stage to Knockout Bracket
  const handleAdvanceToKnockout = async () => {
    if (!tournament) return;

    const allGroupMatchesFinished = tournament.groupMatches.every((m) => m.completed);
    if (!allGroupMatchesFinished) {
      const confirm = window.confirm(
        'Vẫn còn một số trận vòng bảng chưa hoàn thành. Bạn có chắc chắn muốn chốt điểm để chuyển sang Vòng Loại Trực Tiếp?'
      );
      if (!confirm) return;
    }

    const knockoutMatches = advanceGroupsToKnockout(
      groupStandings,
      tournament.advancePerGroup || 2,
      selectedClub.courtsCount || 4
    );

    const updatedTournament: TournamentData = {
      ...tournament,
      knockoutMatches,
      currentPhase: 'knockout_stage',
      updatedAt: new Date().toISOString(),
    };

    await saveTournamentState(updatedTournament);
    setActiveStageTab('knockout');

    try {
      confetti({
        particleCount: 100,
        spread: 75,
        origin: { y: 0.5 },
      });
    } catch {}
  };

  // Finish Tournament & Crown Champion, Runner-up, and 3rd place
  const handleFinishTournament = async () => {
    if (!tournament) return;

    let champion: TournamentTeam | null = tournament.champion || null;
    let runnerUp: TournamentTeam | null = tournament.runnerUp || null;
    let thirdPlace: TournamentTeam | null = tournament.thirdPlace || null;

    // 1. Check if knockout matches exist
    const finalMatch = tournament.knockoutMatches?.find((m) => m.roundName === 'Chung Kết');
    const bronzeMatch = tournament.knockoutMatches?.find((m) => m.roundName === 'Tranh Hạng 3');

    if (finalMatch && finalMatch.completed && finalMatch.winner) {
      champion = (finalMatch.winner === 1 ? finalMatch.team1 : finalMatch.team2) || null;
      runnerUp = (finalMatch.winner === 1 ? finalMatch.team2 : finalMatch.team1) || null;
    }

    if (bronzeMatch && bronzeMatch.completed && bronzeMatch.winner) {
      thirdPlace = (bronzeMatch.winner === 1 ? bronzeMatch.team1 : bronzeMatch.team2) || null;
    } else if (!thirdPlace && tournament.knockoutMatches?.length) {
      const sfMatches = tournament.knockoutMatches.filter((m) => m.roundName === 'Bán Kết');
      const sfLosers = sfMatches
        .filter((m) => m.completed && m.winner)
        .map((m) => (m.winner === 1 ? m.team2 : m.team1))
        .filter(Boolean) as TournamentTeam[];
      if (sfLosers.length > 0) {
        thirdPlace = sfLosers[0] || null;
      }
    }

    // 2. If still no champion and we have group standings (e.g. group_only or preliminary)
    if (!champion && Object.keys(groupStandings).length > 0) {
      const allStandings: GroupStanding[] = [];
      Object.values(groupStandings).forEach((list) => {
        allStandings.push(...list);
      });

      // Sort by points desc, then diff desc, then pointsFor desc
      allStandings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.pointsFor - a.pointsFor;
      });

      if (allStandings[0]?.team) champion = allStandings[0].team || null;
      if (allStandings[1]?.team) runnerUp = allStandings[1].team || null;
      if (allStandings[2]?.team) thirdPlace = allStandings[2].team || null;
    }

    // 3. Fallback if still not determined
    if (!champion && tournament.teams?.length) {
      champion = tournament.teams[0] || null;
      runnerUp = tournament.teams[1] || null;
      thirdPlace = tournament.teams[2] || null;
    }

    const updatedTournament: TournamentData = {
      ...tournament,
      champion,
      runnerUp,
      thirdPlace,
      currentPhase: 'finished',
      updatedAt: new Date().toISOString(),
    };

    await saveTournamentState(updatedTournament);
    setActiveStageTab('podium');

    try {
      confetti({
        particleCount: 200,
        spread: 120,
        origin: { y: 0.4 },
      });
    } catch {}
  };

  // Reset Tournament
  const handleResetTournament = async () => {
    const confirm = window.confirm(
      `Bạn có chắc chắn muốn xóa giải đấu "${tournament?.name}" và bắt đầu thiết lập giải mới?`
    );
    if (!confirm) return;

    try {
      await api.deleteTournament(selectedClub.id);
      setTournament(null);
      setSpunTeams([]);
      setActiveStageTab('setup');
    } catch (err) {
      window.alert('Không thể xóa giải đấu, vui lòng thử lại');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 16px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏓</div>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Đang tải dữ liệu giải đấu...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 16px 80px' }}>
      {/* 1. TOP HEADER BANNER */}
      <div className="hero-gradient card" style={{ marginBottom: 20, padding: '24px 20px', borderRadius: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="badge badge-neon" style={{ background: '#d9f99d', color: '#365314', border: '1px solid #bef264' }}>
                <Trophy size={13} /> GIẢI ĐẤU CLB
              </span>
              <span className="badge badge-court" style={{ background: '#d1fae5', color: '#065f46' }}>
                {selectedClub.name}
              </span>
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
              {tournament ? tournament.name : 'Thi Đấu & Tổ Chức Giải CLB'}
            </h1>
            <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.86rem', marginTop: 4, maxWidth: 680 }}>
              Hỗ trợ sắp xếp cặp đấu, quay random bốc thăm ngẫu nhiên, thi đấu vòng bảng tính điểm và sơ đồ loại trực tiếp (Knockout Bracket) chuyên nghiệp.
            </p>
          </div>

          {tournament && isManager && (
            <button
              onClick={handleResetTournament}
              className="btn-secondary"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '8px 16px',
                borderRadius: 999,
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Trash2 size={15} />
              <span>Tạo Giải Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. STAGE NAVIGATION TABS */}
      <div style={{
        display: 'flex',
        background: '#f1f5f9',
        padding: 4,
        borderRadius: 14,
        gap: 6,
        marginBottom: 20,
        overflowX: 'auto',
      }}>
        <button
          onClick={() => setActiveStageTab('setup')}
          style={{
            flex: 1,
            minWidth: 120,
            padding: '9px 12px',
            borderRadius: 10,
            border: 'none',
            fontSize: '0.84rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: activeTab === 'setup' ? '#0d5e46' : 'transparent',
            color: activeTab === 'setup' ? '#ffffff' : '#64748b',
            boxShadow: activeTab === 'setup' ? '0 2px 6px rgba(13,94,70,0.3)' : 'none',
          }}
        >
          <Layers size={15} />
          <span>1. Thiết Lập</span>
        </button>

        <button
          onClick={() => setActiveStageTab('pairing')}
          style={{
            flex: 1,
            minWidth: 150,
            padding: '9px 12px',
            borderRadius: 10,
            border: 'none',
            fontSize: '0.84rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: activeTab === 'pairing' ? '#0d5e46' : 'transparent',
            color: activeTab === 'pairing' ? '#ffffff' : '#64748b',
            boxShadow: activeTab === 'pairing' ? '0 2px 6px rgba(13,94,70,0.3)' : 'none',
          }}
        >
          <Shuffle size={15} />
          <span>2. Quay Cặp & Bốc Thăm</span>
        </button>

        {(tournament?.type === 'group_and_knockout' || tournament?.type === 'group_only') && (
          <button
            onClick={() => setActiveStageTab('groups')}
            disabled={!tournament?.groupMatches?.length}
            style={{
              flex: 1,
              minWidth: 130,
              padding: '9px 12px',
              borderRadius: 10,
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 800,
              cursor: tournament?.groupMatches?.length ? 'pointer' : 'not-allowed',
              opacity: tournament?.groupMatches?.length ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: activeTab === 'groups' ? '#0d5e46' : 'transparent',
              color: activeTab === 'groups' ? '#ffffff' : '#64748b',
              boxShadow: activeTab === 'groups' ? '0 2px 6px rgba(13,94,70,0.3)' : 'none',
            }}
          >
            <Shield size={15} />
            <span>3. Vòng Bảng</span>
          </button>
        )}

        {(tournament?.type === 'group_and_knockout' || tournament?.type === 'knockout_only') && (
          <button
            onClick={() => setActiveStageTab('knockout')}
            disabled={!tournament?.knockoutMatches?.length}
            style={{
              flex: 1,
              minWidth: 140,
              padding: '9px 12px',
              borderRadius: 10,
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 800,
              cursor: tournament?.knockoutMatches?.length ? 'pointer' : 'not-allowed',
              opacity: tournament?.knockoutMatches?.length ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: activeTab === 'knockout' ? '#0d5e46' : 'transparent',
              color: activeTab === 'knockout' ? '#ffffff' : '#64748b',
              boxShadow: activeTab === 'knockout' ? '0 2px 6px rgba(13,94,70,0.3)' : 'none',
            }}
          >
            <Trophy size={15} />
            <span>4. Loại Trực Tiếp</span>
          </button>
        )}

        {tournament && (
          <button
            onClick={() => setActiveStageTab('podium')}
            style={{
              flex: 1,
              minWidth: 140,
              padding: '9px 12px',
              borderRadius: 10,
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: activeTab === 'podium' ? '#f59e0b' : 'transparent',
              color: activeTab === 'podium' ? '#ffffff' : '#b45309',
              boxShadow: activeTab === 'podium' ? '0 2px 6px rgba(245,158,11,0.3)' : 'none',
            }}
          >
            <Crown size={15} />
            <span>5. Vinh Danh & Kết Quả {tournament.champion ? '🏆' : ''}</span>
          </button>
        )}
      </div>

      {/* ============================================================== */}
      {/* STAGE 1: SETUP & PARTICIPANTS                                  */}
      {/* ============================================================== */}
      {activeTab === 'setup' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Tournament Parameters */}
          <div className="card" style={{ padding: 22, borderRadius: 20 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚙️</span> Thông Tin & Thể Thức Giải
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                  Tên giải đấu:
                </label>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  className="input-dark"
                  placeholder="Ví dụ: Giải Pickleball CLB Mở Rộng 2026"
                />
              </div>

              {/* Format selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                  Thể thức thi đấu:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setFormat('doubles')}
                    style={{
                      padding: '12px',
                      borderRadius: 12,
                      border: format === 'doubles' ? '2px solid #059669' : '1.5px solid #e2e8f0',
                      background: format === 'doubles' ? '#ecfdf5' : '#ffffff',
                      color: format === 'doubles' ? '#047857' : '#475569',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Users size={18} />
                    <span>Đôi (2 vs 2)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('singles')}
                    style={{
                      padding: '12px',
                      borderRadius: 12,
                      border: format === 'singles' ? '2px solid #059669' : '1.5px solid #e2e8f0',
                      background: format === 'singles' ? '#ecfdf5' : '#ffffff',
                      color: format === 'singles' ? '#047857' : '#475569',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <User size={18} />
                    <span>Đơn (1 vs 1)</span>
                  </button>
                </div>
              </div>

              {/* Tournament structure */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                  Cấu trúc giải đấu:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div
                    onClick={() => setType('group_and_knockout')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: type === 'group_and_knockout' ? '2px solid #059669' : '1.5px solid #e2e8f0',
                      background: type === 'group_and_knockout' ? '#ecfdf5' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                        🏆 Vòng Bảng + Loại Trực Tiếp (Tiêu Chuẩn)
                      </span>
                      {type === 'group_and_knockout' && <CheckCircle2 size={18} color="#059669" />}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                      Chia bảng đá vòng tròn tính điểm. Top các đội xuất sắc nhất tiến vào Tứ kết & Bán kết.
                    </div>
                  </div>

                  <div
                    onClick={() => setType('knockout_only')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: type === 'knockout_only' ? '2px solid #059669' : '1.5px solid #e2e8f0',
                      background: type === 'knockout_only' ? '#ecfdf5' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                        ⚡ Loại Trực Tiếp (Knockout Bracket)
                      </span>
                      {type === 'knockout_only' && <CheckCircle2 size={18} color="#059669" />}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                      Thua bị loại ngay, thắng tiến vào vòng sau. Tốc độ nhanh và kịch tính.
                    </div>
                  </div>

                  <div
                    onClick={() => setType('group_only')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: type === 'group_only' ? '2px solid #059669' : '1.5px solid #e2e8f0',
                      background: type === 'group_only' ? '#ecfdf5' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                        🔄 Vòng Tròn Tính Điểm (Round Robin)
                      </span>
                      {type === 'group_only' && <CheckCircle2 size={18} color="#059669" />}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                      Tất cả các cặp đấu chạm trán nhau, xếp hạng chung cuộc theo điểm số.
                    </div>
                  </div>
                </div>
              </div>

              {/* Number of groups & target score */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                    Điểm số mỗi set:
                  </label>
                  <select
                    value={targetScore}
                    onChange={(e) => setTargetScore(parseInt(e.target.value) || 11)}
                    className="input-dark"
                  >
                    <option value={11}>11 Điểm (Cách biệt 2)</option>
                    <option value={15}>15 Điểm (Cách biệt 2)</option>
                    <option value={21}>21 Điểm (Cách biệt 2)</option>
                  </select>
                </div>

                {type !== 'knockout_only' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                      Số bảng đấu:
                    </label>
                    <select
                      value={numGroups}
                      onChange={(e) => setNumGroups(parseInt(e.target.value) || 2)}
                      className="input-dark"
                    >
                      <option value={2}>2 Bảng (Bảng A, B)</option>
                      <option value={3}>3 Bảng (Bảng A, B, C)</option>
                      <option value={4}>4 Bảng (Bảng A, B, C, D)</option>
                    </select>
                  </div>
                )}
              </div>

              <button
                onClick={handleProceedToPairing}
                disabled={!isParticipantCountValid}
                className="btn-primary"
                style={{
                  width: '100%',
                  marginTop: 10,
                  padding: '13px',
                  borderRadius: 14,
                  fontSize: '0.95rem',
                  opacity: isParticipantCountValid ? 1 : 0.5,
                  cursor: isParticipantCountValid ? 'pointer' : 'not-allowed',
                }}
              >
                <span>Tiếp Tục: Ghép Cặp & Bốc Thăm</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          {/* Participant Selector */}
          <div className="card" style={{ padding: 22, borderRadius: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Chọn VĐV Tham Gia
                </h2>
                <div style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 700, marginTop: 2 }}>
                  Đã chọn: {selectedPlayerIds.length} VĐV {format === 'doubles' && `(tạo ${Math.floor(selectedPlayerIds.length / 2)} cặp đôi)`}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={selectAll}
                  style={{ fontSize: '0.74rem', background: '#ecfdf5', color: '#059669', border: 'none', padding: '4px 8px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
                >
                  Chọn hết
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  style={{ fontSize: '0.74rem', background: '#f1f5f9', color: '#64748b', border: 'none', padding: '4px 8px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                type="text"
                placeholder="Tìm thành viên theo tên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-dark"
                style={{ paddingLeft: 34, fontSize: '0.84rem' }}
              />
            </div>

            {/* List of Players */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
              {filteredPlayers.map((player) => {
                const isSelected = selectedPlayerIds.includes(player.id);
                return (
                  <div
                    key={player.id}
                    onClick={() => togglePlayer(player.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #10b981' : '1px solid #f1f5f9',
                      background: isSelected ? '#f0fdf4' : '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img
                        src={player.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}`}
                        alt={player.name}
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>{player.name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>DUPR {player.doublesRating.toFixed(2)}</div>
                      </div>
                    </div>

                    <div style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: isSelected ? '#059669' : '#ffffff',
                      border: isSelected ? 'none' : '1.5px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                    }}>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STAGE 2: PAIRING & RANDOM DRAW (QUAY RANDOM BỐC THĂM)         */}
      {/* ============================================================== */}
      {activeTab === 'pairing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Action Control Bar */}
          <div className="card" style={{ padding: 18, borderRadius: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                    Sắp Xếp Cặp Thi Đấu & Bốc Thăm
                  </h2>
                  <span style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: pairingMethod === 'manual' ? '#fef3c7' : pairingMethod === 'balanced' ? '#e0e7ff' : '#ecfdf5',
                    color: pairingMethod === 'manual' ? '#b45309' : pairingMethod === 'balanced' ? '#4338ca' : '#047857',
                  }}>
                    {pairingMethod === 'manual' ? '✍️ Tự Chọn Cặp (Thủ Công)' : pairingMethod === 'balanced' ? '⚖️ Cân Bằng DUPR' : '🎲 Bốc Thăm Ngẫu Nhiên'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                  Tổng cộng: <strong>{spunTeams.length} cặp đấu</strong> ({spunTeams.length * (format === 'doubles' ? 2 : 1)} VĐV tham gia)
                </div>
              </div>

              {/* Three Pairing Mode Options */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={startRandomSpinPairing}
                  disabled={isSpinning}
                  style={{
                    background: 'linear-gradient(135deg, #059669, #065f46)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: 999,
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(5,150,105,0.3)',
                  }}
                >
                  <Shuffle size={16} />
                  <span>{isSpinning ? 'Đang Quay Xổ Số...' : '🎲 Quay Random Cặp Đấu'}</span>
                </button>

                <button
                  onClick={applyBalancedPairing}
                  disabled={isSpinning}
                  style={{
                    background: '#ffffff',
                    color: '#0f172a',
                    border: '1.5px solid #cbd5e1',
                    padding: '9px 15px',
                    borderRadius: 999,
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Sparkles size={15} color="#059669" />
                  <span>Ghép Cân Bằng DUPR</span>
                </button>

                <button
                  onClick={handleConfirmTeamsAndGenerateMatches}
                  disabled={isSpinning || spunTeams.length < 2}
                  className="btn-primary"
                  style={{
                    padding: '10px 20px',
                    borderRadius: 999,
                    fontSize: '0.88rem',
                  }}
                >
                  <span>Chốt Cặp & Sinh Lịch Đấu</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Roulette Animation Bar */}
            {isSpinning && (
              <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 14, background: '#f0fdf4', border: '1.5px solid #a7f3d0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#047857' }}>
                    🎰 ĐANG QUAY SỐ BỐC THĂM CẶP ĐẤU NGẪU NHIÊN...
                  </span>
                  <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#059669' }}>
                    {spinProgress}%
                  </span>
                </div>
                <div style={{ width: '100%', height: 8, background: '#d1fae5', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${spinProgress}%`, height: '100%', background: '#059669', transition: 'width 0.15s ease' }} />
                </div>
              </div>
            )}
          </div>

          {/* Guide Banner for Manual Pairing */}
          <div style={{
            background: '#f0fdf4',
            border: '1.5px solid #86efac',
            borderRadius: 16,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: '#dcfce7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
              flexShrink: 0,
            }}>
              <Sparkles size={20} />
            </div>
            <div style={{ flex: 1, fontSize: '0.84rem', color: '#166534', lineHeight: 1.5 }}>
              <strong>Làm sao để chọn ai cặp với ai?</strong><br />
              • <strong>Tự chọn theo ý muốn:</strong> Bạn chỉ cần bấm vào ô chọn <strong>VĐV 1</strong> hoặc <strong>VĐV 2</strong> ở từng thẻ bên dưới để ghép bất kỳ ai với ai. Hệ thống sẽ <em>tự động hoán đổi</em> để không bao giờ bị trùng người.<br />
              • <strong>Quay random xổ số:</strong> Bấm nút <strong>"🎲 Quay Random Cặp Đấu"</strong> ở trên để bốc thăm ngẫu nhiên kịch tính.<br />
              • <strong>Cân bằng trình độ:</strong> Bấm <strong>"Ghép Cân Bằng DUPR"</strong> để máy tự động ghép người điểm cao nhất đi cùng người thấp nhất.
            </div>
          </div>

          {/* Teams Grid Display */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            gap: 16,
          }}>
            {spunTeams.map((team, idx) => {
              const avgDupr = format === 'doubles' && team.player2
                ? ((team.player1.doublesRating + team.player2.doublesRating) / 2).toFixed(2)
                : team.player1.singlesRating.toFixed(2);

              return (
                <div
                  key={team.id}
                  className="card"
                  style={{
                    padding: '16px 18px',
                    borderRadius: 18,
                    border: '1.5px solid #e2e8f0',
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {/* Top Bar: Badge & DUPR Info */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        background: '#ecfdf5',
                        color: '#059669',
                        fontSize: '0.74rem',
                        fontWeight: 900,
                        padding: '3px 9px',
                        borderRadius: 999,
                      }}>
                        CẶP #{idx + 1}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                        Hạt giống {idx + 1}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      background: '#f1f5f9',
                      color: '#334155',
                      padding: '3px 8px',
                      borderRadius: 8,
                    }}>
                      DUPR TB: {avgDupr}
                    </span>
                  </div>

                  {/* Team Name Input */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>
                      Tên Cặp Đấu
                    </label>
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => handleRenameTeam(idx, e.target.value)}
                      placeholder="Tên cặp đấu..."
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: '#0f172a',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Player Selectors */}
                  {format === 'doubles' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* VĐV 1 Selector */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: '#f8fafc',
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                      }}>
                        <img
                          src={team.player1.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(team.player1.name)}`}
                          alt={team.player1.name}
                          style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #10b981', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: 2 }}>
                            VĐV 1
                          </div>
                          <select
                            value={team.player1.id}
                            onChange={(e) => handleSwapPlayerInTeam(idx, 1, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 6px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              color: '#0f172a',
                              cursor: 'pointer',
                            }}
                          >
                            {participantPlayers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (DUPR: {p.doublesRating.toFixed(2)})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Invert Button */}
                      <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
                        <button
                          type="button"
                          onClick={() => handleInvertTeamPlayers(idx)}
                          title="Đổi chỗ VĐV 1 và VĐV 2"
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: 999,
                            padding: '3px 10px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#475569',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          }}
                        >
                          <ArrowLeftRight size={12} color="#059669" />
                          <span>Đổi vị trí 1 ⇄ 2</span>
                        </button>
                      </div>

                      {/* VĐV 2 Selector */}
                      {team.player2 && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          background: '#f8fafc',
                          padding: '8px 10px',
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                        }}>
                          <img
                            src={team.player2.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(team.player2.name)}`}
                            alt={team.player2.name}
                            style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #059669', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: 2 }}>
                              VĐV 2
                            </div>
                            <select
                              value={team.player2.id}
                              onChange={(e) => handleSwapPlayerInTeam(idx, 2, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                borderRadius: 6,
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                color: '#0f172a',
                                cursor: 'pointer',
                              }}
                            >
                              {participantPlayers.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (DUPR: {p.doublesRating.toFixed(2)})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Singles Mode Selector */
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: '#f8fafc',
                      padding: '8px 10px',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                    }}>
                      <img
                        src={team.player1.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(team.player1.name)}`}
                        alt={team.player1.name}
                        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #10b981', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: 2 }}>
                          VĐV
                        </div>
                        <select
                          value={team.player1.id}
                          onChange={(e) => handleSwapPlayerInTeam(idx, 1, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            cursor: 'pointer',
                          }}
                        >
                          {participantPlayers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (DUPR: {p.singlesRating.toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STAGE 3: GROUP STAGE & STANDINGS TABLE                        */}
      {/* ============================================================== */}
      {activeTab === 'groups' && tournament && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Action Header for Groups */}
          <div className="card" style={{ padding: '16px 20px', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                Bảng Điểm & Lịch Thi Đấu Vòng Bảng
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                Nhập tỉ số trực tiếp các trận đấu. Bảng xếp hạng tự động tính điểm, hiệu số và thứ hạng.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {tournament.type === 'group_and_knockout' && (
                <button
                  onClick={handleAdvanceToKnockout}
                  className="btn-primary"
                  style={{ padding: '9px 18px', borderRadius: 999, fontSize: '0.86rem' }}
                >
                  <span>Chốt Bảng & Vào Knockout ➔</span>
                </button>
              )}

              <button
                onClick={handleFinishTournament}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: 999,
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
                }}
              >
                <Crown size={15} />
                <span>{tournament.champion ? 'Xem Bục Vinh Danh ➔' : '🏆 Kết Thúc Giải & Trao Giải ➔'}</span>
              </button>
            </div>
          </div>

          {/* Groups Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
            {tournament.groups.map((group) => {
              const standings = groupStandings[group.name] || [];
              const groupMatches = tournament.groupMatches.filter((m) => m.groupName === group.name);

              return (
                <div key={group.name} className="card" style={{ padding: 18, borderRadius: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                        {group.name}
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.72rem', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: 999, fontWeight: 800 }}>
                      Top 2 đi tiếp
                    </span>
                  </div>

                  {/* Standings Table */}
                  <div style={{ overflowX: 'auto', marginBottom: 18 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1.5px solid #e2e8f0', color: '#64748b', textAlign: 'center' }}>
                          <th style={{ padding: '6px 4px', textAlign: 'left', width: 24 }}>#</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Đội thi đấu</th>
                          <th style={{ padding: '6px 4px', width: 30 }}>Đ</th>
                          <th style={{ padding: '6px 4px', width: 30 }}>T</th>
                          <th style={{ padding: '6px 4px', width: 30 }}>B</th>
                          <th style={{ padding: '6px 6px', width: 44 }}>+/-</th>
                          <th style={{ padding: '6px 8px', width: 40, fontWeight: 900 }}>Điểm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((st) => (
                          <tr
                            key={st.team.id}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: st.rank <= 2 ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '8px 4px', fontWeight: 800, color: st.rank <= 2 ? '#059669' : '#64748b' }}>
                              {st.rank}
                            </td>
                            <td style={{ padding: '8px 8px', fontWeight: 700, color: '#0f172a' }}>
                              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                                {st.team.name}
                              </div>
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'center', color: '#475569' }}>{st.played}</td>
                            <td style={{ padding: '8px 4px', textAlign: 'center', color: '#16a34a', fontWeight: 800 }}>{st.won}</td>
                            <td style={{ padding: '8px 4px', textAlign: 'center', color: '#dc2626' }}>{st.lost}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', color: st.diff >= 0 ? '#16a34a' : '#dc2626' }}>
                              {st.diff > 0 ? `+${st.diff}` : st.diff}
                            </td>
                            <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 900, color: '#0f172a', fontSize: '0.9rem' }}>
                              {st.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Group Matches List */}
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: 8 }}>
                      Các trận đấu bảng {group.name}:
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {groupMatches.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => handleOpenScoreModal(m)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 12,
                            border: m.completed ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                            background: m.completed ? '#f0fdf4' : '#f8fafc',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: '0.84rem', fontWeight: m.winner === 1 ? 900 : 600, color: m.winner === 1 ? '#059669' : '#0f172a' }}>
                                {m.team1?.name}
                              </span>
                              <span className="mono" style={{ fontSize: '1rem', fontWeight: 900, color: m.winner === 1 ? '#059669' : '#0f172a' }}>
                                {m.score1 || 0}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.84rem', fontWeight: m.winner === 2 ? 900 : 600, color: m.winner === 2 ? '#059669' : '#0f172a' }}>
                                {m.team2?.name}
                              </span>
                              <span className="mono" style={{ fontSize: '1rem', fontWeight: 900, color: m.winner === 2 ? '#059669' : '#0f172a' }}>
                                {m.score2 || 0}
                              </span>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: m.completed ? '#ecfdf5' : '#f1f5f9', color: m.completed ? '#059669' : '#64748b', fontWeight: 700 }}>
                              {m.completed ? 'Đã Xong' : 'Chưa đấu'}
                            </span>
                            <Edit3 size={15} color="#94a3b8" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STAGE 4: KNOCKOUT BRACKET (SƠ ĐỒ HÌNH CÂY LOẠI TRỰC TIẾP)      */}
      {/* ============================================================== */}
      {activeTab === 'knockout' && tournament && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header */}
          <div className="card" style={{ padding: '16px 20px', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                Sơ Đồ Nhánh Đấu Vòng Loại Trực Tiếp
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Bấm vào từng trận đấu để nhập tỉ số. Đội chiến thắng sẽ tự động tiến vào vòng kế tiếp!
              </div>
            </div>

            <button
              onClick={handleFinishTournament}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#ffffff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: 999,
                fontWeight: 800,
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
              }}
            >
              <Crown size={16} />
              <span>{tournament.champion ? 'Xem Bục Vinh Danh & Trao Giải ➔' : '🏆 Kết Thúc Giải & Trao Giải ➔'}</span>
            </button>
          </div>

          {/* Interactive Knockout Bracket Tree (Responsive horizontal scroll) */}
          <div style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            padding: '24px 20px',
            overflowX: 'auto',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', gap: 36, minWidth: 700, alignItems: 'stretch' }}>
              {/* Group knockout matches by round index */}
              {Array.from(new Set(tournament.knockoutMatches.map((m) => m.roundIndex))).sort((a, b) => a - b).map((roundIdx) => {
                const roundMatches = tournament.knockoutMatches.filter((m) => m.roundIndex === roundIdx);
                const roundName = roundMatches[0]?.roundName || `Vòng ${roundIdx + 1}`;

                return (
                  <div key={roundIdx} style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: '0.9rem',
                      color: '#0f172a',
                      marginBottom: 16,
                      padding: '6px 10px',
                      background: '#f8fafc',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                    }}>
                      {roundName}
                    </div>

                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-around',
                      flex: 1,
                      gap: 20,
                    }}>
                      {roundMatches.map((match) => (
                        <div
                          key={match.id}
                          onClick={() => handleOpenScoreModal(match)}
                          style={{
                            background: match.completed ? '#ffffff' : '#f8fafc',
                            border: match.completed ? '2px solid #059669' : '1.5px solid #cbd5e1',
                            borderRadius: 14,
                            padding: '12px 14px',
                            cursor: 'pointer',
                            boxShadow: match.completed ? '0 4px 12px rgba(5, 150, 105, 0.1)' : 'none',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>
                              {match.title || match.roundName}
                            </span>
                            {match.courtName && (
                              <span style={{ fontSize: '0.65rem', color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: 4 }}>
                                {match.courtName}
                              </span>
                            )}
                          </div>

                          {/* Team 1 */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 0',
                            borderBottom: '1px solid #f1f5f9',
                          }}>
                            <span style={{
                              fontSize: '0.86rem',
                              fontWeight: match.winner === 1 ? 900 : 600,
                              color: match.winner === 1 ? '#059669' : '#0f172a',
                              maxWidth: 150,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {match.team1?.name || '(Đang chờ)'}
                            </span>
                            <span className="mono" style={{ fontSize: '1rem', fontWeight: 900, color: match.winner === 1 ? '#059669' : '#64748b' }}>
                              {match.score1 || 0}
                            </span>
                          </div>

                          {/* Team 2 */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 0',
                          }}>
                            <span style={{
                              fontSize: '0.86rem',
                              fontWeight: match.winner === 2 ? 900 : 600,
                              color: match.winner === 2 ? '#059669' : '#0f172a',
                              maxWidth: 150,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {match.team2?.name || '(Đang chờ)'}
                            </span>
                            <span className="mono" style={{ fontSize: '1rem', fontWeight: 900, color: match.winner === 2 ? '#059669' : '#64748b' }}>
                              {match.score2 || 0}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STAGE 5: PODIUM & CHAMPION CELEBRATION (BỤC VINH DANH)         */}
      {/* ============================================================== */}
      {/* ============================================================== */}
      {/* STAGE 5: PODIUM & CHAMPION CELEBRATION (BỤC VINH DANH)         */}
      {/* ============================================================== */}
      {activeTab === 'podium' && tournament && (
        <div style={{ textAlign: 'center', padding: '16px 0 32px' }}>
          <div style={{ fontSize: '3.2rem', marginBottom: 8 }}>🏆</div>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            LỄ TRAO THƯỞNG & VINH DANH VÔ ĐỊCH
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.92rem', marginTop: 6, maxWidth: 600, margin: '6px auto 0' }}>
            Vinh danh các tay vợt xuất sắc nhất giải đấu <strong>{tournament.name}</strong> ({selectedClub.name})
          </p>

          {/* If not officially finalized yet, show finish button */}
          {!tournament.champion && (
            <div style={{
              background: '#eff6ff',
              border: '1.5px solid #bfdbfe',
              borderRadius: 18,
              padding: '16px 22px',
              maxWidth: 720,
              margin: '20px auto 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              textAlign: 'left',
            }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Info size={18} color="#2563eb" />
                  <span>Giải đấu chưa chính thức chốt kết quả chung cuộc</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: 4 }}>
                  Bạn có thể bấm nút bên phải để chốt trao giải Nhất, Nhì, Ba dựa trên bảng điểm và sơ đồ thi đấu hiện tại.
                </div>
              </div>
              <button
                type="button"
                onClick={handleFinishTournament}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '11px 22px',
                  borderRadius: 999,
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
                  whiteSpace: 'nowrap',
                }}
              >
                <Crown size={16} />
                <span>🏆 Chốt Trao Giải Ngay</span>
              </button>
            </div>
          )}

          {/* 3-Tier Olympic Podium Layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: 20,
            marginTop: 32,
            maxWidth: 1040,
            margin: '32px auto 0',
            alignItems: 'end',
          }}>
            {/* 🥈 2ND PLACE (Á QUÂN / GIẢI NHÌ) - Left on desktop */}
            <div
              className="card"
              style={{
                padding: '24px 20px',
                borderRadius: 24,
                border: '2px solid #cbd5e1',
                background: 'linear-gradient(180deg, #f8fafc, #ffffff)',
                boxShadow: '0 4px 16px rgba(100, 116, 139, 0.12)',
                order: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '2.8rem', marginBottom: 6 }}>🥈</div>
              <span style={{
                background: '#f1f5f9',
                color: '#475569',
                fontWeight: 900,
                fontSize: '0.78rem',
                padding: '4px 14px',
                borderRadius: 999,
                border: '1px solid #cbd5e1',
              }}>
                Á QUÂN (GIẢI NHÌ)
              </span>

              {tournament.runnerUp ? (
                <>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '14px 0 8px' }}>
                    {tournament.runnerUp.name}
                  </h3>

                  {/* Player Avatars & Details */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 0 10px' }}>
                    <img
                      src={tournament.runnerUp.player1.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(tournament.runnerUp.player1.name)}`}
                      alt={tournament.runnerUp.player1.name}
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #94a3b8' }}
                    />
                    {tournament.runnerUp.player2 && (
                      <img
                        src={tournament.runnerUp.player2.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(tournament.runnerUp.player2.name)}`}
                        alt={tournament.runnerUp.player2.name}
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #94a3b8', marginLeft: -12 }}
                      />
                    )}
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {tournament.runnerUp.player1.name}
                    {tournament.runnerUp.player2 ? ` & ${tournament.runnerUp.player2.name}` : ''}
                  </div>

                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', background: '#f1f5f9', padding: '3px 10px', borderRadius: 999, marginTop: 8 }}>
                    {tournament.runnerUp.player2
                      ? `DUPR TB: ${((tournament.runnerUp.player1.doublesRating + tournament.runnerUp.player2.doublesRating) / 2).toFixed(2)}`
                      : `DUPR: ${tournament.runnerUp.player1.singlesRating.toFixed(2)}`}
                  </div>

                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', marginTop: 14 }}>
                    Huy Chương Bạc 🥈
                  </div>
                </>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '24px 0' }}>
                  (Đang tranh giải nhì...)
                </div>
              )}
            </div>

            {/* 🥇 1ST PLACE (QUÁN QUÂN / VÔ ĐỊCH) - Elevated Center on desktop */}
            <div
              className="card"
              style={{
                padding: '32px 22px',
                borderRadius: 26,
                border: '2.5px solid #f59e0b',
                background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)',
                boxShadow: '0 12px 32px rgba(245, 158, 11, 0.25)',
                order: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: 'scale(1.03)',
                position: 'relative',
              }}
            >
              <div style={{ position: 'absolute', top: -14, background: '#f59e0b', color: '#ffffff', fontSize: '0.72rem', fontWeight: 900, padding: '3px 12px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: '0 2px 6px rgba(245,158,11,0.4)' }}>
                ★ ĐỈNH CAO DANH DỰ ★
              </div>

              <div style={{ fontSize: '3.6rem', marginBottom: 6 }}>🏆</div>
              <span style={{
                background: '#fef3c7',
                color: '#b45309',
                fontWeight: 900,
                fontSize: '0.84rem',
                padding: '4px 16px',
                borderRadius: 999,
                border: '1px solid #fde68a',
              }}>
                👑 NHÀ VÔ ĐỊCH (GIẢI NHẤT)
              </span>

              {tournament.champion ? (
                <>
                  <h3 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: '14px 0 8px' }}>
                    {tournament.champion.name}
                  </h3>

                  {/* Player Avatars & Details */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 0 10px' }}>
                    <img
                      src={tournament.champion.player1.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(tournament.champion.player1.name)}`}
                      alt={tournament.champion.player1.name}
                      style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '3px solid #f59e0b', boxShadow: '0 2px 8px rgba(245,158,11,0.3)' }}
                    />
                    {tournament.champion.player2 && (
                      <img
                        src={tournament.champion.player2.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(tournament.champion.player2.name)}`}
                        alt={tournament.champion.player2.name}
                        style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '3px solid #f59e0b', marginLeft: -14, boxShadow: '0 2px 8px rgba(245,158,11,0.3)' }}
                      />
                    )}
                  </div>

                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                    {tournament.champion.player1.name}
                    {tournament.champion.player2 ? ` & ${tournament.champion.player2.name}` : ''}
                  </div>

                  <div style={{ fontSize: '0.76rem', fontWeight: 900, color: '#b45309', background: '#fef3c7', padding: '4px 12px', borderRadius: 999, marginTop: 8, border: '1px solid #fde68a' }}>
                    {tournament.champion.player2
                      ? `DUPR TB: ${((tournament.champion.player1.doublesRating + tournament.champion.player2.doublesRating) / 2).toFixed(2)}`
                      : `DUPR: ${tournament.champion.player1.singlesRating.toFixed(2)}`}
                  </div>

                  <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#b45309', marginTop: 14 }}>
                    Cúp Vô Địch & Huy Chương Vàng 🏆🥇
                  </div>
                </>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '28px 0' }}>
                  (Đang thi đấu trận chung kết...)
                </div>
              )}
            </div>

            {/* 🥉 3RD PLACE (HẠNG BA / GIẢI BA) - Right on desktop */}
            <div
              className="card"
              style={{
                padding: '24px 20px',
                borderRadius: 24,
                border: '2px solid #fed7aa',
                background: 'linear-gradient(180deg, #fffbeb, #ffffff)',
                boxShadow: '0 4px 16px rgba(217, 119, 6, 0.1)',
                order: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '2.8rem', marginBottom: 6 }}>🥉</div>
              <span style={{
                background: '#ffedd5',
                color: '#c2410c',
                fontWeight: 900,
                fontSize: '0.78rem',
                padding: '4px 14px',
                borderRadius: 999,
                border: '1px solid #fed7aa',
              }}>
                HẠNG BA (GIẢI BA)
              </span>

              {tournament.thirdPlace ? (
                <>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '14px 0 8px' }}>
                    {tournament.thirdPlace.name}
                  </h3>

                  {/* Player Avatars & Details */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 0 10px' }}>
                    <img
                      src={tournament.thirdPlace.player1.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(tournament.thirdPlace.player1.name)}`}
                      alt={tournament.thirdPlace.player1.name}
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #d97706' }}
                    />
                    {tournament.thirdPlace.player2 && (
                      <img
                        src={tournament.thirdPlace.player2.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(tournament.thirdPlace.player2.name)}`}
                        alt={tournament.thirdPlace.player2.name}
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #d97706', marginLeft: -12 }}
                      />
                    )}
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {tournament.thirdPlace.player1.name}
                    {tournament.thirdPlace.player2 ? ` & ${tournament.thirdPlace.player2.name}` : ''}
                  </div>

                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#c2410c', background: '#ffedd5', padding: '3px 10px', borderRadius: 999, marginTop: 8 }}>
                    {tournament.thirdPlace.player2
                      ? `DUPR TB: ${((tournament.thirdPlace.player1.doublesRating + tournament.thirdPlace.player2.doublesRating) / 2).toFixed(2)}`
                      : `DUPR: ${tournament.thirdPlace.player1.singlesRating.toFixed(2)}`}
                  </div>

                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#c2410c', marginTop: 14 }}>
                    Huy Chương Đồng 🥉
                  </div>
                </>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '24px 0' }}>
                  (Đang tranh giải ba...)
                </div>
              )}
            </div>
          </div>

          {/* Action Navigation Controls at Bottom of Podium */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 36, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                try {
                  confetti({
                    particleCount: 180,
                    spread: 120,
                    origin: { y: 0.5 },
                  });
                } catch {}
              }}
              style={{
                background: '#ffffff',
                color: '#0f172a',
                border: '1.5px solid #cbd5e1',
                padding: '10px 20px',
                borderRadius: 999,
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              }}
            >
              <Sparkles size={16} color="#f59e0b" />
              <span>🎉 Bắn Pháo Hoa Ăn Mừng</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveStageTab(tournament.type === 'knockout_only' ? 'knockout' : 'groups')}
              style={{
                background: '#ffffff',
                color: '#0f172a',
                border: '1.5px solid #cbd5e1',
                padding: '10px 20px',
                borderRadius: 999,
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              }}
            >
              <Trophy size={16} color="#059669" />
              <span>Xem Lại Lịch Đấu & Tỉ Số</span>
            </button>

            <button
              type="button"
              onClick={handleResetTournament}
              style={{
                background: '#fef2f2',
                color: '#dc2626',
                border: '1.5px solid #fecaca',
                padding: '10px 20px',
                borderRadius: 999,
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <RefreshCw size={16} />
              <span>Tổ Chức Giải Đấu Mới</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: NHẬP & CHỈNH SỬA TỈ SỐ TRẬN ĐẤU                         */}
      {/* ============================================================== */}
      {editingMatch && (
        <div className="modal-overlay" onClick={() => setEditingMatch(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, padding: 24, borderRadius: 22 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Cập Nhật Tỉ Số Trận Đấu
              </h3>
              <span style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 999,
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
              }}>
                Mốc {currentTargetScore} điểm (Cách biệt 2)
              </span>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 16 }}>
              {editingMatch.title || editingMatch.roundName} ({editingMatch.courtName || 'Sân CLB'})
            </div>

            {/* Scores Inputs Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              {/* Team 1 Score */}
              <div style={{ textAlign: 'center', padding: 14, borderRadius: 16, background: '#f0fdf4', border: '1.5px solid #a7f3d0' }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#047857', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {editingMatch.team1?.name || 'Đội 1'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditScore1(Math.max(0, editScore1 - 1))}
                    style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: '#ffffff', color: '#047857', fontWeight: 900, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={editScore1}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setEditScore1(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="mono"
                    style={{ width: 64, textAlign: 'center', fontSize: '1.8rem', fontWeight: 900, color: '#047857', border: 'none', background: 'transparent', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditScore1(editScore1 + 1)}
                    style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: '#ffffff', color: '#047857', fontWeight: 900, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Team 2 Score */}
              <div style={{ textAlign: 'center', padding: 14, borderRadius: 16, background: '#eff6ff', border: '1.5px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#1d4ed8', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {editingMatch.team2?.name || 'Đội 2'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditScore2(Math.max(0, editScore2 - 1))}
                    style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: '#ffffff', color: '#1d4ed8', fontWeight: 900, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={editScore2}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setEditScore2(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="mono"
                    style={{ width: 64, textAlign: 'center', fontSize: '1.8rem', fontWeight: 900, color: '#1d4ed8', border: 'none', background: 'transparent', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditScore2(editScore2 + 1)}
                    style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: '#ffffff', color: '#1d4ed8', fontWeight: 900, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Result Presets */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                ⚡ Chọn Nhanh Tỉ Số Chuẩn ({currentTargetScore} Điểm):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => { setEditScore1(currentTargetScore); setEditScore2(Math.max(0, currentTargetScore - 2)); }}
                  style={{ fontSize: '0.74rem', fontWeight: 700, padding: '4px 9px', borderRadius: 8, border: '1px solid #a7f3d0', background: '#f0fdf4', color: '#047857', cursor: 'pointer' }}
                >
                  Đội 1 Thắng ({currentTargetScore}-{Math.max(0, currentTargetScore - 2)})
                </button>
                <button
                  type="button"
                  onClick={() => { setEditScore1(currentTargetScore); setEditScore2(Math.floor(currentTargetScore / 2)); }}
                  style={{ fontSize: '0.74rem', fontWeight: 700, padding: '4px 9px', borderRadius: 8, border: '1px solid #a7f3d0', background: '#f0fdf4', color: '#047857', cursor: 'pointer' }}
                >
                  {currentTargetScore} - {Math.floor(currentTargetScore / 2)}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditScore1(Math.max(0, currentTargetScore - 2)); setEditScore2(currentTargetScore); }}
                  style={{ fontSize: '0.74rem', fontWeight: 700, padding: '4px 9px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}
                >
                  Đội 2 Thắng ({Math.max(0, currentTargetScore - 2)}-{currentTargetScore})
                </button>
                <button
                  type="button"
                  onClick={() => { setEditScore1(Math.floor(currentTargetScore / 2)); setEditScore2(currentTargetScore); }}
                  style={{ fontSize: '0.74rem', fontWeight: 700, padding: '4px 9px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}
                >
                  {Math.floor(currentTargetScore / 2)} - {currentTargetScore}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditScore1(0); setEditScore2(0); }}
                  style={{ fontSize: '0.74rem', fontWeight: 700, padding: '4px 9px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#64748b', cursor: 'pointer' }}
                >
                  Đặt lại 0 - 0
                </button>
              </div>
            </div>

            {/* Live Score Validation Feedback Alert */}
            <div style={{
              marginBottom: 18,
              padding: '11px 14px',
              borderRadius: 14,
              fontSize: '0.8rem',
              lineHeight: 1.45,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: scoreValidation.valid
                ? (scoreValidation.isReset ? '#f8fafc' : '#f0fdf4')
                : '#fef2f2',
              border: `1.5px solid ${
                scoreValidation.valid
                  ? (scoreValidation.isReset ? '#cbd5e1' : '#86efac')
                  : '#fca5a5'
              }`,
              color: scoreValidation.valid
                ? (scoreValidation.isReset ? '#475569' : '#166534')
                : '#991b1b',
            }}>
              {scoreValidation.valid ? (
                scoreValidation.isReset ? (
                  <Info size={18} color="#475569" style={{ flexShrink: 0, marginTop: 1 }} />
                ) : (
                  <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />
                )
              ) : (
                <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
              )}
              <div style={{ flex: 1 }}>
                <strong>
                  {scoreValidation.valid
                    ? (scoreValidation.isReset ? 'Chưa thi đấu' : 'Hợp lệ')
                    : 'Tỉ số không hợp lệ'}
                  :
                </strong>{' '}
                {scoreValidation.message}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setEditingMatch(null)}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveMatchScore}
                disabled={!scoreValidation.valid}
                className="btn-primary"
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  fontWeight: 800,
                  opacity: scoreValidation.valid ? 1 : 0.45,
                  cursor: scoreValidation.valid ? 'pointer' : 'not-allowed',
                }}
              >
                Lưu Tỉ Số
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
