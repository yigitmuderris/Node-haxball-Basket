// log.js
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const { gitPushLogs } = require("./gitPush");
const { log } = require("console");


const LOG_DIR = path.join(__dirname, "logs");

// Logs klasörü yoksa oluştur
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);


function formatTimestamp() {
    const now = new Date();
    // Almanya saati
    const options = { timeZone: "Europe/Berlin", hour12: false };
    const date = now.toLocaleDateString("de-DE", options); // DD.MM.YYYY
    const time = now.toLocaleTimeString("de-DE", options); // HH:MM:SS
    return `[${date} ${time}]`;
}

// Günlük dosya ismi oluştur (YYYY-MM-DD formatında)
function getDailyLogFilename(type) {
    const now = new Date();
    const options = { timeZone: "Europe/Berlin" };

    const year = now.toLocaleString("de-DE", { year: "numeric", ...options });
    const month = now.toLocaleString("de-DE", { month: "2-digit", ...options });
    const day = now.toLocaleString("de-DE", { day: "2-digit", ...options });

    return `${type}-${year}-${month}-${day}.txt`;
}



function write(message, type = "general") {
    const timestamp = formatTimestamp();
    const filename = getDailyLogFilename(type);

    // Yıl/ay'ı dosya adından alıyoruz (ör. join-2026-06-01.txt -> 2026/06)
    const match = filename.match(/(\d{4})-(\d{2})-\d{2}\.txt$/);
    const dir = match
        ? path.join(LOG_DIR, match[1], match[2], type)
        : path.join(LOG_DIR, type);
    fs.mkdirSync(dir, { recursive: true }); // klasör yoksa oluşturur

    const filePath = path.join(dir, filename);
    fs.appendFileSync(filePath, `${timestamp} ${message}\n`);

}

cron.schedule("0 0 * * *", async () => {
    try {
        const pushed = await gitPushLogs();
        logGit(pushed ? "Otomatik push başarılı." : "Push edilecek yeni log yok.");
    } catch (err) {
        logGit(`Otomatik push başarısız: ${err.message}`);
    }
}, { timezone: "Europe/Berlin" });

// Özel fonksiyonlar
function logChat(message) {
    write(message, "chat");
}

function logJoin(message) {
    write(message, "join");
}

function logLeave(message) {
    write(message, "leave");
}

function logGame(message) {
    write(message, "game");
}

function logGit(message) {
    write(message, "git");
}

function logError(message) {
    write(message, "error");
}

module.exports = {
    write,
    logChat,
    logJoin,
    logLeave,
    logGame,
    logError,
    logGit
};
