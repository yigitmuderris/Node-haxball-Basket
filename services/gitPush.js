const { simpleGit } = require("simple-git");

const git = simpleGit({ baseDir: "/app" });

async function gitPushLogs() {
    try {
        await git.add("logs");

        const status = await git.status();

        if (status.staged.length === 0) {
            console.log("Push için yeni log yok.");
            return false;
        }

        await git.commit("Auto log update");
        await git.push("origin", "main");

        return true;
    } catch (err) {
        console.error("Git hatası:", err);
        return false;
    }
}

module.exports = { gitPushLogs };
