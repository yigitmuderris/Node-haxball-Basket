const {
    START_ELO,
    MIN_ELO,
    MIN_PLAYERS_PER_TEAM,
    STAT_POINTS,
    calculateMatch,
    getRank,
    formatTag,
} = require('../services/eloLogic');

describe("eloLogic", () => {

    // =========================================================
    // CONSTANTS
    // =========================================================

    describe("constants", () => {

        test("START_ELO 1000 olmalı", () => {
            expect(START_ELO).toBe(1000);
        });

        test("MIN_ELO 0 olmalı", () => {
            expect(MIN_ELO).toBe(0);
        });

        test("minimum oyuncu sayısı takım başına 2 olmalı", () => {
            expect(MIN_PLAYERS_PER_TEAM).toBe(2);
        });

        test("istatistik puanları doğru tanımlanmalı", () => {
            expect(STAT_POINTS).toEqual({
                two_pt_made: 2,
                three_pt_made: 3,
                two_pt_own_basket: -2,
                three_pt_own_basket: -3,
            });
        });
    });


    // =========================================================
    // getRank
    // =========================================================

    describe("getRank", () => {

        test("1500 ELO -> Efsane", () => {
            expect(getRank(1500)).toEqual({
                min: 1500,
                name: "Efsane",
                emoji: "👑",
            });
        });

        test("1500 üstü ELO -> Efsane", () => {
            expect(getRank(1800).name).toBe("Efsane");
        });

        test("1300 -> Elmas", () => {
            expect(getRank(1300)).toEqual({
                min: 1300,
                name: "Elmas",
                emoji: "💎",
            });
        });

        test("1150 -> Altın", () => {
            expect(getRank(1150)).toEqual({
                min: 1150,
                name: "Altın",
                emoji: "🥇",
            });
        });

        test("1000 -> Gümüş", () => {
            expect(getRank(1000)).toEqual({
                min: 1000,
                name: "Gümüş",
                emoji: "🥈",
            });
        });

        test("850 -> Bronz", () => {
            expect(getRank(850)).toEqual({
                min: 850,
                name: "Bronz",
                emoji: "🥉",
            });
        });

        test("0 -> Kömür", () => {
            expect(getRank(0)).toEqual({
                min: 0,
                name: "Kömür",
                emoji: "🪵",
            });
        });

        test("eşiklerin hemen altındaki ELO doğru rankı vermeli", () => {
            expect(getRank(1499).name).toBe("Elmas");
            expect(getRank(1299).name).toBe("Altın");
            expect(getRank(1149).name).toBe("Gümüş");
            expect(getRank(999).name).toBe("Bronz");
            expect(getRank(849).name).toBe("Kömür");
        });
    });


    // =========================================================
    // formatTag
    // =========================================================

    describe("formatTag", () => {

        test("1000 ELO için doğru tag üretmeli", () => {
            expect(formatTag(1000))
                .toBe("[🥈 Gümüş 1000]");
        });

        test("1500 ELO için doğru tag üretmeli", () => {
            expect(formatTag(1500))
                .toBe("[👑 Efsane 1500]");
        });

        test("850 ELO için doğru tag üretmeli", () => {
            expect(formatTag(850))
                .toBe("[🥉 Bronz 850]");
        });

        test("0 ELO için doğru tag üretmeli", () => {
            expect(formatTag(0))
                .toBe("[🪵 Kömür 0]");
        });
    });


    // =========================================================
    // calculateMatch
    // =========================================================

    describe("calculateMatch", () => {

        test("eşit ELO'lu takımlarda kazanan pozitif, kaybeden negatif delta almalı", () => {

            const result = calculateMatch({
                winners: [
                    {
                        userId: 1,
                        playerId: 10,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],
            });

            expect(result).toHaveLength(4);

            expect(result[0].result).toBe("win");
            expect(result[1].result).toBe("win");

            expect(result[2].result).toBe("loss");
            expect(result[3].result).toBe("loss");

            expect(result[0].delta).toBeGreaterThan(0);
            expect(result[1].delta).toBeGreaterThan(0);

            expect(result[2].delta).toBeLessThan(0);
            expect(result[3].delta).toBeLessThan(0);
        });


        test("eşit ELO ve eşit katkıda provisional oyuncu +20 / -20 almalı", () => {

            const result = calculateMatch({
                winners: [
                    {
                        userId: 1,
                        playerId: 10,
                        elo: 1000,
                        games: 0,
                        points: 10,
                    },
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1000,
                        games: 0,
                        points: 10,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1000,
                        games: 0,
                        points: 10,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1000,
                        games: 0,
                        points: 10,
                    },
                ],
            });

            expect(result[0].delta).toBe(20);
            expect(result[1].delta).toBe(20);

            expect(result[2].delta).toBe(-20);
            expect(result[3].delta).toBe(-20);
        });


        test("10 maç tamamlayan oyuncu normal K factor kullanmalı", () => {

            const result = calculateMatch({
                winners: [
                    {
                        userId: 1,
                        playerId: 10,
                        elo: 1000,
                        games: 10,
                        points: 10,
                    },
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1000,
                        games: 10,
                        points: 10,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1000,
                        games: 10,
                        points: 10,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1000,
                        games: 10,
                        points: 10,
                    },
                ],
            });

            expect(result[0].delta).toBe(12);
            expect(result[1].delta).toBe(12);

            expect(result[2].delta).toBe(-12);
            expect(result[3].delta).toBe(-12);
        });


        test("10 maçtan az oyuncu provisional K factor kullanmalı", () => {

            const result = calculateMatch({
                winners: [
                    {
                        userId: 1,
                        playerId: 10,
                        elo: 1000,
                        games: 9,
                        points: 10,
                    },
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1000,
                        games: 9,
                        points: 10,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1000,
                        games: 9,
                        points: 10,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1000,
                        games: 9,
                        points: 10,
                    },
                ],
            });

            expect(result[0].delta).toBe(20);
            expect(result[2].delta).toBe(-20);
        });


        test("favori takım kazandığında daha az ELO kazanmalı", () => {

            const result = calculateMatch({
                winners: [
                    {
                        userId: 1,
                        playerId: 10,
                        elo: 1500,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1500,
                        games: 20,
                        points: 10,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],
            });

            expect(result[0].delta).toBeGreaterThanOrEqual(1);
            expect(result[0].delta).toBeLessThan(12);
        });


        test("zayıf takım sürpriz şekilde kazanırsa daha fazla ELO kazanmalı", () => {

            const result = calculateMatch({
                winners: [
                    {
                        userId: 1,
                        playerId: 10,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1500,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1500,
                        games: 20,
                        points: 10,
                    },
                ],
            });

            expect(result[0].delta).toBeGreaterThan(12);
            expect(result[2].delta).toBeLessThan(-12);
        });


        test("yüksek katkı yapan kazanan daha fazla ELO kazanmalı", () => {

            const result = calculateMatch({
                winners: [
                    {
                        userId: 1,
                        playerId: 10,
                        elo: 1000,
                        games: 20,
                        points: 20,
                    },
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1000,
                        games: 20,
                        points: 0,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],
            });

            expect(result[0].delta).toBeGreaterThan(result[1].delta);
        });


        test("yüksek katkı yapan kaybeden daha az ELO kaybetmeli", () => {

            const result = calculateMatch({
                winners: [
                    {
                        userId: 1,
                        playerId: 10,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1000,
                        games: 20,
                        points: 20,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1000,
                        games: 20,
                        points: 0,
                    },
                ],
            });

            // ✅ Düzeltme 1: Kazanan oyuncunun (index 0) delta değeri 0'dan büyük (pozitif) olmalıdır.
            expect(result[0].delta).toBeGreaterThan(0);

            // ✅ Düzeltme 2: Kaybeden oyuncuların delta değerleri 0'dan küçük (negatif) olmalıdır.
            expect(result[2].delta).toBeLessThan(0);
            expect(result[3].delta).toBeLessThan(0);

            // Katkısı yüksek olan kaybeden (userId:3 -> index 2), hiç katkı yapmayana (userId:4 -> index 3) kıyasla mutlak değerce daha az kaybetmeli.
            // Örn: |-4| < |-12|
            expect(Math.abs(result[2].delta)).toBeLessThan(Math.abs(result[3].delta));
        });


        test("negatif katkı ELO hesabında pozitif katkı olarak kullanılmamalı", () => {

            const result = calculateMatch({
                winners: [
                    {
                        userId: 1,
                        playerId: 10,
                        elo: 1000,
                        games: 20,
                        points: -10,
                    },
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],
            });

            expect(result[0].delta).toBeLessThan(result[1].delta);
        });


        test("ELO MIN_ELO değerinin altına düşmemeli", () => {

            const result = calculateMatch({
                winners: [
                    {
                        userId: 1,
                        playerId: 10,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1,
                        games: 20,
                        points: 10,
                    },
                ],
            });

            const loser = result.find(x => x.userId === 3);

            expect(loser.newElo).toBeGreaterThanOrEqual(0);
        });


        test("newElo = eski ELO + delta olmalı", () => {

            const result = calculateMatch({
                winners: [
                    {
                        userId: 1,
                        playerId: 10,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],
            });

            result.forEach(player => {
                expect(player.newElo)
                    .toBe(player.elo + player.delta);
            });
        });


        test("oyuncuların diğer alanları sonuçta korunmalı", () => {

            const player = {
                userId: 123,
                playerId: 55,
                elo: 1000,
                games: 5,
                points: 15,
                username: "testPlayer",
            };

            const result = calculateMatch({
                winners: [
                    player,
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1000,
                        games: 5,
                        points: 10,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1000,
                        games: 5,
                        points: 10,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1000,
                        games: 5,
                        points: 10,
                    },
                ],
            });

            expect(result[0].username).toBe("testPlayer");
            expect(result[0].userId).toBe(123);
            expect(result[0].playerId).toBe(55);
        });


        test("kazanan ve kaybeden oyuncuların sırası korunmalı", () => {

            const result = calculateMatch({
                winners: [
                    {
                        userId: 1,
                        playerId: 10,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 2,
                        playerId: 11,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],

                losers: [
                    {
                        userId: 3,
                        playerId: 20,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                    {
                        userId: 4,
                        playerId: 21,
                        elo: 1000,
                        games: 20,
                        points: 10,
                    },
                ],
            });

            expect(result.map(x => x.userId))
                .toEqual([1, 2, 3, 4]);
        });
    });
});