// Sadece SQL. İş kuralı, hash, doğrulama YOK.
// Her fonksiyonun ilk parametresi `db`: pool veya transaction client'ı.

async function lockAuth(db, auth) {
    await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [auth]);
}

async function findByAuth(db, auth) {
    const { rows } = await db.query(
        `SELECT u.*
           FROM users u
           JOIN auths a ON a.user_id = u.id
          WHERE a.auth = $1`,
        [auth]
    );
    return rows[0] || null;
}

async function findById(db, id) {
    const { rows } = await db.query(`SELECT * FROM users WHERE id = $1`, [id]);
    return rows[0] || null;
}

async function findRegisteredByName(db, name, { forUpdate = false } = {}) {
    const { rows } = await db.query(
        `SELECT * FROM users
          WHERE registered AND lower(name) = lower($1)
          ${forUpdate ? "FOR UPDATE" : ""}`,
        [name]
    );
    return rows[0] || null;
}

async function insertUser(db, name) {
    const { rows } = await db.query(
        `INSERT INTO users (name) VALUES ($1) RETURNING *`,
        [name]
    );
    return rows[0];
}

async function insertAuth(db, auth, userId) {
    await db.query(
        `INSERT INTO auths (auth, user_id) VALUES ($1, $2)`,
        [auth, userId]
    );
}

async function moveAuth(db, auth, userId) {
    await db.query(`UPDATE auths SET user_id = $1 WHERE auth = $2`, [userId, auth]);
}

/** last_seen'i günceller; kayıtsız hesapların adını da günceller. */
async function touch(db, id, name) {
    const { rows } = await db.query(
        `UPDATE users
            SET last_seen = now(),
                name = CASE WHEN registered THEN name ELSE $2 END
          WHERE id = $1
      RETURNING *`,
        [id, name]
    );
    return rows[0];
}

async function markRegistered(db, id, name, passwordHash) {
    const { rows } = await db.query(
        `UPDATE users
            SET name = $2, password_hash = $3, registered = TRUE
          WHERE id = $1
      RETURNING *`,
        [id, name, passwordHash]
    );
    return rows[0];
}

async function addStats(db, id, { wins = 0, losses = 0, goals = 0 }) {
    await db.query(
        `UPDATE users
            SET wins = wins + $2, losses = losses + $3, goals = goals + $4
          WHERE id = $1`,
        [id, wins, losses, goals]
    );
}

async function deleteById(db, id) {
    await db.query(`DELETE FROM users WHERE id = $1`, [id]);
}

module.exports = {
    lockAuth,
    findByAuth,
    findById,
    findRegisteredByName,
    insertUser,
    insertAuth,
    moveAuth,
    touch,
    markRegistered,
    addStats,
    deleteById,
};
