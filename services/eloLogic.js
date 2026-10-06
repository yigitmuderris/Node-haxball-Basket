// Saf fonksiyonlar: veritabanından ve Haxball'dan habersiz, kolayca test edilir.

/* ---------------- ayarlar (hepsi buradan değişir) ---------------- */
const START_ELO = 1000;            // migration'daki DEFAULT ile aynı olmalı
const MIN_ELO = 0;                 // userRepository.applyMatchResult'taki GREATEST(..., 0) ile aynı

const K_PROVISIONAL = 40;          // ilk maçlarda elo hızlı oturur
const K_NORMAL = 24;
const PROVISIONAL_GAMES = 10;

// Skora katkının elo değişimine etkisi: 0.25 => katkıya göre ±%25
const CONTRIBUTION_WEIGHT = 0.25;

// Her takımda en az bu kadar kayıtlı oyuncu yoksa maç elo'ya yazılmaz (1v1 farm'ı engeller)
const MIN_PLAYERS_PER_TEAM = 2;

// Hangi istatistik kaç puan katkı sayılır (kendi potasına atılan eksi)
const STAT_POINTS = {
    two_pt_made: 2,
    three_pt_made: 3,
    two_pt_own_basket: -2,
    three_pt_own_basket: -3,
};

// Büyükten küçüğe sıralı
const RANKS = [
    { min: 1500, name: "Efsane", emoji: "👑" },
    { min: 1300, name: "Elmas", emoji: "💎" },
    { min: 1150, name: "Altın", emoji: "🥇" },
    { min: 1000, name: "Gümüş", emoji: "🥈" },
    { min: 850, name: "Bronz", emoji: "🥉" },
    { min: 0, name: "Kömür", emoji: "🪵" }

];

/* ---------------- elo ---------------- */
const average = (list, key) => list.reduce((sum, e) => sum + e[key], 0) / list.length;

// a'nın b'ye karşı beklenen skoru (0..1)
const expectedScore = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));

const kFactor = (games) => (games < PROVISIONAL_GAMES ? K_PROVISIONAL : K_NORMAL);

/**
 * Takımdaki her oyuncu için katkı çarpanı (1 = ortalama).
 * Takımın toplam pozitif puanındaki payına bakar; hiç puan yoksa herkes 1.
 */
function contributionModifiers(team) {
    const positive = team.map((e) => Math.max(0, e.points || 0));
    const total = positive.reduce((sum, p) => sum + p, 0);
    if (total === 0) return team.map(() => 1);

    return positive.map((p) => {
        const relative = Math.min(2, (p / total) * team.length); // 1 = adil pay
        return 1 + CONTRIBUTION_WEIGHT * (relative - 1);
    });
}

/**
 * winners / losers: [{ userId, playerId, elo, games, points }]
 * Dönüş: aynı oyuncular + { result, delta, newElo }
 *
 * Takım elo'su ortalamadır. Favori kazanırsa az, sürpriz olursa çok puan kazanılır.
 * Katkısı yüksek kazanan daha çok kazanır, katkısı yüksek kaybeden daha az kaybeder.
 */
function calculateMatch({ winners, losers }) {
    const expectedWin = expectedScore(average(winners, "elo"), average(losers, "elo"));
    const swing = 1 - expectedWin;

    const winMods = contributionModifiers(winners);
    const loseMods = contributionModifiers(losers);

    const changes = [
        ...winners.map((e, i) => ({
            ...e,
            result: "win",
            delta: Math.max(1, Math.round(kFactor(e.games) * swing * winMods[i])),
        })),
        ...losers.map((e, i) => ({
            ...e,
            result: "loss",
            delta: -Math.max(1, Math.round(kFactor(e.games) * swing * (2 - loseMods[i]))),
        })),
    ];

    return changes.map((c) => {
        const newElo = Math.max(MIN_ELO, c.elo + c.delta);
        return { ...c, newElo, delta: newElo - c.elo };
    });
}


module.exports = {
    START_ELO,
    MIN_ELO,
    MIN_PLAYERS_PER_TEAM,
    STAT_POINTS,
    calculateMatch,
    
};