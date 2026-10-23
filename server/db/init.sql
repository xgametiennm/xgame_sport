-- ==============================================================================
-- XGame Pickleball & Badminton Platform - Database Schema
-- Database: PostgreSQL 16+
--
-- Schema only: the database starts empty. Accounts are created by registering,
-- clubs by their owners, and members by joining a club with its join code.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. USERS TABLE (Authentication & Account Management)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    google_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    avatar TEXT,
    role VARCHAR(32) DEFAULT 'member',
    linked_player_id VARCHAR(64), -- unused; membership is players.user_id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 2. CLUBS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clubs (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    description TEXT,
    courts_count INT DEFAULT 4,
    member_count INT DEFAULT 0,
    match_count INT DEFAULT 0,
    flagship BOOLEAN DEFAULT FALSE,
    owner_user_id VARCHAR(64), -- user who created the club
    join_code VARCHAR(16) UNIQUE, -- shared with people invited to join
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. PLAYERS TABLE (Club members & their DUPR rating profiles)
--    A row with user_id is that account's membership of the club.
--    A row without user_id is a guest added by a club manager.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS players (
    id VARCHAR(64) PRIMARY KEY,
    club_id VARCHAR(64) NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    avatar TEXT,
    doubles_rating NUMERIC(6, 3) DEFAULT 3.500,
    singles_rating NUMERIC(6, 3) DEFAULT 3.200,
    provisional_doubles BOOLEAN DEFAULT TRUE,
    provisional_singles BOOLEAN DEFAULT TRUE,
    matches_played_doubles INT DEFAULT 0,
    matches_played_singles INT DEFAULT 0,
    wins_doubles INT DEFAULT 0,
    losses_doubles INT DEFAULT 0,
    wins_singles INT DEFAULT 0,
    losses_singles INT DEFAULT 0,
    point_differential INT DEFAULT 0,
    streak INT DEFAULT 0,
    form VARCHAR(32)[] DEFAULT ARRAY[]::VARCHAR(32)[],
    rank_delta INT DEFAULT 0,
    role VARCHAR(32) DEFAULT 'member', -- 'owner' (one or more per club), 'admin', 'member'
    removed_at TIMESTAMP WITH TIME ZONE, -- set when removed from the club; kept for match history
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 4. MATCHES TABLE (Match Results & DUPR Deltas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(64) PRIMARY KEY,
    club_id VARCHAR(64) NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    match_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    format VARCHAR(32) DEFAULT 'doubles', -- 'doubles' | 'singles'
    importance VARCHAR(32) DEFAULT 'league', -- 'league' | 'casual' | 'sanctioned'
    court_name VARCHAR(128) DEFAULT 'Center Court',
    winner SMALLINT NOT NULL CHECK (winner IN (1, 2)),
    sets JSONB NOT NULL,
    total_score_team1 INT NOT NULL,
    total_score_team2 INT NOT NULL,
    team1_player1_id VARCHAR(64) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team1_player2_id VARCHAR(64) REFERENCES players(id) ON DELETE CASCADE,
    team2_player1_id VARCHAR(64) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team2_player2_id VARCHAR(64) REFERENCES players(id) ON DELETE CASCADE,
    delta_rating NUMERIC(6, 3) DEFAULT 0.040,
    notes TEXT,
    details JSONB, -- per-team rating deltas and win probabilities
    created_by_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    updated_by_name VARCHAR(128),
    updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 5. PLAY SESSIONS TABLE (In-progress schedule & scores, one per club)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS play_sessions (
    club_id VARCHAR(64) PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 6. LIVE COURTS TABLE (Real-time live matches across courts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_courts (
    id VARCHAR(64) PRIMARY KEY,
    club_id VARCHAR(64) REFERENCES clubs(id) ON DELETE CASCADE,
    court_name VARCHAR(128) NOT NULL,
    data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_live_courts_club ON live_courts(club_id);

-- ------------------------------------------------------------------------------
-- 7. TOURNAMENTS TABLE (Club tournaments, groups, brackets, draw & matches)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- CLUB FUND (collection rounds, who paid, expenses and their receipts)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 8. NOTIFICATIONS TABLE (Player alerts for match results & appeals)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_players_club_id ON players(club_id);
CREATE INDEX IF NOT EXISTS idx_players_club_removed ON players(club_id, removed_at);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
-- One membership per account per club
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_club_user ON players(club_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_club_id ON matches(club_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
