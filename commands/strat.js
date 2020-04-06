import request from 'request';
import { Command } from './command.js'
import { CommandMethod } from './commandMethod.js'


export class StratCommand extends Command {
    constructor(){
        super("!", "strat", [
            new DefaultCommand()
        ]);
    }

    execute(bot, message, args){
        strat(message);
    }
}

class DefaultCommand extends CommandMethod {
    constructor(){
        super(undefined, "Displays a StratRoulette for attacher and defender");
    }
}


export function strat(message) {
    request.post('https://squadstrats.com/wp-content/themes/squat/twooff_data.php',function (error, res, body)  {
        var strat = JSON.parse(body);
        displayStrat(message.channel, strat);
    });
}

function displayStrat(channel, strat){
    var attack = strat[0];
    var attachMessage = `Attack\n${attack.title}\n${attack.strat}\n`
    var defend = strat[1];
    var defendMessage = `Defend\n${defend.title}\n${defend.strat}`
    channel.send(`${attachMessage}\n${defendMessage}`);
}