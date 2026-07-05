import Home from "./panels/home.js";
import Login from "./panels/login.js";
import Settings from "./panels/settings.js";

import {
    accountSelect,
    addAccount,
    changePanel,
    config,
    database,
    logger,
    pkg,
    popup,
} from "./utils.js";

const { ipcRenderer } = require("electron");
const { AZauth, Microsoft, Mojang } = require("minecraft-java-core");
const fs = require("fs");

class LauncherTerraNova {
    async init() {
        this.initLogs();
        this.shortcut();
        this.initFrame();
        this.initSidebarNav();

        // Set TerraNova background
        let body = document.body;
        let tnBgPath = `${__dirname}/assets/images/terranova/bg.png`;
        let bgSrc = fs.existsSync(tnBgPath)
            ? "url(./assets/images/terranova/bg.png)"
            : "url(./assets/images/background.png)";
        body.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), ${bgSrc}`;
        body.style.backgroundSize = "cover";
        body.style.backgroundPosition = "center";

        this.config = await config.GetConfig().then(r => r).catch(e => e);
        if (await this.config.error) return this.errorConnect();

        this.db = new database();
        await this.initConfigClient();
        this.applyTheme();
        this.createPanels(Login, Home, Settings);
        this.startLauncher();

        // Discord Rich Presence
        try {
            const discord = require("./utils/discord.js");
            discord.initDiscord();
            window._tnDiscord = discord;
        } catch (e) {
            console.warn("[Discord RPC] Chargement impossible :", e.message);
        }

        // Sync profile from Supabase (async, non-blocking)
        this.syncProfileFromSupabase();
    }


    initLogs() {
        document.addEventListener("keydown", (e) => {
            if ((e.ctrlKey && e.shiftKey && e.keyCode == 73) || e.keyCode == 123) {
                ipcRenderer.send("main-window-dev-tools-close");
                ipcRenderer.send("main-window-dev-tools");
            }
        });
        new logger(pkg.name, "#22c55e");
    }

    shortcut() {
        document.addEventListener("keydown", (e) => {
            if (e.ctrlKey && e.keyCode == 87) ipcRenderer.send("main-window-close");
        });
    }

    errorConnect() {
        new popup().openPopup({
            title: this.config.error.code,
            content: this.config.error.message,
            color: "red",
            exit: true,
            options: true,
        });
    }

    initFrame() {
        document.getElementById("minimize")?.addEventListener("click", () => {
            ipcRenderer.send("main-window-minimize");
        });

        let maximized = false;
        let maximize = document.getElementById("maximize");
        maximize?.addEventListener("click", () => {
            ipcRenderer.send("main-window-maximize");
            maximized = !maximized;
            maximize.firstChild.classList.toggle("fa-arrow-up-right-and-arrow-down-left-from-center");
            maximize.firstChild.classList.toggle("fa-arrow-down-left-and-arrow-up-right-to-center");
        });

        document.getElementById("close")?.addEventListener("click", () => {
            ipcRenderer.send("main-window-close");
        });
    }

    initSidebarNav() {
        let navItems = document.querySelectorAll(".tn-nav-item");
        navItems.forEach(item => {
            item.addEventListener("click", () => {
                let panel = item.dataset.panel;
                let tab = item.dataset.tab;
                if (!panel) return;

                // Update active nav
                navItems.forEach(n => n.classList.remove("tn-nav-active"));
                item.classList.add("tn-nav-active");

                changePanel(panel);

                // If a specific settings tab requested, click it
                if (tab) {
                    setTimeout(() => {
                        let tabBtn = document.getElementById(tab);
                        if (tabBtn) tabBtn.click();
                    }, 50);
                }

                // Toggle body class for login panel styling
                document.body.classList.toggle("panel-login", panel === "login");
            });
        });
    }

    async applyTheme() {
        let configClient = await this.db.readData("configClient");
        let theme = configClient?.theme || "theme-green";
        let themes = ["theme-violet", "theme-blue", "theme-red", "theme-green", "theme-orange"];
        themes.forEach(t => document.body.classList.remove(t));
        document.body.classList.add(theme);
    }

    async initConfigClient() {
        let configClient = await this.db.readData("configClient");
        if (!configClient) {
            await this.db.createData("configClient", {
                account_selected: null,
                instance_selct: ".terranova",
                java_config: { java_path: null, java_memory: { min: 2, max: 4 } },
                game_config: { screen_size: { width: 854, height: 480 } },
                launcher_config: { download_multi: 5, closeLauncher: "close-launcher", intelEnabledMac: true },
            });
        } else if (configClient.instance_selct !== ".terranova") {
            // Forcer l'instance TerraNova si une autre était sélectionnée
            configClient.instance_selct = ".terranova";
            await this.db.updateData("configClient", configClient);
        }
    }

    createPanels(...panels) {
        let panelsElm = document.querySelector(".panels");
        for (let panel of panels) {
            let div = document.createElement("div");
            div.classList.add("panel", panel.id);
            let htmlMap = { home: "home-terranova", settings: "settings-terranova" };
            let htmlFile = htmlMap[panel.id] || panel.id;
            div.innerHTML = fs.readFileSync(`${__dirname}/panels/${htmlFile}.html`, "utf-8");
            panelsElm.appendChild(div);
            new panel().init(this.config);
        }

        this.initTabs();

        // Populate instance info rows on first load and on refresh
        this.renderTnInfo();
        this.renderModsList();
        this.pingServer();
        this.load3DSkin();
        this._pingInterval = setInterval(() => this.pingServer(), 60000);
        window.addEventListener("home:refresh", () => {
            this.renderTnInfo();
            this.renderModsList();
            this.pingServer();
            this.load3DSkin();
        });
    }

    async renderTnInfo() {
        try {
            let instances = await config.getInstanceList();
            let active = instances.find(i => i.name === ".terranova") || instances[0];
            if (!active) return;

            let versionEl = document.querySelector(".tn-info-version");
            let loaderEl  = document.querySelector(".tn-info-loader");
            let javaEl    = document.querySelector(".tn-info-java");
            let nameEl    = document.querySelector(".tn-instance-name");

            if (versionEl) versionEl.textContent = active.loadder?.minecraft_version || "—";
            if (loaderEl) {
                let type = active.loadder?.loadder_type;
                loaderEl.textContent = (!type || type === "none")
                    ? "Vanilla"
                    : `${type} ${active.loadder.loadder_version || ""}`.trim();
            }
            if (javaEl) javaEl.textContent = active.java_version || "21";
            if (nameEl) nameEl.textContent = active.name || "Nebula";
        } catch (err) {
            console.error("renderTnInfo:", err);
        }
    }

    async renderModsList() {
        let listEl = document.getElementById("tn-mods-list");
        let countEl = document.getElementById("tn-mods-count");
        if (!listEl) return;

        try {
            let appData = await ipcRenderer.invoke("appData");
            let modsPath = `${appData}/.nebulalauncher/instances/.terranova/mods`;

            if (!fs.existsSync(modsPath)) {
                listEl.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:8px 0;">Aucun mod installé.</div>`;
                if (countEl) countEl.textContent = "";
                return;
            }

            let files = fs.readdirSync(modsPath).filter(f => f.endsWith(".jar"));

            if (!files.length) {
                listEl.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:8px 0;">Aucun mod installé.</div>`;
                if (countEl) countEl.textContent = "";
                return;
            }

            if (countEl) countEl.textContent = `(${files.length})`;

            listEl.innerHTML = files.map(file => {
                let fullPath = `${modsPath}/${file}`;
                let size = fs.statSync(fullPath).size;
                let sizeStr = size > 1024 * 1024
                    ? `${(size / 1024 / 1024).toFixed(1)} Mo`
                    : `${Math.round(size / 1024)} Ko`;
                let name = file.replace(/\.jar$/, "");
                return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:rgba(255,255,255,0.04);border-radius:4px;">
                    <span style="font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:75%;">🧩 ${name}</span>
                    <span style="font-size:11px;color:var(--muted);flex-shrink:0;">${sizeStr}</span>
                </div>`;
            }).join("");
        } catch (err) {
            console.error("renderModsList:", err);
            listEl.innerHTML = `<div style="color:var(--muted);font-size:12px;">Erreur de lecture des mods.</div>`;
        }
    }

    async pingServer() {
        const HOST = "45.140.165.18";
        const PORT = 25589;

        const badge1 = document.getElementById("tn-server-badge");
        const badge2 = document.getElementById("tn-srv-badge");
        const hostEls = document.querySelectorAll(".server-host");
        const playersEls = [document.getElementById("tn-srv-players"), document.getElementById("tn-srv-pl")];
        const pingEls = [document.getElementById("tn-srv-ping"), document.getElementById("tn-srv-pi")];
        const versionEls = [document.getElementById("tn-srv-version"), document.getElementById("tn-srv-ver")];

        const setOffline = () => {
            [badge1, badge2].forEach(el => { if (el) { el.textContent = "Hors ligne"; el.className = el.className.replace("online", "offline"); if (!el.className.includes("offline")) el.className += " offline"; } });
            [...playersEls, ...pingEls, ...versionEls].forEach(el => { if (el) el.textContent = "—"; });
        };

        const setOnline = (players, max, ping, version) => {
            [badge1, badge2].forEach(el => { if (el) { el.textContent = "En ligne"; el.className = el.className.replace("offline", "online"); if (!el.className.includes("online")) el.className += " online"; } });
            hostEls.forEach(el => { if (el) el.textContent = `${HOST}:${PORT}`; });
            playersEls.forEach(el => { if (el) el.textContent = `${players}/${max}`; });
            pingEls.forEach(el => { if (el) el.textContent = `${ping} ms`; });
            versionEls.forEach(el => { if (el) el.textContent = version || "—"; });
        };

        // Init host display
        hostEls.forEach(el => { if (el) el.textContent = `${HOST}:${PORT}`; });

        try {
            const { Status } = require("minecraft-java-core");
            let start = Date.now();
            let status = new Status(HOST, PORT);
            let result = await status.getStatus();
            let ping = Date.now() - start;
            if (result?.players !== undefined) {
                setOnline(result.players.online, result.players.max, ping, result.version?.name);
            } else {
                setOffline();
            }
        } catch {
            setOffline();
        }
    }

    async load3DSkin() {
        try {
            let configClient = await this.db.readData("configClient");
            if (!configClient?.account_selected) return;
            let account = await this.db.readData("accounts", configClient.account_selected);
            let uuid = account?.uuid;
            if (!uuid) return;
            let cleanUuid = uuid.replace(/-/g, "");
            let imgEl = document.getElementById("tn-body-render");
            if (!imgEl) return;
            imgEl.src = `https://crafatar.com/renders/body/${cleanUuid}?scale=3&overlay`;
            imgEl.style.display = "block";
            let letterEl = document.getElementById("sidebar-avatar-letter");
            if (letterEl) letterEl.style.display = "none";
            let headEl = document.getElementById("sidebar-avatar-skin");
            if (headEl) headEl.style.display = "none";
        } catch (err) {
            console.error("load3DSkin:", err);
        }
    }

    initTabs() {
        // Legacy .tn-tab system
        let tabs = document.querySelectorAll(".tn-tab");
        let panes = document.querySelectorAll(".tn-tab-pane");
        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                tabs.forEach(t => t.classList.remove("tn-tab-active"));
                tab.classList.add("tn-tab-active");
                let target = tab.dataset.tab;
                panes.forEach(pane => {
                    if (pane.dataset.pane === target) pane.removeAttribute("hidden");
                    else pane.setAttribute("hidden", "");
                });
            });
        });

        // TerraNova .itab system (script inline ne s'exécute pas via innerHTML)
        let itabs = document.querySelectorAll(".itab");
        itabs.forEach(btn => {
            btn.addEventListener("click", function() {
                let target = this.dataset.itab;
                itabs.forEach(b => b.classList.remove("active"));
                document.querySelectorAll(".itab-content").forEach(c => c.classList.remove("active"));
                this.classList.add("active");
                let pane = document.getElementById("itab-" + target);
                if (pane) pane.classList.add("active");
            });
        });

        // Folder button
        let folderBtn = document.querySelector(".tn-folder-btn");
        folderBtn?.addEventListener("click", async () => {
            let { shell } = require("electron");
            let appData = await ipcRenderer.invoke("appData");
            let instancePath = `${appData}/.nebulalauncher/instances/.terranova`;
            if (!fs.existsSync(instancePath)) fs.mkdirSync(instancePath, { recursive: true });
            shell.openPath(instancePath);
        });
    }

    async startLauncher() {
        let accounts = await this.db.readAllData("accounts");
        let configClient = this.db.readData("configClient");
        let account_selected = configClient ? configClient.account_selected : null;
        let popupRefresh = new popup();

        if (accounts?.length) {
            for (let account of accounts) {
                let account_ID = account.ID;
                if (account.error) { await this.db.deleteData("accounts", account_ID); continue; }
                if (account.meta.type === "Xbox") {
                    popupRefresh.openPopup({ title: "Connexion", content: `Refresh ${account.name}`, color: "var(--color)", background: true });
                    let refresh = await new Microsoft(this.config.client_id).refresh(account);
                    if (refresh.error) {
                        await this.db.deleteData("accounts", account_ID);
                        if (account_ID == account_selected) { configClient.account_selected = null; await this.db.updateData("configClient", configClient); }
                        continue;
                    }
                    refresh.ID = account_ID;
                    await this.db.updateData("accounts", refresh, account_ID);
                    await addAccount(refresh);
                    if (account_ID == account_selected) accountSelect(refresh);
                } else if (account.meta.type == "AZauth") {
                    popupRefresh.openPopup({ title: "Connexion", content: `Refresh ${account.name}`, color: "var(--color)", background: true });
                    let refresh = await new AZauth(this.config.online).verify(account);
                    if (refresh.error) { this.db.deleteData("accounts", account_ID); continue; }
                    refresh.ID = account_ID;
                    this.db.updateData("accounts", refresh, account_ID);
                    await addAccount(refresh);
                    if (account_ID == account_selected) accountSelect(refresh);
                }
            }

            accounts = await this.db.readAllData("accounts");
            configClient = await this.db.readData("configClient");
            account_selected = configClient ? configClient.account_selected : null;

            if (!account_selected) {
                let uuid = accounts[0]?.ID;
                if (uuid) {
                    configClient.account_selected = uuid;
                    await this.db.updateData("configClient", configClient);
                    accountSelect(uuid);
                }
            }

            if (!accounts.length) { popupRefresh.closePopup(); return changePanel("login"); }
            popupRefresh.closePopup();
            changePanel("home");
        } else {
            popupRefresh.closePopup();
            changePanel("login");
        }
    }

    async syncProfileFromSupabase() {
        try {
            let supabase = (await import("./utils/supabase.js")).default;
            let { data } = await supabase.functions.invoke("get-config", { body: { key: "active_profile" } });
            let remoteProfile = data?.value?.profile || "nebula";
            let localProfile = await ipcRenderer.invoke("get-active-profile");
            if (remoteProfile !== localProfile) {
                ipcRenderer.send("set-active-profile", remoteProfile);
            }
        } catch {}
    }
}

new LauncherTerraNova().init();
