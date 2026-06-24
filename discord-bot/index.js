require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 5 * 60 * 1000;

const STATE_FILE = path.join(__dirname, "state.json");

if (!TOKEN || !CHANNEL_ID || !OWNER || !REPO) {
    console.error(
        "Configuration manquante : vérifie DISCORD_BOT_TOKEN, CHANNEL_ID, GITHUB_OWNER et GITHUB_REPO dans .env",
    );
    process.exit(1);
}

function readState() {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    } catch {
        return { lastTag: null };
    }
}

function writeState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function fetchLatestRelease() {
    const res = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
        { headers: { Accept: "application/vnd.github+json" } },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub API ${res.status} : ${await res.text()}`);
    return res.json();
}

function buildEmbed(release) {
    let body = release.body?.trim() || "Aucune note de version fournie.";
    if (body.length > 3500) body = body.slice(0, 3500) + "…";

    return new EmbedBuilder()
        .setColor(0x7b2ff7)
        .setTitle(`🚀 Nebula Launcher ${release.tag_name}`)
        .setURL(release.html_url)
        .setDescription(body)
        .setTimestamp(new Date(release.published_at))
        .setFooter({ text: "Nebula Launcher — Patch notes" });
}

async function checkForNewRelease(client) {
    try {
        const release = await fetchLatestRelease();
        if (!release || release.draft) return;

        const state = readState();
        if (state.lastTag === release.tag_name) return;

        const channel = await client.channels.fetch(CHANNEL_ID);
        await channel.send({ embeds: [buildEmbed(release)] });

        writeState({ lastTag: release.tag_name });
        console.log(`Patch note publiée pour ${release.tag_name}`);
    } catch (err) {
        console.error("Erreur lors de la vérification des releases :", err);
    }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
    checkForNewRelease(client);
    setInterval(() => checkForNewRelease(client), POLL_INTERVAL_MS);
});

client.login(TOKEN);
