import { shuffle } from './shuffle';
import { strat } from './strat';
import { audioCommand } from './audio';


export function exclamation(bot, message) {
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
        default:
            message.reply(`${cmd} is not a supported command`);
    }
}

export function dollar(bot, message) {
    var args = message.content.substring(1).split(' ');
    audioCommand(bot, message, args);
}