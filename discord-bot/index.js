require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    SlashCommandBuilder,
    ActivityType,
} = require("discord.js");

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 5 * 60 * 1000;
const ANNOUNCE_ROLE_ID = process.env.ANNOUNCE_ROLE_ID || null;

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

async function fetchReleaseByTag(tag) {
    const res = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${encodeURIComponent(tag)}`,
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

async function updatePresence(client, release) {
    if (!release) return;
    client.user.setPresence({
        activities: [
            { name: `la version ${release.tag_name}`, type: ActivityType.Watching },
        ],
        status: "online",
    });
}

async function checkForNewRelease(client, { announce = true } = {}) {
    try {
        const release = await fetchLatestRelease();
        if (!release || release.draft) return;

        await updatePresence(client, release);

        const state = readState();
        if (state.lastTag === release.tag_name) return;

        if (announce) {
            const channel = await client.channels.fetch(CHANNEL_ID);
            const content = ANNOUNCE_ROLE_ID
                ? `<@&${ANNOUNCE_ROLE_ID}> Nouvelle mise à jour disponible !`
                : undefined;
            await channel.send({ content, embeds: [buildEmbed(release)] });
            console.log(`Patch note publiée pour ${release.tag_name}`);
        }

        writeState({ lastTag: release.tag_name });
    } catch (err) {
        console.error("Erreur lors de la vérification des releases :", err);
    }
}

const versionCommand = new SlashCommandBuilder()
    .setName("version")
    .setDescription("Affiche la dernière version disponible de Nebula Launcher");

const patchNoteCommand = new SlashCommandBuilder()
    .setName("patch_note")
    .setDescription("Affiche les notes de version d'une release de Nebula Launcher")
    .addStringOption((option) =>
        option
            .setName("version")
            .setDescription("Version à afficher (ex: 1.0.26). Laisse vide pour la dernière.")
            .setRequired(false),
    );

async function registerCommands(client) {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const guild = channel.guild;
    if (!guild) return;
    await guild.commands.create(versionCommand);
    await guild.commands.create(patchNoteCommand);
    console.log(`Commandes /version et /patch_note enregistrées sur ${guild.name}`);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);

    await registerCommands(client);

    // Au démarrage : met à jour le statut sans réannoncer une version déjà connue.
    await checkForNewRelease(client, { announce: false });
    const state = readState();
    if (!state.lastTag) {
        const release = await fetchLatestRelease();
        if (release) writeState({ lastTag: release.tag_name });
    }

    setInterval(() => checkForNewRelease(client), POLL_INTERVAL_MS);
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "version") {
        await interaction.deferReply();
        try {
            const release = await fetchLatestRelease();
            if (!release) {
                await interaction.editReply("Aucune release publiée pour le moment.");
                return;
            }
            await interaction.editReply({ embeds: [buildEmbed(release)] });
        } catch (err) {
            console.error("Erreur /version :", err);
            await interaction.editReply("Impossible de récupérer la dernière version pour le moment.");
        }
        return;
    }

    if (interaction.commandName === "patch_note") {
        await interaction.deferReply();
        try {
            const requested = interaction.options.getString("version");

            if (!requested) {
                const release = await fetchLatestRelease();
                if (!release) {
                    await interaction.editReply("Aucune release publiée pour le moment.");
                    return;
                }
                await interaction.editReply({ embeds: [buildEmbed(release)] });
                return;
            }

            const tag = requested.startsWith("v") ? requested : `v${requested}`;
            let release = await fetchReleaseByTag(tag);
            if (!release) release = await fetchReleaseByTag(requested);

            if (!release) {
                await interaction.editReply(
                    `Aucune release trouvée pour "${requested}". Vérifie le numéro de version.`,
                );
                return;
            }

            await interaction.editReply({ embeds: [buildEmbed(release)] });
        } catch (err) {
            console.error("Erreur /patch_note :", err);
            await interaction.editReply("Impossible de récupérer cette release pour le moment.");
        }
    }
});

client.login(TOKEN);
