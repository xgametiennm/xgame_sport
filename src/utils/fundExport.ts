import type { Workbook, Worksheet } from 'exceljs';
import { FundOverview, Player } from '../types/pickleball';
import { categoryLabel, DayRange, fundMovements, inRange, spendingByCategory, summarizePeriod } from './fundPeriod';

// Excel report of the club fund, for everything or for one period. exceljs is large, so
// it is only loaded when someone exports. The numbers come from the same helpers as the
// on-screen report, so the file and the screen always agree.
//
// Sheets: overview, ledger with the running balance, payments, expenses, spending by
// category, and what each member still owes (always as of today).

const MONEY = '#,##0 "₫"';
const DATE = 'dd/mm/yyyy';
const HEADER_FILL = 'FF0D5E46';
const TOTAL_FILL = 'FFECFDF5';

// yyyy-mm-dd → a date cell (noon, so no timezone can move it to another day)
const day = (value: string | null): Date | null => (value ? new Date(`${value}T12:00:00`) : null);

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const asciiSlug = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '');

interface Column {
  header: string;
  key: string;
  width: number;
  format?: string;
}

function addTable(workbook: Workbook, name: string, columns: Column[], rows: Record<string, unknown>[], totals?: Record<string, unknown>): Worksheet {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.format ? { numFmt: c.format } : {} }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;

  rows.forEach((row) => sheet.addRow(row));
  if (rows.length > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: columns.length } };
  }
  if (totals) {
    const row = sheet.addRow(totals);
    row.font = { bold: true };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
  }
  return sheet;
}

export async function exportFundToExcel(
  fund: FundOverview,
  members: Player[],
  playerById: Map<string, Player>,
  clubName: string,
  range?: DayRange // only this period; everything when left out
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'XGame Pickleball';
  workbook.created = new Date();

  const period: DayRange = range || { from: null, to: null, label: 'toàn bộ thời gian' };
  const nameOf = (playerId: string) => playerById.get(playerId)?.name || 'Thành viên đã rời CLB';
  const today = todayKey();
  const movements = fundMovements(fund, playerById);
  const summary = summarizePeriod(fund, movements, period);

  // What every current member still owes, per round (same rule as the "Còn thiếu" tab)
  const debts = members.flatMap((player) =>
    fund.campaigns
      .filter((c) => c.amountPerMember > 0)
      .map((c) => {
        const paid = c.contributions.find((x) => x.playerId === player.id)?.amount ?? 0;
        return { player, campaign: c, paid, owed: c.amountPerMember - paid };
      })
      .filter((d) => d.owed > 0)
  );
  const totalOwed = debts.reduce((sum, d) => sum + d.owed, 0);

  // 1. Overview
  const overview = workbook.addWorksheet('Tổng quan');
  overview.columns = [{ width: 34 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 18 }];
  overview.addRow([`QUỸ CLB ${clubName.toUpperCase()}`]).font = { bold: true, size: 15, color: { argb: HEADER_FILL } };
  overview.addRow([`Kỳ báo cáo: ${period.label} · xuất ngày ${new Date().toLocaleString('vi-VN')}`]).font = { italic: true, color: { argb: 'FF64748B' } };
  overview.addRow([]);
  const headline: [string, number][] = range
    ? [
        ['Tồn đầu kỳ', summary.openingBalance],
        ['Thu trong kỳ', summary.income],
        ['Chi trong kỳ', summary.expense],
        ['Tồn cuối kỳ', summary.closingBalance],
        ['Tổng quỹ hiện tại', fund.totals.balance],
      ]
    : [
        ['Tổng quỹ hiện tại', fund.totals.balance],
        [`Số dư đầu kỳ${fund.settings.openingDate ? ` (${fund.settings.openingDate.split('-').reverse().join('/')})` : ''}`, fund.totals.opening],
        ['Tổng đã thu', fund.totals.income],
        ['Tổng đã chi', fund.totals.expense],
      ];
  headline.push(['Tổng còn thiếu (chưa thu, tính đến hôm nay)', totalOwed]);
  headline.forEach(([label, amount], index) => {
    const row = overview.addRow([label, amount]);
    row.getCell(2).numFmt = MONEY;
    row.font = { bold: index === 0 || (range && index === 3) ? true : false };
  });
  overview.addRow([]);
  const roundsHeader = overview.addRow(['Đợt thu', 'Số tiền/người', 'Hạn đóng', 'Đã đóng', 'Đã thu', 'Còn thiếu']);
  roundsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  roundsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  fund.campaigns.forEach((c) => {
    const collected = c.contributions.reduce((sum, x) => sum + x.amount, 0);
    const owed = debts.filter((d) => d.campaign.id === c.id).reduce((sum, d) => sum + d.owed, 0);
    const unpaid = members.filter((p) => !c.contributions.some((x) => x.playerId === p.id)).length;
    const row = overview.addRow([c.name, c.amountPerMember, day(c.dueDate), `${c.contributions.length}/${c.contributions.length + unpaid}`, collected, owed]);
    row.getCell(2).numFmt = MONEY;
    row.getCell(3).numFmt = DATE;
    row.getCell(5).numFmt = MONEY;
    row.getCell(6).numFmt = MONEY;
  });

  // 2. Ledger: starts from the balance at the beginning of the period
  let balance = summary.openingBalance;
  addTable(
    workbook,
    'Sổ thu chi',
    [
      { header: 'Ngày', key: 'date', width: 12, format: DATE },
      { header: 'Loại', key: 'kind', width: 7 },
      { header: 'Nội dung', key: 'text', width: 42 },
      { header: 'Danh mục', key: 'category', width: 13 },
      { header: 'Thu', key: 'income', width: 15, format: MONEY },
      { header: 'Chi', key: 'expense', width: 15, format: MONEY },
      { header: 'Tồn quỹ', key: 'balance', width: 16, format: MONEY },
      { header: 'Ghi chú', key: 'note', width: 36 },
    ],
    [
      { date: day(period.from || fund.settings.openingDate), kind: '', text: range ? 'Tồn đầu kỳ' : 'Số dư đầu kỳ', balance },
      ...summary.movements.map((m) => {
        balance += m.kind === 'in' ? m.amount : -m.amount;
        return {
          date: day(m.date),
          kind: m.kind === 'in' ? 'Thu' : 'Chi',
          text: m.text,
          category: m.kind === 'out' ? categoryLabel(m.category || 'other') : '',
          income: m.kind === 'in' ? m.amount : null,
          expense: m.kind === 'out' ? m.amount : null,
          balance,
          note: m.note,
        };
      }),
    ],
    { text: range ? 'TỔNG TRONG KỲ' : 'TỔNG CỘNG', income: summary.income, expense: summary.expense, balance: summary.closingBalance }
  );

  // 3. Payments in the period
  addTable(
    workbook,
    'Thu quỹ',
    [
      { header: 'Đợt thu', key: 'campaign', width: 26 },
      { header: 'Thành viên', key: 'member', width: 24 },
      { header: 'Số tiền', key: 'amount', width: 15, format: MONEY },
      { header: 'Mức đóng', key: 'due', width: 15, format: MONEY },
      { header: 'Ngày đóng', key: 'date', width: 12, format: DATE },
      { header: 'Ghi chú', key: 'note', width: 30 },
      { header: 'Người ghi nhận', key: 'by', width: 20 },
    ],
    fund.campaigns.flatMap((c) => c.contributions
      .filter((x) => inRange(x.paidAt, period))
      .map((x) => ({
        campaign: c.name,
        member: nameOf(x.playerId),
        amount: x.amount,
        due: c.amountPerMember,
        date: day(x.paidAt),
        note: x.note,
        by: x.recordedByName || '',
      }))),
    { member: 'TỔNG CỘNG', amount: summary.income }
  );

  // 4. Expenses in the period
  addTable(
    workbook,
    'Chi tiêu',
    [
      { header: 'Ngày chi', key: 'date', width: 12, format: DATE },
      { header: 'Danh mục', key: 'category', width: 13 },
      { header: 'Nội dung', key: 'title', width: 36 },
      { header: 'Số tiền', key: 'amount', width: 15, format: MONEY },
      { header: 'Ghi chú', key: 'note', width: 40 },
      { header: 'Số hóa đơn', key: 'receipts', width: 11 },
      { header: 'Người ghi', key: 'by', width: 20 },
    ],
    fund.expenses
      .filter((e) => inRange(e.spentAt, period))
      .sort((a, b) => a.spentAt.localeCompare(b.spentAt))
      .map((e) => ({
        date: day(e.spentAt),
        category: categoryLabel(e.category),
        title: e.title,
        amount: e.amount,
        note: e.note,
        receipts: e.receipts.length,
        by: e.createdByName || '',
      })),
    { title: 'TỔNG CỘNG', amount: summary.expense }
  );

  // 5. Spending by category in the period
  addTable(
    workbook,
    'Chi theo danh mục',
    [
      { header: 'Danh mục', key: 'label', width: 18 },
      { header: 'Số khoản', key: 'count', width: 10 },
      { header: 'Số tiền', key: 'amount', width: 16, format: MONEY },
      { header: 'Tỷ lệ', key: 'share', width: 9, format: '0%' },
    ],
    spendingByCategory(summary.movements).map((c) => ({
      label: c.label,
      count: c.count,
      amount: c.amount,
      share: summary.expense ? c.amount / summary.expense : 0,
    })),
    { label: 'TỔNG CỘNG', amount: summary.expense }
  );

  // 6. What is still owed (as of today, whatever the period)
  addTable(
    workbook,
    'Còn thiếu',
    [
      { header: 'Thành viên', key: 'member', width: 24 },
      { header: 'Đợt thu', key: 'campaign', width: 26 },
      { header: 'Mức đóng', key: 'due', width: 15, format: MONEY },
      { header: 'Đã đóng', key: 'paid', width: 15, format: MONEY },
      { header: 'Còn thiếu', key: 'owed', width: 15, format: MONEY },
      { header: 'Hạn đóng', key: 'dueDate', width: 12, format: DATE },
      { header: 'Quá hạn', key: 'overdue', width: 9 },
    ],
    [...debts]
      .sort((a, b) => a.player.name.localeCompare(b.player.name, 'vi') || a.campaign.name.localeCompare(b.campaign.name, 'vi'))
      .map((d) => ({
        member: d.player.name,
        campaign: d.campaign.name,
        due: d.campaign.amountPerMember,
        paid: d.paid,
        owed: d.owed,
        dueDate: day(d.campaign.dueDate),
        overdue: d.campaign.dueDate && d.campaign.dueDate < today ? 'Có' : '',
      })),
    { member: 'TỔNG CỘNG', owed: totalOwed }
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const suffix = range ? asciiSlug(period.label) : today;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Quy-CLB-${asciiSlug(clubName) || 'club'}-${suffix}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
