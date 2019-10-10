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


var jobs = [];

bot.on('ready', function (evt){
    bot.serverID = Object.keys(bot.servers)[0];
    bot.logger = logger;
    setChannelsByType(bot.serverID);

    bot.logger.info('Connected');
    bot.logger.info(`Logged in as: ${bot.username}_(${bot.id}). Server: ${bot.serverID}`);

    jobs.push(schedule.scheduleJob('0 0 18 * * 3', function(){
        bot.sendMessage({
            to: bot.textChannelID,
            message: `<@&314584437751021575> Gameday is tomorrow (Thursday) 6 PM(PST)! :fire: :fire: :fire: `
        })
    }));
    jobs.push(schedule.scheduleJob('0 0 18 * * 4', function(){
        bot.sendMessage({
            to: bot.textChannelID,
            message: `<@&314584437751021575> It's MothaFukinGameDay time! Lets go!!! `
        })
    }));
});

bot.on('disconnect', function(errMsg, code){
    logger.info(`Bot disconnected (${code})`);
    if (errMsg){
        console.log(errMsg);
        logger.error(errMsg);
    }
    jobs.forEach((job)=> {
        job.cancel();
    });
});

bot.on('message', function(user, userID, channelID, message, evt){
    try {
        if (message.substring(0,1) == '!'){
            command.exclamation(bot, user, userID, channelID, message, evt)
        }
    } catch(err) {
        console.log(err);
        logger.error(err);
        bot.sendMessage({
            to: channelID,
            message: "Failed to run command"
        });
    }
});

function setChannelsByType(serverID){
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
    bot.voiceChannels = voiceChannels;
}