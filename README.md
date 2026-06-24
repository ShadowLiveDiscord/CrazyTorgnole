# Nebula Launcher

Launcher Minecraft Electron complet : authentification (Microsoft / compte hors-ligne / AZauth), gestion d'instances, paramètres (RAM, Java, résolution), mise à jour auto.

## Lancer en développement

```
npm install
npm start
```

En mode dev (détecté via `!app.isPackaged` dans `src/app.js`), la fenêtre principale s'ouvre directement et saute l'écran de mise à jour.

## Architecture

- `src/app.js` : process principal Electron (fenêtres, IPC, auto-update)
- `src/assets/js/windows/` : création des fenêtres (splash `index.html`, launcher `launcher.html`)
- `src/panels/` + `src/assets/js/panels/` : panneaux login / accueil / paramètres
- `src/assets/js/utils/` : config, base de données locale (comptes), popups, slider RAM, rendu de skin
- `src/assets/data/config.json` : configuration du launcher (maintenance, RSS, `client_id` Microsoft)
- `src/assets/data/files.json` : liste des instances/modpacks (version Minecraft, whitelist, JVM args)
- `assets/icon.ico` : icône utilisée uniquement pour l'installeur Windows (`electron-builder`)
- `src/assets/images/icon.png` : logo Nebula (cristal + chaîne) utilisé dans l'app (fenêtre + écran de connexion)

## ⚠️ À faire avant utilisation réelle

1. **Authentification Microsoft** : `src/assets/data/config.json` a un `client_id` vide. Il faut créer une application sur le [portail Azure](https://portal.azure.com) (Azure AD App registrations, type "compte Microsoft personnel"), récupérer l'Application (client) ID, et le coller dans `client_id`. Sans ça, le bouton de connexion Microsoft ne fonctionnera pas. C'est une étape que tu dois faire toi-même (création de compte/app sur le portail Microsoft).
2. **Serveur/instance** : `src/assets/data/files.json` contient une instance "Nebula" avec `url: null` (pas de modpack à télécharger). Si tu veux distribuer des mods, héberge un fichier de manifeste et renseigne `url`.
3. **Réseaux sociaux** : `src/panels/home.html` contient des liens Discord/GitHub/YouTube factices (`https://discord.gg/...`) à remplacer par les vrais.

## Build (exécutable Windows)

```
npm run dist
```

Génère `dist/Nebula Launcher Setup 1.0.0.exe`.

## Régénérer les icônes / assets d'installeur

```
python scripts/gen_icon_from_logo.py        # icon.png / icon.ico depuis assets/nebula_logo_raw.png
python scripts/gen_installer_assets.py      # bannière + image latérale NSIS
```

Le fond `src/assets/images/background.png` est l'image d'origine du template (scène Minecraft), pas régénérée par ces scripts.
