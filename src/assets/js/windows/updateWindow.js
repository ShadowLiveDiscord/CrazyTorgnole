const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");
let dev = process.env.DEV_TOOL === "open";
/** @type {BrowserWindow|undefined} */
let updateWindow = undefined;

// Fonction de récupération de la fenetre
function getWindow() {
    return updateWindow;
}

// Fonction de destruction de la fenetre
function destroyWindow() {
    if (!updateWindow) {
        return;
    }
    updateWindow.close();
    updateWindow = undefined;
}

// Fonction de création de la fenetre
function createWindow() {
    destroyWindow();
    updateWindow = new BrowserWindow({
        title: "Mise à jour",
        width: 400,
        height: 500,
        resizable: false,
        icon: `src/assets/images/icon.png`,
        frame: false,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    Menu.setApplicationMenu(null);
    updateWindow.setMenuBarVisibility(false);
    updateWindow.loadFile(path.join(`${app.getAppPath()}/src/index.html`));
    updateWindow.once("ready-to-show", () => {
        if (updateWindow) {
            if (dev) {
                updateWindow.webContents.openDevTools({ mode: "detach" });
            }
            updateWindow.show();
        }
    });
}

module.exports = {
    getWindow,
    destroyWindow,
    createWindow,
};