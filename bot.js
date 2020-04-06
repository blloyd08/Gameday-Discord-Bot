import Discord from 'discord.js';
import logger from 'winston';
import auth from './config/auth.js';
import schedule from 'node-schedule';
import { exclamation, dollar} from './commands/command.js';
import { handleUserJoinVoiceChannel } from './commands/audio.js';


// Configure logger
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Bot
var bot = new Discord.Client();

var jobs = [];

bot.on('ready',() => {
    logger.info('Connected');
    initBotVariables();
    scheduleJobs();
});

bot.on('message', message => {
    try {
        switch(message.content.substring(0,1)){
            case '!': 
                exclamation(bot, message);
                break;
            case '$':
                dollar(bot,message);
        } 
    } catch(err) {
        console.log(err);
        message.reply("Failed to run command");
    }
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

function initBotVariables(){
    bot.logger = logger;
    setChannelsByType(bot.serverID);
}

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

function scheduleJobs(){

    // Cancel jobs previously setup. This can happen if the bot disconnects and reconnects.
    if (jobs.length > 0){
        jobs.forEach((job) => {
            schedule.cancelJob(job);
        });
    }
    jobs.push(schedule.scheduleJob('0 0 18 * * 3', function(){
        bot.textChannels[0].send(`<@&314584437751021575> Gameday is tomorrow (Thursday) 6 PM(PST)! :fire: :fire: :fire: `);
    }));
    jobs.push(schedule.scheduleJob('0 0 18 * * 4', function(){
        bot.textChannels[0].send(`<@&314584437751021575> It's MothaFukinGameDay time! Lets go!!! `);
    }));
}

bot.login(auth.token)