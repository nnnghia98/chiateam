CREATE TABLE match_data (
  id TEXT PRIMARY KEY,
  teams JSONB DEFAULT '[]'::jsonb,
  venue JSONB DEFAULT '{}'::jsonb,
  raw_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Players table
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sub_names JSONB DEFAULT '[]'::jsonb,
  telegram_handle TEXT DEFAULT '',
  jersey_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE match_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Allow public access
CREATE POLICY "Allow all access to match_data" ON match_data
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to players" ON players
  FOR ALL USING (true) WITH CHECK (true);
