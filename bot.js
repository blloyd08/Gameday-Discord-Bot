var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var command = require('./commands/command');

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

bot.on('ready', function (evt){
    bot.serverID = Object.keys(bot.servers)[0];
    bot.logger = logger;
    bot.voiceChannels = getVoiceChannels(bot.serverID);

    logger.info('Connected');
    logger.info(`Logged in as: ${bot.username}_(${bot.id}). Server: ${bot.serverID}`);
});

bot.on('disconnect', function(errMsg, code){
    logger.info(`Bot disconnected (${code})`);
    if (errMsg)
        logger.error(errMsg);
});

bot.on('message', function(user, userID, channelID, message, evt){
    try {
        if (message.substring(0,1) == '!'){
            var args = message.substring(1).split(' ');
            var cmd = args[0];
            var userChannel = getUserVoiceChannel(userID);
            args = args.splice(1);
            var messageArgs = {
                userID: userID,
                channelID: channelID,
                message: message,
                args: args
            }

            switch(cmd){
                case 'shuffle':
                    command.shuffle(bot, messageArgs);
                    break;
                default:
                    bot.sendMessage({
                        to:channelID,
                        message: `${cmd} is not a supported command`
                    })
            } // End switch
        } // end if message starts with !
    } catch(err) {
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
        if (channel.type == 2){
            if (channel.id != afkChannelID)
                voiceChannels.push(channel);
        }
    }
    return voiceChannels;
}

// find the voice channel that the user is connected to
function getUserVoiceChannel(userID){
    var member = bot.servers[bot.serverID].members[userID];
    if (!member || !member.voice_channel_id)
        return null;
    return bot.channels[member.voice_channel_id];
}


