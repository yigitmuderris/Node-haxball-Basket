// gitPush.js
const simpleGit = require('simple-git');
const path = require('path');

const git = simpleGit(); // proje root klasöründe çalışacak

async function gitPushLogs() {
  try {
    const logDir = path.join(__dirname, "logs");
    await git.add(logDir);
    const status = await git.status();

    if (status.staged.length === 0) {
      console.log("Push için yeni log yok.");
      return;
    }

    await git.commit("Auto log update");
    await git.push("origin", "main"); // branch adını değiştir
  } catch (err) {
    console.error("Git hatası:", err);
  }
}

module.exports = { gitPushLogs };
