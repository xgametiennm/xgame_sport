import assert from 'assert';

const BASE_URL = process.env.API_URL || 'http://localhost:5088/api';

// Colors for rich terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(title, text = '') {
  console.log(`${colors.cyan}[${title}]${colors.reset} ${text}`);
}

function success(msg) {
  console.log(`  ${colors.green}✔ ${msg}${colors.reset}`);
}

function fail(msg, err) {
  console.error(`  ${colors.red}✖ ${msg}${colors.reset}`, err || '');
}

function header(title) {
  console.log(`\n${colors.bright}${colors.magenta}======================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.yellow} ${title} ${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}======================================================================${colors.reset}`);
}

// DUPR Mathematical Algorithm (mirrors client-side src/utils/duprCalculator.ts)
function calculateDupr(input) {
  const isDoubles = input.format === 'doubles';
  const t1AvgRating = isDoubles && input.t1p2Rating
    ? (input.t1p1Rating + input.t1p2Rating) / 2
    : input.t1p1Rating;
  const t2AvgRating = isDoubles && input.t2p2Rating
    ? (input.t2p1Rating + input.t2p2Rating) / 2
    : input.t2p1Rating;

  const ratingDiff = t1AvgRating - t2AvgRating;
  const expectedWinProb1 = 1 / (1 + Math.pow(10, -ratingDiff / 1.25));
  const expectedWinProb2 = 1 - expectedWinProb1;
  const expectedPointsShare1 = 1 / (1 + Math.pow(10, -ratingDiff / 0.90));
  const expectedPointsShare2 = 1 - expectedPointsShare1;

  let t1TotalPoints = 0;
  let t2TotalPoints = 0;
  let t1SetsWon = 0;
  let t2SetsWon = 0;

  for (const s of input.sets) {
    t1TotalPoints += s.team1;
    t2TotalPoints += s.team2;
    if (s.team1 > s.team2) t1SetsWon++;
    else if (s.team2 > s.team1) t2SetsWon++;
  }

  const allPoints = t1TotalPoints + t2TotalPoints || 1;
  const actualPointsShare1 = t1TotalPoints / allPoints;
  const actualPointsShare2 = t2TotalPoints / allPoints;
  const winner = t1SetsWon >= t2SetsWon ? 1 : 2;

  const totalPointDiff = Math.abs(t1TotalPoints - t2TotalPoints);
  const target = input.targetScore || 11;
  const movMultiplier = Math.min(2.0, Math.max(0.65, Math.sqrt((totalPointDiff + 1) / target)));

  let baseK = 0.12;
  if (input.importance === 'sanctioned') baseK = 0.18;
  else if (input.importance === 'casual') baseK = 0.08;

  const performanceDiff1 = actualPointsShare1 - expectedPointsShare1;
  let rawTeam1Delta = baseK * performanceDiff1 * movMultiplier;

  if (winner === 1 && rawTeam1Delta <= 0.002) {
    rawTeam1Delta = 0.006 * movMultiplier;
  } else if (winner === 2 && rawTeam1Delta >= -0.002) {
    rawTeam1Delta = -0.006 * movMultiplier;
  }

  const maxDelta = input.importance === 'sanctioned' ? 0.35 : 0.25;
  rawTeam1Delta = Math.max(-maxDelta, Math.min(maxDelta, rawTeam1Delta));

  const getReliabilityMultiplier = (matches) => {
    if ((matches || 0) < 5) return 1.5;
    if ((matches || 0) < 10) return 1.3;
    if ((matches || 0) < 25) return 1.0;
    if ((matches || 0) < 50) return 0.85;
    return 0.75;
  };

  const t1p1Mult = getReliabilityMultiplier(input.t1p1Matches);
  const t1p2Mult = isDoubles ? getReliabilityMultiplier(input.t1p2Matches || 10) : 1;
  const t2p1Mult = getReliabilityMultiplier(input.t2p1Matches);
  const t2p2Mult = isDoubles ? getReliabilityMultiplier(input.t2p2Matches || 10) : 1;

  const t1p1Delta = parseFloat((rawTeam1Delta * t1p1Mult).toFixed(3));
  const t1p2Delta = isDoubles ? parseFloat((rawTeam1Delta * t1p2Mult).toFixed(3)) : undefined;
  const t2p1Delta = parseFloat((-rawTeam1Delta * t2p1Mult).toFixed(3));
  const t2p2Delta = isDoubles ? parseFloat((-rawTeam1Delta * t2p2Mult).toFixed(3)) : undefined;

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
    t1p2Delta,
    t2p1Delta,
    t2p2Delta,
  };
}

function buildMatchPayload({ clubId, format, importance, courtName, p1, p2, p3, p4, score1, score2, notes }) {
  const isDoubles = format === 'doubles';
  const rating = (p) => (isDoubles ? p.doublesRating : p.singlesRating);
  const played = (p) => (isDoubles ? p.matchesPlayedDoubles : p.matchesPlayedSingles);
  const sets = [{ team1: score1, team2: score2 }];

  const calc = calculateDupr({
    format,
    importance,
    targetScore: 11,
    winByTwo: true,
    bestOfSets: 1,
    t1p1Rating: rating(p1),
    t1p1Matches: played(p1),
    t1p2Rating: p2 ? rating(p2) : undefined,
    t1p2Matches: p2 ? played(p2) : undefined,
    t2p1Rating: rating(p3),
    t2p1Matches: played(p3),
    t2p2Rating: p4 ? rating(p4) : undefined,
    t2p2Matches: p4 ? played(p4) : undefined,
    sets,
  });

  return {
    clubId,
    id: `match-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    date: new Date().toISOString(),
    format,
    importance,
    courtName: courtName || 'Sân CLB Trung Tâm',
    winner: calc.winner,
    sets,
    totalScoreTeam1: score1,
    totalScoreTeam2: score2,
    team1: {
      player1: p1,
      player2: p2,
      startRatingAvg: calc.t1AvgRating,
      deltaRating: calc.ratingDeltaTeam1,
      newRatingAvg: parseFloat((calc.t1AvgRating + calc.ratingDeltaTeam1).toFixed(3)),
    },
    team2: {
      player1: p3,
      player2: p4,
      startRatingAvg: calc.t2AvgRating,
      deltaRating: calc.ratingDeltaTeam2,
      newRatingAvg: parseFloat((calc.t2AvgRating + calc.ratingDeltaTeam2).toFixed(3)),
    },
    expectedWinProbTeam1: calc.expectedWinProb1,
    expectedWinProbTeam2: calc.expectedWinProb2,
    expectedPointsShareTeam1: calc.expectedPointsShare1,
    actualPointsShareTeam1: calc.actualPointsShare1,
    marginOfVictoryFactor: calc.marginOfVictoryFactor,
    notes: notes || 'Trận đấu xếp hạng chính thức',
  };
}

// Client helper for a user session
class UserClient {
  constructor(userData) {
    this.name = userData.name;
    this.email = userData.email;
    this.password = userData.password;
    this.baselineRating = userData.rating;
    this.token = null;
    this.user = null;
  }

  get headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) {
      h['Cookie'] = `xgame_token=${this.token}`;
      h['Authorization'] = `Bearer ${this.token}`;
    }
    return h;
  }

  async request(path, options = {}) {
    const res = await globalThis.fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...this.headers, ...options.headers },
    });

    // Capture cookie if set
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/xgame_token=([^;]+)/);
      if (match) this.token = match[1];
    }

    const json = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data: json };
  }

  async register() {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: this.email, name: this.name, password: this.password }),
    });
    if (res.ok) this.user = res.data.user;
    return res;
  }

  async login(password = this.password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: this.email, password }),
    });
    if (res.ok) this.user = res.data.user;
    return res;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async updateMe(payload) {
    return this.request('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async getClubs() {
    return this.request('/clubs');
  }

  async createClub(payload) {
    return this.request('/clubs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async joinClub(code) {
    return this.request('/clubs/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async updateClub(clubId, payload) {
    return this.request(`/clubs/${clubId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteClub(clubId) {
    return this.request(`/clubs/${clubId}`, { method: 'DELETE' });
  }

  async getPlayers(clubId) {
    return this.request(`/players?clubId=${encodeURIComponent(clubId)}`);
  }

  async createGuestPlayer(payload) {
    return this.request('/players', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updatePlayerRole(playerId, role) {
    return this.request(`/players/${playerId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async removePlayer(playerId) {
    return this.request(`/players/${playerId}`, { method: 'DELETE' });
  }

  async getMatches(clubId) {
    return this.request(`/matches?clubId=${encodeURIComponent(clubId)}`);
  }

  async recordMatch(payload) {
    return this.request('/matches', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getSession(clubId) {
    return this.request(`/clubs/${clubId}/session`);
  }

  async saveSession(clubId, session) {
    return this.request(`/clubs/${clubId}/session`, {
      method: 'PUT',
      body: JSON.stringify(session),
    });
  }

  async deleteSession(clubId) {
    return this.request(`/clubs/${clubId}/session`, { method: 'DELETE' });
  }
}

// 30 Realistic Users Definitions
const USER_PROFILES = [
  { name: 'Nguyễn Văn An', email: 'an.nguyen@xgame.vn', password: 'Pickleball@2026', rating: 4.85 },
  { name: 'Trần Thị Bình', email: 'binh.tran@xgame.vn', password: 'Pickleball@2026', rating: 4.40 },
  { name: 'Lê Hoàng Cường', email: 'cuong.le@xgame.vn', password: 'Pickleball@2026', rating: 4.25 },
  { name: 'Phạm Minh Đức', email: 'duc.pham@xgame.vn', password: 'Pickleball@2026', rating: 4.10 },
  { name: 'Hoàng Thu Hà', email: 'ha.hoang@xgame.vn', password: 'Pickleball@2026', rating: 3.95 },
  { name: 'Vũ Hải Long', email: 'long.vu@xgame.vn', password: 'Pickleball@2026', rating: 3.85 },
  { name: 'Đặng Quốc Tuấn', email: 'tuan.dang@xgame.vn', password: 'Pickleball@2026', rating: 3.80 },
  { name: 'Bùi Ngọc Mai', email: 'mai.bui@xgame.vn', password: 'Pickleball@2026', rating: 3.75 },
  { name: 'Đỗ Quang Huy', email: 'huy.do@xgame.vn', password: 'Pickleball@2026', rating: 3.70 },
  { name: 'Ngô Phương Linh', email: 'linh.ngo@xgame.vn', password: 'Pickleball@2026', rating: 3.65 },
  { name: 'Dương Đình Trọng', email: 'trong.duong@xgame.vn', password: 'Pickleball@2026', rating: 3.60 },
  { name: 'Lý Gia Bảo', email: 'bao.ly@xgame.vn', password: 'Pickleball@2026', rating: 3.55 },
  { name: 'Chu Đức Anh', email: 'anh.chu@xgame.vn', password: 'Pickleball@2026', rating: 3.50 },
  { name: 'Võ Nhật Nam', email: 'nam.vo@xgame.vn', password: 'Pickleball@2026', rating: 3.45 },
  { name: 'Phan Thị Hương', email: 'huong.phan@xgame.vn', password: 'Pickleball@2026', rating: 3.40 },
  { name: 'Trịnh Quốc Bảo', email: 'bao.trinh@xgame.vn', password: 'Pickleball@2026', rating: 3.35 },
  { name: 'Đoàn Minh Tú', email: 'tu.doan@xgame.vn', password: 'Pickleball@2026', rating: 3.30 },
  { name: 'Mai Thanh Tùng', email: 'tung.mai@xgame.vn', password: 'Pickleball@2026', rating: 3.25 },
  { name: 'Lâm Vĩnh Khang', email: 'khang.lam@xgame.vn', password: 'Pickleball@2026', rating: 3.20 },
  { name: 'Cao Thùy Dung', email: 'dung.cao@xgame.vn', password: 'Pickleball@2026', rating: 3.15 },
  { name: 'Hà Tiến Dũng', email: 'dung.ha@xgame.vn', password: 'Pickleball@2026', rating: 3.10 },
  { name: 'Tạ Minh Triết', email: 'triet.ta@xgame.vn', password: 'Pickleball@2026', rating: 3.05 },
  { name: 'Lương Kiều Oanh', email: 'oanh.luong@xgame.vn', password: 'Pickleball@2026', rating: 3.00 },
  { name: 'Đinh Trọng Nghĩa', email: 'nghia.dinh@xgame.vn', password: 'Pickleball@2026', rating: 2.95 },
  { name: 'Quách Thành Danh', email: 'danh.quach@xgame.vn', password: 'Pickleball@2026', rating: 2.90 },
  { name: 'Nghiêm Xuân Mạnh', email: 'manh.nghiem@xgame.vn', password: 'Pickleball@2026', rating: 4.70 },
  { name: 'Tô Văn Vũ', email: 'vu.to@xgame.vn', password: 'Pickleball@2026', rating: 4.30 },
  { name: 'Lưu Hồng Nhung', email: 'nhung.luu@xgame.vn', password: 'Pickleball@2026', rating: 3.85 },
  { name: 'Trương Đình Luật', email: 'luat.truong@xgame.vn', password: 'Pickleball@2026', rating: 3.60 },
  { name: 'Huỳnh Tấn Tài', email: 'tai.huynh@xgame.vn', password: 'Pickleball@2026', rating: 4.15 },
];

async function runSimulationAndTests() {
  header('BẮT ĐẦU GIẢ LẬP 30 USER VÀ TEST TOÀN DIỆN HỆ THỐNG XGAME PICKLEBALL');

  const clients = USER_PROFILES.map((p) => new UserClient(p));
  let club1 = null;
  let club2 = null;

  // =========================================================================
  // 1. KIỂM TRA ĐĂNG KÝ VÀ XÁC THỰC (AUTHENTICATION)
  // =========================================================================
  header('PHẦN 1: TEST ĐĂNG KÝ, XÁC THỰC & BẢO MẬT (30 USERS)');
  
  // Test validation errors
  log('Test Auth', 'Kiểm tra từ chối email không hợp lệ...');
  const badEmailRes = await clients[0].request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: 'bademail', name: 'Test', password: '123456' }),
  });
  assert.strictEqual(badEmailRes.status, 400, 'Phải từ chối email sai định dạng');
  success('Validation từ chối email không hợp lệ thành công');

  log('Test Auth', 'Kiểm tra từ chối mật khẩu quá ngắn (< 6 ký tự)...');
  const shortPassRes = await clients[0].request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: 'valid@xgame.vn', name: 'Test', password: '123' }),
  });
  assert.strictEqual(shortPassRes.status, 400, 'Phải từ chối mật khẩu quá ngắn');
  success('Validation từ chối mật khẩu ngắn thành công');

  log('Test Auth', 'Tiến hành đăng ký 30 user giả lập vào hệ thống...');
  for (let i = 0; i < clients.length; i++) {
    const c = clients[i];
    const regRes = await c.register();
    if (regRes.status === 201) {
      assert(c.user && c.user.id, `User ${c.name} phải nhận được ID sau khi đăng ký`);
    } else if (regRes.status === 400 && regRes.data.error.includes('đã được đăng ký')) {
      // Đã tồn tại từ lần chạy trước -> tiến hành login
      const loginRes = await c.login();
      assert.strictEqual(loginRes.status, 200, `User ${c.name} đã tồn tại phải đăng nhập thành công`);
    } else {
      throw new Error(`Đăng ký user ${c.name} thất bại: ${JSON.stringify(regRes.data)}`);
    }
  }
  success(`Hoàn tất khởi tạo và đăng ký thành công cả 30/30 users!`);

  log('Test Auth', 'Kiểm tra từ chối đăng ký trùng email...');
  const dupRes = await clients[0].request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: clients[0].email, name: 'Duplicate', password: '123456' }),
  });
  assert.strictEqual(dupRes.status, 400);
  success('Hệ thống ngăn chặn đúng khi đăng ký trùng email');

  log('Test Auth', 'Kiểm tra đăng nhập sai mật khẩu...');
  const wrongPassRes = await clients[0].login('WrongPass@999');
  assert.strictEqual(wrongPassRes.status, 401);
  success('Hệ thống từ chối đăng nhập sai mật khẩu (HTTP 401)');

  log('Test Auth', 'Đăng nhập lại chính xác và kiểm tra lấy thông tin session (GET /api/auth/me)...');
  await clients[0].login();
  const meRes = await clients[0].getMe();
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meRes.data.user.email, clients[0].email);
  success(`Session hợp lệ cho user ${meRes.data.user.name} (${meRes.data.user.email})`);

  // =========================================================================
  // 2. KHỞI TẠO CÂU LẠC BỘ & THAM GIA CLB (CLUBS & JOIN CODES)
  // =========================================================================
  header('PHẦN 2: TEST KHỞI TẠO CÂU LẠC BỘ & THAM GIA BẰNG JOIN CODE');

  // User 0 (Nguyễn Văn An) tạo CLB 1
  log('Clubs', 'User 1 (Nguyễn Văn An) khởi tạo "Hà Nội Pickleball Premier League"...');
  const c1Res = await clients[0].createClub({
    name: 'Hà Nội Pickleball Premier League',
    location: 'Sân Trung Tâm Cầu Giấy, Hà Nội',
    description: 'Giải đấu Pickleball cấp câu lạc bộ đỉnh cao khu vực miền Bắc',
    courtsCount: 6,
  });
  assert(c1Res.status === 201 || c1Res.status === 200, `Khởi tạo CLB 1 thất bại: ${JSON.stringify(c1Res.data)}`);
  club1 = c1Res.data.data;
  assert(club1.joinCode, 'CLB 1 phải có join_code');
  assert.strictEqual(club1.myRole, 'owner', 'Người tạo phải có vai trò owner');
  success(`CLB 1 được tạo: "${club1.name}" (Mã tham gia: ${club1.joinCode}, Sân: ${club1.courtsCount})`);

  // User 1 (Trần Thị Bình) tạo CLB 2
  log('Clubs', 'User 2 (Trần Thị Bình) khởi tạo "Saigon Elite Pickleball Club"...');
  const c2Res = await clients[1].createClub({
    name: 'Saigon Elite Pickleball Club',
    location: 'Sân Thảo Điền Sports Complex, TP. Hồ Chí Minh',
    description: 'Câu lạc bộ DUPR giao lưu và thi đấu đẳng cấp cao Sài Gòn',
    courtsCount: 4,
  });
  assert(c2Res.status === 201 || c2Res.status === 200, `Khởi tạo CLB 2 thất bại: ${JSON.stringify(c2Res.data)}`);
  club2 = c2Res.data.data;
  assert(club2.joinCode, 'CLB 2 phải có join_code');
  assert.strictEqual(club2.myRole, 'owner');
  success(`CLB 2 được tạo: "${club2.name}" (Mã tham gia: ${club2.joinCode}, Sân: ${club2.courtsCount})`);

  // Join testing: mã sai
  log('Clubs', 'Kiểm tra tham gia bằng mã không tồn tại...');
  const badCodeRes = await clients[2].joinClub('INVALID999');
  assert.strictEqual(badCodeRes.status, 404);
  success('Báo lỗi 404 chuẩn xác khi mã CLB không tồn tại');

  // Cho Users 1 đến 24 (24 users) tham gia CLB 1
  log('Clubs', `Cho 24 thành viên tham gia CLB 1 bằng mã "${club1.joinCode}"...`);
  for (let i = 1; i <= 24; i++) {
    const joinRes = await clients[i].joinClub(club1.joinCode);
    assert.strictEqual(joinRes.status, 200, `User ${clients[i].name} phải tham gia được CLB 1`);
  }
  success(`25 thành viên (1 chủ sân + 24 thành viên) đã gia nhập CLB 1`);

  // Cho Users 15 đến 29 (15 users) tham gia CLB 2 (Các user 15-24 sẽ thuộc CẢ 2 CLB để test đa CLB)
  log('Clubs', `Cho 14 thành viên tham gia CLB 2 bằng mã "${club2.joinCode}"...`);
  for (let i = 15; i < 30; i++) {
    if (i === 1) continue; // User 1 là owner CLB 2 rồi
    const joinRes = await clients[i].joinClub(club2.joinCode);
    assert.strictEqual(joinRes.status, 200, `User ${clients[i].name} phải tham gia được CLB 2`);
  }
  success(`16 thành viên (1 chủ sân + 15 thành viên) đã gia nhập CLB 2`);

  // Kiểm tra multi-club membership cho user 15
  log('Clubs', 'Kiểm tra danh sách CLB của User 15 (thuộc cả 2 CLB)...');
  const user15Clubs = await clients[15].getClubs();
  assert.strictEqual(user15Clubs.status, 200);
  assert(user15Clubs.data.data.length >= 2, 'User 15 phải có ít nhất 2 CLB');
  success(`User 15 (${clients[15].name}) hiển thị đúng danh sách 2 CLB: ${user15Clubs.data.data.map(c => c.name).join(', ')}`);

  // Test Update Club metadata (Owner cập nhật thành công, Member cập nhật bị từ chối)
  log('Clubs', 'Chủ sân cập nhật mô tả và số sân CLB 1...');
  const updateClubRes = await clients[0].updateClub(club1.id, {
    description: 'CLB Pickleball hàng đầu với 6 sân chuẩn quốc tế và hệ thống DUPR tự động',
  });
  assert.strictEqual(updateClubRes.status, 200);
  success('Chủ sân cập nhật thông tin CLB thành công');

  log('Clubs', 'Thành viên thường cố gắng sửa thông tin CLB...');
  const unauthClubUpdate = await clients[5].updateClub(club1.id, { name: 'CLB Hack' });
  assert.strictEqual(unauthClubUpdate.status, 403);
  success('Hệ thống chặn chuẩn xác (403 Forbidden) khi thành viên thường cố sửa CLB');

  // =========================================================================
  // 3. QUẢN LÝ THÀNH VIÊN, PHÂN QUYỀN & KHÁCH VÃNG LAI (ROLES & GUESTS)
  // =========================================================================
  header('PHẦN 3: TEST PHÂN QUYỀN (ROLES), GUEST PLAYERS & QUẢN LÝ ROSTER');

  // Lấy danh sách players của CLB 1
  let p1ListRes = await clients[0].getPlayers(club1.id);
  assert.strictEqual(p1ListRes.status, 200);
  let club1Players = p1ListRes.data.data;
  log('Players', `CLB 1 hiện có ${club1Players.length} người chơi trong roster`);

  // Cập nhật điểm ban đầu (baseline ratings) phù hợp với hồ sơ của 25 người chơi
  log('Players', 'Thiết lập baseline DUPR rating cho từng VĐV theo trình độ thực tế...');
  for (let i = 0; i <= 24; i++) {
    const c = clients[i];
    await c.updateMe({
      name: c.name,
      doublesRating: c.baselineRating,
      singlesRating: parseFloat((c.baselineRating - 0.25).toFixed(2)),
      clubId: club1.id,
    });
  }
  p1ListRes = await clients[0].getPlayers(club1.id);
  club1Players = p1ListRes.data.data;
  success('Đã cập nhật rating khởi điểm cho các thành viên');

  // Thăng cấp 2 quản trị viên (Admin) cho CLB 1: User 2 (Lê Hoàng Cường) và User 3 (Phạm Minh Đức)
  const targetAdmin1 = club1Players.find(p => p.userId === clients[2].user.id);
  const targetAdmin2 = club1Players.find(p => p.userId === clients[3].user.id);
  assert(targetAdmin1 && targetAdmin2, 'Phải tìm thấy 2 thành viên cần thăng chức');

  log('Roles', `Chủ sân thăng cấp ${targetAdmin1.name} và ${targetAdmin2.name} lên Quản trị viên (Admin)...`);
  const promoteRes1 = await clients[0].updatePlayerRole(targetAdmin1.id, 'admin');
  const promoteRes2 = await clients[0].updatePlayerRole(targetAdmin2.id, 'admin');
  assert.strictEqual(promoteRes1.status, 200);
  assert.strictEqual(promoteRes2.status, 200);
  success(`Thăng cấp Admin thành công cho ${targetAdmin1.name} và ${targetAdmin2.name}`);

  // Test Admin tạo Khách vãng lai (Guest Player chưa có tài khoản)
  log('Guests', 'Admin thêm khách vãng lai offline: "Khách VIP Triệu Vĩ"...');
  const guestRes = await clients[2].createGuestPlayer({
    clubId: club1.id,
    name: 'Khách VIP Triệu Vĩ',
    email: 'trieuvi.guest@xgame.vn',
    doublesRating: 3.8,
    singlesRating: 3.5,
  });
  assert.strictEqual(guestRes.status, 201);
  const guestPlayer = guestRes.data.data;
  assert.strictEqual(guestPlayer.userId, null, 'Guest player ban đầu không có user_id');
  success(`Tạo thành công khách vãng lai: ${guestPlayer.name} (ID: ${guestPlayer.id})`);

  // Test xóa thành viên (Soft-delete: removed_at)
  const targetToRemove = club1Players.find(p => p.userId === clients[24].user.id);
  log('Members', `Admin thử xóa thành viên ${targetToRemove.name} khỏi CLB...`);
  const removeRes = await clients[2].removePlayer(targetToRemove.id);
  assert.strictEqual(removeRes.status, 200);
  
  // Xác nhận người bị xóa không còn trong danh sách active players
  const afterRemoveList = await clients[0].getPlayers(club1.id);
  assert(!afterRemoveList.data.data.some(p => p.id === targetToRemove.id), 'Người bị xóa không được xuất hiện trong danh sách active');
  success(`Thành viên ${targetToRemove.name} đã được gỡ khỏi danh sách CLB (soft-delete)`);

  // Thành viên đó tham gia lại bằng joinCode -> được khôi phục thành công!
  log('Members', `Thành viên ${clients[24].name} nhập lại mã "${club1.joinCode}" để tham gia lại CLB...`);
  const rejoinRes = await clients[24].joinClub(club1.joinCode);
  assert.strictEqual(rejoinRes.status, 200);
  const restoredList = await clients[0].getPlayers(club1.id);
  assert(restoredList.data.data.some(p => p.userId === clients[24].user.id), 'Thành viên phải được khôi phục thành công');
  success(`Thành viên ${clients[24].name} đã phục hồi tư cách hội viên thành công!`);

  // =========================================================================
  // 4. MÔ PHỎNG 35 TRẬN ĐẤU & TEST THUẬT TOÁN DUPR ENGINE
  // =========================================================================
  header('PHẦN 4: MÔ PHỎNG 35 TRẬN ĐẤU THỰC TẾ & TEST THUẬT TOÁN DUPR');

  // Lấy danh sách người chơi mới nhất
  p1ListRes = await clients[0].getPlayers(club1.id);
  club1Players = p1ListRes.data.data;
  const playerMap = new Map(club1Players.map(p => [p.userId, p]));

  // Danh sách kịch bản 35 trận đấu hấp dẫn
  const matchScenarios = [
    // Trận 1: Doubles cân tài cân sức (11-9)
    { format: 'doubles', t1: [0, 1], t2: [2, 3], score1: 11, score2: 9, imp: 'league', note: 'Khai mạc giải đấu - Trận đôi nam nữ xuất sắc' },
    // Trận 2: Doubles áp đảo (11-3)
    { format: 'doubles', t1: [0, 4], t2: [5, 6], score1: 11, score2: 3, imp: 'league', note: 'Chiến thắng áp đảo với margin điểm lớn' },
    // Trận 3: Doubles deuce kịch tính (13-11)
    { format: 'doubles', t1: [7, 8], t2: [9, 10], score1: 13, score2: 11, imp: 'sanctioned', note: 'Giải chính thức - Trận đấu kéo dài nghẹt thở' },
    // Trận 4: Upset! Cặp đôi rating thấp hơn lội ngược dòng thắng cặp cao hơn
    { format: 'doubles', t1: [18, 19], t2: [1, 2], score1: 11, score2: 8, imp: 'league', note: 'Bất ngờ lớn (Upset): Đội chiếu dưới hạ gục hạt giống' },
    // Trận 5: Singles đỉnh cao 1v1
    { format: 'singles', t1: [0, null], t2: [2, null], score1: 11, score2: 7, imp: 'league', note: 'Đơn nam - An vs Cường' },
    // Trận 6: Singles lội ngược dòng 1v1
    { format: 'singles', t1: [3, null], t2: [4, null], score1: 12, score2: 10, imp: 'casual', note: 'Đơn nam - Đức vs Hà' },
    // Trận 7-15: Chuỗi trận liên hoàn kiểm tra cập nhật liên tục
    { format: 'doubles', t1: [0, 2], t2: [3, 5], score1: 11, score2: 6, imp: 'league', note: 'Vòng 2 Bảng A' },
    { format: 'doubles', t1: [6, 7], t2: [8, 9], score1: 11, score2: 4, imp: 'league', note: 'Vòng 2 Bảng B' },
    { format: 'doubles', t1: [10, 11], t2: [12, 13], score1: 11, score2: 8, imp: 'league', note: 'Vòng 2 Bảng C' },
    { format: 'doubles', t1: [14, 15], t2: [16, 17], score1: 11, score2: 5, imp: 'league', note: 'Vòng 2 Bảng D' },
    { format: 'doubles', t1: [20, 21], t2: [22, 23], score1: 11, score2: 9, imp: 'league', note: 'Vòng 2 Bảng E' },
    { format: 'doubles', t1: [0, 7], t2: [4, 8], score1: 11, score2: 5, imp: 'sanctioned', note: 'Tứ kết giải đấu' },
    { format: 'doubles', t1: [0, 10], t2: [2, 12], score1: 11, score2: 7, imp: 'league', note: 'Bán kết 1' },
    { format: 'doubles', t1: [0, 14], t2: [3, 16], score1: 11, score2: 9, imp: 'league', note: 'Chung kết bảng đấu' },
    { format: 'doubles', t1: [0, 1], t2: [5, 6], score1: 11, score2: 2, imp: 'sanctioned', note: 'Trận đấu áp đảo chung kết' },
    // Trận 16-25: Thêm trận để đưa User 0 và một số user vượt mốc 10 trận (xóa nhãn Provisional!)
    { format: 'doubles', t1: [0, 3], t2: [7, 11], score1: 11, score2: 8, imp: 'league', note: 'Trận kiểm tra mốc 10 trận DUPR' },
    { format: 'doubles', t1: [0, 4], t2: [8, 12], score1: 11, score2: 6, imp: 'league', note: 'Trận 10 của User 0' },
    { format: 'doubles', t1: [0, 5], t2: [9, 13], score1: 11, score2: 4, imp: 'league', note: 'Trận 11 của User 0' },
    { format: 'doubles', t1: [0, 6], t2: [10, 14], score1: 11, score2: 7, imp: 'league', note: 'Trận 12 của User 0' },
    { format: 'doubles', t1: [1, 3], t2: [4, 7], score1: 11, score2: 9, imp: 'league', note: 'Trận giao hữu hội đồng' },
    { format: 'doubles', t1: [2, 5], t2: [6, 8], score1: 11, score2: 5, imp: 'league', note: 'Trận giao lưu cuối tuần' },
    { format: 'doubles', t1: [9, 11], t2: [13, 15], score1: 11, score2: 8, imp: 'league', note: 'Vòng bảng mở rộng' },
    { format: 'doubles', t1: [10, 12], t2: [14, 16], score1: 11, score2: 6, imp: 'league', note: 'Trận đôi nam trung cấp' },
    { format: 'singles', t1: [1, null], t2: [5, null], score1: 11, score2: 4, imp: 'league', note: 'Đơn nữ giao hữu' },
    { format: 'singles', t1: [6, null], t2: [7, null], score1: 11, score2: 8, imp: 'casual', note: 'Đơn nam thân thiện' },
    // Trận 26-35: Các trận phối hợp khắp các cặp đấu
    { format: 'doubles', t1: [17, 18], t2: [19, 20], score1: 11, score2: 9, imp: 'league', note: 'Trận đấu cặp đôi mới' },
    { format: 'doubles', t1: [21, 22], t2: [23, 24], score1: 11, score2: 7, imp: 'league', note: 'Trận tranh hạng 20' },
    { format: 'doubles', t1: [1, 7], t2: [3, 9], score1: 11, score2: 5, imp: 'league', note: 'Trận đôi nam nữ phối hợp' },
    { format: 'doubles', t1: [2, 8], t2: [4, 10], score1: 11, score2: 8, imp: 'league', note: 'Trận đôi nam kịch tính' },
    { format: 'doubles', t1: [0, 2], t2: [1, 3], score1: 11, score2: 9, imp: 'sanctioned', note: 'Siêu kinh điển CLB' },
    { format: 'doubles', t1: [5, 11], t2: [7, 13], score1: 11, score2: 6, imp: 'league', note: 'Trận đấu phân hạng' },
    { format: 'doubles', t1: [6, 12], t2: [8, 14], score1: 11, score2: 4, imp: 'league', note: 'Trận đấu bứt phá điểm số' },
    { format: 'doubles', t1: [15, 17], t2: [16, 18], score1: 11, score2: 8, imp: 'league', note: 'Vòng playoff bảng dưới' },
    { format: 'singles', t1: [0, null], t2: [3, null], score1: 11, score2: 5, imp: 'sanctioned', note: 'Chung kết đơn nam giải CLB' },
    { format: 'doubles', t1: [0, 1], t2: [2, 4], score1: 11, score2: 7, imp: 'sanctioned', note: 'Trận hạ màn All-Stars' },
  ];

  log('Matches', `Tiến hành ghi nhận ${matchScenarios.length} trận đấu liên hoàn...`);

  let recordedCount = 0;
  for (let idx = 0; idx < matchScenarios.length; idx++) {
    const sc = matchScenarios[idx];
    
    // Refresh players data to get current ratings
    const currList = (await clients[0].getPlayers(club1.id)).data.data;
    const currMap = new Map(currList.map(p => [p.userId, p]));

    const p1 = currMap.get(clients[sc.t1[0]].user.id);
    const p2 = sc.t1[1] !== null ? currMap.get(clients[sc.t1[1]].user.id) : undefined;
    const p3 = currMap.get(clients[sc.t2[0]].user.id);
    const p4 = sc.t2[1] !== null ? currMap.get(clients[sc.t2[1]].user.id) : undefined;

    assert(p1 && p3, `Không tìm thấy người chơi cho trận ${idx + 1}`);

    const payload = buildMatchPayload({
      clubId: club1.id,
      format: sc.format,
      importance: sc.imp,
      courtName: `Sân Trung Tâm ${((idx % 4) + 1)}`,
      p1,
      p2,
      p3,
      p4,
      score1: sc.score1,
      score2: sc.score2,
      notes: sc.note,
    });

    const recordRes = await clients[0].recordMatch(payload);
    assert.strictEqual(recordRes.status, 201, `Ghi nhận trận ${idx + 1} thất bại: ${JSON.stringify(recordRes.data)}`);
    recordedCount++;
  }

  success(`Đã ghi nhận thành công toàn bộ ${recordedCount} trận đấu vào cơ sở dữ liệu!`);

  // Kiểm tra Match History API
  log('Matches', 'Kiểm tra API lịch sử trận đấu (GET /api/matches?clubId=...)...');
  const matchesRes = await clients[0].getMatches(club1.id);
  assert.strictEqual(matchesRes.status, 200);
  assert.strictEqual(matchesRes.data.data.length, recordedCount);
  success(`API trả về chính xác ${matchesRes.data.data.length} trận đấu`);

  // Kiểm tra tính chuẩn xác của DUPR engine sau các trận:
  log('DUPR Engine', 'Kiểm tra trạng thái xếp hạng và chỉ số DUPR của User 0 (Nguyễn Văn An)...');
  const finalPlayers = (await clients[0].getPlayers(club1.id)).data.data;
  const user0Player = finalPlayers.find(p => p.userId === clients[0].user.id);

  assert(user0Player.matchesPlayedDoubles >= 10, 'User 0 phải thi đấu >= 10 trận đôi');
  assert.strictEqual(user0Player.provisionalDoubles, false, 'User 0 phải thoát khỏi trạng thái Provisional khi đủ 10 trận!');
  assert(user0Player.doublesRating > clients[0].baselineRating, 'Rating đôi của User 0 phải tăng sau chuỗi trận thắng');
  assert(user0Player.winsDoubles > 0, 'Phải có số trận thắng dương');
  assert(user0Player.streak > 0, 'Chuỗi thắng (streak) phải dương');
  assert(user0Player.form.length > 0 && user0Player.form[0] === 'W', 'Trận gần nhất trong form phải là "W"');
  success(`User 0: Rating ${user0Player.doublesRating} (ban đầu ${clients[0].baselineRating}), Số trận: ${user0Player.matchesPlayedDoubles}, Thắng: ${user0Player.winsDoubles}, Chuỗi thắng: ${user0Player.streak}, Provisional: ${user0Player.provisionalDoubles ? 'Chưa' : 'Đã xác thực (Đủ 10 trận)'}`);

  // Kiểm tra CLB 2: Cũng tổ chức 5 trận đấu riêng cho CLB 2
  log('Clubs', 'Tổ chức thêm 5 trận đấu cho CLB 2 (Saigon Elite)...');
  const c2Players = (await clients[1].getPlayers(club2.id)).data.data;
  const c2Map = new Map(c2Players.map(p => [p.userId, p]));
  for (let i = 0; i < 5; i++) {
    const p1 = c2Players[i * 2];
    const p2 = c2Players[i * 2 + 1];
    const p3 = c2Players[(i * 2 + 2) % c2Players.length];
    const p4 = c2Players[(i * 2 + 3) % c2Players.length];
    const payload = buildMatchPayload({
      clubId: club2.id,
      format: 'doubles',
      importance: 'league',
      courtName: 'Sân Thảo Điền 1',
      p1, p2, p3, p4,
      score1: 11, score2: 7,
      notes: `Giao hữu CLB 2 trận ${i + 1}`,
    });
    const res = await clients[1].recordMatch(payload);
    assert.strictEqual(res.status, 201);
  }
  const c2MatchesRes = await clients[1].getMatches(club2.id);
  assert.strictEqual(c2MatchesRes.data.data.length, 5);
  success('CLB 2 ghi nhận và cập nhật độc lập 5 trận đấu thành công');

  // =========================================================================
  // 5. TEST BUỔI ĐẤU & XẾP SÂN (PLAY SESSIONS)
  // =========================================================================
  header('PHẦN 5: TEST TÍNH NĂNG BUỔI ĐẤU (PLAY SESSIONS / LÊN LỊCH & XẾP SÂN)');

  log('Play Sessions', 'Tạo và lưu buổi đấu trực tiếp cho CLB 1...');
  const sampleSession = {
    clubId: club1.id,
    date: new Date().toISOString(),
    courtCount: 4,
    pairingMode: 'balanced',
    memberIds: club1Players.slice(0, 16).map(p => p.id),
    matches: [
      {
        id: 'slot-1',
        courtNumber: 1,
        timeSlot: '18:00 - 18:30',
        team1: [club1Players[0].id, club1Players[1].id],
        team2: [club1Players[2].id, club1Players[3].id],
        scoreTeam1: null,
        scoreTeam2: null,
        completed: false,
      },
      {
        id: 'slot-2',
        courtNumber: 2,
        timeSlot: '18:00 - 18:30',
        team1: [club1Players[4].id, club1Players[5].id],
        team2: [club1Players[6].id, club1Players[7].id],
        scoreTeam1: null,
        scoreTeam2: null,
        completed: false,
      },
    ],
  };

  const saveSessionRes = await clients[0].saveSession(club1.id, sampleSession);
  assert.strictEqual(saveSessionRes.status, 200);
  success('Lưu buổi đấu thành công qua PUT /api/clubs/:id/session');

  log('Play Sessions', 'Đọc lại dữ liệu buổi đấu (GET /api/clubs/:id/session)...');
  const getSessionRes = await clients[0].getSession(club1.id);
  assert.strictEqual(getSessionRes.status, 200);
  assert(getSessionRes.data.data && getSessionRes.data.data.matches.length === 2);
  success(`Lấy dữ liệu buổi đấu thành công: gồm ${getSessionRes.data.data.matches.length} trận đấu đã xếp sân`);

  log('Play Sessions', 'Kết thúc buổi đấu và dọn dẹp (DELETE /api/clubs/:id/session)...');
  const deleteSessionRes = await clients[0].deleteSession(club1.id);
  assert.strictEqual(deleteSessionRes.status, 200);
  const verifyDeleted = await clients[0].getSession(club1.id);
  assert.strictEqual(verifyDeleted.data.data, null);
  success('Kết thúc và xóa buổi đấu thành công (dữ liệu trở về null)');

  // =========================================================================
  // 6. KIỂM TRA BẢNG XẾP HẠNG & TOÀN VẸN DỮ LIỆU (STANDINGS & DATA INTEGRITY)
  // =========================================================================
  header('PHẦN 6: KIỂM TRA BẢNG XẾP HẠNG & TOÀN VẸN DỮ LIỆU');

  const finalClub1Players = (await clients[0].getPlayers(club1.id)).data.data;
  log('Leaderboard', `Bảng xếp hạng CLB 1 TOP 10 sau loạt trận:`);
  console.log(`\n  Hạng | Họ và Tên             | Rating DUPR | Trận Đấu | Thắng/Thua | Chuỗi | Form`);
  console.log(`  -----+-----------------------+-------------+----------+------------+-------+-----------`);
  finalClub1Players.slice(0, 10).forEach((p, idx) => {
    const rank = String(idx + 1).padStart(4, ' ');
    const name = p.name.padEnd(21, ' ');
    const rating = p.doublesRating.toFixed(3).padStart(11, ' ');
    const matches = String(p.matchesPlayedDoubles).padStart(8, ' ');
    const wl = `${p.winsDoubles}/${p.lossesDoubles}`.padStart(10, ' ');
    const streak = String(p.streak > 0 ? `+${p.streak}` : p.streak).padStart(5, ' ');
    const form = p.form.slice(0, 5).join(' ').padEnd(9, ' ');
    console.log(`  ${rank} | ${name} | ${rating} | ${matches} | ${wl} | ${streak} | ${form}`);
  });

  // Kiểm tra sắp xếp: VĐV xếp trên phải có số trận thắng hoặc rating >= người xếp sau
  for (let i = 0; i < finalClub1Players.length - 1; i++) {
    const a = finalClub1Players[i];
    const b = finalClub1Players[i + 1];
    assert(
      a.winsDoubles > b.winsDoubles ||
      (a.winsDoubles === b.winsDoubles && a.doublesRating >= b.doublesRating),
      `Thứ tự bảng xếp hạng không đúng tại vị trí ${i}`
    );
  }
  success('Bảng xếp hạng (Leaderboard) được sắp xếp chuẩn xác 100%!');

  header('KẾT QUẢ: TẤT CẢ TÍNH NĂNG VÀ 30 USER ĐÃ ĐƯỢC GIẢ LẬP & KIỂM TRA HOÀN TẤT THÀNH CÔNG!');
  return {
    totalUsers: clients.length,
    clubsCreated: 2,
    club1Members: finalClub1Players.length,
    matchesSimulated: recordedCount + 5,
    topPlayer: finalClub1Players[0],
  };
}

runSimulationAndTests()
  .then((res) => {
    console.log(`\n${colors.bright}${colors.green}>>> TOÀN BỘ BÀI TEST ĐÃ VƯỢT QUA VỚI KẾT QUẢ HOÀN HẢO! <<<${colors.reset}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`\n${colors.bright}${colors.red}>>> LỖI TEST: ${err.message} <<<${colors.reset}`);
    console.error(err);
    process.exit(1);
  });
