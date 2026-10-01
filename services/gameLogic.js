
const { STAT_POINTS, formatTag, getRank } = require('./eloLogic');

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

                announcement = `${highestIdPlayer.name}, karşı takım boşaldığı için karşı takıma aktarıldı.`;
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



       

        return { announcement, scoreRed, scoreBlue, stat: "two_pt_made" }
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


        
        return { announcement, scoreRed, scoreBlue, stat: "three_pt_made" }


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


        

         return { announcement, scoreRed, scoreBlue, stat: "two_pt_made" }
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

       

        return { announcement, scoreRed, scoreBlue, stat: "three_pt_made" }
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

        

        return { announcement, scoreRed, scoreBlue, stat: "three_pt_own_basket" }


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
    
        return { announcement, scoreRed, scoreBlue, stat: "two_pt_own_basket" }
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

        

        return { announcement, scoreRed, scoreBlue, stat: "three_pt_own_basket" }
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


        

        return { announcement, scoreRed, scoreBlue, stat: "two_pt_own_basket" }
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


/** Bu maça katkı puanını ekler. matchPoints: Map(playerId -> puan) */
function addMatchPoints(matchPoints, playerId, stat) {
    const points = STAT_POINTS[stat];
    if (!points) return;
    matchPoints.set(playerId, (matchPoints.get(playerId) || 0) + points);
}

/** Oyuncu id'lerini recordMatch'in beklediği kayıtlara çevirir (oturumu olmayan atlanır). */
function buildMatchEntries(playerIds, sessions, matchPoints) {
    return playerIds
        .map((playerId) => {
            const user = sessions.get(playerId);
            return user ? { userId: user.id, playerId, points: matchPoints.get(playerId) || 0 } : null;
        })
        .filter(Boolean);
}


function createParticipationTracker({ windowMs = 60000, now = Date.now } = {}) {
    const eligible = new Set();
    let active = false;
    let startedAt = 0;

    const inWindow = () => active && now() - startedAt <= windowMs;

    return {
        // Maç başlarken takımlarda olan oyuncular
        start(playerIdsOnTeams) {
            eligible.clear();
            active = true;
            startedAt = now();
            playerIdsOnTeams.forEach((id) => eligible.add(id));
        },
        // onPlayerTeamChange: ilk dakika içinde takıma girenler de dahil olur
        teamChanged(playerId, teamId) {
            if ((teamId === 1 || teamId === 2) && inWindow()) eligible.add(playerId);
        },
        stop() { active = false; },
        isEligible(playerId) { return eligible.has(playerId); },
        filter(playerIds) { return playerIds.filter((id) => eligible.has(id)); },
    };
}



module.exports = { balanceTeams, getLiveTeams, scoreCheck, checkAfkPlayers, resetStates,addMatchPoints, buildMatchEntries,createParticipationTracker }