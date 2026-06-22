const fs = require("fs");
const path = require("path");
import supabase from "./supabase.js";
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

    async getNews() {
        let { data, error } = await supabase
            .from("news")
            .select("title, content, author, publish_date:published_at")
            .order("published_at", { ascending: false });

        if (!error && data) return data;

        let config = (await this.GetConfig()) || {};

        if (config.rss) {
            return new Promise((resolve, reject) => {
                const nodeFetch = require("node-fetch");
                const convert = require("xml-js");
                nodeFetch(config.rss)
                    .then(async (config) => {
                        if (config.status === 200) {
                            let news = [];
                            let response = await config.text();
                            response = JSON.parse(
                                convert.xml2json(response, { compact: true }),
                            )?.rss?.channel?.item;

                            if (!Array.isArray(response)) response = [response];
                            for (let item of response) {
                                news.push({
                                    title: item.title._text,
                                    content: item["content:encoded"]._text,
                                    author: item["dc:creator"]._text,
                                    publish_date: item.pubDate._text,
                                });
                            }
                            return resolve(news);
                        } else
                            return reject({
                                error: {
                                    code: config.statusText,
                                    message: "server not accessible",
                                },
                            });
                    })
                    .catch((error) => reject({ error }));
            });
        } else {
            return new Promise((resolve, reject) => {
                try {
                    return resolve(readLocalJson("news.json"));
                } catch (error) {
                    return reject({
                        error: {
                            code: "local-news",
                            message: "server not accessible",
                        },
                    });
                }
            });
        }
    }
}

export default new Config();
