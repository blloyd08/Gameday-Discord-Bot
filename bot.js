var Discord = require('discord.js');
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
var bot = new Discord.Client();


var jobs = [];

bot.on('ready',() => {
    logger.info('Connected');
    initBotVariables();
    scheduleJobs();
});

bot.on('message', message => {
    try {
        if (message.content.substring(0,1) == '!'){
            command.exclamation(bot, message)
        }
    } catch(err) {
        console.log(err);
        message.reply("Failed to run command");
    }
});

function initBotVariables(){
    bot.logger = logger;
    setChannelsByType(bot.serverID);
}

function setChannelsByType(serverID){
    //var afkChannelID = bot.servers[serverID].afk_channel_id;
    var afkChannelID = bot.guilds.first().afkChannelID;
    var voiceChannels = [];
    var textChannels = [];
    bot.channels.forEach(channel =>{
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
    jobs.push(schedule.scheduleJob('0 0 18 * * 3', function(){
        bot.textChannels[0].send(`<@&314584437751021575> Gameday is tomorrow (Thursday) 6 PM(PST)! :fire: :fire: :fire: `);
    }));
    jobs.push(schedule.scheduleJob('0 0 18 * * 4', function(){
        bot.textChannels[0].send(`<@&314584437751021575> It's MothaFukinGameDay time! Lets go!!! `);
    }));
}

bot.login(auth.token)