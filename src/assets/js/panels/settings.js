import {
    accountSelect,
    appdata,
    changePanel,
    config,
    database,
    popup,
    setBackground,
    setStatus,
    Slider,
} from "../utils.js";
const { ipcRenderer } = require("electron");
const os = require("os");

class Settings {
    static id = "settings";

    async init(config) {
        this.config = config;
        this.db = new database();
        this.navBTN();
        this.accounts();
        this.ram();
        this.javaPath();
        this.resolution();
        this.launcher();
        this.mcVersion();
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
        sliderDiv.setAttribute("max", Math.trunc((80 * totalMem) / 100));

        let ram = config?.java_config?.java_memory
            ? {
                  ramMin: config.java_config.java_memory.min,
                  ramMax: config.java_config.java_memory.max,
              }
            : { ramMin: "1", ramMax: "2" };

        if (totalMem < ram.ramMin) {
            config.java_config.java_memory = { min: 1, max: 2 };
            this.db.updateData("configClient", config);
            ram = { ramMin: "1", ramMax: "2" };
        }

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
        javaPathText.textContent = `${await appdata()}/${process.platform == "darwin" ? this.config.dataDirectory : `.${this.config.dataDirectory}`}/runtime`;

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

        width.value = resolution.width;
        height.value = resolution.height;

        width.addEventListener("change", async () => {
            let configClient = await this.db.readData("configClient");
            configClient.game_config.screen_size.width = width.value;
            await this.db.updateData("configClient", configClient);
        });

        height.addEventListener("change", async () => {
            let configClient = await this.db.readData("configClient");
            configClient.game_config.screen_size.height = height.value;
            await this.db.updateData("configClient", configClient);
        });

        resolutionReset.addEventListener("click", async () => {
            let configClient = await this.db.readData("configClient");
            configClient.game_config.screen_size = {
                width: "854",
                height: "480",
            };
            width.value = "854";
            height.value = "480";
            await this.db.updateData("configClient", configClient);
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

        let themeBox = document.querySelector(".theme-box");
        let theme = configClient?.launcher_config?.theme || "auto";

        if (theme == "auto") {
            document
                .querySelector(".theme-btn-auto")
                .classList.add("active-theme");
        } else if (theme == "dark") {
            document
                .querySelector(".theme-btn-sombre")
                .classList.add("active-theme");
        } else if (theme == "light") {
            document
                .querySelector(".theme-btn-clair")
                .classList.add("active-theme");
        }

        themeBox.addEventListener("click", async (e) => {
            if (e.target.classList.contains("theme-btn")) {
                let activeTheme = document.querySelector(".active-theme");
                if (e.target.classList.contains("active-theme")) return;
                activeTheme?.classList.remove("active-theme");

                if (e.target.classList.contains("theme-btn-auto")) {
                    setBackground();
                    theme = "auto";
                    e.target.classList.add("active-theme");
                } else if (e.target.classList.contains("theme-btn-sombre")) {
                    setBackground(true);
                    theme = "dark";
                    e.target.classList.add("active-theme");
                } else if (e.target.classList.contains("theme-btn-clair")) {
                    setBackground(false);
                    theme = "light";
                    e.target.classList.add("active-theme");
                }

                let configClient = await this.db.readData("configClient");
                configClient.launcher_config.theme = theme;
                await this.db.updateData("configClient", configClient);
            }
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
                let res = await fetch(
                    "https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json",
                );
                let data = await res.json();
                return (data[mcVersion] || []).slice().reverse();
            }

            if (loaderType === "neoforge") {
                let res = await fetch(
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
                let res = await fetch(`${metaHost}${mcVersion}`);
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
            let res = await fetch(
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
            let instanceName = `CrazyTorgnole_${mcVersion}_${loaderLabel}`;

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
    }
}

export default Settings;