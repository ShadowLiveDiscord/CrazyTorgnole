# Nebula Launcher — Bot patch notes

Bot Discord qui surveille les releases GitHub de `ShadowLiveDiscord/CrazyTorgnole` et poste automatiquement les notes de version dans un canal Discord dès qu'une nouvelle release est publiée.

## Configuration

Le fichier `.env` (non commité) contient :

```
DISCORD_BOT_TOKEN=...
CHANNEL_ID=...
GITHUB_OWNER=ShadowLiveDiscord
GITHUB_REPO=CrazyTorgnole
POLL_INTERVAL_MS=300000
```

## Lancer le bot

```
npm install
npm start
```

Le bot vérifie la dernière release toutes les 5 minutes (`POLL_INTERVAL_MS`), et compare avec le tag déjà annoncé (stocké dans `state.json`, non commité). Les releases en brouillon (draft) sont ignorées.

## Garder le bot en ligne

Ce script doit rester en cours d'exécution en permanence pour fonctionner (pas de webhook). Pour un usage durable, héberge-le sur une petite machine/VPS toujours allumée, ou utilise un gestionnaire de process comme `pm2` :

```
npm install -g pm2
pm2 start index.js --name nebula-patchnotes
```
