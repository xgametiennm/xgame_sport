import { Player, TournamentTeam, TournamentMatch, GroupStanding, TournamentFormat, TournamentType } from '../types/pickleball';

// Short name helper (last word of name)
export const shortPlayerName = (name: string): string => name.split(' ').slice(-1)[0] || name;

// Generates unique IDs
export const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

/**
 * Pairs players randomly for doubles or singles.
 */
export function pairPlayersRandomly(players: Player[], format: TournamentFormat): TournamentTeam[] {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const teams: TournamentTeam[] = [];

  if (format === 'singles') {
    shuffled.forEach((p, idx) => {
      teams.push({
        id: createId('team'),
        name: p.name,
        player1: p,
        seed: idx + 1,
      });
    });
  } else {
    // Doubles: pair 2 by 2
    for (let i = 0; i < shuffled.length; i += 2) {
      const p1 = shuffled[i];
      const p2 = shuffled[i + 1];
      if (p1 && p2) {
        teams.push({
          id: createId('team'),
          name: `${shortPlayerName(p1.name)} & ${shortPlayerName(p2.name)}`,
          player1: p1,
          player2: p2,
          seed: Math.floor(i / 2) + 1,
        });
      } else if (p1) {
        // Odd player left over
        teams.push({
          id: createId('team'),
          name: p1.name,
          player1: p1,
          seed: Math.floor(i / 2) + 1,
        });
      }
    }
  }

  return teams;
}

/**
 * Pairs players balanced by DUPR rating (Highest rating paired with lowest rating)
 */
export function pairPlayersBalanced(players: Player[], format: TournamentFormat): TournamentTeam[] {
  if (format === 'singles') {
    const sorted = [...players].sort((a, b) => b.singlesRating - a.singlesRating);
    return sorted.map((p, idx) => ({
      id: createId('team'),
      name: p.name,
      player1: p,
      seed: idx + 1,
    }));
  }

  // Doubles: sort by doubles rating descending
  const sorted = [...players].sort((a, b) => b.doublesRating - a.doublesRating);
  const teams: TournamentTeam[] = [];
  const n = sorted.length;
  const numPairs = Math.floor(n / 2);

  for (let i = 0; i < numPairs; i++) {
    const pTop = sorted[i];
    const pBottom = sorted[n - 1 - i];
    teams.push({
      id: createId('team'),
      name: `${shortPlayerName(pTop.name)} & ${shortPlayerName(pBottom.name)}`,
      player1: pTop,
      player2: pBottom,
      seed: i + 1,
    });
  }

  // If odd count
  if (n % 2 !== 0) {
    const middlePlayer = sorted[numPairs];
    teams.push({
      id: createId('team'),
      name: middlePlayer.name,
      player1: middlePlayer,
      seed: teams.length + 1,
    });
  }

  return teams;
}

/**
 * Generates group assignments and round robin matches for each group.
 */
export function generateGroupStage(
  teams: TournamentTeam[],
  numGroups: number,
  courtsCount: number = 4
): {
  groups: { name: string; teamIds: string[] }[];
  groupMatches: TournamentMatch[];
  assignedTeams: TournamentTeam[];
} {
  const groupNames = ['Bảng A', 'Bảng B', 'Bảng C', 'Bảng D', 'Bảng E', 'Bảng F'].slice(0, numGroups);
  const groups: { name: string; teamIds: string[] }[] = groupNames.map((name) => ({ name, teamIds: [] }));

  // Distribute teams evenly across groups (snake distribution based on seed)
  const assignedTeams = teams.map((team, idx) => {
    const groupIndex = idx % numGroups;
    const gName = groupNames[groupIndex];
    groups[groupIndex].teamIds.push(team.id);
    return {
      ...team,
      groupName: gName,
    };
  });

  const groupMatches: TournamentMatch[] = [];

  // For each group, create all round-robin pairs
  groups.forEach((g) => {
    const gTeams = assignedTeams.filter((t) => g.teamIds.includes(t.id));
    let matchIdx = 1;

    for (let i = 0; i < gTeams.length; i++) {
      for (let j = i + 1; j < gTeams.length; j++) {
        const courtNumber = ((groupMatches.length % courtsCount) + 1);
        groupMatches.push({
          id: createId('m-group'),
          stage: 'group',
          groupName: g.name,
          roundIndex: 0,
          matchIndex: matchIdx++,
          roundName: g.name,
          team1: gTeams[i],
          team2: gTeams[j],
          score1: 0,
          score2: 0,
          winner: null,
          courtName: `Sân ${courtNumber}`,
          completed: false,
        });
      }
    }
  });

  return { groups, groupMatches, assignedTeams };
}

/**
 * Calculates current standings for all groups based on completed matches.
 */
export function calculateGroupStandings(
  teams: TournamentTeam[],
  matches: TournamentMatch[]
): Record<string, GroupStanding[]> {
  const standingsByGroup: Record<string, Record<string, GroupStanding>> = {};

  // Initialize
  teams.forEach((team) => {
    const gName = team.groupName || 'Bảng A';
    if (!standingsByGroup[gName]) standingsByGroup[gName] = {};
    standingsByGroup[gName][team.id] = {
      team,
      played: 0,
      won: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      rank: 1,
      points: 0,
    };
  });

  // Tally matches
  matches.forEach((m) => {
    if (!m.completed || !m.team1 || !m.team2 || !m.groupName) return;
    const gName = m.groupName;
    const s1 = m.score1 || 0;
    const s2 = m.score2 || 0;
    const st1 = standingsByGroup[gName]?.[m.team1.id];
    const st2 = standingsByGroup[gName]?.[m.team2.id];

    if (st1 && st2) {
      st1.played += 1;
      st2.played += 1;
      st1.pointsFor += s1;
      st1.pointsAgainst += s2;
      st2.pointsFor += s2;
      st2.pointsAgainst += s1;
      st1.diff = st1.pointsFor - st1.pointsAgainst;
      st2.diff = st2.pointsFor - st2.pointsAgainst;

      if (m.winner === 1) {
        st1.won += 1;
        st1.points += 2;
        st2.lost += 1;
      } else if (m.winner === 2) {
        st2.won += 1;
        st2.points += 2;
        st1.lost += 1;
      }
    }
  });

  // Convert to sorted lists
  const result: Record<string, GroupStanding[]> = {};
  Object.keys(standingsByGroup).forEach((gName) => {
    const list = Object.values(standingsByGroup[gName]);
    list.sort((a, b) => {
      // Points -> Diff -> Points For
      if (b.points !== a.points) return b.points - a.points;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.pointsFor - a.pointsFor;
    });
    list.forEach((item, idx) => {
      item.rank = idx + 1;
    });
    result[gName] = list;
  });

  return result;
}

/**
 * Generates an empty or seeded Knockout tree structure.
 * Standard bracket sizes: 4 teams (SF -> Finals), 8 teams (QF -> SF -> Finals), 16 teams.
 */
export function generateKnockoutBracket(
  seededTeams: (TournamentTeam | null)[],
  courtsCount: number = 4
): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  const numTeams = seededTeams.length;

  let bracketSize = 4;
  if (numTeams > 8) bracketSize = 16;
  else if (numTeams > 4) bracketSize = 8;
  else bracketSize = 4;

  // Determine rounds needed
  // 16 -> 8 matches (R16), 4 (QF), 2 (SF), 1 (Final), 1 (3rd place)
  // 8 -> 4 (QF), 2 (SF), 1 (Final), 1 (3rd place)
  // 4 -> 2 (SF), 1 (Final), 1 (3rd place)

  const roundNames = bracketSize === 16 
    ? ['Vòng 16 Đội', 'Tứ Kết', 'Bán Kết', 'Chung Kết']
    : bracketSize === 8 
      ? ['Tứ Kết', 'Bán Kết', 'Chung Kết']
      : ['Bán Kết', 'Chung Kết'];

  const finalMatchId = createId('m-final');
  const thirdPlaceMatchId = createId('m-bronze');

  const finalMatch: TournamentMatch = {
    id: finalMatchId,
    stage: 'knockout',
    roundIndex: roundNames.length - 1,
    matchIndex: 1,
    roundName: 'Chung Kết',
    title: '🏆 Trận Chung Kết Tranh Ngôi Vô Địch',
    team1: null,
    team2: null,
    score1: 0,
    score2: 0,
    winner: null,
    courtName: 'Sân Trung Tâm (Center Court)',
    completed: false,
  };

  const thirdPlaceMatch: TournamentMatch = {
    id: thirdPlaceMatchId,
    stage: 'knockout',
    roundIndex: roundNames.length - 1,
    matchIndex: 2,
    roundName: 'Tranh Hạng 3',
    title: '🥉 Trận Tranh Hạng Ba (Huy Chương Đồng)',
    team1: null,
    team2: null,
    score1: 0,
    score2: 0,
    winner: null,
    courtName: 'Sân 2',
    completed: false,
  };

  // Semi finals
  const sf1Id = createId('m-sf1');
  const sf2Id = createId('m-sf2');

  const sf1: TournamentMatch = {
    id: sf1Id,
    stage: 'knockout',
    roundIndex: roundNames.length - 2,
    matchIndex: 1,
    roundName: 'Bán Kết',
    title: 'Bán Kết 1',
    team1: null,
    team2: null,
    score1: 0,
    score2: 0,
    winner: null,
    nextMatchId: finalMatchId,
    nextMatchSlot: 1,
    courtName: 'Sân 1',
    completed: false,
  };

  const sf2: TournamentMatch = {
    id: sf2Id,
    stage: 'knockout',
    roundIndex: roundNames.length - 2,
    matchIndex: 2,
    roundName: 'Bán Kết',
    title: 'Bán Kết 2',
    team1: null,
    team2: null,
    score1: 0,
    score2: 0,
    winner: null,
    nextMatchId: finalMatchId,
    nextMatchSlot: 2,
    courtName: 'Sân 2',
    completed: false,
  };

  if (bracketSize === 4) {
    // 4 teams directly into SF
    sf1.team1 = seededTeams[0] || null;
    sf1.team2 = seededTeams[3] || null; // 1 vs 4
    sf2.team1 = seededTeams[1] || null;
    sf2.team2 = seededTeams[2] || null; // 2 vs 3

    matches.push(sf1, sf2, finalMatch, thirdPlaceMatch);
    return matches;
  }

  if (bracketSize === 8) {
    // Quarter-finals
    const qfIds = [createId('m-qf1'), createId('m-qf2'), createId('m-qf3'), createId('m-qf4')];
    const qfMatches: TournamentMatch[] = [
      {
        id: qfIds[0],
        stage: 'knockout',
        roundIndex: 0,
        matchIndex: 1,
        roundName: 'Tứ Kết',
        title: 'Tứ Kết 1 (TK 1)',
        team1: seededTeams[0] || null, // Seed 1
        team2: seededTeams[7] || null, // Seed 8
        score1: 0,
        score2: 0,
        winner: null,
        nextMatchId: sf1Id,
        nextMatchSlot: 1,
        courtName: `Sân 1`,
        completed: false,
      },
      {
        id: qfIds[1],
        stage: 'knockout',
        roundIndex: 0,
        matchIndex: 2,
        roundName: 'Tứ Kết',
        title: 'Tứ Kết 2 (TK 2)',
        team1: seededTeams[3] || null, // Seed 4
        team2: seededTeams[4] || null, // Seed 5
        score1: 0,
        score2: 0,
        winner: null,
        nextMatchId: sf1Id,
        nextMatchSlot: 2,
        courtName: `Sân 2`,
        completed: false,
      },
      {
        id: qfIds[2],
        stage: 'knockout',
        roundIndex: 0,
        matchIndex: 3,
        roundName: 'Tứ Kết',
        title: 'Tứ Kết 3 (TK 3)',
        team1: seededTeams[1] || null, // Seed 2
        team2: seededTeams[6] || null, // Seed 7
        score1: 0,
        score2: 0,
        winner: null,
        nextMatchId: sf2Id,
        nextMatchSlot: 1,
        courtName: `Sân 3`,
        completed: false,
      },
      {
        id: qfIds[3],
        stage: 'knockout',
        roundIndex: 0,
        matchIndex: 4,
        roundName: 'Tứ Kết',
        title: 'Tứ Kết 4 (TK 4)',
        team1: seededTeams[2] || null, // Seed 3
        team2: seededTeams[5] || null, // Seed 6
        score1: 0,
        score2: 0,
        winner: null,
        nextMatchId: sf2Id,
        nextMatchSlot: 2,
        courtName: `Sân 4`,
        completed: false,
      },
    ];

    matches.push(...qfMatches, sf1, sf2, finalMatch, thirdPlaceMatch);
    return matches;
  }

  // Bracket size 16
  const qfIds = [createId('m-qf1'), createId('m-qf2'), createId('m-qf3'), createId('m-qf4')];
  const qfMatches: TournamentMatch[] = [
    {
      id: qfIds[0],
      stage: 'knockout',
      roundIndex: 1,
      matchIndex: 1,
      roundName: 'Tứ Kết',
      title: 'Tứ Kết 1',
      team1: null,
      team2: null,
      score1: 0,
      score2: 0,
      winner: null,
      nextMatchId: sf1Id,
      nextMatchSlot: 1,
      courtName: 'Sân 1',
      completed: false,
    },
    {
      id: qfIds[1],
      stage: 'knockout',
      roundIndex: 1,
      matchIndex: 2,
      roundName: 'Tứ Kết',
      title: 'Tứ Kết 2',
      team1: null,
      team2: null,
      score1: 0,
      score2: 0,
      winner: null,
      nextMatchId: sf1Id,
      nextMatchSlot: 2,
      courtName: 'Sân 2',
      completed: false,
    },
    {
      id: qfIds[2],
      stage: 'knockout',
      roundIndex: 1,
      matchIndex: 3,
      roundName: 'Tứ Kết',
      title: 'Tứ Kết 3',
      team1: null,
      team2: null,
      score1: 0,
      score2: 0,
      winner: null,
      nextMatchId: sf2Id,
      nextMatchSlot: 1,
      courtName: 'Sân 3',
      completed: false,
    },
    {
      id: qfIds[3],
      stage: 'knockout',
      roundIndex: 1,
      matchIndex: 4,
      roundName: 'Tứ Kết',
      title: 'Tứ Kết 4',
      team1: null,
      team2: null,
      score1: 0,
      score2: 0,
      winner: null,
      nextMatchId: sf2Id,
      nextMatchSlot: 2,
      courtName: 'Sân 4',
      completed: false,
    },
  ];

  // Round of 16 (8 matches)
  const r16Matches: TournamentMatch[] = [];
  for (let i = 0; i < 8; i++) {
    const parentQfIdx = Math.floor(i / 2);
    const parentSlot = (i % 2 === 0 ? 1 : 2) as 1 | 2;
    r16Matches.push({
      id: createId(`m-r16-${i + 1}`),
      stage: 'knockout',
      roundIndex: 0,
      matchIndex: i + 1,
      roundName: 'Vòng 16',
      title: `Vòng 1/8 Trận ${i + 1}`,
      team1: seededTeams[i * 2] || null,
      team2: seededTeams[i * 2 + 1] || null,
      score1: 0,
      score2: 0,
      winner: null,
      nextMatchId: qfIds[parentQfIdx],
      nextMatchSlot: parentSlot,
      courtName: `Sân ${(i % courtsCount) + 1}`,
      completed: false,
    });
  }

  matches.push(...r16Matches, ...qfMatches, sf1, sf2, finalMatch, thirdPlaceMatch);
  return matches;
}

/**
 * Takes top qualifying teams from group standings and maps them into a knockout bracket.
 * E.g., Group A #1 vs Group B #2, Group B #1 vs Group A #2.
 */
export function advanceGroupsToKnockout(
  standings: Record<string, GroupStanding[]>,
  advancePerGroup: number = 2,
  courtsCount: number = 4
): TournamentMatch[] {
  const groupKeys = Object.keys(standings).sort();
  const qualifyingTeams: TournamentTeam[] = [];

  if (groupKeys.length === 2) {
    // 2 groups (A & B), top 2 each -> 4 teams
    const topA1 = standings[groupKeys[0]]?.[0]?.team;
    const topA2 = standings[groupKeys[0]]?.[1]?.team;
    const topB1 = standings[groupKeys[1]]?.[0]?.team;
    const topB2 = standings[groupKeys[1]]?.[1]?.team;

    // Cross-match: A1 vs B2, B1 vs A2
    const seeded = [topA1 || null, topB1 || null, topA2 || null, topB2 || null];
    return generateKnockoutBracket(seeded, courtsCount);
  }

  if (groupKeys.length === 4) {
    // 4 groups (A, B, C, D), top 2 each -> 8 teams
    const topA1 = standings[groupKeys[0]]?.[0]?.team;
    const topA2 = standings[groupKeys[0]]?.[1]?.team;
    const topB1 = standings[groupKeys[1]]?.[0]?.team;
    const topB2 = standings[groupKeys[1]]?.[1]?.team;
    const topC1 = standings[groupKeys[2]]?.[0]?.team;
    const topC2 = standings[groupKeys[2]]?.[1]?.team;
    const topD1 = standings[groupKeys[3]]?.[0]?.team;
    const topD2 = standings[groupKeys[3]]?.[1]?.team;

    // Cross matchups: A1 vs B2, C1 vs D2, B1 vs A2, D1 vs C2
    const seeded = [
      topA1 || null,
      topC1 || null,
      topB1 || null,
      topD1 || null,
      topC2 || null,
      topA2 || null,
      topD2 || null,
      topB2 || null,
    ];
    return generateKnockoutBracket(seeded, courtsCount);
  }

  // Generic fallback: collect top N from each group
  groupKeys.forEach((gKey) => {
    const list = standings[gKey] || [];
    for (let i = 0; i < advancePerGroup; i++) {
      if (list[i]?.team) {
        qualifyingTeams.push(list[i].team);
      }
    }
  });

  return generateKnockoutBracket(qualifyingTeams, courtsCount);
}

export interface ScoreValidationResult {
  valid: boolean;
  isReset: boolean;
  winner: 1 | 2 | null;
  message?: string;
  warningType?: 'error' | 'success' | 'info';
}

/**
 * Validates match scores based on official Pickleball scoring rules:
 * - Played to a target score (e.g. 11, 15, 21).
 * - Win by 2 points required.
 * - If max score reaches targetScore, opponent score must be <= targetScore - 2.
 * - If game goes past targetScore (deuce), the winning team must win by EXACTLY 2 points (e.g. 12-10, 13-11).
 * - Match cannot end in a draw (score1 === score2, except 0 - 0 for unplayed/reset).
 */
export function validatePickleballMatchScore(
  score1: number,
  score2: number,
  targetScore: number = 11
): ScoreValidationResult {
  if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) {
    return {
      valid: false,
      isReset: false,
      winner: null,
      message: 'Điểm số không được để trống hoặc là số âm.',
      warningType: 'error',
    };
  }

  // Both 0: Reset to unplayed
  if (score1 === 0 && score2 === 0) {
    return {
      valid: true,
      isReset: true,
      winner: null,
      message: 'Đặt lại trạng thái trận đấu (0 - 0, chưa thi đấu).',
      warningType: 'info',
    };
  }

  // Draw is not permitted
  if (score1 === score2) {
    return {
      valid: false,
      isReset: false,
      winner: null,
      message: `Tỉ số hòa (${score1} - ${score2}) không hợp lệ! Luật Pickleball yêu cầu phải có bên thắng cách biệt ít nhất 2 điểm.`,
      warningType: 'error',
    };
  }

  const max = Math.max(score1, score2);
  const min = Math.min(score1, score2);
  const diff = max - min;
  const winner: 1 | 2 = score1 > score2 ? 1 : 2;

  // Has not reached target score yet
  if (max < targetScore) {
    return {
      valid: false,
      isReset: false,
      winner: null,
      message: `Chưa đạt điểm quy định! Đội thắng phải đạt tối thiểu ${targetScore} điểm (hiện tại mới là ${max}).`,
      warningType: 'error',
    };
  }

  // Reached exactly target score
  if (max === targetScore) {
    if (diff < 2) {
      return {
        valid: false,
        isReset: false,
        winner: null,
        message: `Chưa đủ cách biệt 2 điểm (${score1} - ${score2})! Cần tiếp tục thi đấu để tạo cách biệt tối thiểu 2 điểm (ví dụ: ${targetScore + 1} - ${min}).`,
        warningType: 'error',
      };
    }
    return {
      valid: true,
      isReset: false,
      winner,
      message: `Tỉ số hợp lệ! Đội ${winner === 1 ? '1' : '2'} thắng (${score1} - ${score2}).`,
      warningType: 'success',
    };
  }

  // Exceeded target score (deuce overtime)
  if (max > targetScore) {
    if (diff < 2) {
      return {
        valid: false,
        isReset: false,
        winner: null,
        message: `Đang ở loạt đấu giằng co Deuce (${score1} - ${score2})! Cần thắng cách biệt đúng 2 điểm (ví dụ: ${max + 1} - ${min}).`,
        warningType: 'error',
      };
    }

    if (diff > 2) {
      return {
        valid: false,
        isReset: false,
        winner: null,
        message: `Tỉ số vượt quá quy định (${score1} - ${score2})! Trận đấu theo luật kết thúc ngay khi chạm ${targetScore} điểm (cách biệt ≥ 2) hoặc khi cách biệt đúng 2 điểm (như ${min + 2} - ${min}).`,
        warningType: 'error',
      };
    }

    // diff === 2
    return {
      valid: true,
      isReset: false,
      winner,
      message: `Tỉ số hợp lệ (Thắng Deuce ${score1} - ${score2})! Đội ${winner === 1 ? '1' : '2'} thắng.`,
      warningType: 'success',
    };
  }

  return {
    valid: false,
    isReset: false,
    winner: null,
    message: 'Tỉ số không hợp lệ.',
    warningType: 'error',
  };
}

/**
 * Updates a match result and advances winner (and semi-final losers to 3rd place) in the bracket.
 */
export function applyMatchResult(
  matches: TournamentMatch[],
  matchId: string,
  score1: number,
  score2: number,
  targetScore: number = 11
): {
  updatedMatches: TournamentMatch[];
  champion?: TournamentTeam | null;
  runnerUp?: TournamentTeam | null;
  thirdPlace?: TournamentTeam | null;
} {
  const updatedMatches = matches.map((m) => ({ ...m }));
  const targetMatch = updatedMatches.find((m) => m.id === matchId);
  if (!targetMatch) return { updatedMatches };

  const validation = validatePickleballMatchScore(score1, score2, targetScore);
  if (!validation.valid && !validation.isReset) {
    return { updatedMatches };
  }

  targetMatch.score1 = score1;
  targetMatch.score2 = score2;
  const isFinished = validation.valid && !validation.isReset;
  targetMatch.completed = isFinished;
  targetMatch.winner = validation.winner;

  const winnerTeam = targetMatch.winner === 1 ? targetMatch.team1 : targetMatch.winner === 2 ? targetMatch.team2 : null;
  const loserTeam = targetMatch.winner === 1 ? targetMatch.team2 : targetMatch.winner === 2 ? targetMatch.team1 : null;

  let champion: TournamentTeam | null = null;
  let runnerUp: TournamentTeam | null = null;
  let thirdPlace: TournamentTeam | null = null;

  // If this was the Final match
  if (targetMatch.roundName === 'Chung Kết' && isFinished) {
    champion = winnerTeam || null;
    runnerUp = loserTeam || null;
  }

  // If this was the 3rd place match
  if (targetMatch.roundName === 'Tranh Hạng 3' && isFinished) {
    thirdPlace = winnerTeam || null;
  }

  // Advance winner to next match in Knockout
  if (targetMatch.nextMatchId && winnerTeam) {
    const nextMatch = updatedMatches.find((m) => m.id === targetMatch.nextMatchId);
    if (nextMatch) {
      if (targetMatch.nextMatchSlot === 1) {
        nextMatch.team1 = winnerTeam;
      } else {
        nextMatch.team2 = winnerTeam;
      }
    }
  }

  // If this was a Semi-Final, also route the loser to the 3rd place match
  if (targetMatch.roundName === 'Bán Kết' && loserTeam) {
    const bronzeMatch = updatedMatches.find((m) => m.roundName === 'Tranh Hạng 3');
    if (bronzeMatch) {
      if (targetMatch.matchIndex === 1) {
        bronzeMatch.team1 = loserTeam;
      } else {
        bronzeMatch.team2 = loserTeam;
      }
    }
  }

  return { updatedMatches, champion, runnerUp, thirdPlace };
}
