const db = require('../config/db');
const { newId, isManager } = require('../middleware/auth');

// Club fund: collection rounds ("đợt thu") with who paid, expenses with their receipts,
// and the balance (everything collected minus everything spent). Members can see it all;
// only managers change it (enforced by the routes). Every query is scoped to the club in
// the path, so ids from another club are never reachable. Every change is logged
// (see writeLog) and the log is visible to all members.

const MAX_AMOUNT = 1e12; // VND
// Sent base64-encoded (+33%), so it must stay under the 10MB JSON body limit
const MAX_RECEIPT_BYTES = 7 * 1024 * 1024;
const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const fail = (res, status, error) => res.status(status).json({ success: false, error });

const handle = (label, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(`${label} error:`, err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const parseAmount = (value, { allowZero = false } = {}) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_AMOUNT || (!allowZero && n === 0)) return null;
  return n;
};

const parseDate = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

const text = (value, max) => String(value || '').trim().slice(0, max);

const dateOnly = (d) => {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  // DATE columns come back as local-midnight Dates
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const recorderName = (req) => (req.membership && req.membership.name) || null;

// ---------------------------------------------------------------------------
// Overview

async function getFund(req, res) {
  const clubId = req.params.id;
  const manager = isManager(req.membership);
  // Managers review every report; a member only sees their own
  const claimsQuery = manager
    ? db.query(`SELECT id, campaign_id, player_id, amount, transferred_at, note, proof_mime, status, reviewed_by_name, reviewed_at, review_note, created_at
                FROM fund_claims WHERE club_id = $1 AND (status = 'pending' OR created_at > NOW() - INTERVAL '60 days')
                ORDER BY created_at DESC LIMIT 200`, [clubId])
    : db.query(`SELECT id, campaign_id, player_id, amount, transferred_at, note, proof_mime, status, reviewed_by_name, reviewed_at, review_note, created_at
                FROM fund_claims WHERE club_id = $1 AND player_id = $2
                ORDER BY created_at DESC LIMIT 50`, [clubId, req.membership.id]);
  const [campaigns, contributions, expenses, receipts, settingsRes, claims] = await Promise.all([
    db.query('SELECT * FROM fund_campaigns WHERE club_id = $1 ORDER BY created_at DESC', [clubId]),
    db.query('SELECT * FROM fund_contributions WHERE club_id = $1 ORDER BY paid_at ASC, created_at ASC', [clubId]),
    db.query('SELECT * FROM fund_expenses WHERE club_id = $1 ORDER BY spent_at DESC, created_at DESC', [clubId]),
    db.query('SELECT id, expense_id, mime, file_name, size, created_at FROM fund_receipts WHERE club_id = $1 ORDER BY created_at ASC', [clubId]),
    db.query(`SELECT opening_balance, opening_date, bank_bin, bank_name, account_no, account_name, qr_mime, qr_updated_at
              FROM fund_settings WHERE club_id = $1`, [clubId]),
    claimsQuery,
  ]);
  const settings = settingsRes.rows[0] || {};
  const opening = Number(settings.opening_balance || 0);

  const contributionsOf = new Map();
  contributions.rows.forEach((row) => {
    const list = contributionsOf.get(row.campaign_id) || [];
    list.push({
      id: row.id,
      playerId: row.player_id,
      amount: Number(row.amount),
      paidAt: dateOnly(row.paid_at),
      note: row.note || '',
      recordedByName: row.recorded_by_name,
    });
    contributionsOf.set(row.campaign_id, list);
  });

  const receiptsOf = new Map();
  receipts.rows.forEach((row) => {
    const list = receiptsOf.get(row.expense_id) || [];
    list.push({ id: row.id, mime: row.mime, fileName: row.file_name, size: row.size });
    receiptsOf.set(row.expense_id, list);
  });

  const income = contributions.rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const spent = expenses.rows.reduce((sum, row) => sum + Number(row.amount), 0);

  res.json({
    success: true,
    data: {
      totals: { opening, income, expense: spent, balance: opening + income - spent },
      settings: {
        openingBalance: opening,
        openingDate: dateOnly(settings.opening_date),
        bankBin: settings.bank_bin || '',
        bankName: settings.bank_name || '',
        accountNo: settings.account_no || '',
        accountName: settings.account_name || '',
        // Changes whenever a new picture is uploaded, so browsers never show a stale one
        qrImageVersion: settings.qr_mime && settings.qr_updated_at ? new Date(settings.qr_updated_at).getTime() : null,
      },
      claims: claims.rows.map((row) => ({
        id: row.id,
        campaignId: row.campaign_id,
        playerId: row.player_id,
        amount: Number(row.amount),
        transferredAt: dateOnly(row.transferred_at),
        note: row.note || '',
        proofMime: row.proof_mime || null,
        status: row.status,
        reviewedByName: row.reviewed_by_name,
        reviewedAt: row.reviewed_at,
        reviewNote: row.review_note || '',
        createdAt: row.created_at,
      })),
      campaigns: campaigns.rows.map((row) => ({
        id: row.id,
        name: row.name,
        amountPerMember: Number(row.amount_per_member),
        dueDate: dateOnly(row.due_date),
        note: row.note || '',
        createdAt: row.created_at,
        contributions: contributionsOf.get(row.id) || [],
      })),
      expenses: expenses.rows.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category || 'other',
        amount: Number(row.amount),
        spentAt: dateOnly(row.spent_at),
        note: row.note || '',
        createdByName: row.created_by_name,
        createdAt: row.created_at,
        receipts: receiptsOf.get(row.id) || [],
      })),
    },
  });
}

// ---------------------------------------------------------------------------
// Change log. Every change is written in the same transaction as the log entry that
// describes it (who, when, what, old → new), so the log can be trusted to be complete.
// Entries keep their text after the round, expense or receipt they describe is deleted.

const formatVnd = (n) => `${Number(n).toLocaleString('vi-VN')} ₫`;
const formatDay = (day) => {
  const value = dateOnly(day);
  if (!value) return 'không có';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
};
const quote = (value) => (value ? `"${value}"` : 'trống');

// [{ field, from, to }] for the fields whose formatted value differs
function changesBetween(before, after, fields) {
  return fields
    .map(([key, label, format]) => ({ field: label, from: format(before[key]), to: format(after[key]) }))
    .filter((c) => c.from !== c.to);
}

async function inTransaction(fn) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function writeLog(client, req, { action, targetType, targetId, summary, changes = [] }) {
  await client.query(`
    INSERT INTO fund_logs (id, club_id, actor_user_id, actor_name, action, target_type, target_id, summary, changes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [newId('flog'), req.params.id, req.user.id, recorderName(req) || 'Quản trị viên', action, targetType, targetId, summary, JSON.stringify(changes)]);
}

// Who changed what, newest first. `before` (an ISO time) pages back through older entries.
async function getLogs(req, res) {
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 100));
  const params = [req.params.id, limit];
  let where = 'club_id = $1';
  if (req.query.before && !Number.isNaN(Date.parse(req.query.before))) {
    params.push(new Date(req.query.before));
    where += ` AND created_at < $${params.length}`;
  }
  const result = await db.query(
    `SELECT * FROM fund_logs WHERE ${where} ORDER BY created_at DESC LIMIT $2`,
    params
  );
  res.json({
    success: true,
    data: result.rows.map((row) => ({
      id: row.id,
      actorName: row.actor_name,
      action: row.action,
      targetType: row.target_type,
      summary: row.summary,
      changes: row.changes || [],
      createdAt: row.created_at,
    })),
  });
}

// ---------------------------------------------------------------------------
// Collection rounds

const CAMPAIGN_FIELDS = [
  ['name', 'Tên đợt', quote],
  ['amount_per_member', 'Số tiền/người', formatVnd],
  ['due_date', 'Hạn đóng', formatDay],
  ['note', 'Ghi chú', quote],
];

function readCampaign(body) {
  const name = text(body.name, 160);
  const amountPerMember = parseAmount(body.amountPerMember, { allowZero: true });
  const dueDate = body.dueDate ? parseDate(body.dueDate) : null;
  if (!name) return { error: 'Vui lòng nhập tên đợt thu' };
  if (amountPerMember === null) return { error: 'Số tiền mỗi người không hợp lệ' };
  if (body.dueDate && !dueDate) return { error: 'Hạn đóng không hợp lệ' };
  return { name, amountPerMember, dueDate, note: text(body.note, 2000) };
}

async function createCampaign(req, res) {
  const input = readCampaign(req.body || {});
  if (input.error) return fail(res, 400, input.error);
  const id = newId('fund');
  await inTransaction(async (client) => {
    await client.query(`
      INSERT INTO fund_campaigns (id, club_id, name, amount_per_member, due_date, note, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, req.params.id, input.name, input.amountPerMember, input.dueDate, input.note, req.user.id]);
    await writeLog(client, req, {
      action: 'campaign.create',
      targetType: 'campaign',
      targetId: id,
      summary: `Tạo đợt thu "${input.name}" (${formatVnd(input.amountPerMember)}/người${input.dueDate ? `, hạn ${formatDay(input.dueDate)}` : ''})`,
    });
  });
  res.status(201).json({ success: true, data: { id } });
}

async function updateCampaign(req, res) {
  const input = readCampaign(req.body || {});
  if (input.error) return fail(res, 400, input.error);
  const found = await inTransaction(async (client) => {
    const before = (await client.query(
      'SELECT * FROM fund_campaigns WHERE id = $1 AND club_id = $2 FOR UPDATE',
      [req.params.campaignId, req.params.id]
    )).rows[0];
    if (!before) return false;
    const after = { name: input.name, amount_per_member: input.amountPerMember, due_date: input.dueDate, note: input.note };
    const changes = changesBetween(before, after, CAMPAIGN_FIELDS);
    if (changes.length === 0) return true;
    await client.query(
      'UPDATE fund_campaigns SET name = $1, amount_per_member = $2, due_date = $3, note = $4 WHERE id = $5',
      [input.name, input.amountPerMember, input.dueDate, input.note, before.id]
    );
    await writeLog(client, req, {
      action: 'campaign.update',
      targetType: 'campaign',
      targetId: before.id,
      summary: `Sửa đợt thu "${before.name}"`,
      changes,
    });
    return true;
  });
  if (!found) return fail(res, 404, 'Không tìm thấy đợt thu');
  res.json({ success: true });
}

// Its payments go with it
async function deleteCampaign(req, res) {
  await inTransaction(async (client) => {
    const before = (await client.query(
      'SELECT * FROM fund_campaigns WHERE id = $1 AND club_id = $2 FOR UPDATE',
      [req.params.campaignId, req.params.id]
    )).rows[0];
    if (!before) return;
    const paid = (await client.query(
      'SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM fund_contributions WHERE campaign_id = $1',
      [before.id]
    )).rows[0];
    await client.query('DELETE FROM fund_campaigns WHERE id = $1', [before.id]);
    await writeLog(client, req, {
      action: 'campaign.delete',
      targetType: 'campaign',
      targetId: before.id,
      summary: `Xóa đợt thu "${before.name}" cùng ${paid.n} khoản đã đóng (${formatVnd(paid.total)})`,
    });
  });
  res.json({ success: true });
}

// Records (or corrects) what one member paid for a round
async function setContribution(req, res) {
  const { id: clubId, campaignId, playerId } = req.params;
  const body = req.body || {};
  const amount = parseAmount(body.amount);
  const paidAt = parseDate(body.paidAt);
  const note = text(body.note, 500);
  if (amount === null) return fail(res, 400, 'Số tiền không hợp lệ');
  if (!paidAt) return fail(res, 400, 'Ngày đóng không hợp lệ');

  const error = await inTransaction(async (client) => {
    const [campaign, player] = await Promise.all([
      client.query('SELECT name FROM fund_campaigns WHERE id = $1 AND club_id = $2', [campaignId, clubId]),
      client.query('SELECT name FROM players WHERE id = $1 AND club_id = $2', [playerId, clubId]),
    ]);
    if (!campaign.rows[0]) return [404, 'Không tìm thấy đợt thu'];
    if (!player.rows[0]) return [404, 'Thành viên không thuộc CLB này'];
    const campaignName = campaign.rows[0].name;
    const playerName = player.rows[0].name;

    const before = (await client.query(
      'SELECT * FROM fund_contributions WHERE campaign_id = $1 AND player_id = $2 FOR UPDATE',
      [campaignId, playerId]
    )).rows[0];

    if (before) {
      const changes = changesBetween(before, { amount, paid_at: paidAt, note }, [
        ['amount', 'Số tiền', formatVnd],
        ['paid_at', 'Ngày đóng', formatDay],
        ['note', 'Ghi chú', quote],
      ]);
      if (changes.length === 0) return null;
      await client.query(
        'UPDATE fund_contributions SET amount = $1, paid_at = $2, note = $3, recorded_by_name = $4 WHERE id = $5',
        [amount, paidAt, note, recorderName(req), before.id]
      );
      await writeLog(client, req, {
        action: 'contribution.update',
        targetType: 'contribution',
        targetId: before.id,
        summary: `Sửa khoản đóng của ${playerName} trong đợt "${campaignName}"`,
        changes,
      });
      return null;
    }

    const id = newId('fc');
    await client.query(`
      INSERT INTO fund_contributions (id, campaign_id, club_id, player_id, amount, paid_at, note, recorded_by_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, campaignId, clubId, playerId, amount, paidAt, note, recorderName(req)]);
    await writeLog(client, req, {
      action: 'contribution.create',
      targetType: 'contribution',
      targetId: id,
      summary: `Ghi nhận ${playerName} đã đóng ${formatVnd(amount)} cho đợt "${campaignName}" (ngày ${formatDay(paidAt)}${note ? `, ${note}` : ''})`,
    });
    return null;
  });
  if (error) return fail(res, error[0], error[1]);
  res.json({ success: true });
}

async function deleteContribution(req, res) {
  const { id: clubId, campaignId, playerId } = req.params;
  await inTransaction(async (client) => {
    const before = (await client.query(`
      SELECT fc.*, c.name AS campaign_name, p.name AS player_name
      FROM fund_contributions fc
      JOIN fund_campaigns c ON c.id = fc.campaign_id
      JOIN players p ON p.id = fc.player_id
      WHERE fc.campaign_id = $1 AND fc.player_id = $2 AND fc.club_id = $3
      FOR UPDATE OF fc
    `, [campaignId, playerId, clubId])).rows[0];
    if (!before) return;
    await client.query('DELETE FROM fund_contributions WHERE id = $1', [before.id]);
    await writeLog(client, req, {
      action: 'contribution.delete',
      targetType: 'contribution',
      targetId: before.id,
      summary: `Bỏ ghi nhận ${before.player_name} đã đóng ${formatVnd(before.amount)} cho đợt "${before.campaign_name}"`,
    });
  });
  res.json({ success: true });
}

// ---------------------------------------------------------------------------
// Expenses and receipts

const EXPENSE_CATEGORIES = {
  court: 'Thuê sân',
  balls: 'Bóng',
  drinks: 'Nước uống',
  prizes: 'Giải thưởng',
  other: 'Khác',
};

const EXPENSE_FIELDS = [
  ['title', 'Nội dung', quote],
  ['category', 'Danh mục', (c) => EXPENSE_CATEGORIES[c] || EXPENSE_CATEGORIES.other],
  ['amount', 'Số tiền', formatVnd],
  ['spent_at', 'Ngày chi', formatDay],
  ['note', 'Ghi chú', quote],
];

function readExpense(body) {
  const title = text(body.title, 200);
  const amount = parseAmount(body.amount);
  const spentAt = parseDate(body.spentAt);
  if (!title) return { error: 'Vui lòng nhập nội dung chi' };
  if (amount === null) return { error: 'Số tiền chi không hợp lệ' };
  if (!spentAt) return { error: 'Ngày chi không hợp lệ' };
  const category = EXPENSE_CATEGORIES[body.category] ? body.category : 'other';
  return { title, category, amount, spentAt, note: text(body.note, 2000) };
}

async function createExpense(req, res) {
  const input = readExpense(req.body || {});
  if (input.error) return fail(res, 400, input.error);
  const id = newId('exp');
  await inTransaction(async (client) => {
    await client.query(`
      INSERT INTO fund_expenses (id, club_id, title, category, amount, spent_at, note, created_by_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, req.params.id, input.title, input.category, input.amount, input.spentAt, input.note, recorderName(req)]);
    await writeLog(client, req, {
      action: 'expense.create',
      targetType: 'expense',
      targetId: id,
      summary: `Thêm khoản chi "${input.title}" ${formatVnd(input.amount)} (${EXPENSE_CATEGORIES[input.category]}, ngày ${formatDay(input.spentAt)})`,
    });
  });
  res.status(201).json({ success: true, data: { id } });
}

async function updateExpense(req, res) {
  const input = readExpense(req.body || {});
  if (input.error) return fail(res, 400, input.error);
  const found = await inTransaction(async (client) => {
    const before = (await client.query(
      'SELECT * FROM fund_expenses WHERE id = $1 AND club_id = $2 FOR UPDATE',
      [req.params.expenseId, req.params.id]
    )).rows[0];
    if (!before) return false;
    const after = { title: input.title, category: input.category, amount: input.amount, spent_at: input.spentAt, note: input.note };
    const changes = changesBetween(before, after, EXPENSE_FIELDS);
    if (changes.length === 0) return true;
    await client.query(
      'UPDATE fund_expenses SET title = $1, category = $2, amount = $3, spent_at = $4, note = $5 WHERE id = $6',
      [input.title, input.category, input.amount, input.spentAt, input.note, before.id]
    );
    await writeLog(client, req, {
      action: 'expense.update',
      targetType: 'expense',
      targetId: before.id,
      summary: `Sửa khoản chi "${before.title}"`,
      changes,
    });
    return true;
  });
  if (!found) return fail(res, 404, 'Không tìm thấy khoản chi');
  res.json({ success: true });
}

// Its receipts go with it
async function deleteExpense(req, res) {
  await inTransaction(async (client) => {
    const before = (await client.query(
      'SELECT * FROM fund_expenses WHERE id = $1 AND club_id = $2 FOR UPDATE',
      [req.params.expenseId, req.params.id]
    )).rows[0];
    if (!before) return;
    const receipts = (await client.query('SELECT COUNT(*) AS n FROM fund_receipts WHERE expense_id = $1', [before.id])).rows[0].n;
    await client.query('DELETE FROM fund_expenses WHERE id = $1', [before.id]);
    await writeLog(client, req, {
      action: 'expense.delete',
      targetType: 'expense',
      targetId: before.id,
      summary: `Xóa khoản chi "${before.title}" ${formatVnd(before.amount)} (ngày ${formatDay(before.spent_at)}, ${receipts} hóa đơn)`,
    });
  });
  res.json({ success: true });
}

// Body: { fileName, mime, data } with the file base64-encoded
async function addReceipt(req, res) {
  const { id: clubId, expenseId } = req.params;
  const body = req.body || {};
  const mime = String(body.mime || '').toLowerCase();
  if (!RECEIPT_TYPES.includes(mime)) {
    return fail(res, 400, 'Chỉ nhận ảnh (JPG, PNG, WEBP, GIF) hoặc PDF');
  }
  const data = Buffer.from(String(body.data || ''), 'base64');
  if (data.length === 0) return fail(res, 400, 'Tệp hóa đơn trống');
  if (data.length > MAX_RECEIPT_BYTES) return fail(res, 400, 'Tệp hóa đơn quá lớn (tối đa 7MB)');

  const id = newId('rcpt');
  const fileName = text(body.fileName, 200) || 'hoa-don';
  const found = await inTransaction(async (client) => {
    const expense = (await client.query('SELECT title FROM fund_expenses WHERE id = $1 AND club_id = $2', [expenseId, clubId])).rows[0];
    if (!expense) return false;
    await client.query(`
      INSERT INTO fund_receipts (id, expense_id, club_id, mime, file_name, size, data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, expenseId, clubId, mime, fileName, data.length, data]);
    await writeLog(client, req, {
      action: 'receipt.create',
      targetType: 'receipt',
      targetId: id,
      summary: `Thêm hóa đơn "${fileName}" cho khoản chi "${expense.title}"`,
    });
    return true;
  });
  if (!found) return fail(res, 404, 'Không tìm thấy khoản chi');
  res.status(201).json({ success: true, data: { id, mime, fileName, size: data.length } });
}

// The file itself, for members of the club only
async function getReceipt(req, res) {
  const result = await db.query(
    'SELECT mime, file_name, data FROM fund_receipts WHERE id = $1 AND club_id = $2',
    [req.params.receiptId, req.params.id]
  );
  const row = result.rows[0];
  if (!row) return fail(res, 404, 'Không tìm thấy hóa đơn');
  res.set({
    'Content-Type': row.mime,
    'Content-Length': row.data.length,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(row.data);
}

async function deleteReceipt(req, res) {
  await inTransaction(async (client) => {
    const before = (await client.query(`
      SELECT r.id, r.file_name, e.title
      FROM fund_receipts r JOIN fund_expenses e ON e.id = r.expense_id
      WHERE r.id = $1 AND r.club_id = $2
    `, [req.params.receiptId, req.params.id])).rows[0];
    if (!before) return;
    await client.query('DELETE FROM fund_receipts WHERE id = $1', [before.id]);
    await writeLog(client, req, {
      action: 'receipt.delete',
      targetType: 'receipt',
      targetId: before.id,
      summary: `Xóa hóa đơn "${before.file_name}" của khoản chi "${before.title}"`,
    });
  });
  res.json({ success: true });
}

// ---------------------------------------------------------------------------
// Opening balance and bank account

const SETTINGS_FIELDS = [
  ['opening_balance', 'Số dư đầu kỳ', formatVnd],
  ['opening_date', 'Ngày bắt đầu', formatDay],
  ['bank_name', 'Ngân hàng', quote],
  ['account_no', 'Số tài khoản', quote],
  ['account_name', 'Chủ tài khoản', quote],
];

async function saveSettings(req, res) {
  const body = req.body || {};
  const openingBalance = Number(body.openingBalance);
  if (!Number.isInteger(openingBalance) || Math.abs(openingBalance) > MAX_AMOUNT) {
    return fail(res, 400, 'Số dư đầu kỳ không hợp lệ');
  }
  const openingDate = body.openingDate ? parseDate(body.openingDate) : null;
  if (body.openingDate && !openingDate) return fail(res, 400, 'Ngày bắt đầu không hợp lệ');
  const bankBin = String(body.bankBin || '').replace(/\D/g, '').slice(0, 8);
  const accountNo = String(body.accountNo || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 40);
  if ((bankBin || accountNo) && !(bankBin.length === 6 && accountNo)) {
    return fail(res, 400, 'Vui lòng chọn ngân hàng và nhập số tài khoản');
  }
  const after = {
    opening_balance: openingBalance,
    opening_date: openingDate,
    bank_bin: bankBin,
    bank_name: text(body.bankName, 80),
    account_no: accountNo,
    account_name: text(body.accountName, 80).toUpperCase(),
  };

  await inTransaction(async (client) => {
    const before = (await client.query('SELECT * FROM fund_settings WHERE club_id = $1 FOR UPDATE', [req.params.id])).rows[0]
      || { opening_balance: 0, opening_date: null, bank_bin: '', bank_name: '', account_no: '', account_name: '' };
    const changes = changesBetween(before, after, SETTINGS_FIELDS);
    if (changes.length === 0) return;
    await client.query(`
      INSERT INTO fund_settings (club_id, opening_balance, opening_date, bank_bin, bank_name, account_no, account_name, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (club_id) DO UPDATE SET
        opening_balance = EXCLUDED.opening_balance, opening_date = EXCLUDED.opening_date, bank_bin = EXCLUDED.bank_bin,
        bank_name = EXCLUDED.bank_name, account_no = EXCLUDED.account_no, account_name = EXCLUDED.account_name, updated_at = NOW()
    `, [req.params.id, after.opening_balance, after.opening_date, after.bank_bin, after.bank_name, after.account_no, after.account_name]);
    await writeLog(client, req, {
      action: 'settings.update',
      targetType: 'settings',
      targetId: req.params.id,
      summary: 'Sửa số dư đầu kỳ / tài khoản nhận tiền',
      changes,
    });
  });
  res.json({ success: true });
}

const QR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_QR_BYTES = 3 * 1024 * 1024;

// Body: { fileName, mime, data } with the picture base64-encoded
async function uploadQrImage(req, res) {
  const body = req.body || {};
  const mime = String(body.mime || '').toLowerCase();
  if (!QR_TYPES.includes(mime)) return fail(res, 400, 'Mã QR phải là ảnh (JPG, PNG, WEBP, GIF)');
  const data = Buffer.from(String(body.data || ''), 'base64');
  if (data.length === 0) return fail(res, 400, 'Ảnh mã QR trống');
  if (data.length > MAX_QR_BYTES) return fail(res, 400, 'Ảnh mã QR quá lớn (tối đa 3MB)');
  const name = text(body.fileName, 200) || 'ma-qr';

  await inTransaction(async (client) => {
    const before = (await client.query('SELECT qr_mime FROM fund_settings WHERE club_id = $1 FOR UPDATE', [req.params.id])).rows[0];
    await client.query(`
      INSERT INTO fund_settings (club_id, qr_mime, qr_name, qr_data, qr_updated_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (club_id) DO UPDATE SET
        qr_mime = EXCLUDED.qr_mime, qr_name = EXCLUDED.qr_name, qr_data = EXCLUDED.qr_data, qr_updated_at = NOW(), updated_at = NOW()
    `, [req.params.id, mime, name, data]);
    await writeLog(client, req, {
      action: 'settings.update',
      targetType: 'settings',
      targetId: req.params.id,
      summary: `${before && before.qr_mime ? 'Thay' : 'Tải lên'} ảnh mã QR nhận tiền quỹ ("${name}")`,
    });
  });
  res.json({ success: true });
}

async function deleteQrImage(req, res) {
  await inTransaction(async (client) => {
    const before = (await client.query('SELECT qr_mime, qr_name FROM fund_settings WHERE club_id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!before || !before.qr_mime) return;
    await client.query(
      'UPDATE fund_settings SET qr_mime = NULL, qr_name = NULL, qr_data = NULL, qr_updated_at = NOW(), updated_at = NOW() WHERE club_id = $1',
      [req.params.id]
    );
    await writeLog(client, req, {
      action: 'settings.update',
      targetType: 'settings',
      targetId: req.params.id,
      summary: `Xóa ảnh mã QR nhận tiền quỹ ("${before.qr_name}")`,
    });
  });
  res.json({ success: true });
}

async function getQrImage(req, res) {
  const row = (await db.query('SELECT qr_mime, qr_name, qr_data FROM fund_settings WHERE club_id = $1', [req.params.id])).rows[0];
  if (!row || !row.qr_data) return fail(res, 404, 'CLB chưa có ảnh mã QR');
  res.set({
    'Content-Type': row.qr_mime,
    'Content-Length': row.qr_data.length,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.qr_name || 'ma-qr')}`,
    // The page asks for it with ?v=<upload time>, so a long cache is safe
    'Cache-Control': 'private, max-age=604800',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(row.qr_data);
}

// ---------------------------------------------------------------------------
// Transfer reports ("Tôi đã chuyển khoản")

async function notify(client, req, userIds, title, message, data) {
  for (const userId of userIds) {
    await client.query(`
      INSERT INTO notifications (id, user_id, club_id, type, title, message, data, read)
      VALUES ($1, $2, $3, 'fund_claim', $4, $5, $6, FALSE)
    `, [newId('notif'), userId, req.params.id, title, message, JSON.stringify(data)]);
  }
}

// Body: { amount, transferredAt, note, proof?: { fileName, mime, data } }
async function createClaim(req, res) {
  const { id: clubId, campaignId } = req.params;
  const body = req.body || {};
  const amount = parseAmount(body.amount);
  const transferredAt = parseDate(body.transferredAt);
  const note = text(body.note, 500);
  if (amount === null) return fail(res, 400, 'Số tiền không hợp lệ');
  if (!transferredAt) return fail(res, 400, 'Ngày chuyển không hợp lệ');

  let proof = null;
  if (body.proof && body.proof.data) {
    const mime = String(body.proof.mime || '').toLowerCase();
    if (!RECEIPT_TYPES.includes(mime)) return fail(res, 400, 'Ảnh chuyển khoản phải là ảnh (JPG, PNG, WEBP, GIF) hoặc PDF');
    const data = Buffer.from(String(body.proof.data), 'base64');
    if (data.length === 0 || data.length > MAX_RECEIPT_BYTES) return fail(res, 400, 'Ảnh chuyển khoản quá lớn (tối đa 7MB)');
    proof = { mime, name: text(body.proof.fileName, 200) || 'chuyen-khoan', data };
  }

  const player = req.membership;
  const result = await inTransaction(async (client) => {
    const campaign = (await client.query('SELECT name FROM fund_campaigns WHERE id = $1 AND club_id = $2', [campaignId, clubId])).rows[0];
    if (!campaign) return [404, 'Không tìm thấy đợt thu'];

    // A second report for the same round replaces the one still waiting
    const pending = (await client.query(
      "SELECT id FROM fund_claims WHERE campaign_id = $1 AND player_id = $2 AND status = 'pending' FOR UPDATE",
      [campaignId, player.id]
    )).rows[0];
    const id = pending ? pending.id : newId('claim');
    if (pending) {
      await client.query(`
        UPDATE fund_claims SET amount = $1, transferred_at = $2, note = $3,
          proof_mime = COALESCE($4, proof_mime), proof_name = COALESCE($5, proof_name), proof_data = COALESCE($6, proof_data),
          created_at = NOW()
        WHERE id = $7
      `, [amount, transferredAt, note, proof && proof.mime, proof && proof.name, proof && proof.data, id]);
    } else {
      await client.query(`
        INSERT INTO fund_claims (id, club_id, campaign_id, player_id, amount, transferred_at, note, proof_mime, proof_name, proof_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [id, clubId, campaignId, player.id, amount, transferredAt, note, proof && proof.mime, proof && proof.name, proof && proof.data]);
    }

    const summary = `${player.name} báo đã chuyển ${formatVnd(amount)} cho đợt "${campaign.name}" (ngày ${formatDay(transferredAt)}${proof ? ', có ảnh chuyển khoản' : ''})`;
    await writeLog(client, req, { action: 'claim.create', targetType: 'claim', targetId: id, summary });

    const managers = await client.query(
      "SELECT user_id FROM players WHERE club_id = $1 AND role IN ('owner', 'admin') AND user_id IS NOT NULL AND removed_at IS NULL AND user_id <> $2",
      [clubId, req.user.id]
    );
    await notify(client, req, managers.rows.map((r) => r.user_id), 'Thành viên báo đã chuyển tiền quỹ', `${summary}. Vào Quỹ CLB để xác nhận.`, { claimId: id, clubId });
    return null;
  });
  if (result) return fail(res, result[0], result[1]);
  res.status(201).json({ success: true });
}

async function loadClaim(client, req) {
  return (await client.query(`
    SELECT c.*, p.name AS player_name, p.user_id AS player_user_id, f.name AS campaign_name
    FROM fund_claims c
    JOIN players p ON p.id = c.player_id
    JOIN fund_campaigns f ON f.id = c.campaign_id
    WHERE c.id = $1 AND c.club_id = $2
    FOR UPDATE OF c
  `, [req.params.claimId, req.params.id])).rows[0];
}

// The member who reported it, or a manager, may withdraw a report still waiting
async function cancelClaim(req, res) {
  const result = await inTransaction(async (client) => {
    const claim = await loadClaim(client, req);
    if (!claim) return [404, 'Không tìm thấy báo chuyển khoản'];
    if (claim.player_id !== req.membership.id && !isManager(req.membership)) return [403, 'Bạn không thể hủy báo chuyển khoản của người khác'];
    if (claim.status !== 'pending') return [400, 'Báo chuyển khoản này đã được xử lý'];
    await client.query('DELETE FROM fund_claims WHERE id = $1', [claim.id]);
    await writeLog(client, req, {
      action: 'claim.delete',
      targetType: 'claim',
      targetId: claim.id,
      summary: `Hủy báo chuyển ${formatVnd(claim.amount)} của ${claim.player_name} cho đợt "${claim.campaign_name}"`,
    });
    return null;
  });
  if (result) return fail(res, result[0], result[1]);
  res.json({ success: true });
}

// Adds the reported amount to what the member has paid for the round
async function approveClaim(req, res) {
  const result = await inTransaction(async (client) => {
    const claim = await loadClaim(client, req);
    if (!claim) return [404, 'Không tìm thấy báo chuyển khoản'];
    if (claim.status !== 'pending') return [400, 'Báo chuyển khoản này đã được xử lý'];

    const existing = (await client.query(
      'SELECT * FROM fund_contributions WHERE campaign_id = $1 AND player_id = $2 FOR UPDATE',
      [claim.campaign_id, claim.player_id]
    )).rows[0];
    const total = Number(claim.amount) + (existing ? Number(existing.amount) : 0);
    const note = ['CK (tự báo)', claim.note].filter(Boolean).join(' - ').slice(0, 500);
    if (existing) {
      await client.query(
        'UPDATE fund_contributions SET amount = $1, paid_at = $2, note = $3, recorded_by_name = $4 WHERE id = $5',
        [total, claim.transferred_at, note, recorderName(req), existing.id]
      );
    } else {
      await client.query(`
        INSERT INTO fund_contributions (id, campaign_id, club_id, player_id, amount, paid_at, note, recorded_by_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [newId('fc'), claim.campaign_id, req.params.id, claim.player_id, total, claim.transferred_at, note, recorderName(req)]);
    }
    await client.query(
      "UPDATE fund_claims SET status = 'approved', reviewed_by_name = $1, reviewed_at = NOW() WHERE id = $2",
      [recorderName(req), claim.id]
    );
    await writeLog(client, req, {
      action: 'claim.approve',
      targetType: 'claim',
      targetId: claim.id,
      summary: `Xác nhận ${claim.player_name} đã chuyển ${formatVnd(claim.amount)} cho đợt "${claim.campaign_name}"${existing ? ` (tổng đã đóng ${formatVnd(total)})` : ''}`,
    });
    if (claim.player_user_id) {
      await notify(client, req, [claim.player_user_id], 'Đã xác nhận tiền quỹ',
        `${recorderName(req) || 'Quản trị viên'} đã xác nhận bạn chuyển ${formatVnd(claim.amount)} cho đợt "${claim.campaign_name}".`, { claimId: claim.id });
    }
    return null;
  });
  if (result) return fail(res, result[0], result[1]);
  res.json({ success: true });
}

async function rejectClaim(req, res) {
  const reason = text((req.body || {}).reason, 500);
  const result = await inTransaction(async (client) => {
    const claim = await loadClaim(client, req);
    if (!claim) return [404, 'Không tìm thấy báo chuyển khoản'];
    if (claim.status !== 'pending') return [400, 'Báo chuyển khoản này đã được xử lý'];
    await client.query(
      "UPDATE fund_claims SET status = 'rejected', reviewed_by_name = $1, reviewed_at = NOW(), review_note = $2 WHERE id = $3",
      [recorderName(req), reason, claim.id]
    );
    await writeLog(client, req, {
      action: 'claim.reject',
      targetType: 'claim',
      targetId: claim.id,
      summary: `Từ chối báo chuyển ${formatVnd(claim.amount)} của ${claim.player_name} cho đợt "${claim.campaign_name}"${reason ? `: ${reason}` : ''}`,
    });
    if (claim.player_user_id) {
      await notify(client, req, [claim.player_user_id], 'Báo chuyển tiền quỹ chưa được xác nhận',
        `Báo chuyển ${formatVnd(claim.amount)} cho đợt "${claim.campaign_name}" bị từ chối${reason ? `: ${reason}` : ''}. Vui lòng kiểm tra lại.`, { claimId: claim.id });
    }
    return null;
  });
  if (result) return fail(res, result[0], result[1]);
  res.json({ success: true });
}

// The transfer screenshot: for the member who sent it and the club's managers
async function getClaimProof(req, res) {
  const row = (await db.query(
    'SELECT player_id, proof_mime, proof_name, proof_data FROM fund_claims WHERE id = $1 AND club_id = $2',
    [req.params.claimId, req.params.id]
  )).rows[0];
  if (!row || !row.proof_data) return fail(res, 404, 'Không có ảnh chuyển khoản');
  if (row.player_id !== req.membership.id && !isManager(req.membership)) return fail(res, 403, 'Bạn không xem được ảnh này');
  res.set({
    'Content-Type': row.proof_mime,
    'Content-Length': row.proof_data.length,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.proof_name || 'chuyen-khoan')}`,
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(row.proof_data);
}

module.exports = {
  getFund: handle('getFund', getFund),
  saveSettings: handle('saveSettings', saveSettings),
  uploadQrImage: handle('uploadQrImage', uploadQrImage),
  deleteQrImage: handle('deleteQrImage', deleteQrImage),
  getQrImage: handle('getQrImage', getQrImage),
  createClaim: handle('createClaim', createClaim),
  cancelClaim: handle('cancelClaim', cancelClaim),
  approveClaim: handle('approveClaim', approveClaim),
  rejectClaim: handle('rejectClaim', rejectClaim),
  getClaimProof: handle('getClaimProof', getClaimProof),
  getLogs: handle('getLogs', getLogs),
  createCampaign: handle('createCampaign', createCampaign),
  updateCampaign: handle('updateCampaign', updateCampaign),
  deleteCampaign: handle('deleteCampaign', deleteCampaign),
  setContribution: handle('setContribution', setContribution),
  deleteContribution: handle('deleteContribution', deleteContribution),
  createExpense: handle('createExpense', createExpense),
  updateExpense: handle('updateExpense', updateExpense),
  deleteExpense: handle('deleteExpense', deleteExpense),
  addReceipt: handle('addReceipt', addReceipt),
  getReceipt: handle('getReceipt', getReceipt),
  deleteReceipt: handle('deleteReceipt', deleteReceipt),
};
