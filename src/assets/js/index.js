const { ipcRenderer } = require("electron");
import { config } from "./utils.js";
const os = require("os");

class Splash {
    constructor() {
        this.splash = document.querySelector(".splash");
        this.splashMessage = document.querySelector(".splash-message");
        this.splashAuthor = document.querySelector(".splash-author");
        this.message = document.querySelector(".message");
        this.progressLoader = document.querySelector(".progress-loader");
        this.progress = document.querySelector(".progress-loader .progress");
        document.addEventListener("DOMContentLoaded", async () => {
            document.body.className = "dark global";
            if (process.platform === "win32")
                ipcRenderer.send("update-window-progress-load");
            this.startAnimation();
        });
    }

    async startAnimation() {
        let splashes = [
            { message: "Idée de nouveau mods ?\n", author: "ShadowLive" },
            {
                message: "Bienvenue sur mon Launcher !",
                author: "ShadowLive",
            },
        ];

        let splash = splashes[Math.floor(Math.random() * splashes.length)];
        this.splashMessage.textContent = splash.message;
        this.splashAuthor.children[0].textContent = "@" + splash.author;
        document.querySelector("#splash").style.display = "flex";
        this.splash.classList.add("opacity");
        this.splashMessage.classList.add("opacity");
        this.splashAuthor.classList.add("opacity");
        this.message.classList.add("opacity");
        this.checkUpdate();
    }

    async checkUpdate() {
        this.setStatus("Recherche de mise à jour...");

        ipcRenderer
            .invoke("update-app")
            .then()
            .catch((err) => {
                console.warn(
                    "Recherche de mise à jour impossible (pas de serveur de mise à jour configuré), lancement direct :",
                    err,
                );
                return this.maintenanceCheck();
            });

        ipcRenderer.on("updateAvailable", () => {
            this.setStatus("Mise à jour disponible !");
            if (os.platform() === "win32") {
                this.togglePropgress();
                ipcRenderer.send("start-update");
            } else {
                return this.downloadUpdate();
            }
        });

        ipcRenderer.on("error", (_e, progress) => {
            ipcRenderer.send("update-window-progress", {
                progress: progress.transferred,
                size: progress.total,
            });
            this.setProgress(progress.transferred, progress.total);
        });

        ipcRenderer.on("update-not-available", () => {
            console.error("Mise à jour non disponible");
            this.maintenanceCheck();
        });
    }

    async downloadUpdate() {
        //
    }

    maintenanceCheck() {
        config.GetConfig().then((res) => {
            if (res.isClosed) return this.shutdown(res.closed_message);
            console.log("Launch");
            this.startLauncher();
        }).catch(e => {
            console.error(e);
            return this.shutdown("Aucune connexion internet détectée,<br>veuillez réessayer ultétieurement.<br><br>Si le problème perciste veuillez contacter <a href=\"https://github.com/Mewax07\">Mewax07<a>")
        });
    }

    startLauncher() {
        this.setStatus("Démarrage du launcher");
        ipcRenderer.send("main-window-open");
        ipcRenderer.send("update-window-close");
    }

    shutdown(text) {
        this.setStatus(`${text}<br>Arrêt dans 5s`);
        let i = 4;
        let interval = setInterval(() => {
            if (i < 0) {
                clearInterval(interval);
                return ipcRenderer.send("update-window-close");
            }
            this.setStatus(`${text}<br>Arrêt dans ${i--}s`);
        }, 1000);
    }

    setStatus(text) {
        this.message.innerHTML = text;
    }

    togglePropgress() {
        if (this.progressLoader.classList.toggle("show")) this.setProgress(0, 1);
    }

    setProgress(value = 0, max = 1) {
        value = Number(value);
        max = Number(max);

        if (!isFinite(value) || !isFinite(max) || max <= 0) {
            console.warn("Progress non valide :", { value, max });
            return;
        }

        this.progress.style.width = `${Math.min(100, (value / max) * 100)}%`;
    }
}

document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey && e.shiftKey && e.keyCode == 73) || e.keyCode == 123) {
        ipcRenderer.send("update-window-dev-tools");
    }
});

new Splash();