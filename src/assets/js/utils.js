const { ipcRenderer } = require("electron");
const fs = require("fs");
const pkg = require("../package.json");
const { Status } = require("minecraft-java-core");

import config from "./utils/config.js";
import database from "./utils/database.js";
import logger from "./utils/logger.js";
import popup from "./utils/popup.js";
import { skin2D } from "./utils/skin.js";
import slider from "./utils/slider.js";
import supabase from "./utils/supabase.js";

async function setBackground() {
    let body = document.body;
    body.className = "dark global";
    let background;
    if (fs.existsSync(`${__dirname}/assets/images`)) {
        background = `linear-gradient(#00000080, #00000080), url(./assets/images/background.png)`;
    }
    body.style.backgroundImage = background ? background : "#000";
    body.style.backgroundSize = "cover";
}

async function changePanel(id) {
    let panel = document.querySelector(`.${id}`);
    let active = document.querySelector(`.panels > .active`);
    if (active) active.classList.remove("active");
    panel.classList.add("active");
}

async function appdata() {
    return await ipcRenderer.invoke("appData").then((path) => path);
}

async function addAccount(data) {
    let skin = false;
    if (data?.profile?.skins[0]?.base64)
        skin = await new skin2D().createHeadTexture(
            data.profile.skins[0].base64,
        );
    // Le changement de skin passe par l'API Mojang (PUT/DELETE
    // minecraftservices.com/.../skins), qui exige un access_token Microsoft
    // valide : impossible pour les comptes hors-ligne, qui n'en ont pas.
    let isPremium = data.meta?.type === "Xbox";
    let div = document.createElement("div");
    div.classList.add("account");
    div.id = data.ID;
    div.innerHTML = `
        <div class="profile-image" ${skin ? 'style="background-image: url(' + skin + ');"' : ""}></div>
        <div class="profile-infos">
            <div class="profile-pseudo">${data.name}</div>
            <div class="profile-uuid">${data.uuid}</div>
        </div>
        ${
            isPremium
                ? `<div class="skin-profile" id="${data.ID}" title="Gérer le skin">
                <i class="fa-solid fa-shirt skin-profile-icon"></i>
            </div>`
                : ""
        }
        <div class="delete-profile" id="${data.ID}">
            <div class="icon-account-delete delete-profile-icon">
                <i class="fa-solid fa-trash"></i>
            </div>
        </div>
    `;
    return document.querySelector(".accounts-list").appendChild(div);
}

async function accountSelect(data) {
    let account = document.getElementById(`${data.ID}`);
    let activeAccount = document.querySelector(".account-select");

    if (activeAccount) activeAccount.classList.toggle("account-select");
    account.classList.add("account-select");
    if (data?.profile?.skins[0]?.base64)
        headplayer(data.profile.skins[0].base64);

    let online = data.meta?.type === "Xbox";
    let nameEl = document.querySelector(".account-widget .account-widget-name");
    let statusEl = document.querySelector(
        ".account-widget .account-widget-status",
    );
    if (nameEl) nameEl.textContent = data.name;
    if (statusEl) {
        statusEl.textContent = online ? "ONLINE" : "OFFLINE";
        statusEl.classList.toggle("online", online);
    }
    renderPlaytime(data);
    window.dispatchEvent(new CustomEvent("account:changed", { detail: data }));
}

async function renderPlaytime(data) {
    let playtimeEl = document.querySelector(".account-widget-playtime");
    if (!playtimeEl) return;
    playtimeEl.textContent = "";

    try {
        let { data: result } = await supabase.functions.invoke(
            "get-playtime",
            {
                body: {
                    minecraft_uuid: data?.uuid,
                    username: data?.name,
                },
            },
        );
        let totalSeconds = result?.total_seconds || 0;
        if (!totalSeconds) return;

        let hours = Math.floor(totalSeconds / 3600);
        let minutes = Math.floor((totalSeconds % 3600) / 60);
        let text =
            hours > 0
                ? `${hours}h${minutes.toString().padStart(2, "0")} jouées cette semaine`
                : `${minutes} min jouées cette semaine`;
        playtimeEl.textContent = text;
    } catch (err) {
        console.error("Impossible de récupérer le temps de jeu :", err);
    }
}

async function headplayer(skinBase64) {
    let skin = await new skin2D().createHeadTexture(skinBase64);
    document.querySelector(".player-head").style.backgroundImage =
        `url(${skin})`;
}

let statusInterval = null;

async function setStatus(opt) {
    let badge = document.querySelector(".server-status-badge");
    if (!badge) return;

    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }

    if (!opt?.ip) {
        badge.style.display = "none";
        return;
    }

    let refresh = async () => {
        try {
            let status = await new Status(opt.ip, opt.port || 25565).getStatus();
            badge.style.display = "flex";
            badge.innerHTML = status.error
                ? `<span class="status-dot"></span> Serveur hors ligne`
                : `<span class="status-dot online"></span> ${status.playersConnect}/${status.playersMax} joueurs • ${status.ms}ms`;
        } catch (err) {
            badge.style.display = "flex";
            badge.innerHTML = `<span class="status-dot"></span> Serveur hors ligne`;
        }
    };

    await refresh();
    statusInterval = setInterval(refresh, 30000);
}

export {
    accountSelect as accountSelect,
    addAccount as addAccount,
    appdata as appdata,
    changePanel as changePanel,
    config as config,
    database as database,
    logger as logger,
    pkg as pkg,
    popup as popup,
    renderPlaytime as renderPlaytime,
    setBackground as setBackground,
    setStatus as setStatus,
    skin2D as skin2D,
    slider as Slider
};
