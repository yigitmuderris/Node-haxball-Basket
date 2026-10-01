const { STAT_POINTS, formatTag, getRank } = require('./eloLogic');



// Kısa/belirsiz kelimeler: sadece TAM kelime olarak eşleşir (ek almış halleri de yaz)
const EXACT_WORDS = new Set([
    "sik", "siktir", "sikerim", "sikeyim", "sikik", "oe", "oc", "pic", "pij", "got", "goto",
    "gotu", "pipi", "kuku", "bok", "mal", "it", "itoglu", "salak", "slak", "slaak",
    "orsp", "ursp", "aptal", "sokuk", "ucube", "pclik", "aptaloc", "pasatoc", "aptaloe", "pasatoe", "susoc", "malmk", "malamk", "yazmaanneiskeirmn", "kafasiz", "kafasız",
    "benannenisikim", "siktiler", "salaksinb", "anasi", "osovbucoco", "bacina", "it", "enigi", "bacini", "deseyim", "valideni", "anmnnnenui", "bogharim",
    "anana", "karini", "anen", "allahin", "peygamberin", "annen", "amcik","sikicem"

]);

// Uzun ve belirsizliği düşük kökler: kelime BU İLE BAŞLIYORSA yakalar (ekleri de kapsar)
const PREFIX_WORDS = [
    "orospu", "oruspu", "yarrak", "kahpe", "gavat", "pezevenk", "gerizekali",
    "serefsiz", "aptalevladi", "amkkurdu", "amkturku", "amini",
    "anani", "anneni", "babani", "bacini", "allahini", "alahini", "allani",
    "tanrini", "dinini", "kitabini", "ataturkunu", "peygamberini", "muhammedini", "anana", "oe", "oc", "orsp", "enigi", "oananiskerim", "aptaluincocugus",
    "skrm", "skerm", "sikerm", "annanabasarim", "annnei", "bnecericem", "skm","skcem","skcm"
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

function controlSpam(playerId) {

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

        announcement = `Spam yapma! Bir dahaki spamda bekleme süren ${Math.ceil(newCooldown / 1000)} saniyeye çıktı. (${remaining} sn daha bekle)`;

        messageSendStatus = false;
    } else {

        lastMessageTime.set(playerId, now);

    }



    return { announcement, messageSendStatus }

}
const TEAM_COLORS = { 0: 0xCCCCCC, 1: 0xFF6666, 2: 0x66B2FF };

/** recordMatch sonucundan oyunculara gidecek duyuruları üretir. */
function buildEloAnnouncements(results) {
    return results.map((r) => {
        const oldRank = getRank(r.oldElo).name;
        const newRank = getRank(r.newElo).name;
        const sign = r.delta > 0 ? "+" : "";
        let message = `📈 ELO: ${r.oldElo} → ${r.newElo} (${sign}${r.delta})`;
        if (oldRank !== newRank) {
            message += r.delta > 0 ? ` 🎉 Yeni rank: ${newRank}` : ` 📉 Rank düştü: ${newRank}`;
        }
        return { playerId: r.playerId, message, color: r.delta > 0 ? 0x00FF00 : 0xFF6666 };
    });
}

function getEloRankColor(elo) {
    if (!elo) return 0xFFFFFF; // Elo verisi yoksa varsayılan beyaz
    
    if (elo >= 1500) return 0x00FF7F; // 1800+     : Zümrüt (Büyüleyici Yeşil)
    if (elo >= 1500) return 0x00FFFF; // 1500-1799 : Elmas (Canlı Turkuaz/Siyan)
    if (elo >= 1150) return 0xFFD700; // 1200-1499 : Altın (Parlak Altın Sarısı)
    if (elo >= 1000)  return 0xE5E8E8; // 900-1199  : Gümüş (Cıvıl Cıvıl Parlak Platin/Gümüş) ✨
    if (elo >= 850)  return 0xCD7F32;                  // 0-899    : Bronz (Sıcak Bakır/Bronz)

    return 0xCD7F32;                  // 0-899    : Bronz (Sıcak Bakır/Bronz)
}

/** Sohbet mesajını elo etiketiyle duyuru satırına çevirir. */
function buildChatAnnouncement({ name, teamId, user, text }) {
    const tag = user ? formatTag(user.elo) : "[...]";

    // Kullanıcı varsa Elo rütbe rengini, yoksa varsayılan takım rengini seçer
    const messageColor = user ? getEloRankColor(user.elo) : (TEAM_COLORS[teamId] ?? TEAM_COLORS[0]);

    return { message: `${tag} ${name}: ${text}`, color: messageColor };
}


module.exports = { buildEloAnnouncements, buildChatAnnouncement, hasBannedWord,controlSpam }