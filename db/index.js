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



module.exports = { pool, withTransaction, isUniqueViolation, init };
