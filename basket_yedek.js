// ═══════════ 1) DIŞARIDA KALANLAR: require'lar ve yardımcılar ═══════════

require('dotenv').config();
const path = require("path");
const { log } = require('console');
const fs = require("fs");


const { OperationType, VariableType, ConnectionState, AllowFlags, Direction, CollisionFlags, CameraFollow, BackgroundType, GamePlayState, BanEntryType, Callback, Utils, Room, Replay, Query, Library, RoomConfig, Plugin, Renderer, Errors, Language, EventFactory, Impl } = require("node-haxball")();
const { migrate } = require('./db/migrate');

const { balanceTeams, getLiveTeams, scoreCheck, checkAfkPlayers, resetStates, addMatchPoints, buildMatchEntries } = require('./services/gameLogic');
const { buildEloAnnouncements, buildChatAnnouncement, hasBannedWord, controlSpam } = require('./services/chatLogic')
const userService = require('./services/userService');


const sessions = new Map();

function readTokens(file) {
    return fs.readFileSync(file, "utf8")
        .split("\n")
        .map(t => t.trim())
        .filter(Boolean);
}

// ═══════════ 2) main() BURADA BAŞLIYOR ═══════════
async function main() {

    await migrate();
    console.log("DB hazır");

    // ── token işleri (mevcut kodun, hiç değişmeden) ──
    const DATA_DIR = process.env.DATA_DIR || "data";
    const TOKENS_FILE = path.join(DATA_DIR, "tokens.txt");
    const USED_TOKENS_FILE = path.join(DATA_DIR, "used_tokens.txt");

    let tokens = readTokens(TOKENS_FILE);
    let usedTokens = fs.existsSync(USED_TOKENS_FILE) ? readTokens(USED_TOKENS_FILE) : [];
    let dynamicToken = tokens.find(t => !usedTokens.includes(t));

    if (!dynamicToken) {
        console.error("TOKEN KALMADI!");
        process.exit(0);
    }

    let tokenForRoom = dynamicToken.replace(/^"+|"+$/g, "");
    usedTokens.push(dynamicToken);
    fs.writeFileSync(USED_TOKENS_FILE, usedTokens.join("\n") + "\n");
    console.log("Alınan token:", tokenForRoom);

    // ── harita (mevcut kodun) ──
    const BASKET = fs.readFileSync("maps/basket.hbs", "utf8");
    let Basket;
    try {
        Basket = Utils.parseStadium(BASKET);
        console.log("Stadium objesi hazır!");
    } catch (err) {
        console.error("Stadium parse hatası:", err);
    }

    Room.create({
        name: "🗑️ BASKET 3V3 🗑️",
        showInRoomList: true,
        noPlayer: true,
        maxPlayerCount: 9,
        token: tokenForRoom,
        stadium: Basket,
        geo: { code: "TR", lat: 39.9198, lon: 32.8543 },
    }, {
        storage: {
            player_name: "wxyz-abcd",
            avatar: "👽"
        },
        onOpen: (room) => {
            console.log("Room opened!");
            console.log("Alınan Token:", dynamicToken);


            room.fakeSetTeamsLock(true);

            try {
                room.setCurrentStadium(Basket); // Burada stadium kesin yüklenecek
                console.log("Basket map başarıyla yüklendi!");
            } catch (err) {
                console.error("Stadium yükleme hatası:", err);
            }
            const stadium = room.stadium;

            room.sendAnnouncement("Hello " + room.name);
            room.onAfterRoomLink = (roomLink) => {
                console.log("room link:", roomLink);
            };




            room.setScoreLimit(0);
            room.setTimeLimit(0);



            const mutedPlayerIds = [];
            const commandCooldown = new Map();


            // ---------- KOMUT PARSING: onBeforeOperationReceived ----------
            room.onBeforeOperationReceived = (type, msg, globalFrameNo, clientFrameNo) => {


                const CHAT_TYPE = 4;
                if (type === CHAT_TYPE) {

                    const playerId = msg.byId;
                    const text = (msg && msg.text) ? String(msg.text) : "";



                    const [cmd, ...args] = text.trim().split(/\s+/);

                    if (cmd === "!kayit" || cmd === "!giris") {
                        const p = room.getPlayer(playerId);
                        if (!p) return false;

                        // Şifre denemelerini yavaşlat
                        const now = Date.now();
                        if (now - (commandCooldown.get(playerId) || 0) < 3000) {
                            room.sendAnnouncement("⏳ Biraz bekle.", playerId, 0xFF0000);
                            return false;
                        }
                        commandCooldown.set(playerId, now);

                        (async () => {
                            try {
                                let res;
                                if (cmd === "!kayit") {
                                    const password = args[0];

                                    res = !password
                                        ? {
                                            ok: false,
                                            error: "Kullanım: !kayit şifre"
                                        }
                                        : await userService.register(
                                            p.auth,
                                            password
                                        );

                                } else {
                                    const password = args[0];

                                    res = !password
                                        ? {
                                            ok: false,
                                            error: "Kullanım: !giris şifre"
                                        }
                                        : await userService.login(
                                            p.auth,
                                            password
                                        );
                                }

                                if (res.ok) sessions.set(playerId, res.user);
                                if (room.getPlayer(playerId)) {
                                    room.sendAnnouncement(
                                        res.ok ? `✅ Başarılı!` : `❌ ${res.error}`,
                                        playerId, res.ok ? 0x00FF00 : 0xFF0000
                                    );
                                }
                            } catch (err) {
                                console.error("Komut hatası:", err);
                            }
                        })();

                        return false;   // mesaj sohbette görünmesin, şifre gizli kalsın

                    }

                    // Mute kontrolü
                    if (mutedPlayerIds.includes(playerId)) {
                        return false;
                    }

                    // 🛑 GELİŞMİŞ CÜMLE İÇİ KÜFÜR KONTROLÜ
                    if (hasBannedWord(text)) {
                        room.sendAnnouncement("❌ Mesajınız küfür veya hakaret içerdiği için engellendi!", playerId, 0xFF0000);
                        return false; // Küfürlü mesajı engelle
                    }

                    const { announcement, messageSendStatus } = controlSpam(playerId)

                    if (!messageSendStatus) {

                        room.sendAnnouncement(announcement, playerId, 0xFF0000);
                        return messageSendStatus
                    }
                    // Küfür ve Spam testlerini geçen normal chat mesajlarının 
                    // oyunda sorunsuz görünmesi için true dönüyoruz.
                    if (text.startsWith("!")) return true;

                    const p = room.getPlayer(playerId);
                    if (!p) return false;

                    const a = buildChatAnnouncement({
                        name: p.name,
                        teamId: p.team ? p.team.id : 0,
                        user: sessions.get(playerId),
                        text,
                    });
                    room.sendAnnouncement(a.message, null, a.color, "normal", 1);
                    return false;
                }

                return true;
            };


            let queue = [];
            let isGameRunning = false;
            let training = false;

            /* ----------------------- Destek fonksiyonları-------------------------------------------------------------*/
            function getPlayerList() {

                return room.players
                    .map(p => room.getPlayer(p.id))
                    .filter(Boolean)

            }

            function handleBalance() {

                const roomPlayers = getPlayerList();
                const { moves, updatedQueue } = balanceTeams(queue, roomPlayers, 3);

                moves.forEach(
                    m => {
                        room.setPlayerTeam(m.playerId, m.teamId)
                    }
                )

                queue = updatedQueue;

            }

            const matchPoints = new Map();   // playerId -> bu maçtaki net skor katkısı

            function addStatsFor(playerId, stats) {
                const user = sessions.get(playerId);
                if (!user) return;
                userService.addStats(user.id, stats)
                    .catch((err) => console.error("addStats hatası:", err));
            }

            function finishMatch(winnerIds, loserIds) {
                const winners = buildMatchEntries(winnerIds, sessions, matchPoints);
                const losers = buildMatchEntries(loserIds, sessions, matchPoints);
                matchPoints.clear();

                userService.recordMatch({ winners, losers })
                    .then((results) => {
                        if (!results) return;
                        const inRoom = results.filter((r) => room.getPlayer(r.playerId));
                        inRoom.forEach((r) => sessions.set(r.playerId, r.user));
                        buildEloAnnouncements(inRoom).forEach((a) =>
                            room.sendAnnouncement(a.message, a.playerId, a.color)
                        );
                    })
                    .catch((err) => console.error("recordMatch hatası:", err));
            }




            /*---------------------------------------------------------------------------------------------------------*/


            room.onPlayerInputChange = (id, value, customData) => {
                const tracked = afkTracker.get(id);

                if (!tracked) {
                    return;
                }

                tracked.lastInputAt = Date.now();
                tracked.warned = false;
            };

            room.onPlayerJoin = (player) => {

                log("oyuna katıldı: " + player.name)

                if (player.auth) {
                    userService.findOrCreateByAuth(player.auth)
                        .then(user => {
                            sessions.set(player.id, user);
                            if (!room.getPlayer(player.id)) return;   // bu arada çıkmış olabilir
                            room.sendAnnouncement(
                                user.registered
                                    ? `✅ Otomatik giriş yapıldı.`
                                    : "Hesabını kalıcı yapmak için !kayit şifre yaz veya hesabın varsa !giris şifre",
                                player.id,
                                user.registered ? 0x00FF00 : 0x999999
                            );
                        })
                        .catch(err => console.error("findOrCreateByAuth hatası:", err));
                } else {
                    console.warn("auth boş geldi:", player.name);
                }




                setTimeout(() => {
                    room.sendAnnouncement(`${player.name} Hoşgeldin`, player.id);
                    queue.push(player.id);

                    if (isGameRunning && queue.find(p => p === player.id)) {

                        room.sendAnnouncement("Oyun oynanıyor sıranın gelmesini bekle...", player.id, 0x999999)
                    }



                    handleBalance();

                    if (room.players.length === 1 && !isGameRunning) {

                        room.sendAnnouncement("Oyunun başlaması için en az iki oyuncu gerek", null, 0x999999);
                        room.sendAnnouncement("Antrenman başlıyor...", null, 0x999999)
                        training = true;
                        room.stopGame();

                        setTimeout(() => {
                            room.startGame();
                        }, 3500);
                    }
                    if (room.players.length > 1 && !isGameRunning) {

                        room.stopGame();
                        setTimeout(() => {
                            room.startGame();
                        }, 3500);

                    }
                }, 20);
            }

            room.onPlayerLeave = (player) => {



                log("oyundan ayrıldı: " + player.name)

                commandCooldown.delete(player.id);
                sessions.delete(player.id);


                queue = queue.filter(p => p !== player.id);
                afkTracker.delete(player.id);

                roomPlayers = getPlayerList();

                const result = balanceTeams(queue, roomPlayers, 3, true)

                if (result && Array.isArray(result.moves)) {
                    result.moves.forEach(move => {
                        room.setPlayerTeam(move.playerId, move.teamId);
                    });
                }
                if (result && typeof result.announcement === "string" && result.announcement.trim() !== "") {
                    room.sendAnnouncement(result.announcement, null, 0x00FF00);
                }


                if (result.shouldStopGame) {
                    room.stopGame();
                }

                if (room.players.length === 0) room.stopGame();


                if (room.players.length === 1) {

                    training = true;
                    room.stopGame();

                    setTimeout(() => {
                        room.startGame();
                    }, 3500);


                }


            }


            var touchedballX = 0;
            var touchedballY = 0;
            var shootedballX = 0;
            var shootedballY = 0;

            var lastShooter = null;


            let gameTimeout = 0;
            let warnTimeoutLastTen = 0;
            let warnTimeoutOne = 0;

            let lasttouchedPlayer = 0;
            let interactingPlayerId = null;
            let lastscoringTeam = null;

            var scoreRed = 0;
            var scoreBlue = 0;
            var drawEND = false;
            var gameTime = 120000;
            var warnTimeOne = 60000;
            var warnTimeLastTenSec = 110000;

            room.onGameStart = function (playerId) {


                resetStates();
                matchPoints.clear();

                if (!training) isGameRunning = true;



                setTimeout(() => {
                    handleBalance();
                }, 100);


                if (gameTimeout) clearTimeout(gameTimeout);
                if (warnTimeoutOne) clearTimeout(warnTimeoutOne);
                if (warnTimeoutLastTen) clearTimeout(warnTimeoutLastTen);



                warnTimeoutOne = setTimeout(() => {

                    room.sendAnnouncement("SON 1 dk...", null, 0XFF007F);


                }, warnTimeOne);


                warnTimeoutLastTen = setTimeout(() => {

                    room.sendAnnouncement("SON 10 sn...", null, "bold", 0XFF007F);


                }, warnTimeLastTenSec);

                if (!training) room.sendAnnouncement("🗑️ OYUN BAŞLADI. SÜRE 2 DK 🗑️", null, 0xFFD700)
                gameTimeout = setTimeout(() => {

                    if (scoreBlue != scoreRed) {


                        room.stopGame();
                    } else {

                        drawEND = true;
                        room.sendAnnouncement(`NORMAL SÜRE BERABERE BİTTİ. skor: ${scoreRed} vs ${scoreBlue}`, null, 0X808080);
                        room.sendAnnouncement("ATAN KAZANIR!", null, 0XFFD700);
                    }

                }, gameTime);

            }

            room.onGameStop = function (winningTeamId) {

                isGameRunning = false;
                let losers = [];
                let winners = [];
                potaTemasFlagi = false;


                if (room.players.length === 1) {

                    room.sendAnnouncement("Antrenman başlıyor...", null, 0x999999);
                    training = true;


                    setTimeout(() => {
                        room.startGame();
                    }, 3500);

                }
                // Kazanan kaybeden takımları belirle

                room.players.forEach(rawPlayer => {

                    const p = room.getPlayer(rawPlayer.id);
                    if (p && p.team) {

                        if (scoreRed > scoreBlue && p.team.id === 2) {

                            losers.push(p.id) // MAVİ KAYBETTİ
                        } else if (scoreBlue > scoreRed && p.team.id === 1) {

                            losers.push(p.id); // KIRMIZI KAYBETTİ
                        }

                    }

                });


                room.players.forEach(rawPlayer => {

                    const p = room.getPlayer(rawPlayer.id);
                    if (p && p.team) {

                        if (scoreRed > scoreBlue && p.team.id === 1) {

                            winners.push(p.id) // KIRMIZI KAZANDI

                        } else if (scoreBlue > scoreRed && p.team.id === 2) {

                            winners.push(p.id); // MAVİ KAZANDI
                        }

                    }

                })

                if (!training && scoreRed !== scoreBlue) {
                    finishMatch(winners, losers);
                }

                if (room.players.length > 6) {
                    winners.forEach(pId => {
                        room.setPlayerTeam(pId, 1); // kazananlar kırmızı takımda
                    })

                    losers.forEach(pId => {
                        room.setPlayerTeam(pId, 0); // kaybedenler handleBalance öncesi specte
                        queue.push(pId);
                    })

                } else {

                    const ids = room.players.map(p => p.id);

                    // Fisher-Yates karıştırma
                    for (let i = ids.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [ids[i], ids[j]] = [ids[j], ids[i]];
                    }

                    // Tek sayıda oyuncuda fazla kalan oyuncu hep aynı takıma gitmesin diye başlangıç takımı da rastgele
                    const firstTeam = Math.random() < 0.5 ? 1 : 2;

                    ids.forEach((id, i) => {
                        const team = (i % 2 === 0) ? firstTeam : (firstTeam === 1 ? 2 : 1);
                        room.setPlayerTeam(id, team);
                    });


                }

                var result = "";
                var color = 0xFFFF00;

                if (scoreBlue > scoreRed) {
                    result = "MAVI TAKIM KAZANDI";
                    color = 0x3399FF;
                }
                if (scoreBlue < scoreRed) {
                    result = "KIRMIZI TAKIM KAZANDI";
                    color = 0xFF0000;
                }

                if (!training) room.sendAnnouncement(`${result}  SKOR : ${scoreRed} vs ${scoreBlue}`, null, color);

                // reset
                drawEND = false;
                scoreBlue = 0;
                scoreRed = 0;
                if (gameTimeout) clearTimeout(gameTimeout);
                if (warnTimeoutOne) clearTimeout(warnTimeoutOne);
                if (warnTimeoutLastTen) clearTimeout(warnTimeoutLastTen);

                setTimeout(() => {

                    // Takımları dengeleyen fonksiyonu çağırıyoruz
                    handleBalance();

                    if (room.players.length >= 2) {
                        room.sendAnnouncement("YENİ OYUN BAŞLIYOR...", null, 0x00E5FF);
                        training = false;

                        // Dengeleme yapıldıktan 3 saniye sonra oyunu başlat
                        setTimeout(() => {

                            room.startGame();

                        }, 3000);

                    }

                }, 100); // 100 milisaniyelik güvenli bekleme süresi

            }

            room.onPlayerBallKick = function (playerId) {
                var player = room.getPlayer(playerId);

                const ball = room.getDisc(0);
                if (!ball) return;



                // topun x kordinatı
                shootedballX = ball.h.x;
                shootedballY = ball.h.y;

                // son vuran oyuncu
                lastShooter = player;

                log("lastShooter: " + lastShooter);
                log("Şut Çekildi - X: " + shootedballX + " | Oyuncu: " + player.name);

            };


            const TUM_POTA_SEGMENT_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 16])
            let TOP_DISC_ID = 0;
            let potaTemasFlagi = false;
            let oyuncuPlayerId = null;

            // 1. TOPUN POTA SEGMENTLERİNDEN BİRİNE ÇARPMASI
            room.onCollisionDiscVsSegment = function (discId, discPlayerId, segmentId) {
                // Çarpan nesne top ise (discId === 0)
                if (discId === TOP_DISC_ID) {
                    // Eğer çarptığı segment bizim pota listemizde varsa
                    if (TUM_POTA_SEGMENT_IDS.has(segmentId)) {
                        if (!potaTemasFlagi) {
                            potaTemasFlagi = true;
                        }
                    }
                }
            };

            room.onCollisionDiscVsDisc = (discId1, discPlayerId1, discId2, discPlayerId2) => {

                let interactingPlayerId = null;

                // 1. Durum: İlk disk top (0) ve ikinci disk bir oyuncuya ait (discPlayerId2 boş değil)
                if (discId1 === 0 && discPlayerId2 !== null && discPlayerId2 !== undefined) {
                    interactingPlayerId = discPlayerId2;
                }
                // 2. Durum: İkinci disk top (0) ve ilk disk bir oyuncuya ait (discPlayerId1 boş değil)
                else if (discId2 === 0 && discPlayerId1 !== null && discPlayerId1 !== undefined) {
                    interactingPlayerId = discPlayerId1;
                }


                if (interactingPlayerId === null) return;

                lasttouchedPlayer = room.getPlayer(interactingPlayerId);

                const ball = room.getDisc(0);
                if (!ball) return;



                // topun x kordinatı
                touchedballX = ball.h.x;
                touchedballY = ball.h.y;




                // Top bir oyuncuya çarptıysa ve öncesinde pota bayrağı kalktıysa
                // Rebound kontrolü: SADECE bu çarpışma gerçek bir top-oyuncu teması ise
                if (potaTemasFlagi) {
                    room.sendAnnouncement(`🗑️ REBOUND! ${lasttouchedPlayer.name}`, null, 0xE67E22, "small-bold", 0);
                    potaTemasFlagi = false;
                }


            }

            /* --- sayı --- */
            room.onTeamGoal = function (team) {


                potaTemasFlagi = false;

                if (!lasttouchedPlayer) {
                    lasttouchedPlayer = {
                        name: "Bilinmeyen Oyuncu",
                        team: team, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
                        team: { M: team } // .team.M kullanan versiyonlar için yedek
                    };
                }


                log("X konumu:" + touchedballX);
                log(lasttouchedPlayer.team.M);
                log(lasttouchedPlayer.team);
                const scoredBall = room.getDisc(0);
                if (!scoredBall) return;

                // ball.A.y bize yspeed değerini verir
                let yspeed = scoredBall.A.y;

                lastscoringTeam = team;


                // ŞUT çekilen konum ve son topa dokulan konum aynı mı?
                let score = { scoreBlue, scoreRed }

                const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)

                scoreBlue = result.scoreBlue;
                scoreRed = result.scoreRed;



                result.announcement.forEach(a => {
                    room.sendAnnouncement(a.message, a.target, a.color, a.messageType, a.messageSound);
                });


                if (!training && result.stat && lasttouchedPlayer.id !== undefined) {
                    addStatsFor(lasttouchedPlayer.id, { [result.stat]: 1 });
                    addMatchPoints(matchPoints, lasttouchedPlayer.id, result.stat);
                }


                //  BERABERE BİTEN NORMAL SÜREDE SAYI ATILIRSA

                if (drawEND && scoreBlue != scoreRed) {


                    if (lasttouchedPlayer.team.M == team) {
                        room.sendAnnouncement(`${lasttouchedPlayer.name} maçı kazandıran sayıyı atıyor!`, null, 0xFFD700)
                        room.stopGame();

                    }

                    drawEND = false;
                    room.stopGame();
                }

                resetStates();

            }



            room.onPositionsReset = () => {



                setTimeout(() => {

                    potaTemasFlagi = false;
                    // Eğer bir takım gol attıysa ve konum değişikliği bekliyorsak
                    if (lastscoringTeam !== null) {

                        if (lastscoringTeam === 1) { // Kırmızı gol attıysa -> Top Maviye yakın
                            room.setDiscProperties(0, { x: 400, y: -215, xspeed: 0, yspeed: 0 });
                        }
                        else if (lastscoringTeam === 2) { // Mavi gol attıysa -> Top Kırmızıya yakın
                            room.setDiscProperties(0, { x: -400, y: -215, xspeed: 0, yspeed: 0 });
                        }

                        // İşlem bitti, hafızayı temizliyoruz
                        lastscoringTeam = null;
                    }
                }, 5);
            }


            const afkTracker = new Map();
            const afkLastCheck = { value: 0 };

            room.onGameTick = () => {


                // Room'dan sade veri çıkar (gameLogic room'u hiç bilmesin)
                const roomPlayersData = room.players
                    .map(rawPlayer => {
                        const player = room.getPlayer(rawPlayer.id);
                        if (!player) return null;

                        const disc = room.getPlayerDisc(player.id);
                        if (!disc) return null;

                        return {
                            id: player.id,
                            teamId: player.team ? player.team.id : 0,
                            x: disc.h.x,
                            y: disc.h.y
                        };
                    })
                    .filter(Boolean);

                const kicks = checkAfkPlayers(roomPlayersData, afkTracker, afkLastCheck);

                kicks.forEach(({ playerId, reason, warning, kick }) => {

                    room.sendAnnouncement(warning, playerId, 0xFF0000, "bold", 2);

                    if (kick) room.kickPlayer(playerId, reason, false);
                });



            }




        }

    });

}// ═══════════ main() BURADA BİTİYOR ═══════════


// ═══════════ 3) main'i çalıştır ═══════════
main().catch(err => {
    console.error("Başlatma hatası:", err);
    process.exit(1);
});