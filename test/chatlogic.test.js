const {hasBannedWord} = require('../services/chatLogic')

describe('hasBannedWord testleri', () => {



    test('1. Küfür varsa true döner ', () => {
        const text = "oruspu";

        const result = hasBannedWord(text);

        expect(result).toBe(true);

    });

    test('2. Küfür varsa true döner ', () => {
        const text = "gerizekalı";

        const result = hasBannedWord(text);

        expect(result).toBe(true);

    });

    test('3. Küfür yoksa false döner ', () => {
        const text = "naber";

        const result = hasBannedWord(text);

        expect(result).toBe(false);

    });

    test('4. Boş mesaj false döner ', () => {
        const text = "";

        const result = hasBannedWord(text);

        expect(result).toBe(false);

    });

    test('5. "değişik" mesajı false döner ', () => {
        const text = "değişik";

        const result = hasBannedWord(text);

        expect(result).toBe(false);

    });

});