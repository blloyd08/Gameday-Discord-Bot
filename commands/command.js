let { shuffle } = require('./shuffle');
let { strat } = require('./strat');
let { audioCommand } = require('./audio');

module.exports = {
    exclamation: (bot, message) => {
        var args = message.content.substring(1).split(' ');
        var cmd = args[0].toLowerCase();
        args = args.splice(1);

        switch(cmd){
            case 'shuffle':
                shuffle(bot, message, args);
                break;
            case 'strat':
                strat(message);
                break;
            case 'play':
                audioCommand(bot, message, args);
                break;
            default:
                message.reply(`${cmd} is not a supported command`);
        }
    }
}