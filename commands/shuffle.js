let permissions = require('discord.js').Permissions;
var { playAudioClipByFileName } = require('../commands/audio');

var shuffledTeams = {
    team1: [],
    team2: []
}

module.exports.shuffle =  (bot, message, args) => {
    var firstArg = args.length > 0 ? args[0].toLowerCase() : "";
    var isValid = verifyShuffle(message, firstArg);

    if (isValid){
        switch (firstArg){
            case "reset":
                resetShuffle(bot, message);
                break;
            case "move":
                moveShuffledMembers(bot, message);
                break;
            default:
                shuffleChannelMembers(message);
        }
    }
}

function verifyShuffle(message, firstArg){
    if (!message.member.voice.channel){
        message.reply("You must be in a voice channel to shuffle");
        return false;
    }

    if ( message.member.voice.channel.members.size < 2 && firstArg != "reset"){
        message.reply("You must have at least 2 users in your voice channel to shuffle");
        return false;
    }

    return true;
}

function buildTeamMessage(teamNumber, users){
    var message = "Team " + teamNumber + "\n";
    for (var i = 0; i < users.length; i++){
        message += users[i].user.username + "\n";
    }
    return message;
}

function shuffleChannelMembers(message){
    if (!message.member.voice.channel)
        return;
    shuffledTeams = {
        team1: [],
        team2: []
    }
    var members = message.member.voice.channel.members.array();
    var teams = randomlySplitArray(members);
    shuffledTeams.team1 = teams[0];
    shuffledTeams.team2 = teams[1];

    var team1Message = buildTeamMessage(1, shuffledTeams.team1);
    var team2Message = buildTeamMessage(2, shuffledTeams.team2);
    message.channel.send( team1Message + "\n\n" + team2Message);
}

function moveShuffledMembers(bot, message){
    var valid = validateMovePermission(message);
    if (!valid){
        message.reply("You don't have permission to move users.");
        return;
    }
    if (!message.member.voice.channel){
        message.reply('You need to join a voice channel first!');
        return;
    }
    playAudioClipByFileName(message.member.voice.channel, "fight.mp3")
        .then(() => {
            moveUsers(bot.voiceChannels[0], shuffledTeams.team1);
            moveUsers(bot.voiceChannels[1], shuffledTeams.team2);
            message.reply("Moved users into teams");
        }).catch((error) => {
            console.log(error);
            message.reply("Failed to move users into teams");
        }); 
}

function resetShuffle(bot, message){
    var valid = validateMovePermission(message);
    if (!valid){
        return;
    }
    moveUsers(bot.voiceChannels[0], shuffledTeams.team2);

    message.reply("Shuffle has been reset");
}

function moveUsers(voiceChannel, users){
    for (var i=0; i < users.length; i++){
        users[i].voice.setChannel(voiceChannel);
    }
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

function validateMovePermission(message){
    var permissionGranted = message.member.hasPermission(permissions.FLAGS.MOVE_MEMBERS);
    if (!permissionGranted){
        message.reply(`You do not have permission to move users`);
    }
    return permissionGranted;
}
