// tests/gameStateService.test.js

const GameStateService = require("../services/GameStateService");

describe("GameStateService", () => {
    let gameState;

    beforeEach(() => {
        gameState = new GameStateService();
    });

    describe("initial state", () => {
        test("başlangıç state'i doğru oluşturulmalı", () => {
            const state = gameState.getState();

            expect(state.room).toEqual({
                name: null,
                playerCount: 0,
                maxPlayers: 9
            });

            expect(state.game.status).toBe("waiting");
            expect(state.score).toEqual({
                red: 0,
                blue: 0
            });

            expect(state.players).toEqual([]);
            expect(state.queue).toEqual([]);
            expect(state.lastTouch).toBeNull();
            expect(state.lastScore).toBeNull();
        });
    });

    describe("setRoomInfo", () => {
        test("oda bilgilerini güncellemeli", () => {
            gameState.setRoomInfo({
                name: "BASKET 3V3",
                playerCount: 4,
                maxPlayers: 9
            });

            const state = gameState.getState();

            expect(state.room.name).toBe("BASKET 3V3");
            expect(state.room.playerCount).toBe(4);
            expect(state.room.maxPlayers).toBe(9);
        });
    });

    describe("startGame", () => {
        test("oyunu running durumuna getirmeli", () => {
            gameState.startGame({
                mode: "ranked",
                durationMs: 120000
            });

            const state = gameState.getState();

            expect(state.game.status).toBe("running");
            expect(state.game.mode).toBe("ranked");
            expect(state.game.durationMs).toBe(120000);
            expect(state.game.startedAt).not.toBeNull();
            expect(state.game.elapsedMs).toBeGreaterThanOrEqual(0);
            expect(state.game.drawEnd).toBe(false);
        });

        test("oyun başlarken skor sıfırlanmalı", () => {
            gameState.setScore(5, 3);

            gameState.startGame({
                mode: "training",
                durationMs: 120000
            });

            expect(gameState.getState().score).toEqual({
                red: 0,
                blue: 0
            });
        });

        test("oyun başlarken lastScore temizlenmeli", () => {
            gameState.setLastScore({
                teamId: 1,
                playerId: 5,
                playerName: "Test"
            });

            gameState.startGame();

            expect(gameState.getState().lastScore).toBeNull();
        });
    });

    describe("stopGame", () => {
        test("oyunu stopped durumuna getirmeli", () => {
            gameState.startGame();

            gameState.stopGame();

            expect(gameState.getState().game.status).toBe("stopped");
        });

        test("maç sonunda skor korunmalı", () => {
            gameState.startGame();
            gameState.setScore(10, 8);

            gameState.stopGame();

            expect(gameState.getState().score).toEqual({
                red: 10,
                blue: 8
            });
        });
    });

    describe("score", () => {
        test("skoru güncellemeli", () => {
            gameState.setScore(7, 4);

            expect(gameState.getState().score).toEqual({
                red: 7,
                blue: 4
            });
        });

        test("SCORE_UPDATE eventi yayınlamalı", () => {
            const listener = jest.fn();

            gameState.on("change", listener);

            gameState.setScore(3, 2);

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener.mock.calls[0][0].type).toBe("SCORE_UPDATE");
            expect(listener.mock.calls[0][0].state.score).toEqual({
                red: 3,
                blue: 2
            });
        });
    });

    describe("lastScore", () => {
        test("son sayıyı kaydetmeli", () => {
            gameState.setLastScore({
                teamId: 1,
                playerId: 5,
                playerName: "Ahmet",
                stat: "three"
            });

            const lastScore = gameState.getState().lastScore;

            expect(lastScore.teamId).toBe(1);
            expect(lastScore.playerId).toBe(5);
            expect(lastScore.playerName).toBe("Ahmet");
            expect(lastScore.stat).toBe("three");
            expect(lastScore.at).toEqual(expect.any(Number));
        });

        test("GOAL eventi yayınlamalı", () => {
            const listener = jest.fn();

            gameState.on("change", listener);

            gameState.setLastScore({
                teamId: 2,
                playerId: 8,
                playerName: "Mehmet"
            });

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener.mock.calls[0][0].type).toBe("GOAL");
        });
    });

    describe("players", () => {
        test("oyuncuları state'e yazmalı", () => {
            gameState.updatePlayers([
                {
                    id: 1,
                    name: "Ali",
                    teamId: 1,
                    x: 100,
                    y: 200
                },
                {
                    id: 2,
                    name: "Veli",
                    teamId: 2,
                    x: -100,
                    y: 200
                }
            ]);

            const state = gameState.getState();

            expect(state.players).toEqual([
                {
                    id: 1,
                    name: "Ali",
                    teamId: 1,
                    x: 100,
                    y: 200
                },
                {
                    id: 2,
                    name: "Veli",
                    teamId: 2,
                    x: -100,
                    y: 200
                }
            ]);
        });

        test("playerCount'u oyuncu sayısına göre güncellemeli", () => {
            gameState.updatePlayers([
                {
                    id: 1,
                    name: "Ali",
                    teamId: 1,
                    x: 0,
                    y: 0
                },
                {
                    id: 2,
                    name: "Veli",
                    teamId: 2,
                    x: 0,
                    y: 0
                }
            ]);

            expect(gameState.getState().room.playerCount).toBe(2);
        });

        test("PLAYERS_UPDATE eventi yayınlamalı", () => {
            const listener = jest.fn();

            gameState.on("change", listener);

            gameState.updatePlayers([]);

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener.mock.calls[0][0].type).toBe("PLAYERS_UPDATE");
        });
    });

    describe("queue", () => {
        test("queue güncellenmeli", () => {
            gameState.setQueue([1, 2, 3]);

            expect(gameState.getState().queue).toEqual([1, 2, 3]);
        });

        test("queue dışarıdan değiştirildiğinde state etkilenmemeli", () => {
            const queue = [1, 2, 3];

            gameState.setQueue(queue);

            queue.push(4);

            expect(gameState.getState().queue).toEqual([
                1,
                2,
                3
            ]);
        });
    });

    describe("ball", () => {
        test("top pozisyonunu güncellemeli", () => {
            gameState.updateBall(123.45, -67.89);

            expect(gameState.getState().ball).toEqual({
                x: 123.45,
                y: -67.89
            });
        });

        test("top güncellemesi event yayınlamamalı", () => {
            const listener = jest.fn();

            gameState.on("change", listener);

            gameState.updateBall(100, 200);

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe("lastTouch", () => {
        test("son dokunuşu kaydetmeli", () => {
            gameState.setLastTouch({
                playerId: 5,
                playerName: "Ali",
                teamId: 1,
                x: 100,
                y: 200,
                source: "vuruş"
            });

            expect(gameState.getState().lastTouch).toEqual({
                playerId: 5,
                playerName: "Ali",
                teamId: 1,
                x: 100,
                y: 200,
                source: "vuruş"
            });
        });

        test("null verilirse son dokunuş temizlenmeli", () => {
            gameState.setLastTouch({
                playerId: 5,
                playerName: "Ali",
                teamId: 1
            });

            gameState.setLastTouch(null);

            expect(gameState.getState().lastTouch).toBeNull();
        });
    });

    describe("drawEnd", () => {
        test("drawEnd değerini değiştirmeli", () => {
            gameState.setDrawEnd(true);

            expect(gameState.getState().game.drawEnd).toBe(true);

            gameState.setDrawEnd(false);

            expect(gameState.getState().game.drawEnd).toBe(false);
        });
    });

    describe("state isolation", () => {
        test("getState canlı state yerine snapshot döndürmeli", () => {
            const state = gameState.getState();

            state.score.red = 999;
            state.players.push({
                id: 999,
                name: "Hacker",
                teamId: 1,
                x: 0,
                y: 0
            });

            const actualState = gameState.getState();

            expect(actualState.score.red).toBe(0);
            expect(actualState.players).toEqual([]);
        });
    });
});