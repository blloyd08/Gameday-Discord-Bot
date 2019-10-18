let Shuffle = require('./shuffle')
let strat = require('./strat')


module.exports = {
    exclamation: (bot, message) => {
        var args = message.content.substring(1).split(' ');
        var cmd = args[0];
        args = args.splice(1);

        switch(cmd){
            case 'shuffle':
                Shuffle.shuffle(bot, message, args);
                break;
            case 'strat':
                strat.strat(message);
                break;
            default:
                message.reply(`${cmd} is not a supported command`);
        }
    }
}