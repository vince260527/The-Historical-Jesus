-- Database tables for comments and "Advertise with us" messages.
-- Paste this into Cloudflare → D1 → your database → Console, then click Execute.
CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  message     TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,            -- Unix time (seconds)
  status      TEXT    NOT NULL DEFAULT 'visible',  -- visible | held | hidden
  hold_reason TEXT,
  reports     INTEGER NOT NULL DEFAULT 0,
  ip_hash     TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments (status, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_ip ON comments (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  organization TEXT,
  email        TEXT    NOT NULL,
  website      TEXT,
  category     TEXT,
  message      TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  agreed_terms_at INTEGER,                 -- when they ticked "I agree to the Advertising Policy and Terms"
  is_read      INTEGER NOT NULL DEFAULT 0,
  ip_hash      TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_ip ON messages (ip_hash, created_at);
