var request = require('request');

module.exports.strat =  (bot, messageArgs) => {
    request.post('https://squadstrats.com/wp-content/themes/squat/twooff_data.php',callback = (error, res, body) => {
        var strat = JSON.parse(body);
        displayStrat(bot, messageArgs.channelID, strat);
    });
}

function displayStrat(bot, channelID, strat){
    var attack = strat[0];
    var attachMessage = `Attack\n${attack.title}\n${attack.strat}\n`
    var defend = strat[1];
    var defendMessage = `Defend\n${defend.title}\n${defend.strat}`
    bot.sendMessage({
        to: channelID,
        message: `${attachMessage}\n${defendMessage}`
    })
}