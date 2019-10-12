let Permission = require('../permission')

var shuffledTeams = {
    all: [],
    team1: [],
    team2: [],
    moved: true
}

module.exports.shuffle =  (bot, messageArgs) => {
    let userChannel = getUserVoiceChannel(bot, messageArgs.userID);
    var args = messageArgs.args;
    var firstArg = args.length > 0 ? args[0].toLowerCase() : "";
    var isValid = verifyShuffle(bot, messageArgs, userChannel, firstArg);

    if (isValid){
        switch (firstArg){
            case "reset":
                resetShuffle(bot, messageArgs);
                break;
            case "move":
                moveShuffledMembers(bot, messageArgs);
                break;
            default:
                shuffleChannelMembers(bot, messageArgs, userChannel);
        }
    }
    
}

function verifyShuffle(bot, messageArgs, userChannel, firstArg){
    if (!userChannel){
        bot.sendMessage({
            to: messageArgs.channelID,
            message: "You must be in a voice channel to shuffle"
        });
        return false;
    }

    var memberIDs = Object.keys(userChannel.members);
    if (memberIDs.length < 2 && firstArg != "reset"){
        bot.sendMessage({
            to: messageArgs.channelID,
            message: "You must have at least 2 users in your voice channel to shuffle"
        });
        return false;
    }

    return true;
}

function buildTeamMessage(teamNumber, users){
    var message = "Team " + teamNumber + "\n";
    for (var i = 0; i < users.length; i++){
        message += users[i].username + "\n";
    }
    return message;
}

function shuffleChannelMembers(bot,messageArgs, voiceChannel){
    if (!voiceChannel)
        return;
    var members = Object.keys(voiceChannel.members);
    var teams = randomlySplitArray(members);
    shuffledTeams.team1 = getUsers(bot, teams[0]);
    shuffledTeams.team2 = getUsers(bot, teams[1]);
    shuffledTeams.all = shuffledTeams.team1.concat(shuffledTeams.team2);
    shuffledTeams.moved = false;

    var team1Message = buildTeamMessage(1, shuffledTeams.team1);
    var team2Message = buildTeamMessage(2, shuffledTeams.team2);
    bot.sendMessage({
        to: messageArgs.channelID,
        message: team1Message + "\n\n" + team2Message
    });
}

function moveShuffledMembers(bot, messageArgs){
    var valid = validateMovePermission(bot, messageArgs);
    if (!valid){
        return;
    }

    moveUsers(bot, bot.voiceChannels[0].id, shuffledTeams.team1);
    moveUsers(bot, bot.voiceChannels[1].id, shuffledTeams.team2);
    shuffledTeams.moved = true;
    bot.sendMessage({
        to: messageArgs.channelID,
        message: "Moved users into teams"
    });
}

function resetShuffle(bot, messageArgs){
    var valid = validateMovePermission(bot, messageArgs);
    if (!valid){
        return;
    }
    moveUsers(bot, bot.voiceChannels[0].id, shuffledTeams.all);
    shuffledTeams = {
        all: [],
        team1: [],
        team2: [],
        moved: true
    }
    bot.sendMessage({
        to: messageArgs.channelID,
        message: "Shuffle has been reset"
    });
}

function moveUsers(bot, channelID, users){
    for (var i=0; i < users.length; i++){
        moveUser(bot, channelID, users[i]);
    }
}

function moveUser(bot, channelID, user) {
    bot.logger.info(`Moving user: ${user.user}`)
    bot.moveUserTo({
        serverID: bot.serverID,
        userID: user.id,
        channelID: channelID
    }, (message) => {
        bot.logger.info(`Moved user ${user.username}`);
        if (message)
            bot.logger.error(message);
    })
}

function getUsers(bot, userIds){
    var users = []
    userIds.forEach((userId) => {
        users.push(bot.users[userId]);
    })
    return users;
}

// find the voice channel that the user is connected to
function getUserVoiceChannel(bot, userID){
    var member = bot.servers[bot.serverID].members[userID];
    if (!member || !member.voice_channel_id)
        return null;
    return bot.channels[member.voice_channel_id];
}

function randomlySplitArray(fullArray){
    var shuffledArray = shuffle(fullArray);
    var midpoint = Math.floor(shuffledArray.length / 2);
    var isOdd = shuffledArray.length % 2 == 1;
    var a = shuffledArray.slice(0, midpoint);
    var b = shuffledArray.slice(midpoint, midpoint * 2);
    if (isOdd){
        var lastElement = shuffledArray[shuffledArray.length - 1];
        if (Math.round(Math.random())){
            a.push(lastElement);
        } else {
            b.push(lastElement);
        }
    }
    return [a, b];
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function validateMovePermission(bot, messageArgs){
    var permissionGranted = Permission.canMoveUsers(bot, messageArgs.userID);
    if (!permissionGranted){
        bot.sendMessage({
            to: messageArgs.channelID,
            message: `You do not have permission to move users`
        });
    }
    return permissionGranted;
}
