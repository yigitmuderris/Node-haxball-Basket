const { getLiveTeams, balanceTeams, hasBannedWord, scoreCheck } = require('../services/gameLogic');


describe('getliveTeams testleri', () => {

    test('1. Bir kırmızı bir mavi oyuncu varsa odada', () => {
        const mockPlayers = [
            { id: 1, team: { id: 1 } },
            { id: 2, team: { id: 2 } }
        ];

        const result = getLiveTeams(mockPlayers);
        expect(result).toEqual({ red: 1, blue: 1 });
    });


    test('2. Odada kimse yoksa', () => {

        const mockPlayers = [];

        const result = getLiveTeams(mockPlayers);
        expect(result).toEqual({ red: 0, blue: 0 });

    });

    test("3. Eğer odadaki herkes specteyse", () => {

        const mockPlayers = [
            { id: 1, team: { id: 0 } },
            { id: 2, team: { id: 0 } }
        ]

        const result = getLiveTeams(mockPlayers);
        expect(result).toEqual({ red: 0, blue: 0 });

    });

    test('4. Bozuk Veri Koruması: Dizide null veya eksik objeler varsa uygulamayı patlatmamalı', () => {
        const mockPlayers = [
            { id: 1, team: { id: 1 } },
            null,                        // Bozuk veri
            { id: 3 },                   // team alanı yok
            undefined
        ];

        const result = getLiveTeams(mockPlayers);
        expect(result).toEqual({ red: 1, blue: 0 });
    });


});


describe('balanceTeams testleri', () => {

    test('1. Eksik Takıma Öncelik: Kırmızı çoksa sıradaki oyuncuyu Maviye atmalı', () => {
        const queue = [101];
        const mockPlayers = [
            { id: 1, team: { id: 1 } },
            { id: 2, team: { id: 1 } } // 2 Kırmızı, 0 Mavi
        ];

        const { moves, updatedQueue } = balanceTeams(queue, mockPlayers);

        expect(moves).toEqual([{ playerId: 101, teamId: 2 }]); // Mavi (teamId: 2)
        expect(updatedQueue).toEqual([]);

    });

    test('2. Eksik Takıma Öncelik: Mavi çoksa sıradaki oyuncuyu Kırmızıya atmalı', () => {
        const queue = [101];
        const mockPlayers = [
            { id: 1, team: { id: 2 } },
            { id: 2, team: { id: 2 } } // 0 Kırmızı, 2 Mavi
        ];

        const { moves, updatedQueue } = balanceTeams(queue, mockPlayers);

        expect(moves).toEqual([{ playerId: 101, teamId: 1 }]); // Kırmızı (teamId: 1)
        expect(updatedQueue).toEqual([]);
    });

    test('3. Eşitlik Durumu (Dengeli Dağıtım): 1v1 eşitlikte sıradakileri dengeli dağıtmalı', () => {
        const queue = [101, 102];
        const mockPlayers = [
            { id: 1, team: { id: 1 } }, // 1 Kırmızı
            { id: 2, team: { id: 2 } }  // 1 Mavi
        ];

        const { moves, updatedQueue } = balanceTeams(queue, mockPlayers);

        expect(moves).toEqual([
            { playerId: 101, teamId: 1 }, // Kırmızı
            { playerId: 102, teamId: 2 }  // Mavi
        ]);
        expect(updatedQueue).toEqual([]);
    });

    test('4. Takım Limiti Koruması (3v3 Dolu): İki takım da 3 kişiyse oyuna kimseyi almamalı', () => {
        const queue = [101, 102];
        const mockPlayers = [
            { id: 1, team: { id: 1 } }, { id: 2, team: { id: 1 } }, { id: 3, team: { id: 1 } }, // 3 Kırmızı
            { id: 4, team: { id: 2 } }, { id: 5, team: { id: 2 } }, { id: 6, team: { id: 2 } }  // 3 Mavi
        ];

        const { moves, updatedQueue } = balanceTeams(queue, mockPlayers);

        expect(moves).toEqual([]); // Hamle yapılmamalı
        expect(updatedQueue).toEqual([101, 102]); // Kuyruk korunmalı
    });


    test('5. Sıra boşken 2v0 dengesizliği varsa, takımdaki bir oyuncu', () => {
        const queue = [];
        const roomPlayers = [
            { id: 1, name: 'Ali', team: { id: 1 } },
            { id: 2, name: 'Veli', team: { id: 1 } },
        ];

        const result = balanceTeams(queue, roomPlayers, 3, true);

        expect(result.moves).toContainEqual(
            expect.objectContaining({ playerId: 2, teamId: 2 })

        );
        expect(result.shouldStopGame).toBe(false);
    });

    test('6. Sıra boşken 3v1 dengesizliği varsa en son giren oyuncuyu transfer etmeli', () => {
        const queue = [];
        const roomPlayers = [
            { id: 1, name: 'Ali', team: { id: 1 } },
            { id: 2, name: 'Veli', team: { id: 1 } },
            { id: 5, name: 'SonGiren', team: { id: 1 } }, // En yüksek ID
            { id: 3, name: 'Can', team: { id: 2 } }
        ];

        const result = balanceTeams(queue, roomPlayers, 3, true);

        expect(result.moves).toContainEqual(
            expect.objectContaining({ playerId: 5, teamId: 2 })

        );
        expect(result.shouldStopGame).toBe(false);
    });

    test('7. 3V3 Oyun oynanıyorken gelen 3 oyuncu da queueda ve specte kalır', () => {
        const queue = [7, 8, 9];
        const roomPlayers = [
            { id: 1, name: 'Ali', team: { id: 1 } },
            { id: 2, name: 'Veli', team: { id: 1 } },
            { id: 3, name: 'SonGiren', team: { id: 1 } },
            { id: 4, name: 'Can', team: { id: 2 } },
            { id: 5, name: 'Murat', team: { id: 2 } },
            { id: 6, name: 'Selim', team: { id: 2 } }
        ];

        const result = balanceTeams(queue, roomPlayers, 3, false);

        expect(result.updatedQueue).toEqual([7, 8, 9]);

    });


});



describe('scoreCheck testleri', () => {




    test('1. Kırmızı takım için üçlük', () => {


        const touchedballX = -180;
        const touchedballY = 32;



        const yspeed = 10;
        const team = 1;

        const lasttouchedPlayer = {
            name: "Oyuncu",
            team: 1, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
            team: { M: 1 } // .team.M kullanan versiyonlar için yedek
        };

        const scoreRed = 0;
        const scoreBlue = 0;

        score = { scoreBlue, scoreRed };


        const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



        expect(result.announcement).toEqual([
            {
                message: `${lasttouchedPlayer.name} ÜÇLÜK!!`,
                target: null,
                color: 0xFFD700,
                messageType: "small-bold",
                messageSound: 2
            },

            {
                message: `Skor : ${scoreRed + 3} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }

        ]
        );





    });


    test('2. kırmızı takım için ikilik, normal şut ', () => {


        const touchedballX = 150;
        const touchedballY = 60


        const yspeed = 10;
        const team = 1;

        const lasttouchedPlayer = {
            name: "Oyuncu",
            team: 1, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
            team: { M: 1 } // .team.M kullanan versiyonlar için yedek
        };

        const scoreRed = 0;
        const scoreBlue = 0;

        score = { scoreBlue, scoreRed };


        const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



        expect(result.announcement).toEqual([
            {
                message: `${lasttouchedPlayer.name} şık bir şutla İKİ SAYI atıyor! 🏀`,
                target: null,
                color: 0xFF6600,
                messageType: "small-bold",
                messageSound: 1
            },

            {
                message: `Skor : ${scoreRed + 2} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }

        ]
        );





    });

    test('3. kırmızı takım için ikilik, normal dokunuş ', () => {


        const touchedballX = 150;
        const touchedballY = -77



        const yspeed = 10;
        const team = 1;

        const lasttouchedPlayer = {
            name: "Oyuncu",
            team: 1, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
            team: { M: 1 } // .team.M kullanan versiyonlar için yedek
        };

        const scoreRed = 0;
        const scoreBlue = 0;

        score = { scoreBlue, scoreRed };


        const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



        expect(result.announcement).toEqual([
            {
                message: `${lasttouchedPlayer.name} bitirici dokunuş. İki sayı! 🏀`,
                target: null,
                color: 0xFF6600,
                messageType: "small-bold",
                messageSound: 1
            },

            {
                message: `Skor : ${scoreRed + 2} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }

        ]
        );





    });

    test('4. kırmızı takım için ikilik, turnike ', () => {


        const touchedballX = 15.0;
        const touchedballY = 10.0;



        const yspeed = -10;
        const team = 1;

        const lasttouchedPlayer = {
            name: "Oyuncu",
            team: 1, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
            team: { M: 1 } // .team.M kullanan versiyonlar için yedek
        };

        const scoreRed = 0;
        const scoreBlue = 0;

        score = { scoreBlue, scoreRed };


        const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



        expect(result.announcement).toEqual([
            {
                message: `${lasttouchedPlayer.name} pota altından turnike!💨`,
                target: null,
                color: 0x00E5FF,
                messageType: "small-bold",
                messageSound: 1
            },

            {
                message: `Skor : ${scoreRed + 2} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }

        ]
        );





    });

    test('5. kırmızı takım için ikilik, yspeed sıfırsa ', () => {


        const touchedballX = 15.0;
        const touchedballY = 10.0;



        const yspeed = 0;
        const team = 1;

        const lasttouchedPlayer = {
            name: "Oyuncu",
            team: 1, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
            team: { M: 1 } // .team.M kullanan versiyonlar için yedek
        };

        const scoreRed = 0;
        const scoreBlue = 0;

        score = { scoreBlue, scoreRed };


        const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



        expect(result.announcement).toEqual([
            {
                message: `${lasttouchedPlayer.name} potayı sarsıyor!`,
                target: null,
                color: 0xFFFF00,
                messageType: "small-bold",
                messageSound: 1
            },

            {
                message: `Skor : ${scoreRed + 2} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }

        ]
        );





    });

    test('6. kırmızı takım için ikilik , SMAÇ', () => {


        const touchedballX = 15.0;
        const touchedballY = 10.0;



        const yspeed = 10.5;
        const team = 1;

        const lasttouchedPlayer = {
            name: "Oyuncu",
            team: 1, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
            team: { M: 1 } // .team.M kullanan versiyonlar için yedek
        };

        const scoreRed = 0;
        const scoreBlue = 0;

        score = { scoreBlue, scoreRed };


        const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



        expect(result.announcement).toEqual([
            {
                message: `${lasttouchedPlayer.name} SMAÇ! 🔥`,
                target: null,
                color: 0x4169E1 ,
                messageType: "small-bold",
                messageSound: 2
            },

            {
                message: `Skor : ${scoreRed + 2} vs ${scoreBlue}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }

        ]
        );





    });

    test('7. mavi takım için üçlük', () => {


        const touchedballX = 15.0;
        const touchedballY = 10.0;



        const yspeed = 0;
        const team = 2;

        const lasttouchedPlayer = {
            name: "Oyuncu",
            team: 2, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
            team: { M: 2 } // .team.M kullanan versiyonlar için yedek
        };

        const scoreRed = 0;
        const scoreBlue = 0;

        score = { scoreBlue, scoreRed };


        const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



        expect(result.announcement).toEqual([
            {
                message: `${lasttouchedPlayer.name} ÜÇLÜK!!`,
                target: null,
                color: 0xFFD700,
                messageType: "small-bold",
                messageSound: 2
            },

            {
                message: `Skor : ${scoreRed} vs ${scoreBlue + 3}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }

        ]
        );





    });

    test('8. mavi takım için ikilik, normal şut ', () => {


        const touchedballX = -10.0;
        const touchedballY = 50.0;



        const yspeed = 10;
        const team = 2;

        const lasttouchedPlayer = {
            name: "Oyuncu",
            team: 2, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
            team: { M: 2 } // .team.M kullanan versiyonlar için yedek
        };

        const scoreRed = 0;
        const scoreBlue = 0;

        score = { scoreBlue, scoreRed };


        const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



        expect(result.announcement).toEqual([
            {
                message: `${lasttouchedPlayer.name} şık bir şutla İKİ SAYI atıyor! 🏀`,
                target: null,
                color: 0xFF6600,
                messageType: "small-bold",
                messageSound: 1
            },

            {
                message: `Skor : ${scoreRed} vs ${scoreBlue + 2}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }

        ]
        );





    });
    test('9. mavi takım için ikilik, normal dokunuş ', () => {


        const touchedballX = -10.0;
        const touchedballY = -75.0;



        const yspeed = 10;
        const team = 2;

        const lasttouchedPlayer = {
            name: "Oyuncu",
            team: 2, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
            team: { M: 2 } // .team.M kullanan versiyonlar için yedek
        };

        const scoreRed = 0;
        const scoreBlue = 0;

        score = { scoreBlue, scoreRed };


        const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



        expect(result.announcement).toEqual([
            {
                message: `${lasttouchedPlayer.name} bitirici dokunuş. İki sayı! 🏀`,
                target: null,
                color: 0xFF6600,
                messageType: "small-bold",
                messageSound: 1
            },

            {
                message: `Skor : ${scoreRed} vs ${scoreBlue + 2}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }

        ]
        );





    });

    test('10. mavi takım için ikilik, turnike ', () => {


        const touchedballX = -15.0;
        const touchedballY = -10.0;



        const yspeed = -10;
        const team = 2;

        const lasttouchedPlayer = {
            name: "Oyuncu",
            team: 2, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
            team: { M: 2 } // .team.M kullanan versiyonlar için yedek
        };

        const scoreRed = 0;
        const scoreBlue = 0;

        score = { scoreBlue, scoreRed };


        const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



        expect(result.announcement).toEqual([
            {
                message: `${lasttouchedPlayer.name} pota altından turnike! 💨`,
                target: null,
                color: 0x00E5FF,
                messageType: "small-bold",
                messageSound: 1
            },

            {
                message: `Skor : ${scoreRed} vs ${scoreBlue + 2}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }

        ]
        );





    });

    test('11. mavi takım için ikilik, yspeed sıfırsa ', () => {


        const touchedballX = -15.0;
        const touchedballY = -10.0;



        const yspeed = 0;
        const team = 2;

        const lasttouchedPlayer = {
            name: "Oyuncu",
            team: 2, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
            team: { M: 2 } // .team.M kullanan versiyonlar için yedek
        };

        const scoreRed = 0;
        const scoreBlue = 0;

        score = { scoreBlue, scoreRed };


        const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



        expect(result.announcement).toEqual([
            {
                message: `${lasttouchedPlayer.name} potayı sarsıyor!`,
                target: null,
                color: 0xFFFF00,
                messageType: "small-bold",
                messageSound: 1
            },

            {
                message: `Skor : ${scoreRed} vs ${scoreBlue + 2}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }

        ]
        );





    });

    test('12. mavi takım için ikilik, SMAÇ ', () => {


        const touchedballX = -15.0;
        const touchedballY = -10.0;



        const yspeed = 10.5;
        const team = 2;

        const lasttouchedPlayer = {
            name: "Oyuncu",
            team: 2, // Sayıyı atan takımın rengini veriyoruz ki hata çıkmasın
            team: { M: 2 } // .team.M kullanan versiyonlar için yedek
        };

        const scoreRed = 0;
        const scoreBlue = 0;

        score = { scoreBlue, scoreRed };


        const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



        expect(result.announcement).toEqual([
            {
                message: `${lasttouchedPlayer.name} SMAÇ! 🔥`,
                target: null,
                color: 0x4169E1,
                messageType: "small-bold",
                messageSound: 2
            },

            {
                message: `Skor : ${scoreRed} vs ${scoreBlue + 2}`,
                target: null,
                color: 0xEEEEEE,
                messageType: "normal",
                messageSound: 1
            }

        ]
        );





    });

    describe('-------HATALI SKORLAR:  ', () => {

        test('1. Kırmızı takım için hatalı üçlük', () => {


            const touchedballX = 15.0;
            const touchedballY = 10.0;



            const yspeed = 10;
            const team = 2;

            const lasttouchedPlayer = {
                name: "Oyuncu",
                team: 1,
                team: { M: 1 } // .team.M kullanan versiyonlar için yedek
            };

            const scoreRed = 0;
            const scoreBlue = 0;

            score = { scoreBlue, scoreRed };


            const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



            expect(result.announcement).toEqual([
                {
                    message: `${lasttouchedPlayer.name} HATALI DOKUNUŞ!! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "normal",
                    messageSound: 2
                },

                {
                    message: `KENDİ POTASINA ÜÇLÜK!!`,
                    target: null,
                    color: 0xE60000,
                    messageType: "small-bold",
                    messageSound: 2
                },
                {
                    message: `Skor : ${scoreRed} vs ${scoreBlue + 3}`,
                    target: null,
                    color: 0xEEEEEE,
                    messageType: "normal",
                    messageSound: 1
                }

            ]
            );





        });

        test('2. Kırmızı takım için hatalı ikilik, top yukarıdan gelirken ve potanın üstünden çekilen şutlar için', () => {


            const touchedballX = -15.0;
            const touchedballY = -72.0;



            const yspeed = 10;
            const team = 2;

            const lasttouchedPlayer = {
                name: "Oyuncu",
                team: 1,
                team: { M: 1 } // .team.M kullanan versiyonlar için yedek
            };

            const scoreRed = 0;
            const scoreBlue = 0;

            score = { scoreBlue, scoreRed };


            const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



            expect(result.announcement).toEqual([
                {
                    message: `${lasttouchedPlayer.name} HATALI DOKUNUŞ!! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "normal",
                    messageSound: 2
                },

                {
                    message: `KENDI POTASINA İKİ SAYI!!`,
                    target: null,
                    color: 0xFF6600,
                    messageType: "small-bold",
                    messageSound: 2
                },
                {
                    message: `Skor : ${scoreRed} vs ${scoreBlue + 2}`,
                    target: null,
                    color: 0xEEEEEE,
                    messageType: "normal",
                    messageSound: 1
                }

            ]
            );





        });

        test('3. Kırmızı takım için hatalı ikilik, top yukarıdan gelirken ve potanın altından çekilen şutlar için', () => {


            const touchedballX = -15.0;
            const touchedballY = -55.0;



            const yspeed = 10;
            const team = 2;

            const lasttouchedPlayer = {
                name: "Oyuncu",
                team: 1,
                team: { M: 1 } // .team.M kullanan versiyonlar için yedek
            };

            const scoreRed = 0;
            const scoreBlue = 0;

            score = { scoreBlue, scoreRed };


            const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



            expect(result.announcement).toEqual([
                {
                    message: `${lasttouchedPlayer.name} HATALI ŞUT!! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "normal",
                    messageSound: 2
                },

                {
                    message: `KENDI POTASINA İKİ SAYI!!`,
                    target: null,
                    color: 0xFF6600,
                    messageType: "small-bold",
                    messageSound: 2
                },
                {
                    message: `Skor : ${scoreRed} vs ${scoreBlue + 2}`,
                    target: null,
                    color: 0xEEEEEE,
                    messageType: "normal",
                    messageSound: 1
                }

            ]
            );





        });

        test('4. Kırmızı takım için hatalı ikilik, top aşağıdan gelirken ve potanın altından çekilen şutlar için', () => {


            const touchedballX = -15.0;
            const touchedballY = -55.0;



            const yspeed = -10;
            const team = 2;

            const lasttouchedPlayer = {
                name: "Oyuncu",
                team: 1,
                team: { M: 1 } // .team.M kullanan versiyonlar için yedek
            };

            const scoreRed = 0;
            const scoreBlue = 0;

            score = { scoreBlue, scoreRed };


            const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



            expect(result.announcement).toEqual([
                {
                    message: `${lasttouchedPlayer.name} HATALI TURNIKE!! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "normal",
                    messageSound: 2
                },

                {
                    message: `KENDI POTASINA İKİ SAYI!!`,
                    target: null,
                    color: 0xFF6600,
                    messageType: "small-bold",
                    messageSound: 2
                },
                {
                    message: `Skor : ${scoreRed} vs ${scoreBlue + 2}`,
                    target: null,
                    color: 0xEEEEEE,
                    messageType: "normal",
                    messageSound: 1
                }

            ]
            );





        });

        test('5. Kırmızı takım için hatalı ikilik, top düz gelirken çekilen şutlar için', () => {


            const touchedballX = -15.0;
            const touchedballY = -55.0;



            const yspeed = 0;
            const team = 2;

            const lasttouchedPlayer = {
                name: "Oyuncu",
                team: 1,
                team: { M: 1 } // .team.M kullanan versiyonlar için yedek
            };

            const scoreRed = 0;
            const scoreBlue = 0;

            score = { scoreBlue, scoreRed };


            const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



            expect(result.announcement).toEqual([
                {
                    message: `${lasttouchedPlayer.name} potayı sarsıyor! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "small-bold",
                    messageSound: 1
                },

                {
                    message: `KENDI POTASINA İKİ SAYI!!`,
                    target: null,
                    color: 0xFF6600,
                    messageType: "small-bold",
                    messageSound: 2
                },
                {
                    message: `Skor : ${scoreRed} vs ${scoreBlue + 2}`,
                    target: null,
                    color: 0xEEEEEE,
                    messageType: "normal",
                    messageSound: 1
                }

            ]
            );





        });




        test('6. Mavi takım için hatalı üçlük', () => {


            const touchedballX = -15.0;
            const touchedballY = -10.0;



            const yspeed = 10;
            const team = 1; // sayıyı atan takım

            const lasttouchedPlayer = {
                name: "Oyuncu",
                team: 2,   // son vuran oyuncunun takımı
                team: { M: 2 } // .team.M kullanan versiyonlar için yedek
            };

            const scoreRed = 0;
            const scoreBlue = 0;

            score = { scoreBlue, scoreRed };


            const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



            expect(result.announcement).toEqual([
                {
                    message: `${lasttouchedPlayer.name} HATALI DOKUNUŞ!! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "normal",
                    messageSound: 2
                },

                {
                    message: `KENDİ POTASINA ÜÇLÜK!!`,
                    target: null,
                    color: 0xE60000,
                    messageType: "small-bold",
                    messageSound: 2
                },
                {
                    message: `Skor : ${scoreRed + 3} vs ${scoreBlue}`,
                    target: null,
                    color: 0xEEEEEE,
                    messageType: "normal",
                    messageSound: 1
                }

            ]
            );





        });

        test('7. Mavi takım için hatalı ikilik, top yukarıdan gelirken ve potanın üstünden çekilen şutlar için', () => {


            const touchedballX = 15.0;
            const touchedballY = -72.0;



            const yspeed = 10;
            const team = 1;

            const lasttouchedPlayer = {
                name: "Oyuncu",
                team: 2,
                team: { M: 2 } // .team.M kullanan versiyonlar için yedek
            };

            const scoreRed = 0;
            const scoreBlue = 0;

            score = { scoreBlue, scoreRed };


            const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



            expect(result.announcement).toEqual([
                {
                    message: `${lasttouchedPlayer.name} HATALI DOKUNUŞ!! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "normal",
                    messageSound: 2
                },

                {
                    message: `KENDI POTASINA İKİ SAYI!!`,
                    target: null,
                    color: 0xFF6600,
                    messageType: "small-bold",
                    messageSound: 2
                },
                {
                    message: `Skor : ${scoreRed + 2} vs ${scoreBlue}`,
                    target: null,
                    color: 0xEEEEEE,
                    messageType: "normal",
                    messageSound: 1
                }

            ]
            );





        });

        test('8. Mavi takım için hatalı ikilik, top yukarıdan gelirken ve potanın altından çekilen şutlar için', () => {


            const touchedballX = 15.0;
            const touchedballY = 55.0;



            const yspeed = 10;
            const team = 1;

            const lasttouchedPlayer = {
                name: "Oyuncu",
                team: 2,
                team: { M: 2 } // .team.M kullanan versiyonlar için yedek
            };

            const scoreRed = 0;
            const scoreBlue = 0;

            score = { scoreBlue, scoreRed };


            const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



            expect(result.announcement).toEqual([
                {
                    message: `${lasttouchedPlayer.name} HATALI ŞUT!! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "normal",
                    messageSound: 2
                },

                {
                    message: `KENDI POTASINA İKİ SAYI!!`,
                    target: null,
                    color: 0xFF6600,
                    messageType: "small-bold",
                    messageSound: 2
                },
                {
                    message: `Skor : ${scoreRed + 2} vs ${scoreBlue}`,
                    target: null,
                    color: 0xEEEEEE,
                    messageType: "normal",
                    messageSound: 1
                }

            ]
            );





        });

        test('9. Mavi takım için hatalı ikilik, top aşağıdan gelirken ve potanın altından çekilen şutlar için', () => {


            const touchedballX = 15.0;
            const touchedballY = 55.0;



            const yspeed = -10;
            const team = 1;

            const lasttouchedPlayer = {
                name: "Oyuncu",
                team: 2,
                team: { M: 2 } // .team.M kullanan versiyonlar için yedek
            };

            const scoreRed = 0;
            const scoreBlue = 0;

            score = { scoreBlue, scoreRed };


            const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



            expect(result.announcement).toEqual([
                {
                    message: `${lasttouchedPlayer.name} HATALI TURNIKE!! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "normal",
                    messageSound: 2
                },

                {
                    message: `KENDI POTASINA İKİ SAYI!!`,
                    target: null,
                    color: 0xFF6600,
                    messageType: "small-bold",
                    messageSound: 2
                },
                {
                    message: `Skor : ${scoreRed + 2} vs ${scoreBlue}`,
                    target: null,
                    color: 0xEEEEEE,
                    messageType: "normal",
                    messageSound: 1
                }

            ]
            );





        });

        test('10. Mavi takım için hatalı ikilik, top düz gelirken çekilen şutlar için', () => {


            const touchedballX = 15.0;
            const touchedballY = 55.0;



            const yspeed = 0;
            const team = 1;

            const lasttouchedPlayer = {
                name: "Oyuncu",
                team: 2,
                team: { M: 2 } // .team.M kullanan versiyonlar için yedek
            };

            const scoreRed = 0;
            const scoreBlue = 0;

            score = { scoreBlue, scoreRed };


            const result = scoreCheck(touchedballX, touchedballY, yspeed, team, lasttouchedPlayer, score)



            expect(result.announcement).toEqual([
                {
                    message: `${lasttouchedPlayer.name} potayı sarsıyor! ❌❌❌`,
                    target: null,
                    color: 0xFF007F,
                    messageType: "small-bold",
                    messageSound: 1
                },

                {
                    message: `KENDI POTASINA İKİ SAYI!!`,
                    target: null,
                    color: 0xFF6600,
                    messageType: "small-bold",
                    messageSound: 2
                },
                {
                    message: `Skor : ${scoreRed + 2} vs ${scoreBlue}`,
                    target: null,
                    color: 0xEEEEEE,
                    messageType: "normal",
                    messageSound: 1
                }

            ]
            );





        });



    });



});

