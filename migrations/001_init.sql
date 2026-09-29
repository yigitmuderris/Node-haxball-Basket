CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT        NOT NULL,
    password_hash   TEXT,
    registered      BOOLEAN     NOT NULL DEFAULT FALSE,
    wins            INTEGER     NOT NULL DEFAULT 0,
    losses          INTEGER     NOT NULL DEFAULT 0,
    two_pt_made     INTEGER     NOT NULL DEFAULT 0 CHECK (two_pt_made >= 0),
    three_pt_made   INTEGER     NOT NULL DEFAULT 0 CHECK (three_pt_made >= 0),
    two_pt_own_basket   INTEGER     NOT NULL DEFAULT 0 CHECK (two_pt_own_basket >= 0),
    three_pt_own_basket  INTEGER     NOT NULL DEFAULT 0 CHECK (three_pt_own_basket >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auths (
    auth    TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_auths_user_id ON auths(user_id);

CREATE UNIQUE INDEX idx_users_registered_name
    ON users (lower(name)) WHERE registered;