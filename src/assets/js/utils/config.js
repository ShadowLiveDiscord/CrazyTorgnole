const fs = require("fs");
const path = require("path");
import database from "./database.js";

const dataDir = path.join(__dirname, "assets", "data");

function readLocalJson(file) {
    return JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf-8"));
}

class Config {
    GetConfig() {
        return new Promise((resolve, reject) => {
            try {
                return resolve(readLocalJson("config.json"));
            } catch (error) {
                return reject({
                    error: {
                        code: "local-config",
                        message: "Server not accessible",
                    },
                });
            }
        });
    }

    async getInstanceList() {
        let instances = readLocalJson("files.json");
        let instancesList = [];
        instances = Object.entries(instances);

        for (let [name, data] of instances) {
            let instance = data;
            instance.name = name;
            instance.custom = false;
            instancesList.push(instance);
        }

        let db = new database();
        let configClient = await db.readData("configClient");
        for (let instance of configClient?.custom_instances || []) {
            instance.custom = true;
            instancesList.push(instance);
        }

        console.log(instancesList);
        return instancesList;
    }

    async addCustomInstance(instance) {
        let db = new database();
        let configClient = await db.readData("configClient");
        let customInstances = (configClient.custom_instances || []).filter(
            (i) => i.name !== instance.name,
        );
        customInstances.push(instance);
        configClient.custom_instances = customInstances;
        configClient.instance_selct = instance.name;
        await db.updateData("configClient", configClient);
    }

    async removeCustomInstance(name) {
        let db = new database();
        let configClient = await db.readData("configClient");
        configClient.custom_instances = (
            configClient.custom_instances || []
        ).filter((i) => i.name !== name);
        if (configClient.instance_selct === name) {
            let base = readLocalJson("files.json");
            configClient.instance_selct = Object.keys(base)[0];
        }
        await db.updateData("configClient", configClient);
    }

}

export default new Config();
