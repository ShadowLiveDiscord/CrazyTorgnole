import {
    accountSelect,
    appdata,
    changePanel,
    config,
    database,
    popup,
    setStatus,
    Slider,
} from "../utils.js";
import { skin2D } from "../utils/skin.js";
import supabase from "../utils/supabase.js";
const { ipcRenderer, shell } = require("electron");
const { Microsoft } = require("minecraft-java-core");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

class Settings {
    static id = "settings";

    async init(config) {
        this.config = config;
        this.db = new database();
        this.navBTN();
        this.accounts();
        this.skins();
        this.ram();
        this.javaPath();
        this.resolution();
        this.launcher();
        this.mcVersion();
        this.modsManager();
        this.admin();
    }

    navBTN() {
        document.querySelector(".nav-box").addEventListener("click", (e) => {
            if (e.target.classList.contains("nav-settings-btn")) {
                let id = e.target.id;

                let activeSettingsBTN = document.querySelector(
                    ".active-settings-BTN",
                );
                let activeContainerSettings = document.querySelector(
                    ".active-container-settings",
                );

                if (id == "save") {
                    if (activeSettingsBTN)
                        activeSettingsBTN.classList.toggle(
                            "active-settings-BTN",
                        );
                    document
                        .querySelector("#account")
                        .classList.add("active-settings-BTN");

                    if (activeContainerSettings)
                        activeContainerSettings.classList.toggle(
                            "active-container-settings",
                        );
                    document
                        .querySelector(`#account-tab`)
                        .classList.add("active-container-settings");
                    window.dispatchEvent(new CustomEvent("home:refresh"));
                    return changePanel("home");
                }

                if (activeSettingsBTN)
                    activeSettingsBTN.classList.toggle("active-settings-BTN");
                e.target.classList.add("active-settings-BTN");

                if (activeContainerSettings)
                    activeContainerSettings.classList.toggle(
                        "active-container-settings",
                    );
                document
                    .querySelector(`#${id}-tab`)
                    .classList.add("active-container-settings");
            }
        });
    }

    accounts() {
        document
            .querySelector(".accounts-list")
            .addEventListener("click", async (e) => {
                let popupAccount = new popup();
                try {
                    let id = e.target.id;
                    if (e.target.classList.contains("account")) {
                        popupAccount.openPopup({
                            title: "Connexion",
                            content: "Veuillez patienter...",
                            color: "var(--color)",
                        });

                        if (id == "add") {
                            document
                                .querySelectorAll(".cancel-home")
                                .forEach((e) => {
                                    e.style.display = "inline";
                                    e.dataset.returnTo = "settings";
                                });
                            return changePanel("login");
                        }

                        let account = await this.db.readData("accounts", id);
                        let configClient = await this.setInstance(account);
                        await accountSelect(account);
                        configClient.account_selected = account.ID;
                        return await this.db.updateData(
                            "configClient",
                            configClient,
                        );
                    }

                    if (e.target.classList.contains("delete-profile")) {
                        popupAccount.openPopup({
                            title: "Connexion",
                            content: "Veuillez patienter...",
                            color: "var(--color)",
                        });
                        await this.db.deleteData("accounts", id);
                        let deleteProfile = document.getElementById(`${id}`);
                        let accountListElement =
                            document.querySelector(".accounts-list");
                        accountListElement.removeChild(deleteProfile);

                        if (accountListElement.children.length == 1)
                            return changePanel("login");

                        let configClient =
                            await this.db.readData("configClient");

                        if (configClient.account_selected == id) {
                            let allAccounts =
                                await this.db.readAllData("accounts");
                            configClient.account_selected = allAccounts[0].ID;
                            accountSelect(allAccounts[0]);
                            let newInstanceSelect = await this.setInstance(
                                allAccounts[0],
                            );
                            configClient.instance_selct =
                                newInstanceSelect.instance_selct;
                            return await this.db.updateData(
                                "configClient",
                                configClient,
                            );
                        }
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    popupAccount.closePopup();
                }
            });
    }

    skins() {
        let skinPopup = document.querySelector(".skin-popup");
        let fileInput = document.querySelector(".skin-file-input");
        let fileNameEl = document.querySelector(".skin-file-name");
        let errorEl = document.querySelector(".skin-popup-error");
        let applyBtn = document.querySelector(".skin-apply-btn");
        let resetBtn = document.querySelector(".skin-reset-btn");
        let closeBtn = document.querySelector(".close-skin-popup");
        let currentAccountId = null;

        let closeSkinPopup = () => {
            skinPopup.style.display = "none";
            fileInput.value = "";
            fileNameEl.textContent = "";
            errorEl.textContent = "";
            currentAccountId = null;
        };

        document
            .querySelector(".accounts-list")
            .addEventListener("click", async (e) => {
                if (!e.target.classList.contains("skin-profile")) return;
                currentAccountId = e.target.id;
                let account = await this.db.readData(
                    "accounts",
                    currentAccountId,
                );
                errorEl.textContent = "";
                fileInput.value = "";
                fileNameEl.textContent = "";
                let variant = (
                    account?.profile?.skins?.[0]?.variant || "classic"
                ).toLowerCase();
                let radio = document.querySelector(
                    `input[name="skin-variant"][value="${variant === "slim" ? "slim" : "classic"}"]`,
                );
                if (radio) radio.checked = true;
                await this.renderSkinPreview(account);
                skinPopup.style.display = "flex";
            });

        closeBtn.addEventListener("click", closeSkinPopup);
        skinPopup.addEventListener("click", (e) => {
            if (e.target === skinPopup) closeSkinPopup();
        });

        fileInput.addEventListener("change", () => {
            fileNameEl.textContent = fileInput.files[0]?.name || "";
        });

        applyBtn.addEventListener("click", async () => {
            if (!currentAccountId) return;
            let file = fileInput.files[0];
            if (!file) {
                errorEl.textContent = "Sélectionne d'abord une image PNG.";
                return;
            }
            let variant = document.querySelector(
                'input[name="skin-variant"]:checked',
            ).value;

            applyBtn.disabled = true;
            errorEl.textContent = "";
            try {
                let account = await this.db.readData(
                    "accounts",
                    currentAccountId,
                );
                let updated = await this.uploadSkin(account, file, variant);
                await this.saveSkinUpdate(currentAccountId, updated);
                await this.renderSkinPreview(updated);
                fileInput.value = "";
                fileNameEl.textContent = "";
            } catch (err) {
                console.error("Erreur lors de l'envoi du skin :", err);
                errorEl.textContent =
                    err.message || "Échec de l'envoi du skin.";
            } finally {
                applyBtn.disabled = false;
            }
        });

        resetBtn.addEventListener("click", async () => {
            if (!currentAccountId) return;
            resetBtn.disabled = true;
            errorEl.textContent = "";
            try {
                let account = await this.db.readData(
                    "accounts",
                    currentAccountId,
                );
                let updated = await this.resetSkin(account);
                await this.saveSkinUpdate(currentAccountId, updated);
                await this.renderSkinPreview(updated);
            } catch (err) {
                console.error(
                    "Erreur lors de la réinitialisation du skin :",
                    err,
                );
                errorEl.textContent =
                    err.message || "Échec de la réinitialisation du skin.";
            } finally {
                resetBtn.disabled = false;
            }
        });
    }

    async renderSkinPreview(account) {
        let previewEl = document.querySelector(".skin-preview");
        let base64 = account?.profile?.skins?.[0]?.base64;
        if (!base64) {
            previewEl.style.backgroundImage = "";
            return;
        }
        let head = await new skin2D().createHeadTexture(base64);
        previewEl.style.backgroundImage = `url(${head})`;
    }

    // L'API officielle Mojang (minecraftservices.com) n'accepte les
    // changements de skin que pour un compte Microsoft authentifié : on
    // rafraîchit toujours le token avant d'appeler l'API pour éviter un 401
    // si l'access_token stocké a expiré depuis la dernière connexion.
    async uploadSkin(account, file, variant) {
        let auth = new Microsoft(this.config.client_id);
        let refreshed = await auth.refresh(account);
        if (refreshed.error) throw new Error(refreshed.error);

        let form = new FormData();
        form.append("variant", variant);
        form.append("file", file, file.name);

        let response = await fetch(
            "https://api.minecraftservices.com/minecraft/profile/skins",
            {
                method: "POST",
                headers: { Authorization: `Bearer ${refreshed.access_token}` },
                body: form,
            },
        );
        if (!response.ok) {
            throw new Error(
                `L'API Mojang a refusé l'image (code ${response.status}). Vérifie qu'il s'agit bien d'un PNG 64x64.`,
            );
        }

        let profile = await auth.getProfile({
            access_token: refreshed.access_token,
        });
        if (profile.error) throw new Error(profile.error);

        refreshed.profile = { skins: profile.skins, capes: profile.capes };
        return refreshed;
    }

    async resetSkin(account) {
        let auth = new Microsoft(this.config.client_id);
        let refreshed = await auth.refresh(account);
        if (refreshed.error) throw new Error(refreshed.error);

        let response = await fetch(
            "https://api.minecraftservices.com/minecraft/profile/skins/active",
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${refreshed.access_token}` },
            },
        );
        if (!response.ok && response.status !== 204) {
            throw new Error(
                `Échec de la réinitialisation (code ${response.status}).`,
            );
        }

        let profile = await auth.getProfile({
            access_token: refreshed.access_token,
        });
        if (profile.error) throw new Error(profile.error);

        refreshed.profile = { skins: profile.skins, capes: profile.capes };
        return refreshed;
    }

    async saveSkinUpdate(accountId, updated) {
        updated.ID = accountId;
        await this.db.updateData("accounts", updated, accountId);

        let row = document.getElementById(accountId);
        let base64 = updated?.profile?.skins?.[0]?.base64;
        if (row && base64) {
            let img = row.querySelector(".profile-image");
            if (img) {
                let head = await new skin2D().createHeadTexture(base64);
                img.style.backgroundImage = `url(${head})`;
            }
        }

        let configClient = await this.db.readData("configClient");
        if (configClient?.account_selected === accountId) {
            await accountSelect(updated);
        }
    }

    async setInstance(auth) {
        let configClient = await this.db.readData("configClient");
        let instanceSelect = configClient.instance_selct;
        let instancesList = await config.getInstanceList();

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(
                    (whitelist) => whitelist == auth.name,
                );
                if (whitelist !== auth.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(
                            (i) => i.whitelistActive == false,
                        );
                        configClient.instance_selct = newInstanceSelect.name;
                        await setStatus(newInstanceSelect.status);
                    }
                }
            }
        }
        return configClient;
    }

    async ram() {
        let config = await this.db.readData("configClient");
        let totalMem = Math.trunc((os.totalmem() / 1073741824) * 10) / 10;
        let freeMem = Math.trunc((os.freemem() / 1073741824) * 10) / 10;

        document.getElementById("total-ram").textContent = `${totalMem} Go`;
        document.getElementById("free-ram").textContent = `${freeMem} Go`;

        let sliderDiv = document.querySelector(".memory-slider");
        let sliderMin = parseFloat(sliderDiv.getAttribute("min"));
        let sliderMax = Math.trunc((80 * totalMem) / 100);
        sliderDiv.setAttribute("max", sliderMax);

        let ram = config?.java_config?.java_memory
            ? {
                  ramMin: parseFloat(config.java_config.java_memory.min),
                  ramMax: parseFloat(config.java_config.java_memory.max),
              }
            : { ramMin: 1, ramMax: 2 };

        // Borne les valeurs sauvegardées à la plage actuelle : une config
        // enregistrée sur une machine avec plus/moins de RAM peut sinon
        // pousser les curseurs hors de la zone visible du slider.
        ram.ramMin = Math.min(Math.max(ram.ramMin, sliderMin), sliderMax);
        ram.ramMax = Math.min(Math.max(ram.ramMax, sliderMin), sliderMax);
        if (ram.ramMin >= ram.ramMax) {
            ram.ramMin = Math.max(sliderMin, ram.ramMax - sliderMin);
        }

        config.java_config.java_memory = { min: ram.ramMin, max: ram.ramMax };
        this.db.updateData("configClient", config);

        let slider = new Slider(
            ".memory-slider",
            parseFloat(ram.ramMin),
            parseFloat(ram.ramMax),
        );

        let minSpan = document.querySelector(".slider-touch-left span");
        let maxSpan = document.querySelector(".slider-touch-right span");

        minSpan.setAttribute("value", `${ram.ramMin} Go`);
        maxSpan.setAttribute("value", `${ram.ramMax} Go`);

        slider.on("change", async (min, max) => {
            let config = await this.db.readData("configClient");
            minSpan.setAttribute("value", `${min} Go`);
            maxSpan.setAttribute("value", `${max} Go`);
            config.java_config.java_memory = { min: min, max: max };
            this.db.updateData("configClient", config);
        });
    }

    async javaPath() {
        let javaPathText = document.querySelector(".java-path-txt");
        javaPathText.textContent = `${await appdata()}/${process.platform == "darwin" ? "nebulalauncher" : ".nebulalauncher"}/runtime`;

        let configClient = await this.db.readData("configClient");
        let javaPath =
            configClient?.java_config?.java_path ||
            "Utiliser la version de java livre avec le launcher";
        let javaPathInputTxt = document.querySelector(".java-path-input-text");
        let javaPathInputFile = document.querySelector(".java-path-input-file");
        javaPathInputTxt.value = javaPath;

        document
            .querySelector(".java-path-set")
            .addEventListener("click", async () => {
                javaPathInputFile.value = "";
                javaPathInputFile.click();
                await new Promise((resolve) => {
                    let interval;
                    interval = setInterval(() => {
                        if (javaPathInputFile.value != "")
                            resolve(clearInterval(interval));
                    }, 100);
                });

                if (
                    javaPathInputFile.value
                        .replace(".exe", "")
                        .endsWith("java") ||
                    javaPathInputFile.value
                        .replace(".exe", "")
                        .endsWith("javaw")
                ) {
                    let configClient = await this.db.readData("configClient");
                    let file = javaPathInputFile.files[0].path;
                    javaPathInputTxt.value = file;
                    configClient.java_config.java_path = file;
                    await this.db.updateData("configClient", configClient);
                } else alert("Le nom du fichier doit être java ou javaw");
            });

        document
            .querySelector(".java-path-reset")
            .addEventListener("click", async () => {
                let configClient = await this.db.readData("configClient");
                javaPathInputTxt.value =
                    "Utiliser la version de java livre avec le launcher";
                configClient.java_config.java_path = null;
                await this.db.updateData("configClient", configClient);
            });
    }

    async resolution() {
        let configClient = await this.db.readData("configClient");
        let resolution = configClient?.game_config?.screen_size || {
            width: 1920,
            height: 1080,
        };

        let width = document.querySelector(".width-size");
        let height = document.querySelector(".height-size");
        let resolutionReset = document.querySelector(".size-reset");
        let resolutionDetect = document.querySelector(".resolution-detect");
        let fullscreenCheckbox = document.querySelector(
            ".fullscreen-checkbox",
        );
        let presetButtons = document.querySelectorAll(
            ".resolution-preset-btn",
        );

        width.value = resolution.width;
        height.value = resolution.height;
        fullscreenCheckbox.checked = !!resolution.fullscreen;

        let saveResolution = async (w, h, fullscreen) => {
            let configClient = await this.db.readData("configClient");
            configClient.game_config.screen_size = {
                width: w,
                height: h,
                fullscreen: fullscreen,
            };
            await this.db.updateData("configClient", configClient);
        };

        width.addEventListener("change", () =>
            saveResolution(width.value, height.value, fullscreenCheckbox.checked),
        );

        height.addEventListener("change", () =>
            saveResolution(width.value, height.value, fullscreenCheckbox.checked),
        );

        fullscreenCheckbox.addEventListener("change", () =>
            saveResolution(width.value, height.value, fullscreenCheckbox.checked),
        );

        presetButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                width.value = btn.dataset.w;
                height.value = btn.dataset.h;
                saveResolution(
                    btn.dataset.w,
                    btn.dataset.h,
                    fullscreenCheckbox.checked,
                );
            });
        });

        resolutionDetect.addEventListener("click", async () => {
            let size = await ipcRenderer.invoke("get-screen-size");
            width.value = size.width;
            height.value = size.height;
            await saveResolution(
                size.width,
                size.height,
                fullscreenCheckbox.checked,
            );
        });

        resolutionReset.addEventListener("click", async () => {
            width.value = "854";
            height.value = "480";
            fullscreenCheckbox.checked = false;
            await saveResolution("854", "480", false);
        });
    }

    async launcher() {
        let configClient = await this.db.readData("configClient");

        let maxDownloadFiles =
            configClient?.launcher_config?.download_multi || 5;
        let maxDownloadFilesInput = document.querySelector(".max-files");
        let maxDownloadFilesReset = document.querySelector(".max-files-reset");
        maxDownloadFilesInput.value = maxDownloadFiles;

        maxDownloadFilesInput.addEventListener("change", async () => {
            let configClient = await this.db.readData("configClient");
            configClient.launcher_config.download_multi =
                maxDownloadFilesInput.value;
            await this.db.updateData("configClient", configClient);
        });

        maxDownloadFilesReset.addEventListener("click", async () => {
            let configClient = await this.db.readData("configClient");
            maxDownloadFilesInput.value = 5;
            configClient.launcher_config.download_multi = 5;
            await this.db.updateData("configClient", configClient);
        });

        let closeBox = document.querySelector(".close-box");
        let closeLauncher =
            configClient?.launcher_config?.closeLauncher || "close-launcher";

        if (closeLauncher == "close-launcher") {
            document
                .querySelector(".close-launcher")
                .classList.add("active-close");
        } else if (closeLauncher == "close-all") {
            document.querySelector(".close-all").classList.add("active-close");
        } else if (closeLauncher == "close-none") {
            document.querySelector(".close-none").classList.add("active-close");
        }

        closeBox.addEventListener("click", async (e) => {
            if (e.target.classList.contains("close-btn")) {
                let activeClose = document.querySelector(".active-close");
                if (e.target.classList.contains("active-close")) return;
                activeClose?.classList.toggle("active-close");

                let configClient = await this.db.readData("configClient");

                if (e.target.classList.contains("close-launcher")) {
                    e.target.classList.toggle("active-close");
                    configClient.launcher_config.closeLauncher =
                        "close-launcher";
                    await this.db.updateData("configClient", configClient);
                } else if (e.target.classList.contains("close-all")) {
                    e.target.classList.toggle("active-close");
                    configClient.launcher_config.closeLauncher = "close-all";
                    await this.db.updateData("configClient", configClient);
                } else if (e.target.classList.contains("close-none")) {
                    e.target.classList.toggle("active-close");
                    configClient.launcher_config.closeLauncher = "close-none";
                    await this.db.updateData("configClient", configClient);
                }
            }
        });
    }

    async fetchLoaderBuilds(loaderType, mcVersion) {
        try {
            if (loaderType === "forge") {
                let res = await this.fetchWithTimeout(
                    "https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json",
                );
                let data = await res.json();
                return (data[mcVersion] || []).slice().reverse();
            }

            if (loaderType === "neoforge") {
                let res = await this.fetchWithTimeout(
                    "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge",
                );
                let data = await res.json();
                let prefix = mcVersion.replace(/^1\./, "");
                if (!prefix.includes(".")) prefix += ".0";
                return data.versions
                    .filter((v) => v.startsWith(`${prefix}.`))
                    .reverse();
            }

            let metaHost = {
                fabric: "https://meta.fabricmc.net/v2/versions/loader/",
                legacyfabric:
                    "https://meta.legacyfabric.net/v2/versions/loader/",
                quilt: "https://meta.quiltmc.org/v3/versions/loader/",
            }[loaderType];

            if (metaHost) {
                let res = await this.fetchWithTimeout(`${metaHost}${mcVersion}`);
                let data = await res.json();
                return data.map((entry) => entry.loader.version);
            }
        } catch (err) {
            console.error(
                `Impossible de récupérer les builds ${loaderType} pour ${mcVersion} :`,
                err,
            );
        }
        return [];
    }

    async mcVersion() {
        let versionSelect = document.querySelector(".mc-version-select");
        let loaderTypeSelect = document.querySelector(
            ".mc-loader-type-select",
        );
        let buildSelect = document.querySelector(".mc-loader-build-select");
        let applyBtn = document.querySelector(".mc-version-apply");
        let resetBtn = document.querySelector(".mc-version-reset");
        let currentText = document.querySelector(".mc-version-current");
        let instancesListEl = document.querySelector(".mc-instances-list");
        let latestRelease = null;

        let describeInstance = (instance) =>
            `${instance.loadder.minecraft_version}${
                instance.loadder.loadder_type !== "none"
                    ? ` + ${instance.loadder.loadder_type} ${instance.loadder.loadder_version}`
                    : " (vanilla)"
            }`;

        let renderCurrent = async () => {
            let configClient = await this.db.readData("configClient");
            let instances = await config.getInstanceList();
            let active =
                instances.find((i) => i.name === configClient?.instance_selct) ||
                instances.find((i) => !i.custom);

            currentText.textContent = active
                ? `Instance active : ${active.name} — ${describeInstance(active)}`
                : "Aucune instance.";

            instancesListEl.innerHTML = "";
            let customInstances = instances.filter((i) => i.custom);
            if (!customInstances.length) {
                instancesListEl.innerHTML =
                    '<div class="mc-instances-empty">Aucune instance créée pour le moment.</div>';
                return;
            }
            for (let instance of customInstances) {
                let row = document.createElement("div");
                row.classList.add("mc-instance-row");
                if (instance.name === active?.name)
                    row.classList.add("active");
                row.innerHTML = `
                    <div class="mc-instance-row-name">${instance.name} — ${describeInstance(instance)}</div>
                    <div class="mc-instance-row-delete">✕</div>
                `;
                row.addEventListener("click", async (e) => {
                    if (e.target.closest(".mc-instance-row-delete")) {
                        await config.removeCustomInstance(instance.name);
                        window.dispatchEvent(new CustomEvent("home:refresh"));
                        return renderCurrent();
                    }
                    let configClient = await this.db.readData("configClient");
                    configClient.instance_selct = instance.name;
                    await this.db.updateData("configClient", configClient);
                    window.dispatchEvent(new CustomEvent("home:refresh"));
                    renderCurrent();
                });
                instancesListEl.appendChild(row);
            }
        };

        let refreshBuilds = async () => {
            let loaderType = loaderTypeSelect.value;
            if (loaderType === "none") {
                buildSelect.innerHTML = '<option value="">— Vanilla —</option>';
                buildSelect.disabled = true;
                return;
            }
            buildSelect.disabled = true;
            buildSelect.innerHTML = '<option value="">Chargement...</option>';
            let builds = await this.fetchLoaderBuilds(
                loaderType,
                versionSelect.value,
            );
            if (!builds.length) {
                buildSelect.innerHTML =
                    '<option value="">Aucun build trouvé pour cette version</option>';
                return;
            }
            buildSelect.innerHTML = builds
                .map((b) => `<option value="${b}">${b}</option>`)
                .join("");
            buildSelect.disabled = false;
        };

        await renderCurrent();

        try {
            let res = await this.fetchWithTimeout(
                "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
            );
            let manifest = await res.json();
            latestRelease = manifest.latest.release;

            let releaseGroup = document.createElement("optgroup");
            releaseGroup.label = "Releases";
            let snapshotGroup = document.createElement("optgroup");
            snapshotGroup.label = "Snapshots";

            for (let version of manifest.versions) {
                let option = document.createElement("option");
                option.value = version.id;
                option.textContent = version.id;
                if (version.type === "release")
                    releaseGroup.appendChild(option);
                else if (version.type === "snapshot")
                    snapshotGroup.appendChild(option);
            }

            versionSelect.innerHTML = "";
            versionSelect.appendChild(releaseGroup);
            versionSelect.appendChild(snapshotGroup);
            versionSelect.value = latestRelease;
            loaderTypeSelect.value = "none";
            await refreshBuilds();
        } catch (err) {
            console.error(
                "Impossible de récupérer les versions Minecraft :",
                err,
            );
            versionSelect.innerHTML =
                '<option value="">Impossible de contacter Mojang</option>';
            versionSelect.disabled = true;
        }

        versionSelect.addEventListener("change", refreshBuilds);
        loaderTypeSelect.addEventListener("change", refreshBuilds);

        applyBtn.addEventListener("click", async () => {
            let loaderType = loaderTypeSelect.value;
            if (loaderType !== "none" && !buildSelect.value) {
                alert("Choisissez un build de loader.");
                return;
            }

            let mcVersion = versionSelect.value;
            let loaderLabel =
                loaderType !== "none"
                    ? `${loaderType}-${buildSelect.value}`
                    : "vanilla";
            let instanceName = `Nebula_${mcVersion}_${loaderLabel}`;

            let instances = await config.getInstanceList();
            let baseInstance = instances.find((i) => !i.custom) || {};

            await config.addCustomInstance({
                name: instanceName,
                url: null,
                whitelistActive: false,
                whitelist: [],
                status: null,
                loadder: {
                    minecraft_version: mcVersion,
                    loadder_type: loaderType,
                    loadder_version:
                        loaderType !== "none" ? buildSelect.value : "",
                },
                verify: true,
                ignored: baseInstance.ignored || [],
                jvm_args: baseInstance.jvm_args || [],
            });

            window.dispatchEvent(new CustomEvent("home:refresh"));
            await renderCurrent();
        });

        resetBtn.addEventListener("click", async () => {
            let configClient = await this.db.readData("configClient");
            let instances = await config.getInstanceList();
            let baseInstance = instances.find((i) => !i.custom);
            if (baseInstance) {
                configClient.instance_selct = baseInstance.name;
                await this.db.updateData("configClient", configClient);
            }
            if (latestRelease) versionSelect.value = latestRelease;
            loaderTypeSelect.value = "none";
            await refreshBuilds();
            window.dispatchEvent(new CustomEvent("home:refresh"));
            await renderCurrent();
        });

        document
            .querySelector(".mc-version-open-mods")
            .addEventListener("click", async () => {
                let active = await this.getActiveInstance();
                if (!active) return;

                let modsPath = await this.getModsPath(active.name);
                shell.openPath(modsPath);
            });
    }

    async fetchWithTimeout(url, ms = 8000) {
        let controller = new AbortController();
        let timeout = setTimeout(() => controller.abort(), ms);
        try {
            return await fetch(url, { signal: controller.signal });
        } finally {
            clearTimeout(timeout);
        }
    }

    async getActiveInstance() {
        let configClient = await this.db.readData("configClient");
        let instances = await config.getInstanceList();
        return (
            instances.find((i) => i.name === configClient?.instance_selct) ||
            instances.find((i) => !i.custom)
        );
    }

    async getModsPath(instanceName) {
        let modsPath = `${await appdata()}/.nebulalauncher/instances/${instanceName}/mods`;
        if (!fs.existsSync(modsPath)) fs.mkdirSync(modsPath, { recursive: true });
        return modsPath;
    }

    modrinthLoaderFacet(loaderType) {
        if (loaderType === "legacyfabric") return "fabric";
        return loaderType;
    }

    async modsManager() {
        let infoEl = document.querySelector(".mods-instance-info");
        let searchInput = document.querySelector(".mods-search-input");
        let searchBtn = document.querySelector(".mods-search-btn");
        let resultsEl = document.querySelector(".mods-search-results");
        let installedEl = document.querySelector(".mods-installed-list");

        let renderInstalled = async (active) => {
            let modsPath = await this.getModsPath(active.name);
            let files = fs
                .readdirSync(modsPath)
                .filter((f) => f.toLowerCase().endsWith(".jar"));

            if (!files.length) {
                installedEl.innerHTML =
                    '<div class="mc-instances-empty">Aucun mod installé pour cette instance.</div>';
                return;
            }

            // Sur l'instance verrouillée, les mods viennent uniquement du
            // modpack publié par l'admin (cf. bouton "Mettre à jour" sur
            // l'accueil) : pas de bouton de suppression individuel ici.
            installedEl.innerHTML = files
                .map(
                    (file) => `
                        <div class="mc-instance-row" data-file="${file}">
                            <div class="mc-instance-row-name">${file}</div>
                            ${active.modsLocked ? "" : '<div class="mc-instance-row-delete">✕</div>'}
                        </div>
                    `,
                )
                .join("");

            if (!active.modsLocked) {
                installedEl.querySelectorAll(".mc-instance-row").forEach((row) => {
                    row.querySelector(".mc-instance-row-delete").addEventListener(
                        "click",
                        () => {
                            fs.unlinkSync(`${modsPath}/${row.dataset.file}`);
                            renderInstalled(active);
                        },
                    );
                });
            }
        };

        let renderResults = (mods, active, modsPath) => {
            if (!mods.length) {
                resultsEl.innerHTML =
                    '<div class="mc-instances-empty">Aucun mod trouvé.</div>';
                return;
            }

            resultsEl.innerHTML = mods
                .map(
                    (mod) => `
                        <div class="mc-instance-row" data-id="${mod.project_id}">
                            <div class="mc-instance-row-name">${mod.title} — ${mod.author}</div>
                            <div class="mods-install-btn size-btn">Installer</div>
                        </div>
                    `,
                )
                .join("");

            resultsEl.querySelectorAll(".mc-instance-row").forEach((row) => {
                let btn = row.querySelector(".mods-install-btn");
                btn.addEventListener("click", async () => {
                    btn.textContent = "Installation...";
                    try {
                        await this.installMod(
                            row.dataset.id,
                            active,
                            modsPath,
                        );
                        btn.textContent = "Installé ✓";
                        await renderInstalled(active);
                    } catch (err) {
                        console.error(err);
                        btn.textContent = "Erreur";
                    }
                });
            });
        };

        let runSearch = async () => {
            let active = await this.getActiveInstance();
            if (!active) return;

            if (active.modsLocked) {
                resultsEl.innerHTML =
                    '<div class="mc-instances-empty">Les mods de cette instance sont gérés par l\'administrateur. Utilise le bouton "Mettre à jour" sur l\'accueil pour récupérer la dernière version.</div>';
                return;
            }

            if (active.loadder.loadder_type === "none") {
                resultsEl.innerHTML =
                    '<div class="mc-instances-empty">Cette instance est en Vanilla. Configurez un mod loader (Forge/NeoForge/Fabric/Quilt) dans l\'onglet VERSION pour installer des mods.</div>';
                return;
            }

            let modsPath = await this.getModsPath(active.name);
            let facets = [
                ["project_type:mod"],
                [`versions:${active.loadder.minecraft_version}`],
                [
                    `categories:${this.modrinthLoaderFacet(active.loadder.loadder_type)}`,
                ],
            ];

            resultsEl.innerHTML =
                '<div class="mc-instances-empty">Recherche...</div>';

            try {
                let url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(searchInput.value)}&facets=${encodeURIComponent(JSON.stringify(facets))}&limit=20`;
                let res = await this.fetchWithTimeout(url);
                let data = await res.json();
                renderResults(data.hits || [], active, modsPath);
            } catch (err) {
                console.error(err);
                resultsEl.innerHTML =
                    '<div class="mc-instances-empty">Impossible de contacter Modrinth.</div>';
            }
        };

        searchBtn.addEventListener("click", runSearch);
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") runSearch();
        });

        let applyLockState = (active) => {
            infoEl.textContent = `Instance active : ${active.name} (${active.loadder.minecraft_version}${active.loadder.loadder_type !== "none" ? ` + ${active.loadder.loadder_type}` : " vanilla"})${active.modsLocked ? " — géré par l'administrateur" : ""}`;
            searchInput.disabled = !!active.modsLocked;
            searchBtn.classList.toggle("disabled", !!active.modsLocked);
        };

        let active = await this.getActiveInstance();
        if (active) {
            applyLockState(active);
            await renderInstalled(active);
        }

        window.addEventListener("home:refresh", async () => {
            let active = await this.getActiveInstance();
            if (!active) return;
            applyLockState(active);
            await renderInstalled(active);
        });
    }

    async installMod(projectId, active, modsPath) {
        let loader = this.modrinthLoaderFacet(active.loadder.loadder_type);
        let versionsUrl = `https://api.modrinth.com/v2/project/${projectId}/version?game_versions=${encodeURIComponent(JSON.stringify([active.loadder.minecraft_version]))}&loaders=${encodeURIComponent(JSON.stringify([loader]))}`;
        let res = await this.fetchWithTimeout(versionsUrl);
        let versions = await res.json();
        if (!versions.length)
            throw new Error("Aucune version compatible trouvée.");

        let file =
            versions[0].files.find((f) => f.primary) || versions[0].files[0];
        let fileRes = await this.fetchWithTimeout(file.url, 30000);
        let buffer = Buffer.from(await fileRes.arrayBuffer());
        fs.writeFileSync(`${modsPath}/${file.filename}`, buffer);
    }

    // L'instance verrouillée à administrer : celle marquée modsLocked dans
    // files.json (une seule pour l'instant, "Nebula").
    async getLockedInstance() {
        let instances = await config.getInstanceList();
        return instances.find((i) => i.modsLocked);
    }

    // L'identité admin est vérifiée côté serveur (Edge Function admin-modpack)
    // via l'access_token Microsoft, jamais via un pseudo/uuid auto-déclaré :
    // voir la note de sécurité dans la fonction elle-même.
    async getFreshAccessToken() {
        let configClient = await this.db.readData("configClient");
        let account = await this.db.readData(
            "accounts",
            configClient?.account_selected,
        );
        if (!account || account.meta?.type !== "Xbox") return null;
        let refreshed = await new Microsoft(this.config.client_id).refresh(
            account,
        );
        if (refreshed.error) return null;
        return refreshed.access_token;
    }

    // supabase-js ne remonte pas le corps JSON d'une réponse d'Edge Function
    // non-2xx dans error.message (juste "Edge Function returned a non-2xx
    // status code") : le vrai message est dans error.context, une Response
    // qu'il faut lire à part.
    async describeFunctionError(error) {
        try {
            if (error?.context?.json) {
                let body = await error.context.json();
                if (body?.error) return body.error;
            }
        } catch {
            /* corps non-JSON ou déjà consommé, on retombe sur error.message */
        }
        return error?.message || "Erreur inconnue.";
    }

    async admin() {
        let navBtn = document.querySelector(".admin-nav-btn");
        let dropzone = document.querySelector(".admin-dropzone");
        let fileInput = document.querySelector(".admin-file-input");
        let uploadStatusEl = document.querySelector(".admin-upload-status");
        let modsListEl = document.querySelector(".admin-mods-list");
        let publishBtn = document.querySelector(".admin-publish-btn");
        let publishStatusEl = document.querySelector(".admin-publish-status");

        this.adminMods = [];
        this.adminAccessToken = null;

        let renderMods = () => {
            if (!this.adminMods.length) {
                modsListEl.innerHTML =
                    '<div class="mc-instances-empty">Aucun mod publié pour le moment.</div>';
                return;
            }
            modsListEl.innerHTML = this.adminMods
                .map(
                    (mod) => `
                        <div class="admin-mod-row${mod.pending ? " pending" : ""}" data-filename="${mod.filename}">
                            <div class="admin-mod-row-name">${mod.filename}${mod.pending ? " (à publier)" : ""}</div>
                            <i class="fa-solid fa-xmark admin-mod-row-remove"></i>
                        </div>
                    `,
                )
                .join("");
            modsListEl.querySelectorAll(".admin-mod-row-remove").forEach((btn) => {
                btn.addEventListener("click", (e) => {
                    let filename = e.target.closest(".admin-mod-row").dataset.filename;
                    this.adminMods = this.adminMods.filter(
                        (m) => m.filename !== filename,
                    );
                    renderMods();
                });
            });
        };

        let loadCurrentManifest = async () => {
            let locked = await this.getLockedInstance();
            if (!locked) return;
            let { data: manifest } = await supabase.functions.invoke(
                "get-modpack",
                { body: { instance_name: locked.name } },
            );
            this.adminMods = (manifest?.mods || []).map((mod) => ({
                ...mod,
                pending: false,
            }));
            renderMods();
        };

        let refreshAdminAccess = async () => {
            try {
                let accessToken = await this.getFreshAccessToken();
                if (!accessToken) {
                    navBtn.hidden = true;
                    return;
                }
                let { data, error } = await supabase.functions.invoke(
                    "admin-modpack",
                    { body: { action: "whoami", access_token: accessToken } },
                );
                if (error || !data?.is_admin) {
                    navBtn.hidden = true;
                    return;
                }
                this.adminAccessToken = accessToken;
                navBtn.hidden = false;
                await loadCurrentManifest();
            } catch (err) {
                console.error("Vérification admin impossible :", err);
                navBtn.hidden = true;
            }
        };

        window.addEventListener("account:changed", refreshAdminAccess);
        await refreshAdminAccess();

        let stageFiles = async (files) => {
            let locked = await this.getLockedInstance();
            if (!locked) return;

            for (let file of Array.from(files)) {
                if (!file.name.toLowerCase().endsWith(".jar")) continue;

                uploadStatusEl.textContent = `Envoi de ${file.name}...`;
                try {
                    let buffer = Buffer.from(await file.arrayBuffer());
                    let sha1 = crypto
                        .createHash("sha1")
                        .update(buffer)
                        .digest("hex");

                    let accessToken = await this.getFreshAccessToken();
                    let { data: uploadInfo, error } =
                        await supabase.functions.invoke("admin-modpack", {
                            body: {
                                action: "request_upload",
                                access_token: accessToken,
                                instance_name: locked.name,
                                filename: file.name,
                            },
                        });
                    if (error || !uploadInfo)
                        throw new Error(await this.describeFunctionError(error));

                    // Windows n'associe aucun type MIME aux .jar : file.type
                    // est vide, donc on force explicitement le content-type
                    // plutôt que de laisser uploadToSignedUrl deviner.
                    let { error: uploadError } = await supabase.storage
                        .from("modpacks")
                        .uploadToSignedUrl(
                            uploadInfo.path,
                            uploadInfo.token,
                            file,
                            { contentType: "application/java-archive" },
                        );
                    if (uploadError) throw uploadError;

                    this.adminMods = this.adminMods.filter(
                        (m) => m.filename !== file.name,
                    );
                    this.adminMods.push({
                        filename: file.name,
                        sha1,
                        size: file.size,
                        pending: true,
                    });
                    renderMods();
                } catch (err) {
                    console.error(`Échec de l'envoi de ${file.name} :`, err);
                    uploadStatusEl.textContent = `Échec de l'envoi de ${file.name} : ${err.message || err}`;
                    return;
                }
            }
            uploadStatusEl.textContent = "";
        };

        dropzone.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", () => {
            stageFiles(fileInput.files);
            fileInput.value = "";
        });
        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzone.classList.add("drag-over");
        });
        dropzone.addEventListener("dragleave", () => {
            dropzone.classList.remove("drag-over");
        });
        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.classList.remove("drag-over");
            stageFiles(e.dataTransfer.files);
        });

        publishBtn.addEventListener("click", async () => {
            let locked = await this.getLockedInstance();
            if (!locked) return;

            publishBtn.classList.add("disabled");
            publishStatusEl.textContent = "Publication...";
            try {
                let accessToken = await this.getFreshAccessToken();
                let { data, error } = await supabase.functions.invoke(
                    "admin-modpack",
                    {
                        body: {
                            action: "publish",
                            access_token: accessToken,
                            instance_name: locked.name,
                            mods: this.adminMods.map((mod) => ({
                                filename: mod.filename,
                                sha1: mod.sha1,
                                size: mod.size,
                            })),
                        },
                    },
                );
                if (error || !data?.version)
                    throw new Error(await this.describeFunctionError(error));

                publishStatusEl.textContent = `Publié en version ${data.version}.`;
                await loadCurrentManifest();
            } catch (err) {
                console.error("Échec de la publication du modpack :", err);
                publishStatusEl.textContent = `Échec de la publication : ${err.message || err}`;
            } finally {
                publishBtn.classList.remove("disabled");
            }
        });
    }
}

export default Settings;