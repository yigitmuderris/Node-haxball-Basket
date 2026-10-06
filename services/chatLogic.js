
// Kısa/belirsiz kelimeler: sadece TAM kelime olarak eşleşir (ek almış halleri de yaz)
const EXACT_WORDS = new Set([
    "sik", "siktir", "sikerim", "sikeyim", "sikik", "oe", "oc", "pic", "pij", "got", "goto",
    "gotu", "pipi", "kuku", "bok", "mal", "it", "itoglu", "salak", "slak", "slaak",
    "orsp", "ursp", "aptal", "sokuk", "ucube", "pclik", "aptaloc", "pasatoc", "aptaloe", "pasatoe", "susoc", "malmk", "malamk", "yazmaanneiskeirmn", "kafasiz", "kafasız",
    "benannenisikim", "siktiler", "salaksinb", "anasi", "osovbucoco", "bacina", "it", "enigi", "bacini", "deseyim", "valideni", "anmnnnenui", "bogharim",
    "anana", "karini", "anen", "allahin", "peygamberin", "annen", "amcik", "sikicem"
]);

// Uzun ve belirsizliği düşük kökler: kelime BU İLE BAŞLIYORSA yakalar (ekleri de kapsar)
const PREFIX_WORDS = [
    "orospu", "oruspu", "yarrak", "kahpe", "gavat", "pezevenk", "gerizekali",
    "serefsiz", "aptalevladi", "amkkurdu", "amkturku", "amini",
    "anani", "anneni", "babani", "bacini", "allahini", "alahini", "allani",
    "tanrini", "dinini", "kitabini", "ataturkunu", "peygamberini", "muhammedini", "anana", "oe", "oc", "orsp", "enigi", "oananiskerim", "aptaluincocugus",
    "skrm", "skerm", "sikerm", "annanabasarim", "annnei", "bnecericem", "skm", "skcem", "skcm", "anasini", "siktigimin", "allhini ",
    "anasini"
];

function normalize(text) {
    return text
        .toLowerCase()
        .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
        .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
        .replace(/[^a-z0-9\s]/g, "");   // boşlukları KORU
}

function hasBannedWord(text) {
    if (!text) return false;

    const words = normalize(text).split(/\s+/).filter(Boolean);

    return words.some(word =>
        EXACT_WORDS.has(word) ||
        PREFIX_WORDS.some(root => word.startsWith(root))
    );
}

// 🛑 FLOODING (SPAM) KONTROLÜ 

const lastMessageTime = new Map();
const spamStrikes = new Map();       // oyuncu -> ihlal sayısı
const lastStrikeTime = new Map();    // oyuncu -> son ihlal zamanı

const BASE_COOLDOWN = 1000;          // başlangıç bekleme süresi (ms)
const COOLDOWN_STEP = 2000;          // her ihlalde eklenecek süre (ms)
const MAX_COOLDOWN = 20000;          // üst sınır (ms)
const STRIKE_RESET_TIME = 60000;     // bu kadar süre temiz kalırsa ihlaller sıfırlanır (ms)

function controlSpam(playerId, lang = 'tr') {
    let announcement = "";
    let messageSendStatus = true;
    const now = Date.now();

    // Uzun süre spam yapmadıysa ihlalleri sıfırla
    const lastStrike = lastStrikeTime.get(playerId) || 0;
    if (now - lastStrike > STRIKE_RESET_TIME) {
        spamStrikes.set(playerId, 0);
    }

    const strikes = spamStrikes.get(playerId) || 0;
    const cooldown = Math.min(BASE_COOLDOWN + strikes * COOLDOWN_STEP, MAX_COOLDOWN);
    const lastTime = lastMessageTime.get(playerId) || 0;
    const elapsed = now - lastTime;

    if (elapsed < cooldown) {
        // Yeni ihlal kaydet
        spamStrikes.set(playerId, strikes + 1);
        lastStrikeTime.set(playerId, now);

        const newCooldown = Math.min(BASE_COOLDOWN + (strikes + 1) * COOLDOWN_STEP, MAX_COOLDOWN);
        const remaining = Math.ceil((cooldown - elapsed) / 1000);
        const nextCooldownSec = Math.ceil(newCooldown / 1000);

        if (lang === 'en') {
            announcement = `Don't spam! Next cooldown increased to ${nextCooldownSec} seconds. (Wait ${remaining}s more)`;
        } else {
            announcement = `Spam yapma! Bir dahaki spamda bekleme süren ${nextCooldownSec} saniyeye çıktı. (${remaining} sn daha bekle)`;
        }

        messageSendStatus = false;
    } else {
        lastMessageTime.set(playerId, now);
    }

    return { announcement, messageSendStatus };
}

const TEAM_COLORS = { 0: 0xCCCCCC, 1: 0xFF6666, 2: 0x66B2FF };

function getRankInfo(elo, lang = 'tr') {
    const isEn = lang === 'en';

    if (elo >= 1500) {
        return { name: isEn ? "Legend 👑" : "Efsane 👑", color: 0xFFD700 };
    }
    if (elo >= 1300) {
        return { name: isEn ? "Diamond 💎" : "Elmas 💎", color: 0x00FFFF };
    }
    if (elo >= 1150) {
        return { name: isEn ? "Gold 🥇" : "Altın 🥇", color: 0xFFD700 };
    }
    if (elo >= 1000) {
        return { name: isEn ? "Silver 🥈" : "Gümüş 🥈", color: 0xC0C0C0 };
    }
    if (elo >= 850) {
        return { name: isEn ? "Bronze 🥉" : "Bronz 🥉", color: 0xCD7F32 };
    }

    return { name: isEn ? "Coal 🪵" : "Kömür 🪵", color: 0x666666 };
}



/** recordMatch sonucundan oyunculara gidecek duyuruları üretir. */
function buildEloAnnouncements(results, lang = 'tr') {
    const isEn = lang === 'en';

    return results.map((r) => {
        const oldRank = getRankInfo(r.oldElo, lang).name;
        const newRank = getRankInfo(r.newElo, lang).name;
        const sign = r.delta > 0 ? "+" : "";
        let message = `📈 ELO: ${r.oldElo} → ${r.newElo} (${sign}${r.delta})`;

        if (oldRank !== newRank) {
            if (r.delta > 0) {
                message += isEn ? ` 🎉 New rank: ${newRank}` : ` 🎉 Yeni rank: ${newRank}`;
            } else {
                message += isEn ? ` 📉 Rank demoted: ${newRank}` : ` 📉 Rank düştü: ${newRank}`;
            }
        }
        return { playerId: r.playerId, message, color: r.delta > 0 ? 0x00FF00 : 0xFF6666 };
    });
}

/**
 * recordMatch sonucundan MVP duyurusunu üretir.
 */
function buildMvpAnnouncement(results, lang = 'tr') {
    const mvps = results
        .filter((r) => r.isMvp)
        .map((r) => r.user.username);

    if (mvps.length === 0) {
        return null;
    }

    const names = mvps.join(" & ");
    return `🏆 MVP: ${names}`;
}

/** Sohbet mesajını elo etiketiyle duyuru satırına çevirir. */
function buildChatAnnouncement({ name, teamId, user, text}, lang = 'tr') {
    const tag = user ? getRankInfo(user.elo, lang) : "[...]";

    // Kullanıcı varsa Elo rütbe rengini, yoksa varsayılan takım rengini seçer
    const messageColor = user ? tag.color : (TEAM_COLORS[teamId] ?? TEAM_COLORS[0]);

    return { message: `${tag.name} ${name}: ${text}`, color: messageColor };
}

/**
 * !stats
 * Oyuncunun detaylı istatistiklerini hazırlar.
 */
function buildStatsAnnouncement(user, lang = 'tr') {
    const isEn = lang === 'en';

    if (!user) {
        return {
            message: isEn
                ? "❌ Account not loaded yet. Please try again in a few seconds."
                : "❌ Hesabın henüz yüklenmedi. Birkaç saniye sonra tekrar dene.",
            color: 0xFF0000
        };
    }

    const elo = Number(user.elo) || 0;
    const wins = Number(user.wins) || 0;
    const losses = Number(user.losses) || 0;

    const games = wins + losses;
    const winRate = games > 0
        ? ((wins / games) * 100).toFixed(1)
        : "0.0";

    const currentStreak = Number(user.win_streak) || 0;
    const bestStreak = Number(user.best_win_streak) || 0;

    const rank = getRankInfo(elo, lang);

    if (isEn) {
        return {
            message:
                `📊 YOUR STATS\n` +
                `━━━━━━━━━━━━━━\n` +
                `🏀 ELO: ${elo}\n` +
                `🏅 Rank: ${rank.name}\n` +
                `🎮 Matches: ${games}\n` +
                `✅ Wins: ${wins}\n` +
                `❌ Losses: ${losses}\n` +
                `📈 Win Rate: %${winRate}\n` +
                `🔥 Win streak: ${currentStreak}\n` +
                `🏆 Best streak: ${bestStreak}`,
            color: rank.color
        };
    }

    return {
        message:
            `📊 İSTATİSTİKLERİN\n` +
            `━━━━━━━━━━━━━━\n` +
            `🏀 ELO: ${elo}\n` +
            `🏅 Rütbe: ${rank.name}\n` +
            `🎮 Maç: ${games}\n` +
            `✅ Galibiyet: ${wins}\n` +
            `❌ Mağlubiyet: ${losses}\n` +
            `📈 Win Rate: %${winRate}\n` +
            `🔥 Galibiyet serisi: ${currentStreak}\n` +
            `🏆 En iyi seri: ${bestStreak}`,
        color: rank.color
    };
}

/**
 * !rank
 * Daha kısa rank bilgisi.
 */
function buildRankAnnouncement(user, lang = 'tr') {
    const isEn = lang === 'en';

    if (!user) {
        return {
            message: isEn ? "❌ Account not loaded yet." : "❌ Hesabın henüz yüklenmedi.",
            color: 0xFF0000
        };
    }

    const elo = Number(user.elo) || 0;
    const wins = Number(user.wins) || 0;
    const losses = Number(user.losses) || 0;

    const games = wins + losses;
    const winRate = games > 0
        ? ((wins / games) * 100).toFixed(1)
        : "0.0";

    const streak = Number(user.win_streak) || 0;
    const rank = getRankInfo(elo, lang);

    if (isEn) {
        return {
            message:
                `🏅 ${rank.name} | ${elo} ELO | ` +
                `${wins}W-${losses}L | %${winRate} WR | ` +
                `🔥 ${streak} streak`,
            color: rank.color
        };
    }

    return {
        message:
            `🏅 ${rank.name} | ${elo} ELO | ` +
            `${wins}W-${losses}L | %${winRate} WR | ` +
            `🔥 ${streak} seri`,
        color: rank.color
    };
}

/**
 * !vs <oyuncu>
 * Kariyer istatistikleri karşılaştırılır.
 */
function buildVsAnnouncement(user1, user2, name1, name2, lang = 'tr') {
    const isEn = lang === 'en';

    if (!user1 || !user2) {
        return {
            message: isEn
                ? "❌ Player account to compare was not found."
                : "❌ Karşılaştırılacak oyuncunun hesabı bulunamadı.",
            color: 0xFF0000
        };
    }

    const elo1 = Number(user1.elo) || 0;
    const elo2 = Number(user2.elo) || 0;

    const wins1 = Number(user1.wins) || 0;
    const losses1 = Number(user1.losses) || 0;

    const wins2 = Number(user2.wins) || 0;
    const losses2 = Number(user2.losses) || 0;

    const games1 = wins1 + losses1;
    const games2 = wins2 + losses2;

    const wr1 = games1 > 0 ? ((wins1 / games1) * 100).toFixed(1) : "0.0";
    const wr2 = games2 > 0 ? ((wins2 / games2) * 100).toFixed(1) : "0.0";

    const rank1 = getRankInfo(elo1, lang);
    const rank2 = getRankInfo(elo2, lang);

    if (isEn) {
        return {
            message:
                `⚔️ PLAYER COMPARISON\n` +
                `━━━━━━━━━━━━━━\n` +
                `👤 ${name1}\n` +
                `🏅 ${rank1.name} | ${elo1} ELO\n` +
                `🎮 ${games1} matches | ${wins1}W-${losses1}L\n` +
                `📈 %${wr1} WR\n` +
                `🔥 ${Number(user1.win_streak) || 0} streak\n` +
                `\n` +
                `👤 ${name2}\n` +
                `🏅 ${rank2.name} | ${elo2} ELO\n` +
                `🎮 ${games2} matches | ${wins2}W-${losses2}L\n` +
                `📈 %${wr2} WR\n` +
                `🔥 ${Number(user2.win_streak) || 0} streak`,
            color: 0xFFD700
        };
    }

    return {
        message:
            `⚔️ OYUNCU KARŞILAŞTIRMASI\n` +
            `━━━━━━━━━━━━━━\n` +
            `👤 ${name1}\n` +
            `🏅 ${rank1.name} | ${elo1} ELO\n` +
            `🎮 ${games1} maç | ${wins1}W-${losses1}L\n` +
            `📈 %${wr1} WR\n` +
            `🔥 ${Number(user1.win_streak) || 0} seri\n` +
            `\n` +
            `👤 ${name2}\n` +
            `🏅 ${rank2.name} | ${elo2} ELO\n` +
            `🎮 ${games2} maç | ${wins2}W-${losses2}L\n` +
            `📈 %${wr2} WR\n` +
            `🔥 ${Number(user2.win_streak) || 0} seri`,
        color: 0xFFD700
    };
}

// ============================================================
// HESAP KOMUTLARI
// ============================================================

function buildAccountCommandAnnouncement(cmd, result, lang = 'tr') {
    const isEn = lang === 'en';

    if (result.ok) {
        return {
            message: isEn ? "✅ Success!" : "✅ Başarılı!",
            color: 0x00FF00
        };
    }

    return {
        message: `❌ ${result.error}`,
        color: 0xFF0000
    };
}

function buildAccountCommandUsage(cmd, lang = 'tr') {
    const isEn = lang === 'en';

    if (cmd === "!kayit" || cmd === "!register") {
        return {
            message: isEn ? "❌ Usage: !register password" : "❌ Kullanım: !kayit şifre",
            color: 0xFF0000
        };
    }

    if (cmd === "!giris" || cmd === "!login") {
        return {
            message: isEn ? "❌ Usage: !login password" : "❌ Kullanım: !giris şifre",
            color: 0xFF0000
        };
    }

    return {
        message: isEn ? "❌ Invalid command." : "❌ Geçersiz komut.",
        color: 0xFF0000
    };
}

function buildCommandCooldownAnnouncement(lang = 'tr') {
    return {
        message: lang === 'en' ? "⏳ Please wait a moment." : "⏳ Biraz bekle.",
        color: 0xFF0000
    };
}

function buildHelpAnnouncement(lang = 'tr') {
    if (lang === 'en') {
        return {
            message:
                `📖 COMMANDS\n` +
                `━━━━━━━━━━━━━━\n` +
                `🔐 !register pass — Create an account\n` +
                `🔑 !login pass — Log in to your account\n` +
                `📊 !stats — Show your statistics\n` +
                `🏅 !rank — Show rank and ELO\n` +
                `⚔️ !vs player — Compare players\n` +
                `🏆 !leaderboard — Show ELO leaderboard\n` +
                `🏆 !leaderboard 5 — Show top 5 players\n` +
                `❓ !help — Show commands list`,
            color: 0x00FFFF
        };
    }

    return {
        message:
            `📖 KOMUTLAR\n` +
            `━━━━━━━━━━━━━━\n` +
            `🔐 !kayit şifre — Hesap oluştur\n` +
            `🔑 !giris şifre — Hesabına giriş yap\n` +
            `📊 !stats — İstatistiklerini göster\n` +
            `🏅 !rank — Rütbeni ve ELO'nu göster\n` +
            `⚔️ !vs oyuncu — Oyuncu karşılaştır\n` +
            `🏆 !leaderboard — ELO sıralamasını göster\n` +
            `🏆 !leaderboard 5 — İlk 5 oyuncuyu göster\n` +
            `❓ !help — Komutları göster\n` +
            `❓ !yardım — Komutları göster\n` +
            `❓ !komutlar — Komutları göster`,
        color: 0x00FFFF
    };
}

function buildLeaderboardAnnouncement(players, lang = 'tr') {
    const isEn = lang === 'en';

    if (!Array.isArray(players) || players.length === 0) {
        const noPlayersText = isEn ? "No registered players." : "Kayıtlı oyuncu yok.";
        return {
            message:
                `╔════════════════════╗\n` +
                `║   🏆 LEADERBOARD   ║\n` +
                `╠════════════════════╣\n` +
                `║ ${noPlayersText.padEnd(18)} ║\n` +
                `╚════════════════════╝`,
            color: 0xFFD700
        };
    }

    const medals = ["🥇", "🥈", "🥉"];

    const lines = players.map((player, index) => {
        const position = index + 1;
        const prefix = medals[index] || `${position}.`;

        const username = player.username || (isEn ? "Player" : "Oyuncu");
        const elo = Number(player.elo) || 0;
        const wins = Number(player.wins) || 0;
        const losses = Number(player.losses) || 0;

        return (
            `║ ${prefix} ${username} — ${elo} ELO ` +
            `${wins}W-${losses}L`
        );
    });

    return {
        message:
            `╔════════════════════╗\n` +
            `║   🏆 LEADERBOARD   ║\n` +
            `╠════════════════════╣\n` +
            lines.join("\n") +
            `\n╚════════════════════╝`,
        color: 0xFFD700
    };
}

module.exports = {
    buildEloAnnouncements,
    buildChatAnnouncement,
    buildMvpAnnouncement,
    hasBannedWord,
    controlSpam,
    getRankInfo,
    buildStatsAnnouncement,
    buildRankAnnouncement,
    buildVsAnnouncement,
    buildAccountCommandAnnouncement,
    buildAccountCommandUsage,
    buildCommandCooldownAnnouncement,
    buildHelpAnnouncement,
    buildLeaderboardAnnouncement
};