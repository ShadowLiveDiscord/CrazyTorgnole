// Discord Rich Presence — TerraNova Launcher
//
// Prérequis (une seule fois) :
//   1. Créer une application sur https://discord.com/developers/applications
//   2. Copier l'Application ID et le coller dans CLIENT_ID ci-dessous
//   3. Dans "Rich Presence > Art Assets", uploader une image nommée "terranova_logo"
//
// Si CLIENT_ID n'est pas renseigné, le module est silencieusement désactivé.

const CLIENT_ID = "VOTRE_DISCORD_APP_ID"; // ← Remplacer par ton Application ID Discord

let rpc = null;
let ready = false;

async function initDiscord() {
    if (CLIENT_ID === "VOTRE_DISCORD_APP_ID") {
        console.log("[Discord RPC] Non configuré — ajoute ton Application ID dans discord.js");
        return;
    }
    try {
        const DiscordRPC = require("discord-rpc");
        DiscordRPC.register(CLIENT_ID);
        rpc = new DiscordRPC.Client({ transport: "ipc" });
        rpc.on("ready", () => {
            ready = true;
            setPresenceLauncher();
            console.log("[Discord RPC] Connecté");
        });
        rpc.login({ clientId: CLIENT_ID }).catch(e => {
            console.warn("[Discord RPC] Discord non disponible :", e.message);
        });
    } catch (e) {
        console.warn("[Discord RPC] Erreur init :", e.message);
    }
}

function setPresenceLauncher() {
    if (!rpc || !ready) return;
    try {
        rpc.setActivity({
            details: "Au launcher",
            state: "TerraNova",
            largeImageKey: "terranova_logo",
            largeImageText: "TerraNova Launcher",
            instance: false,
        });
    } catch {}
}

function setPresenceInGame(playerCount) {
    if (!rpc || !ready) return;
    try {
        rpc.setActivity({
            details: "En jeu sur TerraNova",
            state: playerCount != null ? `${playerCount} joueurs en ligne` : "En jeu",
            largeImageKey: "terranova_logo",
            largeImageText: "TerraNova",
            startTimestamp: new Date(),
            instance: true,
        });
    } catch {}
}

function destroyDiscord() {
    if (rpc) { try { rpc.destroy(); } catch {} rpc = null; ready = false; }
}

module.exports = { initDiscord, setPresenceLauncher, setPresenceInGame, destroyDiscord };
