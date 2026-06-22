const { app, ipcMain, screen } = require("electron");
const { Microsoft } = require("minecraft-java-core");
const { autoUpdater } = require("electron-updater");

const path = require("path");
const fs = require("fs");

const UpdateWindow = require("./assets/js/windows/updateWindow.js");
const MainWindow = require("./assets/js/windows/mainWindow.js");

// Récupération de l'environement pour savoir si le script est lancer en mode dev ou non.
let dev = !app.isPackaged;
console.log(dev);

// Si c'est le cas on change le répértoire de Electron dans le projet (Non Build, non export)
if (dev) {
    let appPath = path.resolve("./data/Launcher");
    let appdata = path.resolve("./data");
    if (!fs.existsSync(appPath)) {
        fs.mkdirSync(appPath, { recursive: true });
    }
    if (!fs.existsSync(appdata)) {
        fs.mkdirSync(appdata, { recursive: true });
    }
    app.setPath("userData", appPath);
    app.setPath("appData", appdata);
}

/**
 * Ici on vérifie si il y a déjà une instance du Launcher d'executer si c'est le cas alors on quitte l'instance actuelle.
 * De cette manière on évite de gaspiller des performences en supprimant le multi-instance.
 */
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.whenReady().then(() => {
        if (dev) {
            return MainWindow.createWindow();
        }
        UpdateWindow.createWindow();
    });
}

ipcMain.on("main-window-open", () => MainWindow.createWindow());
ipcMain.on("main-window-dev-tools", () =>
    MainWindow.getWindow().webContents.openDevTools({ mode: "detach" }),
);
ipcMain.on("main-window-dev-tools-close", () =>
    MainWindow.getWindow().webContents.closeDevTools(),
);
ipcMain.on("main-window-close", () => MainWindow.destroyWindow());
ipcMain.on("main-window-reload", () => MainWindow.getWindow().reload());
ipcMain.on("main-window-progress", (event, options) =>
    MainWindow.getWindow().setProgressBar(options.progress / options.size),
);
ipcMain.on("main-window-progress-reset", () =>
    MainWindow.getWindow().setProgressBar(-1),
);
ipcMain.on("main-window-progress-load", () =>
    MainWindow.getWindow().setProgressBar(2),
);
ipcMain.on("main-window-minimize", () => MainWindow.getWindow().minimize());

ipcMain.on("update-window-close", () => UpdateWindow.destroyWindow());
ipcMain.on("update-window-dev-tools", () =>
    UpdateWindow.getWindow().webContents.openDevTools({ mode: "detach" }),
);
ipcMain.on("update-window-progress", (event, options) =>
    UpdateWindow.getWindow().setProgressBar(options.progress / options.size),
);
ipcMain.on("update-window-progress-reset", () =>
    UpdateWindow.getWindow().setProgressBar(-1),
);
ipcMain.on("update-window-progress-load", () =>
    UpdateWindow.getWindow().setProgressBar(2),
);

ipcMain.handle("path-user-data", (_e) => app.getPath("userData"));
ipcMain.handle("appData", (_e) => app.getPath("appData"));
ipcMain.handle("is-dev", (_e) => dev);
ipcMain.handle("get-screen-size", (_e) =>
    screen.getPrimaryDisplay().workAreaSize,
);

ipcMain.on("main-window-maximize", () => {
    if (MainWindow.getWindow().isMaximized()) {
        MainWindow.getWindow().unmaximize();
    } else {
        MainWindow.getWindow().maximize();
    }
});

ipcMain.on("main-window-hide", () => MainWindow.getWindow().hide());
ipcMain.on("main-window-show", () => MainWindow.getWindow().show());

ipcMain.handle("Microsoft-window", async (_, client_id) => {
    return await new Microsoft(client_id).getAuth();
});

app.on("window-all-closed", () => app.quit());

autoUpdater.autoDownload = false;
autoUpdater.forceDevUpdateConfig = dev;

ipcMain.handle("update-app", async () => {
    return await new Promise(async (resolve, reject) => {
        autoUpdater
            .checkForUpdates()
            .then((res) => {
                resolve(res);
            })
            .catch((error) => {
                reject({
                    error: true,
                    message: error,
                });
            });
    });
});

autoUpdater.on("update-available", () => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send("updateAvailable");
});

ipcMain.on("start-update", () => {
    autoUpdater.downloadUpdate();
});

autoUpdater.on("update-not-available", () => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send("update-not-available");
});

autoUpdater.on("update-downloaded", () => {
    autoUpdater.quitAndInstall();
});

autoUpdater.on("download-progress", (progress) => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow)
        updateWindow.webContents.send("download-progress", progress);
});

autoUpdater.on("error", (err) => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send("error", err);
});