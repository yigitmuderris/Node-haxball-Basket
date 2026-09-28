
function getLiveTeams(roomPlayers) {
    let redCount = 0;
    let blueCount = 0;


    if (!Array.isArray(roomPlayers)) return { red: 0, blue: 0 };

    roomPlayers.forEach(player => {
        if (player && player.team) {
            if (player.team.id === 1) redCount++;
            if (player.team.id === 2) blueCount++;
        }
    });

    return { red: redCount, blue: blueCount };
}


function balanceTeams(queue, roomPlayers, maxPerTeam = 3, isLeave = false) {

    // Canlı sayıları al
    const teams = getLiveTeams(roomPlayers);
    const moves = []
    const updatedQueue = [...queue]
    let announcement = "";
    let shouldStopGame = false;

    while (updatedQueue.length > 0) {
        // Her iki takım da 3v3 olduysa döngüyü KESİN OLARAK bitir
        if (teams.red >= maxPerTeam && teams.blue >= maxPerTeam) break;

        let targetTeamID;

        // Adil dağıtım mantığı
        if (teams.red > teams.blue) {
            targetTeamID = 2; // Kırmızı çoksa Maviye at
        } else if (teams.blue > teams.red) {
            targetTeamID = 1; // Mavi çoksa Kırmızıya at
        } else {
            // Eşitlikte (0v0, 1v1, 2v2) 3 sınırı dolmayana öncelik ver
            targetTeamID = (teams.red < maxPerTeam) ? 1 : 2;
        }

        // Üst sınır koruması: Hedef takım zaten 3 kişiyse sıradan çekmeyi durdur
        if ((targetTeamID === 1 && teams.red >= maxPerTeam) || (targetTeamID === 2 && teams.blue >= maxPerTeam)) break;


        // Sıradan oyuncuyu güvenle çek ve takıma yolla
        const nextPlayerId = updatedQueue.shift();

        moves.push({ playerId: nextPlayerId, teamId: targetTeamID })

        // Kütüphane asenkron onayını beklemeden local sayacımızı artırıyoruz (4v4 koruması)
        if (targetTeamID === 1) teams.red++;
        else teams.blue++;
    }

    if (updatedQueue.length === 0 && isLeave) {

        // 1. TAMAMEN BOŞALMA KORUMASI (Örn: 2v0 veya 1v0 kaldıysa)
        if (teams.red === 0 || teams.blue === 0) {
            // Sadece sahada (Red veya Blue) olan oyuncuları filtrele
            const activePlayers = roomPlayers.filter(p => p && p.team && (p.team.id === 1 || p.team.id === 2));

            // Eğer sahada en az 2 oyuncu varsa dengeleme yap
            if (activePlayers.length >= 2) {
                // ID'si en yüksek oyuncuyu bul (Math.max ile)
                const highestIdPlayer = activePlayers.reduce((max, p) => p.id > max.id ? p : max, activePlayers[0]);

                // Boş olan takımın ID'sini belirle (Kırmızı boşsa 1, Mavi boşsa 2)
                const emptyTeamId = teams.red === 0 ? 1 : 2;

                // Oyuncuyu boş takıma transfer et
                moves.push({ playerId: highestIdPlayer.id, teamId: emptyTeamId });

                announcement = `${highestIdPlayer.name}, karşı boşaldığı için karşı takıma aktarıldı.`;
                shouldStopGame = false; // Oyun devam etsin
            } else {
                // Sahada sadece 1 kişi kaldıysa (1v0) oyunu durdur ve seyirciye al
                shouldStopGame = true;
            }
        }
        // 2. KESİNTİSİZ TRANSFER MOTORU (Sadece fark 1'den büyükse çalışır: Örn 3v1 -> 2v2)
        // Maç 3v2 veya 2v1 kaldıysa fark 1 olacağı için burayı pas geçer, oyun donmaz!
        else if (Math.abs(teams.red - teams.blue) > 1) {
            let crowdedTeamID = (teams.red > teams.blue) ? 1 : 2;
            let emptyTeamID = (crowdedTeamID === 1) ? 2 : 1;

            let crowdedTeamPlayers = [];

            roomPlayers.forEach(p => {
                if (p && p.team && p.team.id === crowdedTeamID) {
                    crowdedTeamPlayers.push(p);
                }
            });

            if (crowdedTeamPlayers.length > 0) {
                // Kalabalık takımdaki son giren oyuncuyu bul
                crowdedTeamPlayers.sort((a, b) => b.id - a.id);
                let playerToTransfer = crowdedTeamPlayers[0];

                // Oyunu durdurmadan direkt boş kalan karşı takıma transfer et!

                moves.push({ playerId: playerToTransfer.id, teamId: emptyTeamID })
                announcement = `${playerToTransfer.name}, takımları eşitlemek için karşı takıma transfer edildi.`;
            }
        }



    }

    return { moves, updatedQueue, announcement, shouldStopGame }

}

// Kısa/belirsiz kelimeler: sadece TAM kelime olarak eşleşir (ek almış halleri de yaz)
const EXACT_WORDS = new Set([
    "sik", "siktir", "sikerim", "sikeyim", "sikik", "oe", "oc", "pic", "pij", "got", "goto",
    "gotu", "pipi", "kuku", "bok", "mal", "it", "itoglu", "salak", "slak", "slaak",
    "orsp", "ursp", "aptal", "sokuk", "ucube", "pclik", "aptaloc", "pasatoc", "aptaloe", "pasatoe", "susoc", "malmk", "malamk", "yazmaanneiskeirmn", "kafasiz", "kafasız",
    "benannenisikim", "siktiler", "salaksinb", "anasi", "osovbucoco", "bacina", "it", "enigi", "bacini", "deseyim", "valideni", "anmnnnenui", "bogharim",
    "anana"

]);

// Uzun ve belirsizliği düşük kökler: kelime BU İLE BAŞLIYORSA yakalar (ekleri de kapsar)
const PREFIX_WORDS = [
    "orospu", "oruspu", "yarrak", "kahpe", "gavat", "pezevenk", "gerizekali",
    "serefsiz", "aptalevladi", "amkkurdu", "amkturku", "amini",
    "anani", "anneni", "babani", "bacini", "allahini", "alahini", "allani",
    "tanrini", "dinini", "kitabini", "ataturkunu", "peygamberini", "muhammedini", "anana", "oe", "oc", "orsp", "enigi", "oananiskerim", "aptaluincocugus",
    "skrm", "skerm", "sikerm", "annanabasarim", "annnei", "bnecericem"
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




function scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score) {

    let announcement = [];
    let { scoreRed, scoreBlue } = score;


    // kırmızı takım için ikilik 
    if (team == 1 && lasttouchedPlayer && lasttouchedPlayer.team.M == 1 && touchedballX > 0) {

        scoreRed = scoreRed + 2;

        if (yspeed > 0) {
            // Top yukarıdan aşağıya inerek potaya girdi (Şut / İki Sayı)

            if (touchedballY <= -71) {

                announcement.push(
                    {
                        message: `${lasttouchedPlayer.name} bitirici dokunuş. İki sayı! 🏀`,
                        target: null,
                        color: 0xFF6600,
                        messageType: "small-bold",
                        messageSound: 1
                    }
                )

            } else {
                announcement.push(
                    {
                        message: `${lasttouchedPlayer.name} şık bir şutla İKİ SAYI atıyor! 🏀`,
                        target: null,
                        color: 0xFF6600,
                        messageType: "small-bold",
                        messageSound: 1
                    }
                )
            }
        } else if (yspeed < 0) {
            // Top aşağıdan yukarıya çıkarak potaya girdi (Turnike)
            announcement.push(
                {
                    message: `${lasttouchedPlayer.name} pota altından turnike!💨`,
                    target: null,
                    color: 0x00E5FF,
                    messageType: "small-bold",
                    messageSound: 1
                }
            )
        } else {
            // yspeed tam 0 ise (dümdüz gitmişse)
            announcement.push(
                {
                    message: `${lasttouchedPlayer.name} potayı sarsıyor!`,
                    target: null,
                    color: 0xFFFF00,
                    messageType: "small-bold",
                    messageSound: 1
                }
            )
        }



        announcement.push(
            {
                message: `Skor : ${scoreRed} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }
        )

        return { announcement, scoreRed, scoreBlue }
    }

    // kırmızı takım için üçlük
    if (team == 1 && lasttouchedPlayer && lasttouchedPlayer.team.M == 1 && touchedballX < 0) {


        scoreRed = scoreRed + 3;

        announcement.push(
            {
                message: `${lasttouchedPlayer.name} ÜÇLÜK!!`,
                target: null,
                color: 0xFFD700,
                messageType: "small-bold",
                messageSound: 2
            }
        )

        announcement.push(
            {
                message: `Skor : ${scoreRed} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }
        )

        return { announcement, scoreRed, scoreBlue }


    }

    // mavi takım için ikilik 

    if (team == 2 && lasttouchedPlayer && lasttouchedPlayer.team.M == 2 && touchedballX < 0) {

        scoreBlue = scoreBlue + 2;

        if (yspeed > 0) {
            // Top yukarıdan aşağıya inerek potaya girdi (Şut / İki Sayı)
            if (touchedballY <= -71) {
                announcement.push(
                    {
                        message: `${lasttouchedPlayer.name} bitirici dokunuş. İki sayı! 🏀`,
                        target: null,
                        color: 0xFF6600,
                        messageType: "small-bold",
                        messageSound: 1
                    }
                )

            } else {
                announcement.push(
                    {
                        message: `${lasttouchedPlayer.name} şık bir şutla İKİ SAYI atıyor! 🏀`,
                        target: null,
                        color: 0xFF6600,
                        messageType: "small-bold",
                        messageSound: 1
                    }
                )
            }
        } else if (yspeed < 0) {
            // Top aşağıdan yukarıya çıkarak potaya girdi (Turnike)
            announcement.push(
                {
                    message: `${lasttouchedPlayer.name} pota altından turnike! 💨`,
                    target: null,
                    color: 0x00E5FF,
                    messageType: "small-bold",
                    messageSound: 1
                }
            )
        } else {
            // yspeed tam 0 ise (dümdüz gitmişse)
            announcement.push(
                {
                    message: `${lasttouchedPlayer.name} potayı sarsıyor!`,
                    target: null,
                    color: 0xFFFF00,
                    messageType: "small-bold",
                    messageSound: 1
                }
            )
        }

        announcement.push(
            {
                message: `Skor : ${scoreRed} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }
        )

        return { announcement, scoreRed, scoreBlue }
    }


    // mavi takım için üçlük
    if (team == 2 && lasttouchedPlayer && lasttouchedPlayer.team.M == 2 && touchedballX > 0) {

        scoreBlue = scoreBlue + 3;

        announcement.push(
            {
                message: `${lasttouchedPlayer.name} ÜÇLÜK!!`,
                target: null,
                color: 0xFFD700,
                messageType: "small-bold",
                messageSound: 2
            }
        )


        announcement.push(
            {
                message: `Skor : ${scoreRed} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }
        )

        return { announcement, scoreRed, scoreBlue }
    }


    //**************************** */ HATALI SKORLAR ****************************************************

    // kırmızı takım için üçlük
    if (team == 1 && lasttouchedPlayer && lasttouchedPlayer.team.M != 1 && touchedballX < 0) {


        scoreRed = scoreRed + 3;

        announcement.push(
            {
                message: `${lasttouchedPlayer.name} HATALI DOKUNUŞ!! ❌❌❌`,
                target: null,
                color: 0xFF007F,
                messageType: "normal",
                messageSound: 2
            }
        )

        announcement.push(
            {
                message: `KENDİ POTASINA ÜÇLÜK!!`,
                target: null,
                color: 0xE60000,
                messageType: "small-bold",
                messageSound: 2
            }
        )

        announcement.push(
            {
                message: `Skor : ${scoreRed} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }
        )

        return { announcement, scoreRed, scoreBlue }


    }
    // kırmızı takım için ikilik 
    if (team == 1 && lasttouchedPlayer && lasttouchedPlayer.team.M != 1 && touchedballX > 0) {



        scoreRed = scoreRed + 2;
        if (yspeed > 0) {
            // Top yukarıdan aşağıya inerek potaya girdi (Şut / İki Sayı)

            if (touchedballY <= -71) {

                announcement.push(
                    {
                        message: `${lasttouchedPlayer.name} HATALI DOKUNUŞ!! ❌❌❌`,
                        target: null,
                        color: 0xFF007F,
                        messageType: "normal",
                        messageSound: 2
                    }
                )

                announcement.push(
                    {
                        message: `KENDI POTASINA İKİ SAYI!!`,
                        target: null,
                        color: 0xFF6600,
                        messageType: "small-bold",
                        messageSound: 2
                    }
                )



            } else {

                announcement.push(
                    {
                        message: `${lasttouchedPlayer.name} HATALI ŞUT!! ❌❌❌`,
                        target: null,
                        color: 0xFF007F,
                        messageType: "normal",
                        messageSound: 2
                    }
                )
                announcement.push(
                    {
                        message: `KENDI POTASINA İKİ SAYI!!`,
                        target: null,
                        color: 0xFF6600,
                        messageType: "small-bold",
                        messageSound: 2
                    }
                )
            }
        } else if (yspeed < 0) {
            // Top aşağıdan yukarıya çıkarak potaya girdi (Turnike)

            announcement.push(
                {
                    message: `${lasttouchedPlayer.name} HATALI TURNIKE!! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "normal",
                    messageSound: 2
                }
            )
            announcement.push(
                {
                    message: `KENDI POTASINA İKİ SAYI!!`,
                    target: null,
                    color: 0xFF6600,
                    messageType: "small-bold",
                    messageSound: 2
                }
            )
        } else {
            // yspeed tam 0 ise (dümdüz gitmişse)
            announcement.push(
                {
                    message: `${lasttouchedPlayer.name} potayı sarsıyor! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "small-bold",
                    messageSound: 1
                }
            )

            announcement.push(
                {
                    message: `KENDI POTASINA İKİ SAYI!!`,
                    target: null,
                    color: 0xFF6600,
                    messageType: "small-bold",
                    messageSound: 2
                }
            )
        }


        announcement.push(
            {
                message: `Skor : ${scoreRed} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }
        )

        return { announcement, scoreRed, scoreBlue }
    }

    // mavi takım için üçlük
    if (team == 2 && lasttouchedPlayer && lasttouchedPlayer.team.M != 2 && touchedballX > 0) {


        scoreBlue = scoreBlue + 3;

        announcement.push(
            {
                message: `${lasttouchedPlayer.name} HATALI DOKUNUŞ!! ❌❌❌`,
                target: null,
                color: 0xFF007F,
                messageType: "normal",
                messageSound: 2
            }
        )

        announcement.push(
            {
                message: `KENDİ POTASINA ÜÇLÜK!!`,
                target: null,
                color: 0xE60000,
                messageType: "small-bold",
                messageSound: 2
            }
        )

        announcement.push(
            {
                message: `Skor : ${scoreRed} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }
        )

        return { announcement, scoreRed, scoreBlue }
    }

    // mavi takım için ikilik 

    if (team == 2 && lasttouchedPlayer && lasttouchedPlayer.team.M != 2 && touchedballX < 0) {


        scoreBlue = scoreBlue + 2;

        if (yspeed > 0) {
            // Top yukarıdan aşağıya inerek potaya girdi (Şut / İki Sayı)

            if (touchedballY <= -71) {

                announcement.push(
                    {
                        message: `${lasttouchedPlayer.name} HATALI DOKUNUŞ!! ❌❌❌`,
                        target: null,
                        color: 0xFF007F,
                        messageType: "normal",
                        messageSound: 2
                    }
                )

                announcement.push(
                    {
                        message: `KENDI POTASINA İKİ SAYI!!`,
                        target: null,
                        color: 0xFF6600,
                        messageType: "small-bold",
                        messageSound: 2
                    }
                )



            } else {

                announcement.push(
                    {
                        message: `${lasttouchedPlayer.name} HATALI ŞUT!! ❌❌❌`,
                        target: null,
                        color: 0xFF007F,
                        messageType: "normal",
                        messageSound: 2
                    }
                )
                announcement.push(
                    {
                        message: `KENDI POTASINA İKİ SAYI!!`,
                        target: null,
                        color: 0xFF6600,
                        messageType: "small-bold",
                        messageSound: 2
                    }
                )
            }
        } else if (yspeed < 0) {
            // Top aşağıdan yukarıya çıkarak potaya girdi (Turnike)

            announcement.push(
                {
                    message: `${lasttouchedPlayer.name} HATALI TURNIKE!! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "normal",
                    messageSound: 2
                }
            )
            announcement.push(
                {
                    message: `KENDI POTASINA İKİ SAYI!!`,
                    target: null,
                    color: 0xFF6600,
                    messageType: "small-bold",
                    messageSound: 2
                }
            )
        } else {
            // yspeed tam 0 ise (dümdüz gitmişse)
            announcement.push(
                {
                    message: `${lasttouchedPlayer.name} potayı sarsıyor! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "small-bold",
                    messageSound: 1
                }
            )

            announcement.push(
                {
                    message: `KENDI POTASINA İKİ SAYI!!`,
                    target: null,
                    color: 0xFF6600,
                    messageType: "small-bold",
                    messageSound: 2
                }
            )
        }


        announcement.push(
            {
                message: `Skor : ${scoreRed} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }
        )

        return { announcement, scoreRed, scoreBlue }
    }



    return { announcement, scoreRed, scoreBlue }
}


// --- AFK KONTROLÜ (room.onOpen içindeki diğer değişkenlerin yanına) ---





const AFK_TIME_LIMIT = 20000;       // 20 saniye hareketsizlik = kick
const WARN_TIME_LIMIT = 15000;      // 15 saniye hareketsizlik = uyarı
const AFK_CHECK_INTERVAL = 1000;    // en fazla saniyede bir kontrol et

function checkAfkPlayers(roomPlayersData, afkTracker, lastCheckRef) {

    const now = Date.now();
    const kicks = [];

    // Gerçek zaman farkına bak: 1 saniye dolmadıysa hiç işlem yapma
    if (now - lastCheckRef.value < AFK_CHECK_INTERVAL) {
        return kicks;
    }
    lastCheckRef.value = now;

    const currentIds = new Set();

    roomPlayersData.forEach(p => {
        currentIds.add(p.id);

        // Spectator ise takip etme, kaydı varsa temizle
        if (p.teamId === 0) {
            afkTracker.delete(p.id);
            return;
        }

        const tracked = afkTracker.get(p.id);

        if (!tracked) {
            afkTracker.set(p.id, {
                x: p.x,
                y: p.y,
                lastInputAt: now,
                lastWarningSecond: null
            });
            return;
        }


        const afkTime = now - tracked.lastInputAt;


        // 15 saniye input yoksa bir kere uyar


        if (afkTime >= WARN_TIME_LIMIT) {

            const remainingSeconds = Math.ceil(
                (AFK_TIME_LIMIT - afkTime) / 1000
            );

            // Sadece saniye değiştiğinde mesaj gönder
            if (tracked.lastWarningSecond !== remainingSeconds) {
                kicks.push({
                    playerId: p.id,
                    reason: "",
                    warning: `Hareket etmezsen ${remainingSeconds} saniye içinde kickleneceksin!`,
                    kick: false
                });

                tracked.lastWarningSecond = remainingSeconds;
            }

        }

        // 20 saniye afk kalmış süreyi kontrol et
        if (afkTime >= AFK_TIME_LIMIT) {
            kicks.push({
                playerId: p.id,
                reason: "20 saniye hareketsiz kaldığınız için atıldınız (AFK)",
                warning: "",
                kick: true
            });
            afkTracker.delete(p.id);
        }
    });

    // Artık odada olmayan ama tracker'da kalmış kayıtları temizle (güvenlik önlemi)
    for (const trackedId of afkTracker.keys()) {
        if (!currentIds.has(trackedId)) {
            afkTracker.delete(trackedId);
        }
    }

    return kicks;
}


function resetStates() {
    touchedballX = null;
    touchedballY = null;
    shootedballX = null;
    shootedballY = null;
    lasttouchedPlayer = null;
    lastShooter = null;
    potaTemasFlagi = false;
    yspeed = null;

}


module.exports = { balanceTeams, getLiveTeams, hasBannedWord, controlSpam, scoreCheck, checkAfkPlayers, resetStates }