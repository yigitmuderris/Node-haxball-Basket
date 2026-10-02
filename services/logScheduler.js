const cron = require("node-cron");
const { gitPushLogs } = require("./gitPush");
const { logGit } = require("./logLogic");

cron.schedule("0 0 * * *", async () => {
    try {
        const pushed = await gitPushLogs();

        logGit(
            pushed
                ? "Otomatik GitHub push başarılı."
                : "Push edilecek yeni log yok."
        );
    } catch (err) {
        logGit(`Otomatik GitHub push başarısız: ${err.message}`);
    }
}, {
    timezone: "Europe/Berlin"
});

console.log("Log scheduler başlatıldı.");