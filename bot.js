var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var command = require('./commands/command');
var schedule = require('node-schedule')


// Configure logger
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Bot
var bot = new Discord.Client({
    token: auth.token,
    autorun: true
});


var schedules = {
    gameday: null,
    reminder: null
}

bot.on('ready', function (evt){
    bot.serverID = Object.keys(bot.servers)[0];
    bot.logger = logger;
    bot.voiceChannels = getVoiceChannels(bot.serverID);

    logger.info('Connected');
    logger.info(`Logged in as: ${bot.username}_(${bot.id}). Server: ${bot.serverID}`);

    schedules.reminder = schedule.scheduleJob('0 44 20 * * 3', function(){
        bot.sendMessage({
            to: bot.textChannelID,
            message: `<@&314584437751021575> Gameday is tomorrow (Thursday) 6 PM(PST)! :volcano: :fire: :fire: `
        })
    });
    schedules.gameday = schedule.scheduleJob('0 0 18 * * 4', function(){
        bot.sendMessage({
            to: bot.textChannelID,
            message: `<@&314584437751021575> It's MothaFukinGameDay time! Lets go!!! `
        })
    })
});

bot.on('disconnect', function(errMsg, code){
    logger.info(`Bot disconnected (${code})`);
    if (errMsg){
        console.log(errMsg);
        logger.error(errMsg);
    }
    if (schedules.gameday)
        schedules.gameday.cancel();
    if (schedules.reminder)
        schedules.reminder.cancel();
});

bot.on('message', function(user, userID, channelID, message, evt){
    try {
        if (message.substring(0,1) == '!'){
            command.exclamation(bot, user, userID, channelID, message, evt)
        } // end if message starts with !
    } catch(err) {
        console.log(err);
        logger.error(err);
        bot.sendMessage({
            to: channelID,
            message: "Failed to run command"
        });
    }
});

function getVoiceChannels(serverID){
    var afkChannelID = bot.servers[serverID].afk_channel_id;
    var voiceChannels = [];
    for (channelID in bot.channels){
        var channel = bot.channels[channelID];
        switch (channel.type){
            case 2:
                if (channel.id != afkChannelID)
                    voiceChannels.push(channel);
                break;
            case 0:
                bot.textChannelID = channel.id;
                break;

        }
    }
    return voiceChannels;
}