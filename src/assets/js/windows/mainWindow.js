const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");
const pkg = require("../../../../package.json");
let dev = process.env.DEV_TOOL === "open";
/** @type {BrowserWindow|undefined} */
let mainWindow = undefined;

// Fonction de récupération de la fenetre
function getWindow() {
    return mainWindow;
}

// Fonction de destruction de la fenetre
function destroyWindow() {
    if (!mainWindow) {
        return;
    }
    app.quit();
    mainWindow = undefined;
}

// Fonction de création de la fenetre
function createWindow() {
    destroyWindow();
    mainWindow = new BrowserWindow({
        title: pkg.productName,
        width: 1280,
        height: 720,
        minWidth: 980,
        minHeight: 550,
        resizable: true,
        icon: `src/assets/images/icon.png`,
        frame: false,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(`${app.getAppPath()}/src/launcher.html`));
    mainWindow.once("ready-to-show", () => {
        if (mainWindow) {
            if (dev) {
                mainWindow.webContents.openDevTools({ mode: "detach" });
            }
            mainWindow.show();
        }
    });
}

module.exports = {
    getWindow,
    destroyWindow,
    createWindow,
};