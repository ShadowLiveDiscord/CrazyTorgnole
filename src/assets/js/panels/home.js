import {
    accountSelect,
    appdata,
    changePanel,
    config,
    database,
    logger,
    pkg,
    popup,
    renderPlaytime,
    setStatus,
    skin2D,
} from "../utils.js";
import supabase from "../utils/supabase.js";

const { Launch } = require("minecraft-java-core");
const { shell, ipcRenderer } = require("electron");

const MAX_ACCOUNTS = 3;

// Toujours protégés de la suppression au "verify", quelle que soit la config
// de l'instance : sans ça, minecraft-java-core efface tout fichier du dossier
// d'instance absent du manifeste officiel, y compris les sauvegardes du joueur.
const ALWAYS_IGNORED = [
    "saves",
    "screenshots",
    "logs",
    "crash-reports",
    "options.txt",
    "servers.dat",
];

class Home {
    static id = "home";

    async init(config) {
        this.config = config;
        this.db = new database();
        document.querySelector(".launcher-version").textContent =
            `v${pkg.version}`;
        this.socialLick();
        this.instancesSelect();
        this.accountWidget();
        this.renderActiveVersion();
        window.addEventListener("home:refresh", () =>
            this.renderActiveVersion(),
        );
        document
            .querySelector(".settings-btn")
            .addEventListener("click", (e) => changePanel("settings"));
    }

    async renderActiveVersion() {
        let label = document.querySelector(".active-version-label");
        if (!label) return;
        let configClient = await this.db.readData("configClient");
        let instances = await config.getInstanceList();
        let active =
            instances.find((i) => i.name == configClient?.instance_selct) ||
            instances.find((i) => !i.custom);

        let instanceSelectBTN = document.querySelector(".instance-select");
        let playInstanceBTN = document.querySelector(".play-instance");
        if (instanceSelectBTN && playInstanceBTN) {
            if (instances.length > 1) {
                instanceSelectBTN.style.display = "";
                playInstanceBTN.style.paddingRight = "";
            } else {
                instanceSelectBTN.style.display = "none";
                playInstanceBTN.style.paddingRight = "0";
            }
        }

        if (!active) return;
        label.textContent = `${active.loadder.minecraft_version}${
            active.loadder.loadder_type !== "none"
                ? ` • ${active.loadder.loadder_type} ${active.loadder.loadder_version}`
                : " • Vanilla"
        }`;
    }

    accountWidget() {
        let widget = document.querySelector(".account-widget");
        let dropdown = document.querySelector(".account-dropdown");

        widget.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("show");
            if (dropdown.classList.contains("show"))
                this.renderAccountDropdown();
        });

        document.addEventListener("click", (e) => {
            if (!widget.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove("show");
            }
        });
    }

    async renderAccountDropdown() {
        let dropdown = document.querySelector(".account-dropdown");
        let configClient = await this.db.readData("configClient");
        let accounts = await this.db.readAllData("accounts");
        let selected = configClient?.account_selected;

        dropdown.innerHTML = "";

        for (let account of accounts) {
            let online = account.meta?.type === "Xbox";
            let item = document.createElement("div");
            item.classList.add("account-row");
            if (account.ID === selected) item.classList.add("active");
            item.innerHTML = `
                <div class="account-row-head"></div>
                <div class="account-widget-infos">
                    <div class="account-row-name">${account.name}</div>
                    <div class="account-row-status ${online ? "online" : ""}">${online ? "ONLINE" : "OFFLINE"}</div>
                </div>
                <span class="account-dot ${account.ID === selected ? "active" : ""}"></span>
            `;

            if (account?.profile?.skins?.[0]?.base64) {
                new skin2D()
                    .createHeadTexture(account.profile.skins[0].base64)
                    .then((texture) => {
                        item.querySelector(
                            ".account-row-head",
                        ).style.backgroundImage = `url(${texture})`;
                    });
            }

            item.addEventListener("click", async () => {
                configClient.account_selected = account.ID;
                await this.db.updateData("configClient", configClient);
                await accountSelect(account);
                dropdown.classList.remove("show");
            });
            dropdown.appendChild(item);
        }

        let divider = document.createElement("div");
        divider.classList.add("account-dropdown-divider");
        dropdown.appendChild(divider);

        let addBtn = document.createElement("div");
        addBtn.classList.add("account-dropdown-add");
        let atMax = accounts.length >= MAX_ACCOUNTS;
        if (atMax) addBtn.classList.add("disabled");
        addBtn.innerHTML = `+ Ajouter un compte <span class="account-count">(${accounts.length}/${MAX_ACCOUNTS})</span>`;
        if (!atMax) {
            addBtn.addEventListener("click", () => {
                document.querySelectorAll(".cancel-home").forEach((e) => {
                    e.style.display = "inline";
                    e.dataset.returnTo = "home";
                });
                changePanel("login");
            });
        }
        dropdown.appendChild(addBtn);
    }

    socialLick() {
        let socials = document.querySelectorAll(".social-block");

        socials.forEach((social) => {
            social.addEventListener("click", (e) => {
                shell.openExternal(e.target.dataset.url);
            });
        });
    }

    async instancesSelect() {
        let configClient = await this.db.readData("configClient");
        let auth = await this.db.readData(
            "accounts",
            configClient.account_selected,
        );
        let instancesList = await config.getInstanceList();
        let instanceSelect = instancesList.find(
            (i) => i.name == configClient?.instance_selct,
        )
            ? configClient?.instance_selct
            : null;

        let instanceBTN = document.querySelector(".play-instance");
        let instancePopup = document.querySelector(".instance-popup");
        let instancesListPopup = document.querySelector(".instances-List");
        let instanceCloseBTN = document.querySelector(".close-popup");

        if (instancesList.length === 1) {
            document.querySelector(".instance-select").style.display = "none";
            instanceBTN.style.paddingRight = "0";
        }

        if (!instanceSelect) {
            let newInstanceSelect = instancesList.find(
                (i) => i.whitelistActive == false,
            );
            let configClient = await this.db.readData("configClient");
            configClient.instance_selct = newInstanceSelect.name;
            instanceSelect = newInstanceSelect.name;
            await this.db.updateData("configClient", configClient);
        }

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(
                    (whitelist) => whitelist == auth?.name,
                );
                if (whitelist !== auth?.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(
                            (i) => i.whitelistActive == false,
                        );
                        let configClient =
                            await this.db.readData("configClient");
                        configClient.instance_selct = newInstanceSelect.name;
                        instanceSelect = newInstanceSelect.name;
                        console.log(newInstanceSelect.status);
                        setStatus(newInstanceSelect.status);
                        await this.db.updateData("configClient", configClient);
                    }
                }
            } else console.log(`Initializing instance ${instance.name}...`);
            if (instance.name == instanceSelect) {
                console.log(instance.status);
                setStatus(instance.status);
            }
        }

        instancePopup.addEventListener("click", async (e) => {
            let configClient = await this.db.readData("configClient");

            if (e.target.classList.contains("instance-elements")) {
                let newInstanceSelect = e.target.id;
                let activeInstanceSelect =
                    document.querySelector(".active-instance");

                if (activeInstanceSelect)
                    activeInstanceSelect.classList.toggle("active-instance");
                e.target.classList.add("active-instance");

                configClient.instance_selct = newInstanceSelect;
                await this.db.updateData("configClient", configClient);
                instanceSelect = instancesList.filter(
                    (i) => i.name == newInstanceSelect,
                );
                instancePopup.style.display = "none";
                let instance = await config.getInstanceList();
                let options = instance.find(
                    (i) => i.name == configClient.instance_selct,
                );
                await setStatus(options.status);
                this.renderActiveVersion();
            }
        });

        instanceBTN.addEventListener("click", async (e) => {
            let configClient = await this.db.readData("configClient");
            let instanceSelect = configClient.instance_selct;
            let auth = await this.db.readData(
                "accounts",
                configClient.account_selected,
            );

            if (e.target.classList.contains("instance-select")) {
                instancesList = await config.getInstanceList();
                instancesListPopup.innerHTML = "";
                for (let instance of instancesList) {
                    if (instance.whitelistActive) {
                        instance.whitelist.map((whitelist) => {
                            if (whitelist == auth?.name) {
                                if (instance.name == instanceSelect) {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`;
                                } else {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`;
                                }
                            }
                        });
                    } else {
                        if (instance.name == instanceSelect) {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`;
                        } else {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`;
                        }
                    }
                }

                instancePopup.style.display = "flex";
            }

            if (!e.target.classList.contains("instance-select"))
                this.startGame();
        });

        instanceCloseBTN.addEventListener(
            "click",
            () => (instancePopup.style.display = "none"),
        );
    }

    async checkPlayerAllowed(authenticator) {
        try {
            let { data, error } = await supabase.functions.invoke(
                "check-player",
                {
                    body: {
                        minecraft_uuid: authenticator?.uuid,
                        username: authenticator?.name,
                        auth_type:
                            authenticator?.meta?.type === "Xbox"
                                ? "microsoft"
                                : "offline",
                    },
                },
            );
            if (error) return { allowed: true };
            return data;
        } catch (err) {
            console.error("Impossible de vérifier le joueur :", err);
            return { allowed: true };
        }
    }

    async startSession(playerId, authenticator, options) {
        try {
            let { data } = await supabase.functions.invoke("track-session", {
                body: {
                    action: "start",
                    player_id: playerId,
                    username: authenticator?.name,
                    instance_name: options.name,
                    minecraft_version: options.loadder.minecraft_version,
                    loader_type: options.loadder.loadder_type,
                    loader_version: options.loadder.loadder_version,
                },
            });
            return data?.session_id || null;
        } catch (err) {
            console.error("Impossible de démarrer la session :", err);
            return null;
        }
    }

    async endSession(sessionId) {
        if (!sessionId) return;
        try {
            await supabase.functions.invoke("track-session", {
                body: { action: "end", session_id: sessionId },
            });
        } catch (err) {
            console.error("Impossible de terminer la session :", err);
        }
    }

    async startGame() {
        let launch = new Launch();
        let configClient = await this.db.readData("configClient");
        let instance = await config.getInstanceList();
        let authenticator = await this.db.readData(
            "accounts",
            configClient.account_selected,
        );
        let options = instance.find(
            (i) => i.name == configClient.instance_selct,
        );

        let playInstanceBTN = document.querySelector(".play-instance");
        let infoStarting = document.querySelector(".info-starting-game-text");
        let progressBar = document.querySelector(".progress-bar");

        let access = await this.checkPlayerAllowed(authenticator);
        if (!access.allowed) {
            let popupBan = new popup();
            popupBan.openPopup({
                title: "Accès refusé",
                content:
                    access.reason || "Vous n'êtes pas autorisé à jouer.",
                color: "red",
                options: true,
            });
            return;
        }

        const path = `${await appdata()}/.nebulalauncher`;
        console.log(path + " appdata: " + (await appdata()));

        let opt = {
            url: options.url,
            authenticator: authenticator,
            timeout: 10000,
            path: path,
            instance: options.name,
            version: options.loadder.minecraft_version,
            detached:
                configClient.launcher_config.closeLauncher == "close-all"
                    ? false
                    : true,
            downloadFileMultiple: configClient.launcher_config.download_multi,
            intelEnabledMac: configClient.launcher_config.intelEnabledMac,

            loader: {
                type: options.loadder.loadder_type,
                build: options.loadder.loadder_version,
                enable: options.loadder.loadder_type !== "none",
            },

            verify: options.verify,

            ignored: Array.from(
                new Set([...(options.ignored || []), ...ALWAYS_IGNORED]),
            ),

            java: {
                path: configClient.java_config.java_path,
            },

            JVM_ARGS: options.jvm_args || [],
            GAME_ARGS: [],

            screen: {
                width: configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height,
                fullscreen: configClient.game_config.screen_size.fullscreen || false,
            },

            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`,
            },
        };

        launch.Launch(opt);

        let sessionId = null;
        this.startSession(access.player_id, authenticator, options).then(
            (id) => (sessionId = id),
        );

        playInstanceBTN.classList.add("disabled");
        progressBar.style.display = "";
        ipcRenderer.send("main-window-progress-load");

        launch.on("extract", (extract) => {
            ipcRenderer.send("main-window-progress-load");
            console.log(extract);
        });

        launch.on("progress", (progress, size) => {
            console.log(opt, launch);
            infoStarting.innerHTML = `Téléchargement ${((progress / size) * 100).toFixed(0)}%`;
            ipcRenderer.send("main-window-progress", { progress, size });
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on("check", (progress, size) => {
            infoStarting.innerHTML = `Vérification ${((progress / size) * 100).toFixed(0)}%`;
            ipcRenderer.send("main-window-progress", { progress, size });
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on("estimated", (time) => {
            let hours = Math.floor(time / 3600);
            let minutes = Math.floor((time - hours * 3600) / 60);
            let seconds = Math.floor(time - hours * 3600 - minutes * 60);
            console.log(`${hours}h ${minutes}m ${seconds}s`);
        });

        launch.on("speed", (speed) => {
            console.log(`${(speed / 1067008).toFixed(2)} Mb/s`);
        });

        launch.on("patch", (patch) => {
            console.log(patch);
            ipcRenderer.send("main-window-progress-load");
            infoStarting.innerHTML = `Patch en cours...`;
        });

        launch.on("data", (e) => {
            progressBar.style.display = "none";
            if (
                configClient.launcher_config.closeLauncher == "close-launcher"
            ) {
                ipcRenderer.send("main-window-hide");
            }
            new logger("Minecraft", "#36b030");
            ipcRenderer.send("main-window-progress-load");
            infoStarting.innerHTML = `Demarrage en cours...`;
            console.log(e);
        });

        launch.on("close", (code) => {
            if (
                configClient.launcher_config.closeLauncher == "close-launcher"
            ) {
                ipcRenderer.send("main-window-show");
            }
            ipcRenderer.send("main-window-progress-reset");
            playInstanceBTN.classList.remove("disabled");
            progressBar.value = 0;
            infoStarting.innerHTML = `Prêt à jouer`;
            new logger(pkg.name, "#7289da");
            console.log("Close");
            this.endSession(sessionId).then(() =>
                renderPlaytime(authenticator),
            );
        });

        launch.on("error", (err) => {
            if (typeof launch !== "object") {
                console.log("Aborting launch");
                console.log(typeof launch);
            }
            /*let popupError = new popup();

            popupError.openPopup({
                title: "Erreur",
                content: err.error,
                color: "red",
                options: true,
            });*/

            if (
                configClient.launcher_config.closeLauncher == "close-launcher"
            ) {
                ipcRenderer.send("main-window-show");
            }
            ipcRenderer.send("main-window-progress-reset");
            playInstanceBTN.classList.remove("disabled");
            progressBar.value = 0;
            infoStarting.innerHTML = `Prêt à jouer`;
            console.log("test: ", typeof launch, launch);
            // launch.Launch(opt);
            launch.removeAllListeners();
            // new logger(pkg.name, "#7289da");
            console.error(err);
            this.endSession(sessionId).then(() =>
                renderPlaytime(authenticator),
            );
        });
    }

}

export default Home;