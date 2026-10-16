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
