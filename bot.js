import Discord from 'discord.js';
import logger from 'winston';
import auth from './config/auth.js';
import { scheduleJobs } from './jobs.js'

import { handleUserJoinVoiceChannel } from './commands/audio.js';
import { botCommandManager } from './commands/commandManager.js';

// Configure logger
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Bot
var bot = new Discord.Client();

function initBotVariables(){
    bot.logger = logger;
    setChannelsByType(bot.serverID);
}

bot.on('ready',() => {
    logger.info('Connected');
    initBotVariables();
    scheduleJobs(bot);
});

bot.on('message', message => {
    botCommandManager.handleMessage(bot, message);
});

bot.on('voiceStateUpdate', (oldState, newState) =>{
    try{
        if (!newState.member.user.bot){
            if (!newState.channel){
                console.log(`USER ${newState.member.user.username}(${newState.member.user.id}) LEFT VOICE CHANNEL`);
            } else if (!oldState.channel){
                console.log(`USER ${newState.member.user.username}(${newState.member.user.id}) HAS JOINED VOICE CHANNEL`)
                handleUserJoinVoiceChannel(newState);
            }
        }
    } catch(err){
        console.error(err);
    }
})


function setChannelsByType(serverID){
    var afkChannelID = bot.guilds.cache.first().afkChannelID;
    var voiceChannels = [];
    var textChannels = [];
    bot.channels.cache.forEach(channel =>{
        switch (channel.type){
            case "voice":
                if (channel.id !== afkChannelID)
                    voiceChannels.push(channel);
                break;
            case "text":
                textChannels.push(channel);
                break;
        }
    });
    bot.voiceChannels = voiceChannels;
    bot.textChannels = textChannels;
}

bot.login(auth.token)