// npm i pg
// .env -> DATABASE_URL=postgres://user:pass@localhost:5432/haxball
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** fn'e transaction client'ı verir; hata olursa ROLLBACK, yoksa COMMIT. */
async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

const isUniqueViolation = (err) => err && err.code === "23505";

/** Açılışta bir kez çağır. */
async function init() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id            BIGSERIAL PRIMARY KEY,
            name          TEXT        NOT NULL,
            password_hash TEXT,
            registered    BOOLEAN     NOT NULL DEFAULT FALSE,
            wins          INTEGER     NOT NULL DEFAULT 0,
            losses        INTEGER     NOT NULL DEFAULT 0,
            scores         INTEGER     NOT NULL DEFAULT 0,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_seen     TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS auths (
            auth    TEXT PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_auths_user_id ON auths(user_id);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_registered_name
            ON users (lower(name)) WHERE registered;
    `);
}

module.exports = { pool, withTransaction, isUniqueViolation, init };
