import { playAudioClipByFileName } from '../commands/audio.js';
import discord from 'discord.js';
import { Command } from './command.js'
import { CommandMethod } from './commandMethod.js'


export class ShuffleCommand extends Command {
    constructor(){
        super("!", "shuffle", [
            new DefaultCommand(),
            new MoveCommand(),
            new ResetCommand()
        ]);
    }

    onValidate(params){
        if (!params.message.member.voice.channel){
            params.message.reply("You must be in a voice channel to shuffle");
            return false;
        }
    
        if (getVoiceChannelMembers(params.message.member.voice.channel).size < 2 && params.methodName != "reset"){
            params.message.reply("You must have at least 2 users in your voice channel to shuffle");
            return false;
        }
    
        return true;
    }

}

class DefaultCommand extends CommandMethod {
    constructor(){
        super(undefined, "Split all voice channel members into two teams then display the teams");
    }

    execute(params){
        shuffleChannelMembers(params.message);
    }
}

class ResetCommand extends CommandMethod{
    constructor(){
        super("reset", "Moves all members back to the first voice channel", undefined);
    }

    execute(params){
        resetShuffle(params.bot, params.message);
    }
}

class MoveCommand extends CommandMethod {
    constructor() {
        super("move", "Move Team 2 to the second voice channel", undefined);
    }

    execute(params){
        moveShuffledMembers(params.bot, params.message);
    }
}


var shuffledTeams = {
    team1: [],
    team2: []
}


function getVoiceChannelMembers(voiceChannel){
    return voiceChannel.members.filter((member) => {
        return !member.user.bot;
    });
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
    var members = getVoiceChannelMembers(message.member.voice.channel).array();
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
    var shuffledArray = shuffleArray(fullArray);
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

function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function validateMovePermission(message){
    var permissionGranted = message.member.hasPermission(discord.Permissions.FLAGS.MOVE_MEMBERS);
    if (!permissionGranted){
        message.reply(`You do not have permission to move users`);
    }
    return permissionGranted;
}
