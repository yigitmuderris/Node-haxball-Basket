
// Sadece SQL.
// İş kuralı, hash, doğrulama YOK.
// Her fonksiyonun ilk parametresi `db`: pool veya transaction client'ı.


/**
 * Aynı auth üzerinde eşzamanlı işlemleri sıraya sokar.
 */
async function lockAuth(db, auth) {
    await db.query(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        [auth]
    );
}


/**
 * Auth'a bağlı kullanıcıyı getirir.
 */
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


/**
 * ID ile kullanıcı getirir.
 */
async function findById(db, id) {
    const { rows } = await db.query(
        `SELECT *
           FROM users
          WHERE id = $1`,
        [id]
    );

    return rows[0] || null;
}

async function findByIdsForUpdate(db, ids) {
    const { rows } = await db.query(
        `SELECT * FROM users WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE`,
        [ids]
    );
    return rows;
}

async function applyMatchResult(
    db,
    id,
    { eloDelta, win, loss, winStreak, mvp }
) {
    const { rows } = await db.query(
        `UPDATE users
            SET elo = GREATEST(elo + $2, 0),

                wins = wins + $3,
                losses = losses + $4,

                win_streak = CASE
                    WHEN $5 = 1
                        THEN win_streak + 1
                    ELSE 0
                END,

                best_win_streak = CASE
                    WHEN $5 = 1
                        THEN GREATEST(best_win_streak, win_streak + 1)
                    ELSE best_win_streak
                END,
                
                mvp_count = mvp_count + $6

          WHERE id = $1
      RETURNING *`,
        [
            id,
            eloDelta,
            win,
            loss,
            winStreak,
            mvp
        ]
    );

    return rows[0];
}



async function updateUsername(db, id, username) {
    const { rows } = await db.query(
        `UPDATE users
            SET username = $2
          WHERE id = $1
      RETURNING *`,
        [id, username]
    );

    return rows[0];
}

async function getLeaderboard(db, limit = 10) {
    const safeLimit = Math.min(
        Math.max(Number(limit) || 10, 1),
        10
    );

    const { rows } = await db.query(
        `SELECT
            id,
            username,
            elo,
            wins,
            losses
         FROM users
         WHERE registered = TRUE
         ORDER BY elo DESC, wins DESC, id ASC
         LIMIT $1`,
        [safeLimit]
    );

    return rows;
}

/**
 * password_key ile kayıtlı kullanıcıyı bulur.
 *
 * forUpdate=true verilirse login sırasında
 * hesabı transaction boyunca kilitler.
 */
async function findRegisteredByPasswordKey(
    db,
    passwordKey,
    { forUpdate = false } = {}
) {
    const { rows } = await db.query(
        `SELECT *
           FROM users
          WHERE registered = TRUE
            AND password_key = $1
          ${forUpdate ? "FOR UPDATE" : ""}`,
        [passwordKey]
    );

    return rows[0] || null;
}


/**
 * Yeni misafir kullanıcı oluşturur.
 *
 * Kullanıcı adı/name yoktur.
 */
async function insertUser(db) {
    const { rows } = await db.query(
        `INSERT INTO users DEFAULT VALUES
         RETURNING *`
    );

    return rows[0];
}


/**
 * Auth'ı kullanıcıya bağlar.
 */
async function insertAuth(db, auth, userId) {
    await db.query(
        `INSERT INTO auths (auth, user_id)
         VALUES ($1, $2)`,
        [auth, userId]
    );
}


/**
 * Auth'ı başka kullanıcıya taşır.
 */
async function moveAuth(db, auth, userId) {
    await db.query(
        `UPDATE auths
            SET user_id = $1
          WHERE auth = $2`,
        [userId, auth]
    );
}


/**
 * Kullanıcının son görülme zamanını günceller.
 */
async function touch(db, id) {
    const { rows } = await db.query(
        `UPDATE users
            SET last_seen = now()
          WHERE id = $1
        RETURNING *`,
        [id]
    );

    return rows[0];
}


/**
 * Misafir hesabı kayıtlı hesaba dönüştürür.
 *
 * password_hash:
 *   Gerçek scrypt hash'i.
 *
 * password_key:
 *   Aynı şifrenin ikinci kez kullanılmasını
 *   engellemek için kullanılan deterministik key.
 */
async function markRegistered(
    db,
    id,
    passwordHash,
    passwordKey
) {
    const { rows } = await db.query(
        `UPDATE users
            SET password_hash = $2,
                password_key = $3,
                registered = TRUE
          WHERE id = $1
        RETURNING *`,
        [
            id,
            passwordHash,
            passwordKey
        ]
    );

    return rows[0];
}


/**
 * Kullanıcının istatistiklerini artırır.
 */
async function addStats(
    db,
    id,
    {
        wins = 0,
        losses = 0,
        two_pt_made = 0,
        three_pt_made = 0,
        two_pt_own_basket = 0,
        three_pt_own_basket = 0
    }
) {
    await db.query(
        `UPDATE users
            SET wins = wins + $2,
                losses = losses + $3,
                two_pt_made = two_pt_made + $4,
                three_pt_made = three_pt_made + $5,
                two_pt_own_basket = two_pt_own_basket + $6,
                three_pt_own_basket = three_pt_own_basket + $7
          WHERE id = $1`,
        [
            id,
            wins,
            losses,
            two_pt_made,
            three_pt_made,
            two_pt_own_basket,
            three_pt_own_basket
        ]
    );
}


/**
 * Kullanıcıyı siler.
 *
 * auths.user_id -> users.id
 * foreign key'i ON DELETE CASCADE olduğu için
 * bağlı auth kayıtları da silinir.
 */
async function deleteById(db, id) {
    await db.query(
        `DELETE FROM users
          WHERE id = $1`,
        [id]
    );
}


module.exports = {
    lockAuth,
    findByAuth,
    findById,
    findByIdsForUpdate,
    findRegisteredByPasswordKey,
    insertUser,
    insertAuth,
    moveAuth,
    touch,
    markRegistered,
    addStats,
    applyMatchResult,
    deleteById,
    getLeaderboard,
    updateUsername
};

