#!/bin/bash

# This CWD is expected to be the root of this project. This script will do the following
# - Pull latest from git
# - Start the discord bot as a background task
git pull --rebase > "/var/log/discord-bot/update-$(date +%FT%T).log"

# start the discord bot
nohup npm run start&
sleep 5
pgrep node > /var/log/discord-bot/pid.txt
