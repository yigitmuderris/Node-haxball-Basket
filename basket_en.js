require('dotenv').config();
const path = require("path");
const { log } = require('console');
const fs = require("fs");

const { OperationType, VariableType, ConnectionState, AllowFlags, Direction, CollisionFlags, CameraFollow, BackgroundType, GamePlayState, BanEntryType, Callback, Utils, Room, Replay, Query, Library, RoomConfig, Plugin, Renderer, Errors, Language, EventFactory, Impl } = require("node-haxball")();
const { migrate } = require('./db/migrate');

const { balanceTeams, getLiveTeams, scoreCheck, checkAfkPlayers, addMatchPoints, buildMatchEntries, createParticipationTracker } = require('./services/gameLogic');
const { buildEloAnnouncements,
    buildChatAnnouncement,
    hasBannedWord,
    controlSpam,
    buildStatsAnnouncement,
    buildRankAnnouncement,
    buildVsAnnouncement,
    buildAccountCommandAnnouncement,
    buildAccountCommandUsage,
    buildCommandCooldownAnnouncement,
    buildHelpAnnouncement,
    buildLeaderboardAnnouncement,
    buildMvpAnnouncement } = require('./services/chatLogic')

const eloLogic = require('./services/eloLogic');
const userService = require('./services/userService');

const { logChat,
    logJoin,
    logLeave,
    logGame,
    logError,
    logGit } = require('./services/logLogic');

const gameState = require("./services/GameStateService");

require("./controller/server");

const sessions = new Map();

function readTokens(file) {
    return fs.readFileSync(file, "utf8")
        .split("\n")
        .map(t => t.trim())
        .filter(Boolean);
}

async function main() {

    await migrate();
    console.log("Database ready");

    const DATA_DIR = process.env.DATA_DIR || "data";
    const TOKENS_FILE = path.join(DATA_DIR, "tokens.txt");
    const USED_TOKENS_FILE = path.join(DATA_DIR, "used_tokens.txt");

    let tokens = readTokens(TOKENS_FILE);
    let usedTokens = fs.existsSync(USED_TOKENS_FILE) ? readTokens(USED_TOKENS_FILE) : [];
    let dynamicToken = tokens.find(t => !usedTokens.includes(t));

    if (!dynamicToken) {
        console.error("NO TOKENS LEFT!");
        process.exit(0);
    }

    let tokenForRoom = dynamicToken.replace(/^"+|"+$/g, "");
    usedTokens.push(dynamicToken);
    fs.writeFileSync(USED_TOKENS_FILE, usedTokens.join("\n") + "\n");
    console.log("Token received:", tokenForRoom);

    const BASKET = fs.readFileSync("maps/basket.hbs", "utf8");
    let Basket;
    try {
        Basket = Utils.parseStadium(BASKET);
        console.log("Stadium object ready!");
    } catch (err) {
        console.error("Stadium parse error:", err);
    }

    Room.create({
        name: "🗑️ BASKET 3v3 🗑️",
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
            console.log("Received Token:", dynamicToken);

            gameState.setRoomInfo({
                name: room.name,
                playerCount: room.players.length,
                maxPlayers: 9
            })

            room.fakeSetTeamsLock(true);

            try {
                room.setCurrentStadium(Basket);
                console.log("Basket map loaded successfully!");
            } catch (err) {
                console.error("Stadium loading error:", err);
            }
            const stadium = room.stadium;

            room.sendAnnouncement("Hello " + room.name);
            room.onAfterRoomLink = (roomLink) => {
                console.log("Room link:", roomLink);
            };

            room.setScoreLimit(0);
            room.setTimeLimit(0);

            const mutedPlayerIds = [];
            const commandCooldown = new Map();

            room.onBeforeOperationReceived = (type, msg, globalFrameNo, clientFrameNo) => {

                const CHAT_TYPE = 4;
                if (type === CHAT_TYPE) {

                    const playerId = msg.byId;
                    const text = (msg && msg.text) ? String(msg.text) : "";

                    const normalizeCmd = (s) =>
                        s.toLowerCase().replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                    const [rawCmd, ...args] = text.trim().split(/\s+/);
                    const cmd = normalizeCmd(rawCmd);

                    // Oturum ve dil belirleme (Varsayılan 'tr', hesap/komut tercihlerine göre 'en')
                    const user = sessions.get(playerId);
                    const lang ='en';

                    // ============================================================
                    // HESAP KOMUTLARI (!kayit, !register, !giris, !login)
                    // ============================================================
                    if (cmd === "!kayit" || cmd === "!giris" || cmd === "!register" || cmd === "!login") {

                        const p = room.getPlayer(playerId);
                        if (!p) return false;

                        const now = Date.now();

                        if (now - (commandCooldown.get(playerId) || 0) < 3000) {
                            const announcement = buildCommandCooldownAnnouncement(lang);

                            room.sendAnnouncement(
                                announcement.message,
                                playerId,
                                announcement.color
                            );

                            return false;
                        }

                        commandCooldown.set(playerId, now);

                        (async () => {
                            try {
                                const password = args[0];

                                if (!password) {
                                    const announcement = buildAccountCommandUsage(cmd, lang);

                                    room.sendAnnouncement(
                                        announcement.message,
                                        playerId,
                                        announcement.color
                                    );

                                    return;
                                }

                                let res;

                                if (cmd === "!kayit" || cmd === "!register") {
                                    res = await userService.register(
                                        p.auth,
                                        password
                                    );
                                } else {
                                    res = await userService.login(
                                        p.auth,
                                        password
                                    );
                                }

                                if (res.ok) {
                                    sessions.set(playerId, res.user);
                                }

                                if (room.getPlayer(playerId)) {
                                    const announcement = buildAccountCommandAnnouncement(
                                        cmd,
                                        res,
                                        lang
                                    );

                                    room.sendAnnouncement(
                                        announcement.message,
                                        playerId,
                                        announcement.color
                                    );
                                }

                            } catch (err) {
                                console.error(`${cmd} command error:`, err);

                                if (room.getPlayer(playerId)) {
                                    const errMsg = lang === 'en'
                                        ? "❌ An error occurred during the operation."
                                        : "❌ İşlem sırasında bir hata oluştu.";

                                    room.sendAnnouncement(
                                        errMsg,
                                        playerId,
                                        0xFF0000
                                    );
                                }
                            }
                        })();

                        return false;
                    }

                    // ============================================================
                    // !stats
                    // ============================================================
                    if (cmd === "!stats") {
                        const user = sessions.get(playerId);
                        const result = buildStatsAnnouncement(user, lang);

                        room.sendAnnouncement(
                            result.message,
                            playerId,
                            result.color,
                            "small-bold",
                            1
                        );

                        return false;
                    }

                    // ============================================================
                    // !rank
                    // ============================================================
                    if (cmd === "!rank") {
                        const user = sessions.get(playerId);
                        const result = buildRankAnnouncement(user, lang);

                        room.sendAnnouncement(
                            result.message,
                            playerId,
                            result.color,
                            "small-bold",
                            1
                        );

                        return false;
                    }

                    // ============================================================
                    // !vs
                    // ============================================================
                    if (cmd === "!vs") {
                        const p = room.getPlayer(playerId);
                        if (!p) return false;

                        const targetName = args.join(" ").trim();

                        if (!targetName) {
                            const usageMsg = lang === 'en' ? "❌ Usage: !vs player" : "❌ Kullanım: !vs oyuncu";

                            room.sendAnnouncement(
                                usageMsg,
                                playerId,
                                0xFF0000
                            );

                            return false;
                        }

                        const target = room.players
                            .map(p => room.getPlayer(p.id))
                            .filter(Boolean)
                            .find(
                                p => p.name.toLowerCase() === targetName.toLowerCase()
                            );

                        if (!target) {
                            const notFoundMsg = lang === 'en'
                                ? `❌ Player "${targetName}" was not found in the room.`
                                : `❌ "${targetName}" isimli oyuncu odada bulunamadı.`;

                            room.sendAnnouncement(
                                notFoundMsg,
                                playerId,
                                0xFF0000
                            );

                            return false;
                        }

                        const user1 = sessions.get(playerId);
                        const user2 = sessions.get(target.id);

                        const result = buildVsAnnouncement(
                            user1,
                            user2,
                            p.name,
                            target.name,
                            lang
                        );

                        room.sendAnnouncement(
                            result.message,
                            playerId,
                            result.color,
                            "small-bold",
                            1
                        );

                        return false;
                    }

                    // ============================================================
                    // !leaderboard / !lb / !lider
                    // ============================================================
                    if (
                        cmd === "!leaderboard" ||
                        cmd === "!leaderbord" ||
                        cmd === "!lb" ||
                        cmd === "!lider"
                    ) {
                        const p = room.getPlayer(playerId);
                        if (!p) return false;

                        let limit = Number(args[0]) || 10;
                        limit = Math.min(Math.max(limit, 1), 10);

                        (async () => {
                            try {
                                const players = await userService.getLeaderboard(limit);
                                const result = buildLeaderboardAnnouncement(players, lang);

                                if (room.getPlayer(playerId)) {
                                    room.sendAnnouncement(
                                        result.message,
                                        playerId,
                                        result.color,
                                        "small-bold",
                                        1
                                    );
                                }
                            } catch (err) {
                                console.error("!leaderboard command error:", err);

                                if (room.getPlayer(playerId)) {
                                    const errMsg = lang === 'en'
                                        ? "❌ An error occurred while fetching the leaderboard."
                                        : "❌ Sıralama çekilirken bir hata oluştu.";

                                    room.sendAnnouncement(
                                        errMsg,
                                        playerId,
                                        0xFF0000
                                    );
                                }
                            }
                        })();

                        return false;
                    }

                    // ============================================================
                    // !help / !yardim / !komutlar
                    // ============================================================
                    if (cmd === "!help" || cmd === "!yardim" || cmd === "!komutlar") {
                        const announcement = buildHelpAnnouncement(lang);

                        room.sendAnnouncement(
                            announcement.message,
                            playerId,
                            announcement.color,
                            "small-bold",
                            1
                        );

                        return false;
                    }

                    // Tanımsız komutlar
                    if (/^!\p{L}+/u.test(rawCmd)) {
                        const unknownMsg = lang === 'en'
                            ? "❓ Unknown command. Type !help for available commands."
                            : "❓ Bilinmeyen komut. Kullanılabilir komutlar için !help yazın.";

                        room.sendAnnouncement(unknownMsg, playerId, 0x999999);
                        return false;
                    }

                    // Mute kontrolü
                    if (mutedPlayerIds.includes(playerId)) {
                        return false;
                    }

                    // Küfür / Argo filtresi
                    if (hasBannedWord(text)) {
                        const bannedMsg = lang === 'en'
                            ? "❌ Your message was blocked because it contains profanity or insults!"
                            : "❌ Mesajınız küfür veya hakaret içerdiği için engellendi!";

                        room.sendAnnouncement(bannedMsg, playerId, 0xFF0000);
                        return false;
                    }

                    // Spam kontrolü
                    const { announcement, messageSendStatus } = controlSpam(playerId, lang);

                    if (!messageSendStatus) {
                        room.sendAnnouncement(announcement, playerId, 0xFF0000);
                        return messageSendStatus;
                    }

                    // Normal sohbet mesajı gönderimi
                    const p = room.getPlayer(playerId);
                    if (!p) return false;

                    const a = buildChatAnnouncement({
                        name: p.name,
                        teamId: p.team ? p.team.id : 0,
                        user: sessions.get(playerId),
                        text,
                    });

                    room.sendAnnouncement(a.message, null, a.color, "normal", 1);

                    logChat(`${p.name}#${playerId}: ${text}`);
                    return false;
                }

                return true;
            };

            let queue = [];
            let isGameRunning = false;
            let training = false;

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

                gameState.setQueue(queue);

            }

            const matchPoints = new Map();
            const participation = createParticipationTracker({ windowMs: 60000 });

            function addStatsFor(playerId, stats) {
                const user = sessions.get(playerId);
                if (!user) return;
                userService.addStats(user.id, stats)
                    .catch((err) => console.error("addStats error:", err));
            }

            function finishMatch(winnerIds, loserIds) {
                const winners = buildMatchEntries(winnerIds, sessions, matchPoints);
                const losers = buildMatchEntries(loserIds, sessions, matchPoints);
                matchPoints.clear();

                userService.recordMatch({ winners, losers })
                    .then((results) => {
                        if (!results) { logGame("ELO was not recorded: there were not enough eligible players on the teams"); return; }
                        results.forEach((r) => logGame(
                            `ELO user=${r.user.id} ${r.oldElo}->${r.newElo} (${r.delta > 0 ? "+" : ""}${r.delta})`
                        ));
                        const inRoom = results.filter((r) => room.getPlayer(r.playerId));
                        inRoom.forEach((r) => sessions.set(r.playerId, r.user));
                        buildEloAnnouncements(inRoom, "en").forEach((a) =>
                            room.sendAnnouncement(a.message, a.playerId, a.color)
                        );

                        const mvpAnnouncement = buildMvpAnnouncement(results);

                        if (mvpAnnouncement) {
                            room.sendAnnouncement(
                                mvpAnnouncement,
                                null,
                                0xFFD700,
                                "bold"
                            );
                        }

                    })
                    .catch((err) => console.error("recordMatch error:", err));
            }

            function isRankedMatch() {
                const redCount = room.players.filter(p => p.team?.id === 1).length;
                const blueCount = room.players.filter(p => p.team?.id === 2).length;

                return (
                    redCount >= eloLogic.MIN_PLAYERS_PER_TEAM &&
                    blueCount >= eloLogic.MIN_PLAYERS_PER_TEAM
                );
            }

            var touchedballX = null;
            var touchedballY = null;
            let lasttouchedPlayer = null;
            const touchHistory = [];

            function registerTouch(playerId, source) {
                const p = room.getPlayer(playerId);
                const ball = room.getDisc(0);
                if (!p || !p.team || p.team.id === 0 || !ball) return false;

                lasttouchedPlayer = { id: p.id, name: p.name, team: { M: p.team.id } };
                touchedballX = ball.h.x;
                touchedballY = ball.h.y;

                gameState.setLastTouch({
                    playerId: lasttouchedPlayer.id,
                    playerName: lasttouchedPlayer.name,
                    teamId: lasttouchedPlayer.team.M,
                    x: touchedballX,
                    y: touchedballY,
                    source: source
                })

                touchHistory.push({ name: p.name, x: Math.round(ball.h.x), source });
                if (touchHistory.length > 5) touchHistory.shift();
                return true;
            }

            function resetTouchState() {
                lasttouchedPlayer = null;
                touchedballX = null;
                touchedballY = null;
                touchHistory.length = 0;
            }

            room.onPlayerTeamChange = (id, teamId) => {

                participation.teamChanged(id, teamId);
            }

            room.onPlayerInputChange = (id, value, customData) => {
                const tracked = afkTracker.get(id);

                if (!tracked) {
                    return;
                }

                tracked.lastInputAt = Date.now();
                tracked.warned = false;
            };

            room.onPlayerJoin = (player) => {

                log("Player joined: " + player.name);
                logJoin(`${player.name} joined the room.`);

                if (player.auth) {
                    userService.findOrCreateByAuth(player.auth)
                        .then(async user => {

                            if (player.name && player.name.trim()) {
                                user = await userService.updateUsername(
                                    user.id,
                                    player.name.trim()
                                );
                            }

                            sessions.set(player.id, user);

                            if (!room.getPlayer(player.id)) return;

                            room.sendAnnouncement(
                                user.registered
                                    ? `✅ Automatically logged in.`
                                    : "To make your account permanent, type !kayit password, or !giris password if you already have an account.",
                                player.id,
                                user.registered
                                    ? 0x00FF00
                                    : 0x999999
                            );
                        })
                        .catch(err =>
                            console.error(
                                "findOrCreateByAuth error:",
                                err
                            )
                        );
                } else {
                    console.warn("auth was empty:", player.name);
                }

                setTimeout(() => {
                    room.sendAnnouncement(`${player.name}, welcome!`, player.id);
                    queue.push(player.id);

                    gameState.setQueue(queue);

                    if (isGameRunning && queue.find(p => p === player.id) && room.players.length > 6) {

                        room.sendAnnouncement("A game is in progress. Please wait for your turn...", player.id, 0x999999)
                    }

                    handleBalance();

                    if (room.players.length === 1 && !isGameRunning) {

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

                log("Player left: " + player.name)
                logLeave(`${player.name} left the room.`);

                commandCooldown.delete(player.id);
                sessions.delete(player.id);

                queue = queue.filter(p => p !== player.id);

                gameState.setQueue(queue);
                afkTracker.delete(player.id);

                const roomPlayers = getPlayerList();

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

                    room.stopGame();

                    setTimeout(() => {
                        room.startGame();
                    }, 3500);

                }

            }

            let gameTimeout = 0;
            let warnTimeoutLastTen = 0;
            let warnTimeoutOne = 0;

            let lastscoringTeam = null;

            var scoreRed = 0;
            var scoreBlue = 0;
            var drawEND = false;
            var gameTime = 120000;
            var warnTimeOne = 60000;
            var warnTimeLastTenSec = 110000;

            room.onGameStart = function (playerId) {

                resetTouchState();
                lastscoringTeam = null;
                matchPoints.clear();

                isGameRunning = true;

                setTimeout(() => {
                    handleBalance();

                    training = !isRankedMatch();

                    participation.start(
                        getPlayerList().filter((p) => p.team && p.team.id !== 0).map((p) => p.id)
                    );

                    if (!training) {
                        room.sendAnnouncement(
                            "🏆 RANKED MATCH STARTED! ELO IS ACTIVE 🏆 TIME LIMIT: 2 MIN",
                            null,
                            0xFFD700
                        );

                    } else {

                        room.sendAnnouncement(
                            "🏀 FEWER THAN 4 PLAYERS... 🏀",
                            null,
                            0x999999
                        );
                        room.sendAnnouncement(
                            "🏀 TRAINING MATCH STARTED! ELO WILL NOT BE AFFECTED 🏀 TIME LIMIT: 2 MIN",
                            null,
                            0x999999
                        );
                    }

                    gameState.startGame({
                        mode: training ? "training" : "ranked",
                        durationMs: gameTime
                    });

                }, 100);

                if (gameTimeout) clearTimeout(gameTimeout);
                if (warnTimeoutOne) clearTimeout(warnTimeoutOne);
                if (warnTimeoutLastTen) clearTimeout(warnTimeoutLastTen);

                warnTimeoutOne = setTimeout(() => {

                    room.sendAnnouncement("1 MINUTE LEFT...", null, 0XFF007F);

                }, warnTimeOne);

                warnTimeoutLastTen = setTimeout(() => {

                    room.sendAnnouncement("10 SECONDS LEFT...", null, 0XFF007F, "bold");

                }, warnTimeLastTenSec);

                gameTimeout = setTimeout(() => {

                    if (scoreBlue != scoreRed) {

                        room.stopGame();
                    } else {

                        drawEND = true;
                        gameState.setDrawEnd(true);

                        room.sendAnnouncement(`REGULAR TIME ENDED IN A DRAW. SCORE: ${scoreRed} vs ${scoreBlue}`, null, 0X808080);
                        room.sendAnnouncement("NEXT SCORE WINS!", null, 0XFFD700);
                    }

                }, gameTime);

            }

            room.onGameStop = function (winningTeamId) {

                gameState.stopGame();
                isGameRunning = false;
                let losers = [];
                let winners = [];
                potaTemasFlagi = false;

                participation.stop();

                if (room.players.length === 1) {

                    room.sendAnnouncement("Training is starting...", null, 0x999999);

                    setTimeout(() => {
                        room.startGame();
                    }, 3500);

                }

                room.players.forEach(rawPlayer => {

                    const p = room.getPlayer(rawPlayer.id);
                    if (p && p.team) {

                        if (scoreRed > scoreBlue && p.team.id === 2) {

                            losers.push(p.id)
                        } else if (scoreBlue > scoreRed && p.team.id === 1) {

                            losers.push(p.id);
                        }

                    }

                });

                room.players.forEach(rawPlayer => {

                    const p = room.getPlayer(rawPlayer.id);
                    if (p && p.team) {

                        if (scoreRed > scoreBlue && p.team.id === 1) {

                            winners.push(p.id)
                        } else if (scoreBlue > scoreRed && p.team.id === 2) {

                            winners.push(p.id);
                        }
                    }

                })

                logGame(`MATCH FINISHED score=${scoreRed}-${scoreBlue} training=${training} ` +
                    `winner=[${winners.forEach(p => room.getPlayer(p).name)}] loser=[${losers.forEach(p => room.getPlayer(p).name)}] eligible=[${participation.filter([...winners, ...losers])}]`);

                if (!training && scoreRed !== scoreBlue) {
                    finishMatch(participation.filter(winners), participation.filter(losers));

                    [...winners, ...losers]
                        .filter((id) => !participation.isEligible(id))
                        .forEach((id) =>
                            room.sendAnnouncement("ℹ️ Your ELO was not affected because you joined the match too late.", id, 0x999999)
                        );
                }

                if (room.players.length > 6) {
                    winners.forEach(pId => {
                        room.setPlayerTeam(pId, 1);
                    })

                    losers.forEach(pId => {
                        room.setPlayerTeam(pId, 0);
                        queue.push(pId);
                    })

                } else {

                    const ids = room.players.map(p => p.id);

                    for (let i = ids.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [ids[i], ids[j]] = [ids[j], ids[i]];
                    }

                    const firstTeam = Math.random() < 0.5 ? 1 : 2;

                    ids.forEach((id, i) => {
                        const team = (i % 2 === 0) ? firstTeam : (firstTeam === 1 ? 2 : 1);
                        room.setPlayerTeam(id, team);
                    });

                }

                var result = "";
                var color = 0xFFFF00;

                if (scoreBlue > scoreRed) {
                    result = "BLUE TEAM WON";
                    color = 0x3399FF;
                }
                if (scoreBlue < scoreRed) {
                    result = "RED TEAM WON";
                    color = 0xFF0000;
                }

                if (!training) room.sendAnnouncement(`${result}  SCORE: ${scoreRed} vs ${scoreBlue}`, null, color);

                drawEND = false;
                scoreBlue = 0;
                scoreRed = 0;
                if (gameTimeout) clearTimeout(gameTimeout);
                if (warnTimeoutOne) clearTimeout(warnTimeoutOne);
                if (warnTimeoutLastTen) clearTimeout(warnTimeoutLastTen);

                setTimeout(() => {

                    handleBalance();

                    if (room.players.length >= 2) {
                        room.sendAnnouncement("NEW GAME STARTING...", null, 0x00E5FF);

                        setTimeout(() => {

                            room.startGame();

                        }, 3000);

                    }

                }, 100);

            }

            const TUM_POTA_SEGMENT_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 16])
            let TOP_DISC_ID = 0;
            let potaTemasFlagi = false;
            let oyuncuPlayerId = null;

            room.onCollisionDiscVsSegment = function (discId, discPlayerId, segmentId) {
                if (discId === TOP_DISC_ID) {
                    if (TUM_POTA_SEGMENT_IDS.has(segmentId)) {
                        if (!potaTemasFlagi) {
                            potaTemasFlagi = true;
                        }
                    }
                }
            };

            room.onCollisionDiscVsDisc = (discId1, discPlayerId1, discId2, discPlayerId2) => {
                let playerId = null;
                if (discId1 === 0 && discPlayerId2 != null) playerId = discPlayerId2;
                else if (discId2 === 0 && discPlayerId1 != null) playerId = discPlayerId1;
                if (playerId === null) return;
                if (!registerTouch(playerId, "collision")) return;

                if (potaTemasFlagi) {
                    room.sendAnnouncement(`🗑️ REBOUND! ${lasttouchedPlayer.name}`, null, 0xE67E22, "small-bold", 0);
                    potaTemasFlagi = false;
                }
            };

            room.onPlayerBallKick = (playerId) => { registerTouch(playerId, "kick"); };

            room.onTeamGoal = function (team) {

                potaTemasFlagi = false;

                const scoredBall = room.getDisc(0);
                if (!scoredBall) return;

                const shooter = lasttouchedPlayer || { name: "Unknown Player", team: { M: team } };
                const shotX = touchedballX ?? scoredBall.h.x;
                const shotY = touchedballY ?? scoredBall.h.y;
                const yspeed = scoredBall.A.y;

                lastscoringTeam = team;

                let score = { scoreBlue, scoreRed }

                const result = scoreCheck(shotX, shotY, yspeed, team, shooter, score)

                scoreBlue = result.scoreBlue;
                scoreRed = result.scoreRed;

                gameState.setScore(scoreRed, scoreBlue);

                gameState.setLastScore({
                    teamId: team,
                    playerId: lasttouchedPlayer?.id ?? null,
                    playerName: lasttouchedPlayer?.name ?? null,
                    stat: result.stat ?? null,
                    x: shotX,
                    y: shotY
                });

                result.announcement.forEach(a => {
                    room.sendAnnouncement(a.message, a.target, a.color, a.messageType, a.messageSound);
                });

                if (!training && result.stat && lasttouchedPlayer?.id !== undefined) {
                    addStatsFor(lasttouchedPlayer.id, { [result.stat]: 1 });
                    addMatchPoints(matchPoints, lasttouchedPlayer.id, result.stat);
                }

                if (drawEND && scoreBlue != scoreRed) {

                    if (lasttouchedPlayer.team.M == team) {
                        room.sendAnnouncement(`${lasttouchedPlayer.name} scores the game-winning point!`, null, 0xFFD700)
                        room.stopGame();

                    }

                    drawEND = false;
                    room.stopGame();
                }

                logGame(`SCORE team=${team} player=${shooter.name}#${shooter.id ?? "-"} stat=${result.stat ?? "-"} ` +
                    `x=${Math.round(shotX)} y=${Math.round(shotY)} vy=${yspeed.toFixed(2)} score=${scoreRed}-${scoreBlue} ` +
                    `lastTouches=${touchHistory.slice(-3).map((t) => `${t.name}(${t.source})`).join(">")}`);

                resetTouchState();

            }

            room.onPositionsReset = () => {

                setTimeout(() => {

                    potaTemasFlagi = false;

                    if (lastscoringTeam !== null) {

                        if (lastscoringTeam === 1) {
                            room.setDiscProperties(0, { x: 400, y: -215, xspeed: 0, yspeed: 0 });
                        }
                        else if (lastscoringTeam === 2) {
                            room.setDiscProperties(0, { x: -400, y: -215, xspeed: 0, yspeed: 0 });
                        }

                        lastscoringTeam = null;
                    }
                }, 5);
            }

            const afkTracker = new Map();
            const afkLastCheck = { value: 0 };

            let lastStatePublish = 0;

            room.onGameTick = () => {

                const roomPlayersData = room.players
                    .map(rawPlayer => {
                        const player = room.getPlayer(rawPlayer.id);
                        if (!player) return null;

                        const disc = room.getPlayerDisc(player.id);
                        if (!disc) return null;

                        return {
                            id: player.id,
                            name: player.name ? player.name : "Unknown Player",
                            teamId: player.team ? player.team.id : 0,
                            x: disc.h.x,
                            y: disc.h.y
                        };
                    })
                    .filter(Boolean);

                const now = Date.now();

                if (now - lastStatePublish >= 50) {
                    gameState.updatePlayers(roomPlayersData);
                    lastStatePublish = now;
                }

                const ball = room.getDisc(0);

                if (ball) gameState.updateBall(ball.h.x, ball.h.y);

                const kicks = checkAfkPlayers(roomPlayersData, afkTracker, afkLastCheck);

                kicks.forEach(({ playerId, reason, warning, kick }) => {

                    if (room.players.length > 2) {
                        room.sendAnnouncement(warning, playerId, 0xFF0000, "bold", 2);

                        if (kick) room.kickPlayer(playerId, reason, false);

                    }
                });

            }

        }

    });

}

main().catch(err => {
    console.error("Startup error:", err);
    process.exit(1);
});