# Nebula Launcher — Bot patch notes

Bot Discord qui surveille les releases GitHub de `ShadowLiveDiscord/CrazyTorgnole` et poste automatiquement les notes de version dans un canal Discord dès qu'une nouvelle release est publiée.

## Fonctionnalités

- **Annonce automatique** : poste un embed avec les notes de version dans le canal configuré dès qu'une nouvelle release (non-draft) est détectée
- **Commande `/version`** : affiche à la demande la dernière version disponible
- **Commande `/patch_note [version]`** : affiche les notes de version d'une release précise (ex: `1.0.24`), ou de la dernière si aucun numéro n'est donné
- **Statut Discord** : le bot affiche "regarde la version x.x.x" en présence, mis à jour à chaque vérification
- **Mention de rôle** (optionnelle) : ping un rôle en plus de l'embed lors d'une nouvelle annonce

## Configuration

Le fichier `.env` (non commité) contient :

```
DISCORD_BOT_TOKEN=...
CHANNEL_ID=...
GITHUB_OWNER=ShadowLiveDiscord
GITHUB_REPO=CrazyTorgnole
POLL_INTERVAL_MS=300000
ANNOUNCE_ROLE_ID=
```

`ANNOUNCE_ROLE_ID` est optionnel : laisse-le vide pour ne ping personne, ou mets l'ID d'un rôle (ex. `@MAJ`) pour qu'il soit mentionné à chaque nouvelle annonce.

Les commandes `/version` et `/patch_note` sont enregistrées automatiquement sur le serveur du canal configuré au démarrage du bot (pas besoin de les déclarer ailleurs).

## Lancer le bot

```
npm install
npm start
```

Le bot vérifie la dernière release toutes les 5 minutes (`POLL_INTERVAL_MS`), et compare avec le tag déjà annoncé (stocké dans `state.json`, non commité). Les releases en brouillon (draft) sont ignorées.

## Garder le bot en ligne

Ce script doit rester en cours d'exécution en permanence pour fonctionner (pas de webhook).

### Option A — VPS / machine perso avec pm2

```
npm install -g pm2
pm2 start index.js --name nebula-patchnotes
```

### Option B — Discloud

Le fichier `discloud.config` est prêt pour un déploiement sur [Discloud](https://discloud.app).

1. Installe l'extension/CLI Discloud (ou utilise le bot Discloud officiel pour uploader).
2. **Ne mets pas le token dans `.env` avant l'upload** : `.discloudignore` exclut `.env` et `node_modules` du paquet envoyé. Configure plutôt les variables d'environnement (`DISCORD_BOT_TOKEN`, `CHANNEL_ID`, `GITHUB_OWNER`, `GITHUB_REPO`, `POLL_INTERVAL_MS`) via le panneau Discloud (commande `/env` ou dashboard web) après le premier déploiement.
3. Compresse le dossier `discord-bot/` (sans `node_modules`, `.env`, `state.json`) et upload-le, ou utilise la commande `discloud commands upload` si tu as la CLI configurée.
4. Remplis `ID` dans `discloud.config` avec l'ID renvoyé par Discloud après le premier déploiement, pour les mises à jour suivantes.
