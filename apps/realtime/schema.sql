CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL,
  host_player_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS room_snapshots (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  color TEXT NOT NULL,
  is_host INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pack_cards (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  style TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS room_pack_links (
  room_id TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  PRIMARY KEY (room_id, pack_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_room_snapshots_room_id ON room_snapshots(room_id);
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
