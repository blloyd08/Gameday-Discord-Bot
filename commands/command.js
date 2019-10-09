let Shuffle = require('./shuffle')
let strat = require('./strat')

module.exports = {
    exclamation: (bot, user, userID, channelID, message, evt) => {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
        args = args.splice(1);
        var messageArgs = {
            user: user,
            userID: userID,
            channelID: channelID,
            message: message,
            args: args
        }

        switch(cmd){
            case 'shuffle':
                Shuffle.shuffle(bot, messageArgs);
                break;
            case 'strat':
                strat.strat(bot, messageArgs);
                break;
            case 'echo':
                echo(bot,messageArgs);
                break;
            default:
                bot.sendMessage({
                    to:channelID,
                    message: `${cmd} is not a supported command`
                })
        } // End switch
    }
}

function echo(bot, messageArgs){
    var user = bot.users[messageArgs.userID];
    bot.sendMessage({
        to: messageArgs.channelID,
        message: `<@${messageArgs.userID}> ${messageArgs.message}`
    })
}

