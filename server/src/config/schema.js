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
