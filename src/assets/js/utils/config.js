const fs = require("fs");
const path = require("path");

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
            instancesList.push(instance);
        }
        console.log(instancesList);
        return instancesList;
    }

    async getNews() {
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
