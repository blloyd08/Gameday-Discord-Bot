#!/bin/bash

# This CWD is expected to be the root of this project. This script will do the following
# - Pull latest from git
# - Start the discord bot as a background task
git pull --rebase > "/var/log/discord-bot/update-$(date +%FT%T).log"
npm install
npm run build

# start the discord bot
npm install pm2@latest -g
pm2 start ./out/bot.js
