import { DuprCalcInput, DuprCalcOutput, GameFormat } from '../types/pickleball';

/**
 * Calculates DUPR rating change based on official dynamic Elo principles:
 * - Skill rating scale: 2.000 to 8.000
 * - Expected outcome logistic function scaled to pickleball skill intervals
 * - Expected points share vs actual points share
 * - Margin of victory (MOV) multiplier
 * - Match format weight (Best of 3 vs 1 Set) and Tier importance
 * - Player reliability factor (Provisional < 10 matches vs Established)
 */
export function calculateDupr(input: DuprCalcInput): DuprCalcOutput {
  const isDoubles = input.format === 'doubles';

  // 1. Team Averages
  const t1AvgRating = isDoubles && input.t1p2Rating
    ? (input.t1p1Rating + input.t1p2Rating) / 2
    : input.t1p1Rating;

  const t2AvgRating = isDoubles && input.t2p2Rating
    ? (input.t2p1Rating + input.t2p2Rating) / 2
    : input.t2p1Rating;

  const ratingDiff = t1AvgRating - t2AvgRating;

  // 2. Expected Win Probability (Logistic function with DUPR scale factor 1.25)
  // A 0.5 rating difference in DUPR represents a substantial skill advantage (~72% win prob)
  const expectedWinProb1 = 1 / (1 + Math.pow(10, -ratingDiff / 1.25));
  const expectedWinProb2 = 1 - expectedWinProb1;

  // 3. Expected Points Share (Point distribution spread factor 0.90)
  const expectedPointsShare1 = 1 / (1 + Math.pow(10, -ratingDiff / 0.90));
  const expectedPointsShare2 = 1 - expectedPointsShare1;

  // 4. Actual Points & Set Outcomes
  let t1TotalPoints = 0;
  let t2TotalPoints = 0;
  let t1SetsWon = 0;
  let t2SetsWon = 0;

  for (const s of input.sets) {
    t1TotalPoints += s.team1;
    t2TotalPoints += s.team2;
    if (s.team1 > s.team2) {
      t1SetsWon++;
    } else if (s.team2 > s.team1) {
      t2SetsWon++;
    }
  }

  const allPoints = t1TotalPoints + t2TotalPoints || 1;
  const actualPointsShare1 = t1TotalPoints / allPoints;
  const actualPointsShare2 = t2TotalPoints / allPoints;

  const winner: 1 | 2 = t1SetsWon >= t2SetsWon ? 1 : 2;

  // 5. Margin of Victory Multiplier (MOV)
  // Lopsided wins (e.g. 11-1) have higher impact than tight wins (11-9)
  const totalPointDiff = Math.abs(t1TotalPoints - t2TotalPoints);
  const target = input.targetScore || 11;
  const movMultiplier = Math.min(2.0, Math.max(0.65, Math.sqrt((totalPointDiff + 1) / target)));

  // 6. Base K-factor (Match weight)
  let baseK = 0.12; // default Club League
  if (input.importance === 'sanctioned') {
    baseK = 0.18; // Tournament
  } else if (input.importance === 'casual') {
    baseK = 0.08; // Friendly
  }

  // Best of 3 sets gives more data reliability -> 1.2x weight
  if (input.bestOfSets === 3) {
    baseK *= 1.2;
  }

  // 7. Performance delta: actual vs expected points share
  const performanceDiff1 = actualPointsShare1 - expectedPointsShare1;

  // Base raw rating delta for Team 1
  let rawTeam1Delta = baseK * performanceDiff1 * movMultiplier;

  // In pickleball DUPR, winning a match should guarantee a non-negative adjustment
  // unless a massive favorite wins in extreme razor-thin deuce against novices
  if (winner === 1 && rawTeam1Delta <= 0.002) {
    rawTeam1Delta = 0.006 * movMultiplier;
  } else if (winner === 2 && rawTeam1Delta >= -0.002) {
    rawTeam1Delta = -0.006 * movMultiplier;
  }

  // Clamp team delta to avoid wild runaway in a single game
  const maxDelta = input.importance === 'sanctioned' ? 0.35 : 0.25;
  rawTeam1Delta = Math.max(-maxDelta, Math.min(maxDelta, rawTeam1Delta));

  // 8. Player Reliability Factors (Matches played volatility)
  // Provisional players (< 10 matches) adjust faster
  const getReliabilityMultiplier = (matches: number) => {
    if (matches < 5) return 1.5;
    if (matches < 10) return 1.3;
    if (matches < 25) return 1.0;
    if (matches < 50) return 0.85;
    return 0.75; // Highly stabilized veteran
  };

  const t1p1Mult = getReliabilityMultiplier(input.t1p1Matches);
  const t1p2Mult = isDoubles ? getReliabilityMultiplier(input.t1p2Matches || 10) : 1;
  const t2p1Mult = getReliabilityMultiplier(input.t2p1Matches);
  const t2p2Mult = isDoubles ? getReliabilityMultiplier(input.t2p2Matches || 10) : 1;

  // Individual deltas
  const t1p1Delta = parseFloat((rawTeam1Delta * t1p1Mult).toFixed(3));
  const t1p2Delta = isDoubles ? parseFloat((rawTeam1Delta * t1p2Mult).toFixed(3)) : undefined;

  const t2p1Delta = parseFloat((-rawTeam1Delta * t2p1Mult).toFixed(3));
  const t2p2Delta = isDoubles ? parseFloat((-rawTeam1Delta * t2p2Mult).toFixed(3)) : undefined;

  // Calculate new ratings clamped to [2.000, 8.000]
  const clampRating = (val: number) => Math.max(2.000, Math.min(8.000, parseFloat(val.toFixed(3))));

  const t1p1New = clampRating(input.t1p1Rating + t1p1Delta);
  const t1p2New = t1p2Delta !== undefined && input.t1p2Rating !== undefined
    ? clampRating(input.t1p2Rating + t1p2Delta)
    : undefined;

  const t2p1New = clampRating(input.t2p1Rating + t2p1Delta);
  const t2p2New = t2p2Delta !== undefined && input.t2p2Rating !== undefined
    ? clampRating(input.t2p2Rating + t2p2Delta)
    : undefined;

  // Build analysis explanation text
  const winningTeam = winner === 1 ? 'Đội 1' : 'Đội 2';
  const marginText = totalPointDiff > 6
    ? 'cách biệt lớn (áp đảo)'
    : totalPointDiff > 3
    ? 'cách biệt vừa phải'
    : 'sát nút (nghẹt thở)';

  let explanation = `${winningTeam} giành chiến thắng với tỷ số ${t1TotalPoints}-${t2TotalPoints} (${marginText}). `;
  if (Math.abs(ratingDiff) < 0.15) {
    explanation += `Hai đội có trình độ DUPR rất cân bằng (chênh lệch ${Math.abs(ratingDiff).toFixed(3)}). `;
  } else if ((ratingDiff > 0 && winner === 1) || (ratingDiff < 0 && winner === 2)) {
    explanation += `Đội được đánh giá cao hơn đã khẳng định đúng phong độ kỳ vọng. `;
  } else {
    explanation += `KẾT QUẢ BẤT NGỜ (Upset): Đội chiếu dưới đã thi đấu xuất sắc vượt kỳ vọng! `;
  }

  explanation += `Tỷ lệ điểm thực tế đạt ${(actualPointsShare1 * 100).toFixed(1)}% so với kỳ vọng ${(expectedPointsShare1 * 100).toFixed(1)}%. Hệ số MOV: ${movMultiplier.toFixed(2)}x.`;

  return {
    t1AvgRating: parseFloat(t1AvgRating.toFixed(3)),
    t2AvgRating: parseFloat(t2AvgRating.toFixed(3)),
    ratingDiff: parseFloat(ratingDiff.toFixed(3)),
    expectedWinProb1: parseFloat(expectedWinProb1.toFixed(3)),
    expectedWinProb2: parseFloat(expectedWinProb2.toFixed(3)),
    expectedPointsShare1: parseFloat(expectedPointsShare1.toFixed(3)),
    expectedPointsShare2: parseFloat(expectedPointsShare2.toFixed(3)),
    actualPointsShare1: parseFloat(actualPointsShare1.toFixed(3)),
    actualPointsShare2: parseFloat(actualPointsShare2.toFixed(3)),
    winner,
    ratingDeltaTeam1: parseFloat(rawTeam1Delta.toFixed(3)),
    ratingDeltaTeam2: parseFloat((-rawTeam1Delta).toFixed(3)),
    marginOfVictoryFactor: parseFloat(movMultiplier.toFixed(2)),
    t1p1Delta,
    t1p1New,
    t1p2Delta,
    t1p2New,
    t2p1Delta,
    t2p1New,
    t2p2Delta,
    t2p2New,
    analysisExplanation: explanation,
  };
}

/**
 * Returns descriptive skill tier and color for a DUPR rating
 */
export function getDuprTier(rating: number): {
  nameVi: string;
  nameEn: string;
  badgeClass: string;
  color: string;
  desc: string;
} {
  if (rating < 2.5) {
    return {
      nameVi: '🌱 Tân Thủ Nhập Môn (2.0+)',
      nameEn: 'Novice (2.0+)',
      badgeClass: 'tier-novice',
      color: '#94a3b8',
      desc: 'Mới làm quen với luật chơi, cách cầm vợt và vị trí đứng cơ bản.',
    };
  }
  if (rating < 3.0) {
    return {
      nameVi: '🎾 Tay Vợt Tiềm Năng (2.5+)',
      nameEn: 'Beginner (2.5+)',
      badgeClass: 'tier-beginner',
      color: '#38bdf8',
      desc: 'Biết giao bóng qua lưới, duy trì loạt đánh bóng ngắn ổn định.',
    };
  }
  if (rating < 3.5) {
    return {
      nameVi: '⚡ Cao Thủ Giao Lưu (3.0+)',
      nameEn: 'Intermediate (3.0+)',
      badgeClass: 'tier-intermediate',
      color: '#34d399',
      desc: 'Kiểm soát bóng ổn định, bắt đầu biết dink và tiến lên vạch Non-Volley Zone.',
    };
  }
  if (rating < 4.0) {
    return {
      nameVi: '🎯 Bậc Thầy Dinking (3.5+)',
      nameEn: 'High Intermediate (3.5+)',
      badgeClass: 'tier-high-intermediate',
      color: '#a3e635',
      desc: 'Thành thạo Third-shot drop, nhẫn nại dink và điều hướng bóng chủ động.',
    };
  }
  if (rating < 4.5) {
    return {
      nameVi: '💎 Chiến Binh Tinh Anh (4.0+)',
      nameEn: 'Advanced (4.0+)',
      badgeClass: 'tier-advanced',
      color: '#fbbf24',
      desc: 'Phản xạ chớp nhoáng, reset bóng từ cuối sân mượt mà, tấn công góc hiểm.',
    };
  }
  if (rating < 5.0) {
    return {
      nameVi: '🏆 Đại Sư Sân Đấu (4.5+)',
      nameEn: 'Semi-Pro (4.5+)',
      badgeClass: 'tier-semi-pro',
      color: '#f97316',
      desc: 'Kỹ năng đỉnh cao, hạn chế tối đa lỗi tự đánh hỏng, sẵn sàng thi đấu giải mở rộng.',
    };
  }
  return {
    nameVi: '👑 Huyền Thoại Pickleball (5.0+)',
    nameEn: 'Pro / Elite (5.0+)',
    badgeClass: 'tier-pro',
    color: '#ec4899',
    desc: 'Vận động viên đẳng cấp hàng đầu với bản lĩnh thi đấu xuất sắc.',
  };
}
