
// İş mantığı: şifre hash'leme, doğrulama, kurallar, transaction yönetimi.

const crypto = require("crypto");
require("dotenv").config();
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);
const { pool, withTransaction, isUniqueViolation } = require("../db");

const eloLogic = require("./eloLogic");


const userRepo = require("../repositories/userRepository");



const MIN_PASSWORD_LENGTH = 6;

/* ---------------- Şifre yardımcıları ---------------- */

/**
 * Şifreyi güvenli şekilde hash'ler.
 *
 * Sonuç:
 * salt:hash
 */
async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = (
        await scrypt(password, salt, 64)
    ).toString("hex");

    return `${salt}:${hash}`;
}

/**
 * Girilen şifreyi kayıtlı hash ile karşılaştırır.
 */
async function verifyPassword(password, stored) {
    if (!stored) return false;

    const [salt, hash] = stored.split(":");

    if (!salt || !hash) {
        return false;
    }

    const test = await scrypt(password, salt, 64);

    const storedBuffer = Buffer.from(hash, "hex");

    if (storedBuffer.length !== test.length) {
        return false;
    }

    return crypto.timingSafeEqual(storedBuffer, test);
}

/**
 * Aynı şifrenin ikinci kez kullanılmasını kontrol etmek için
 * deterministik bir key üretir.
 *
 * ÖNEMLİ:
 * Bu değer gerçek şifre değildir.
 * password_hash'ten farklı olarak aynı şifre her zaman
 * aynı password_key'i üretir.
 */
const PEPPER = process.env.PASSWORD_PEPPER;
if (!PEPPER || PEPPER.length < 16) {
    throw new Error("PASSWORD_PEPPER .env içinde tanımlı olmalı (en az 16 karakter)");
}

async function createPasswordKey(password) {
    return (await scrypt(password, PEPPER, 32)).toString("hex");
}

/* ---------------- Sonuç yardımcıları ---------------- */

const fail = (error) => ({
    ok: false,
    error
});

const success = (user) => ({
    ok: true,
    user
});

/* ---------------- Servis ---------------- */

/**
 * Oyuncu odaya girdiğinde:
 *
 * auth kayıtlıysa mevcut kullanıcıyı getirir.
 * auth kayıtlı değilse misafir kullanıcı oluşturur.
 */
function findOrCreateByAuth(auth) {
    return withTransaction(async (tx) => {
        // Aynı auth için eşzamanlı iki kullanıcı oluşmasını engeller.
        await userRepo.lockAuth(tx, auth);

        const existing = await userRepo.findByAuth(tx, auth);

        if (existing) {
            await userRepo.touch(tx, existing.id);
            return existing;
        }

        // Odaya ilk kez giren oyuncu için misafir hesap.
        const user = await userRepo.insertUser(tx);

        await userRepo.insertAuth(
            tx,
            auth,
            user.id
        );

        return user;
    });
}





/**
 * !kayit şifre
 *
 * Örnek:
 * !kayit 1234
 *
 * Oyuncunun mevcut misafir hesabını kayıtlı hesaba dönüştürür.
 */
async function register(auth, password) {
    // Şifre kontrolü
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        return fail(
            `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`
        );
    }

    const passwordHash = await hashPassword(password);
    const passwordKey = await createPasswordKey(password);

    try {
        return await withTransaction(async (tx) => {

            // Oyuncunun mevcut hesabını bul.
            const user = await userRepo.findByAuth(
                tx,
                auth
            );

            if (!user) {
                return fail(
                    "Hesap bulunamadı, odaya tekrar gir."
                );
            }

            // Zaten kayıtlıysa tekrar kayıt olamaz.
            if (user.registered) {
                return fail(
                    "Zaten kayıtlısın."
                );
            }

            // Aynı şifre başka hesapta kullanılıyor mu?
            const passwordTaken =
                await userRepo.findRegisteredByPasswordKey(
                    tx,
                    passwordKey
                );

            if (passwordTaken) {
                return fail(
                    "Bu şifre zaten kullanılıyor. Başka bir şifre seç."
                );
            }

            // Misafir hesabını kayıtlı hesaba çevir.
            const updated =
                await userRepo.markRegistered(
                    tx,
                    user.id,
                    passwordHash,
                    passwordKey
                );

            return success(updated);
        });

    } catch (err) {

        // UNIQUE constraint yarış durumunu yakala.
        if (isUniqueViolation(err)) {
            return fail(
                "Bu şifre zaten kullanılıyor. Başka bir şifre seç."
            );
        }

        throw err;
    }
}


/**
 * !giris şifre
 *
 * Örnek:
 * !giris 1234
 *
 * Oyuncunun auth'ını o şifreye sahip kayıtlı hesaba bağlar.
 */
function login(auth, password) {
    return withTransaction(async (tx) => {

        if (!password) {
            return fail(
                "Şifre girmelisin. Kullanım: !giris şifre"
            );
        }

        const passwordKey =
            await createPasswordKey(password);

        // Şifreye sahip kayıtlı hesabı bul.
        const target =
            await userRepo.findRegisteredByPasswordKey(
                tx,
                passwordKey,
                { forUpdate: true }
            );

        if (!target) {
            return fail(
                "Şifre hatalı veya böyle bir hesap yok."
            );
        }

        // Oyuncunun şu anda bağlı olduğu hesap.
        const current =
            await userRepo.findByAuth(
                tx,
                auth
            );

        // Zaten aynı hesaba bağlı.
        if (current && current.id === target.id) {
            return fail(
                "Zaten bu hesaba giriş yapmışsın."
            );
        }

        // Auth'ı kayıtlı hesaba taşı.
        await userRepo.moveAuth(
            tx,
            auth,
            target.id
        );

        /**
         * Oyuncu login yapmadan önce misafir hesaptaysa,
         * misafir hesabındaki istatistikleri kayıtlı hesaba aktar.
         */
        if (current && !current.registered) {

            await userRepo.addStats(
                tx,
                target.id,
                current
            );

            await userRepo.deleteById(
                tx,
                current.id
            );
        }

        // Güncel kayıtlı hesabı döndür.
        return success(
            await userRepo.findById(
                tx,
                target.id
            )
        );
    });
}




/**
 * Oyun sonunda istatistik eklemek için.
 */
function addStats(userId, stats) {
    return userRepo.addStats(
        pool,
        userId,
        stats
    );
}


/**
 * Maç sonucunu tek transaction'da yazar: elo + wins/losses.
 * winners / losers: [{ userId, playerId, points }]
 * Elo yazılmadıysa null döner.
 */
async function recordMatch({ winners, losers }) {
    const seen = new Set();
    const dedupe = (list) => list.filter((e) => {
        const key = String(e.userId);
        if (seen.has(key)) return false;   // aynı hesap iki sekmeyle girdiyse bir kez say
        seen.add(key);
        return true;
    });
    const w = dedupe(winners);
    const l = dedupe(losers);

    if (w.length < eloLogic.MIN_PLAYERS_PER_TEAM || l.length < eloLogic.MIN_PLAYERS_PER_TEAM) {
        return null;
    }

    return withTransaction(async (tx) => {
        const rows = await userRepo.findByIdsForUpdate(tx, [...w, ...l].map((e) => e.userId));
        const byId = new Map(rows.map((r) => [String(r.id), r]));

        // Elo ve maç sayısı anlık görüntüden değil, kilitli güncel satırdan alınır
        const enrich = (list) => list
            .filter((e) => byId.has(String(e.userId)))
            .map((e) => {
                const u = byId.get(String(e.userId));
                return { ...e, elo: u.elo, games: u.wins + u.losses };
            });

        const changes = eloLogic.calculateMatch({ winners: enrich(w), losers: enrich(l) });

        const results = [];
        for (const c of changes) {
            const user = await userRepo.applyMatchResult(tx, c.userId, {
                eloDelta: c.delta,
                win: c.result === "win" ? 1 : 0,
                loss: c.result === "loss" ? 1 : 0,
            });
            results.push({ playerId: c.playerId, oldElo: c.elo, newElo: c.newElo, delta: c.delta, user });
        }
        return results;
    });
}


/* ---------------- Export ---------------- */

module.exports = {
    findOrCreateByAuth,
    register,
    login,
    verifyPassword,
    addStats,
    recordMatch,

};

