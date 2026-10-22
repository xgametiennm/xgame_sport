export interface SetScore {
  team1: number;
  team2: number;
}

export interface SetValidationResult {
  valid: boolean;
  winner?: 1 | 2;
  error?: string;
  diff?: number;
}

export interface MatchValidationResult {
  valid: boolean;
  winner?: 1 | 2;
  team1SetsWon: number;
  team2SetsWon: number;
  sets: SetScore[];
  error?: string;
}

/**
 * Validates a single Pickleball set score according to official rules:
 * 1. Must reach targetScore (11, 15, or 21).
 * 2. Cannot be a tie.
 * 3. Must win by at least 2 points (Win-by-2).
 */
export function validatePickleballSet(
  score1: number,
  score2: number,
  targetScore: number = 11
): SetValidationResult {
  if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 < 0 || score2 < 0) {
    return { valid: false, error: 'Điểm số không được để trống hoặc nhỏ hơn 0' };
  }

  const s1 = Math.round(score1);
  const s2 = Math.round(score2);

  if (s1 === s2) {
    return { 
      valid: false, 
      error: `Tỉ số không thể hòa (${s1} - ${s2}). Pickleball bắt buộc phải có đội thắng.` 
    };
  }

  const maxScore = Math.max(s1, s2);
  const minScore = Math.min(s1, s2);
  const diff = maxScore - minScore;
  const winner: 1 | 2 = s1 > s2 ? 1 : 2;

  if (maxScore < targetScore) {
    return {
      valid: false,
      winner,
      diff,
      error: `Chưa đạt điểm kết thúc: Đội thắng phải đạt tối thiểu ${targetScore} điểm (hiện tại: ${s1} - ${s2})`,
    };
  }

  if (diff < 2) {
    return {
      valid: false,
      winner,
      diff,
      error: `Chưa đủ cách biệt: Luật Pickleball bắt buộc thắng cách biệt ít nhất 2 điểm (hiện tại: ${s1} - ${s2}, thiếu ${2 - diff} điểm)`,
    };
  }

  return {
    valid: true,
    winner,
    diff,
  };
}

/**
 * Validates an entire match (1 Set or Best of 3):
 */
export function validatePickleballMatch(
  mode: 'single' | 'best_of_3',
  sets: SetScore[],
  targetScore: number = 11
): MatchValidationResult {
  if (mode === 'single') {
    const s = sets[0] || { team1: 0, team2: 0 };
    const res = validatePickleballSet(s.team1, s.team2, targetScore);
    if (!res.valid) {
      return {
        valid: false,
        team1SetsWon: 0,
        team2SetsWon: 0,
        sets: [s],
        error: res.error,
      };
    }
    return {
      valid: true,
      winner: res.winner,
      team1SetsWon: res.winner === 1 ? 1 : 0,
      team2SetsWon: res.winner === 2 ? 1 : 0,
      sets: [s],
    };
  }

  // Best of 3 mode
  const s1 = sets[0] || { team1: 0, team2: 0 };
  const s2 = sets[1] || { team1: 0, team2: 0 };
  const s3 = sets[2] || { team1: 0, team2: 0 };

  const res1 = validatePickleballSet(s1.team1, s1.team2, targetScore);
  if (!res1.valid) {
    return {
      valid: false,
      team1SetsWon: 0,
      team2SetsWon: 0,
      sets: [s1],
      error: `Hiệp 1: ${res1.error}`,
    };
  }

  const res2 = validatePickleballSet(s2.team1, s2.team2, targetScore);
  if (!res2.valid) {
    return {
      valid: false,
      team1SetsWon: res1.winner === 1 ? 1 : 0,
      team2SetsWon: res1.winner === 2 ? 1 : 0,
      sets: [s1, s2],
      error: `Hiệp 2: ${res2.error}`,
    };
  }

  let t1Wins = (res1.winner === 1 ? 1 : 0) + (res2.winner === 1 ? 1 : 0);
  let t2Wins = (res1.winner === 2 ? 1 : 0) + (res2.winner === 2 ? 1 : 0);

  // If 2-0 or 0-2, match is finished in 2 sets!
  if (t1Wins === 2) {
    return {
      valid: true,
      winner: 1,
      team1SetsWon: 2,
      team2SetsWon: 0,
      sets: [s1, s2],
    };
  }

  if (t2Wins === 2) {
    return {
      valid: true,
      winner: 2,
      team1SetsWon: 0,
      team2SetsWon: 2,
      sets: [s1, s2],
    };
  }

  // If 1-1, Set 3 is required!
  const res3 = validatePickleballSet(s3.team1, s3.team2, targetScore);
  if (!res3.valid) {
    return {
      valid: false,
      team1SetsWon: 1,
      team2SetsWon: 1,
      sets: [s1, s2, s3],
      error: `Hiệp 3 (Quyết định): ${res3.error}`,
    };
  }

  if (res3.winner === 1) t1Wins++;
  else t2Wins++;

  return {
    valid: true,
    winner: res3.winner,
    team1SetsWon: t1Wins,
    team2SetsWon: t2Wins,
    sets: [s1, s2, s3],
  };
}
