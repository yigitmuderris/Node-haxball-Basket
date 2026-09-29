// İş mantığı: şifre hash'leme, doğrulama, kurallar, transaction yönetimi.
const crypto = require("crypto");
const { promisify } = require("util");
const { pool, withTransaction, isUniqueViolation } = require("../db");
const userRepo = require("../repositories/userRepository");

const scrypt = promisify(crypto.scrypt);
const MIN_PASSWORD_LENGTH = 4;

/* ---------------- şifre yardımcıları ---------------- */
async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = (await scrypt(password, salt, 64)).toString("hex");
    return `${salt}:${hash}`;
}

async function verifyPassword(password, stored) {
    if (!stored) return false;
    const [salt, hash] = stored.split(":");
    const test = await scrypt(password, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), test);
}

const fail = (error) => ({ ok: false, error });
const success = (user) => ({ ok: true, user });

/* ---------------- servis ---------------- */

/** Odaya girişte: auth biliniyorsa hesabı getir, yoksa misafir hesap aç. */
function findOrCreateByAuth(auth, name) {
    return withTransaction(async (tx) => {
        // Aynı auth için eşzamanlı çift kayıt olmasın
        await userRepo.lockAuth(tx, auth);

        const existing = await userRepo.findByAuth(tx, auth);
        if (existing) {
            return userRepo.touch(tx, existing.id, name);
        }

        const user = await userRepo.insertUser(tx, name);
        await userRepo.insertAuth(tx, auth, user.id);
        return user;
    });
}

/** !kayit şifre */
async function register(auth, name, password) {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        return fail(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
    }

    const passwordHash = await hashPassword(password);

    try {
        return await withTransaction(async (tx) => {
            const user = await userRepo.findByAuth(tx, auth);
            if (!user) return fail("Hesap bulunamadı, odaya tekrar gir.");
            if (user.registered) return fail("Zaten kayıtlısın.");

            const taken = await userRepo.findRegisteredByName(tx, name);
            if (taken) {
                return fail("Bu isimle kayıtlı bir hesap var. Sen ise !giris isim şifre yaz.");
            }

            const updated = await userRepo.markRegistered(tx, user.id, name, passwordHash);
            return success(updated);
        });
    } catch (err) {
        // Pre-check ile insert arasındaki yarış durumu
        if (isUniqueViolation(err)) {
            return fail("Bu isimle kayıtlı bir hesap var. Sen ise !giris isim şifre yaz.");
        }
        throw err;
    }
}

/** !giris isim şifre -> yeni auth'u kayıtlı hesaba bağla. */
function login(auth, name, password) {
    return withTransaction(async (tx) => {
        const target = await userRepo.findRegisteredByName(tx, name, { forUpdate: true });

        if (!target || !(await verifyPassword(password, target.password_hash))) {
            return fail("İsim veya şifre hatalı.");
        }

        const current = await userRepo.findByAuth(tx, auth);
        if (current && current.id === target.id) {
            return fail("Zaten bu hesaba giriş yapmışsın.");
        }

        await userRepo.moveAuth(tx, auth, target.id);

        // Misafir hesabın istatistiklerini kayıtlı hesaba aktar, misafiri sil
        if (current && !current.registered) {
            await userRepo.addStats(tx, target.id, current);
            await userRepo.deleteById(tx, current.id);
        }

        return success(await userRepo.findById(tx, target.id));
    });
}

function addStats(userId, stats) {
    return userRepo.addStats(pool, userId, stats);
}

module.exports = { findOrCreateByAuth, register, login, addStats };
