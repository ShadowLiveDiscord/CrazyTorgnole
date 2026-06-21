const { ipcRenderer } = require("electron");
const fs = require("fs");
const pkg = require("../package.json");

import config from "./utils/config.js";
import database from "./utils/database.js";
import logger from "./utils/logger.js";
import popup from "./utils/popup.js";
import { skin2D } from "./utils/skin.js";
import slider from "./utils/slider.js";

async function setBackground(theme) {
    if (typeof theme === "undefined") {
        let databaseLauncher = new database();
        let configClient = await databaseLauncher.readData("configClient");
        theme = configClient?.launcher_config?.theme || "auto";
        theme = await ipcRenderer
            .invoke("is-dark-theme", theme)
            .then((res) => res);
    }
    let background;
    let body = document.body;
    body.className = theme ? "dark global" : "light global";
    if (fs.existsSync(`${__dirname}/assets/images`)) {
        background = `linear-gradient(#00000080, #00000080), url(./assets/images/background.png)`;
    }
    body.style.backgroundImage = background
        ? background
        : theme
          ? "#000"
          : "#fff";
    body.style.backgroundSize = "cover";
}

async function changePanel(id) {
    let panel = document.querySelector(`.${id}`);
    let active = document.querySelector(`.active`);
    if (active) active.classList.toggle("active");
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
    let div = document.createElement("div");
    div.classList.add("account");
    div.id = data.ID;
    div.innerHTML = `
        <div class="profile-image" ${skin ? 'style="background-image: url(' + skin + ');"' : ""}></div>
        <div class="profile-infos">
            <div class="profile-pseudo">${data.name}</div>
            <div class="profile-uuid">${data.uuid}</div>
        </div>
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
}

async function headplayer(skinBase64) {
    let skin = await new skin2D().createHeadTexture(skinBase64);
    document.querySelector(".player-head").style.backgroundImage =
        `url(${skin})`;
}

async function setStatus(opt) {
    // L'UI de statut serveur a été retirée du panneau d'accueil ; conservé
    // comme no-op pour ne pas casser les appelants (login.js, home.js).
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
    setBackground as setBackground,
    setStatus as setStatus,
    skin2D as skin2D,
    slider as Slider
};
