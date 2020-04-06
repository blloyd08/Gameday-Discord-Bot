import request from 'request';

export function strat(message) {
    request.post('https://squadstrats.com/wp-content/themes/squat/twooff_data.php',callback = (error, res, body) => {
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