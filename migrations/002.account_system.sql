ALTER TABLE users
    DROP COLUMN name;

ALTER TABLE users
    ADD COLUMN password_key TEXT;

CREATE UNIQUE INDEX idx_users_password_key
    ON users (password_key)
    WHERE registered;