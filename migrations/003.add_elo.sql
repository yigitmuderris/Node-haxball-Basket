ALTER TABLE users ADD COLUMN elo INTEGER NOT NULL DEFAULT 1000 CHECK (elo >= 0);

-- Sıralama tabloları (!top, web paneli) için
CREATE INDEX idx_users_elo ON users (elo DESC);