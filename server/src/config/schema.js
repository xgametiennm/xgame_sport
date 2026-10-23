const db = require('./db');
const { HAPPY_OPTIONS } = require('../utils/avatar');

// Changes made after the first release. init.sql only runs on a fresh database volume,
// so existing databases are brought up to date here on every start (all statements are idempotent).
const SCHEMA_UPGRADE = `
  ALTER TABLE players ADD COLUMN IF NOT EXISTS role VARCHAR(32) DEFAULT 'member';
  ALTER TABLE players ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS default_club_id VARCHAR(64);
  ALTER TABLE clubs ADD COLUMN IF NOT EXISTS owner_user_id VARCHAR(64);
  ALTER TABLE clubs ADD COLUMN IF NOT EXISTS join_code VARCHAR(16) UNIQUE;
  ALTER TABLE matches ADD COLUMN IF NOT EXISTS details JSONB;
  ALTER TABLE matches ADD COLUMN IF NOT EXISTS updated_by_name VARCHAR(128);
  ALTER TABLE matches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE matches ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(64);
  ALTER TABLE matches ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

  CREATE TABLE IF NOT EXISTS play_sessions (
    club_id VARCHAR(64) PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    club_id VARCHAR(64) PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Finished tournaments, kept after the club starts a new one
  CREATE TABLE IF NOT EXISTS tournament_history (
    id VARCHAR(64) PRIMARY KEY,
    club_id VARCHAR(64) NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_tournament_history_club ON tournament_history(club_id, finished_at DESC);
  -- A tournament finished before the history existed is still the club's current one
  INSERT INTO tournament_history (id, club_id, data, finished_at)
  SELECT COALESCE(data->>'id', 'tour-' || club_id), club_id, data, updated_at
  FROM tournaments WHERE data->>'currentPhase' = 'finished'
  ON CONFLICT (id) DO NOTHING;

  -- Club fund: collection rounds, who paid, expenses and their receipts
  CREATE TABLE IF NOT EXISTS fund_campaigns (
      id VARCHAR(64) PRIMARY KEY,
      club_id VARCHAR(64) NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      name VARCHAR(160) NOT NULL,
      amount_per_member BIGINT NOT NULL DEFAULT 0,
      due_date DATE,
      note TEXT DEFAULT '',
      created_by_user_id VARCHAR(64),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_fund_campaigns_club ON fund_campaigns(club_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS fund_contributions (
      id VARCHAR(64) PRIMARY KEY,
      campaign_id VARCHAR(64) NOT NULL REFERENCES fund_campaigns(id) ON DELETE CASCADE,
      club_id VARCHAR(64) NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      player_id VARCHAR(64) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      amount BIGINT NOT NULL,
      paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
      note TEXT DEFAULT '',
      recorded_by_name VARCHAR(128),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (campaign_id, player_id)
  );
  CREATE INDEX IF NOT EXISTS idx_fund_contributions_club ON fund_contributions(club_id);

  CREATE TABLE IF NOT EXISTS fund_expenses (
      id VARCHAR(64) PRIMARY KEY,
      club_id VARCHAR(64) NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      amount BIGINT NOT NULL,
      spent_at DATE NOT NULL,
      note TEXT DEFAULT '',
      created_by_name VARCHAR(128),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_fund_expenses_club ON fund_expenses(club_id, spent_at DESC);

  -- Receipt files are kept in the database, so backups and moves need nothing else
  CREATE TABLE IF NOT EXISTS fund_receipts (
      id VARCHAR(64) PRIMARY KEY,
      expense_id VARCHAR(64) NOT NULL REFERENCES fund_expenses(id) ON DELETE CASCADE,
      club_id VARCHAR(64) NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      mime VARCHAR(64) NOT NULL,
      file_name VARCHAR(200) NOT NULL,
      size INT NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_fund_receipts_expense ON fund_receipts(expense_id);

  -- Who changed the fund and how; kept after the changed item is deleted
  CREATE TABLE IF NOT EXISTS fund_logs (
      id VARCHAR(64) PRIMARY KEY,
      club_id VARCHAR(64) NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      actor_user_id VARCHAR(64),
      actor_name VARCHAR(128) NOT NULL,
      action VARCHAR(48) NOT NULL,
      target_type VARCHAR(32) NOT NULL,
      target_id VARCHAR(64),
      summary TEXT NOT NULL,
      changes JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_fund_logs_club ON fund_logs(club_id, created_at DESC);

  -- Opening balance and the bank account members transfer to (for VietQR codes)
  CREATE TABLE IF NOT EXISTS fund_settings (
      club_id VARCHAR(64) PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
      opening_balance BIGINT NOT NULL DEFAULT 0,
      opening_date DATE,
      bank_bin VARCHAR(16),
      bank_name VARCHAR(80),
      account_no VARCHAR(40),
      account_name VARCHAR(80),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE fund_expenses ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'other';

  -- The treasurer's own payment QR picture (from a banking app, MoMo, ZaloPay...)
  ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS qr_mime VARCHAR(64);
  ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS qr_name VARCHAR(200);
  ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS qr_data BYTEA;
  ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS qr_updated_at TIMESTAMP WITH TIME ZONE;

  -- A member's "I have transferred" report, waiting for a manager to confirm or reject it
  CREATE TABLE IF NOT EXISTS fund_claims (
      id VARCHAR(64) PRIMARY KEY,
      club_id VARCHAR(64) NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      campaign_id VARCHAR(64) NOT NULL REFERENCES fund_campaigns(id) ON DELETE CASCADE,
      player_id VARCHAR(64) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      amount BIGINT NOT NULL,
      transferred_at DATE NOT NULL,
      note TEXT DEFAULT '',
      proof_mime VARCHAR(64),
      proof_name VARCHAR(200),
      proof_data BYTEA,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      reviewed_by_name VARCHAR(128),
      reviewed_at TIMESTAMP WITH TIME ZONE,
      review_note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_fund_claims_club ON fund_claims(club_id, status, created_at DESC);

  CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    club_id VARCHAR(64) REFERENCES clubs(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS live_courts (
    id VARCHAR(64) PRIMARY KEY,
    club_id VARCHAR(64) REFERENCES clubs(id) ON DELETE CASCADE,
    court_name VARCHAR(128) NOT NULL,
    data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_live_courts_club ON live_courts(club_id);

  CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_players_club_user ON players(club_id, user_id) WHERE user_id IS NOT NULL;

  -- Deleting a club removes its members and matches together
  ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_team1_player1_id_fkey;
  ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_team1_player2_id_fkey;
  ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_team2_player1_id_fkey;
  ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_team2_player2_id_fkey;
  ALTER TABLE matches ADD CONSTRAINT matches_team1_player1_id_fkey FOREIGN KEY (team1_player1_id) REFERENCES players(id) ON DELETE CASCADE;
  ALTER TABLE matches ADD CONSTRAINT matches_team1_player2_id_fkey FOREIGN KEY (team1_player2_id) REFERENCES players(id) ON DELETE CASCADE;
  ALTER TABLE matches ADD CONSTRAINT matches_team2_player1_id_fkey FOREIGN KEY (team2_player1_id) REFERENCES players(id) ON DELETE CASCADE;
  ALTER TABLE matches ADD CONSTRAINT matches_team2_player2_id_fkey FOREIGN KEY (team2_player2_id) REFERENCES players(id) ON DELETE CASCADE;

  -- Generated avatars created before the cheerful-expression options existed
  UPDATE users SET avatar = avatar || '&${HAPPY_OPTIONS}'
  WHERE avatar LIKE 'https://api.dicebear.com/7.x/avataaars/svg?seed=%' AND avatar NOT LIKE '%mouth=%';
  UPDATE players SET avatar = avatar || '&${HAPPY_OPTIONS}'
  WHERE avatar LIKE 'https://api.dicebear.com/7.x/avataaars/svg?seed=%' AND avatar NOT LIKE '%mouth=%';
`;

async function ensureSchema() {
  await db.query(SCHEMA_UPGRADE);
}

module.exports = { ensureSchema };
