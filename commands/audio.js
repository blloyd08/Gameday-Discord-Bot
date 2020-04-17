import { Command } from './command.js'
import { CommandMethod } from './commandMethod.js'
import { getAudioConfig, getAudioFilePath} from '../util.js';


export class AudioCommand extends Command {
    constructor(){
        super("$", "", [
            new DefaultCommand(),
            new ClipCommand(),
            new ListCommand()
        ]);
    }

    execute(bot, message, args){
        var args = message.content.substring(1).split(' ');
        var firstArg = args.length > 0 ? args[0].toLowerCase() : "";

        switch (firstArg){
            case "":
                playUserAudioClip(message);
                break;
            case "list":
                listAudioClips(message);
                break;
            default:
                playAudioClipByTitle(message, firstArg);
        }
    }

    // AudioCommand doesn't use the name of the command when making a call. Remove name from output.
    toString(){
        let commandOutput = "";
        this.methods.forEach(method => {
          commandOutput += `\n${this.prefix}${method.toString()}`;
        })
        return commandOutput;
      }
}

class DefaultCommand extends CommandMethod {
    constructor(){
        super(undefined, "Play the audio clip that's assigned to you when you join voice channel");
    }
}

class ClipCommand extends CommandMethod {
    constructor(){
        super("<name of audio clip>", "Play the audio clip with the given name");
    }
}

class ListCommand extends CommandMethod {
    constructor(){
        super("list", "List all of the available audio clips");
    }
}

let userAudioHistory = {
    countLimit: 5,
    expireAfter: 1, // hours
    records: {}
};


export function handleUserJoinVoiceChannel(voiceState) {
    var userFilePath = getUserAudioClipPath(voiceState.member.user.id);
    if (voiceState.channel && userFilePath){
        playAudioClip(voiceState.channel,userFilePath)
            .catch(err => { console.log(err)});
    }
}

export function playAudioClipByFileName(voiceChannel, fileName) {
    return new Promise(function(resolve, reject){
        if (voiceChannel && fileName){
            var filePath = getAudio + fileName;
            playAudioClip(voiceChannel, filePath)
                .then(() => {resolve()})
                .catch(err => { reject(err) });
        } else {
            reject("voiceChannel or fileName doesn't have a value");
        }
    });
}

function listAudioClips(message) {
    let audioClipNames = Object.keys(getAudioConfig().clips);
    message.reply(`\n${audioClipNames.join(", ")}`);
}

function getUserAudioClipPath(userId) {
    var userFileName = getAudioConfig().users[userId];
    if (!userFileName){
        return
    }
    return getAudioFilePath(userFileName);
}

function getAudioClipPathByTitle(title){
    var audioClipFileName = getAudioConfig().clips[title];
    if (!audioClipFileName){
        return
    }
    return getAudioFilePath(audioClipFileName);
}

function hasExcededAudioCountLimit(userId){
    var expiredTime = new Date();
    expiredTime.setDate(expiredTime.getHours() - userAudioHistory.expireAfter);

    if (!(userId in userAudioHistory.records)){
        userAudioHistory.records[userId] = [];
    }

    let history = userAudioHistory.records[userId].filter((playedDate) => {
        return playedDate < expiredTime;
    });
    var hasExcededCount = history.length >= userAudioHistory.countLimit
    if (!hasExcededCount){
        history.push(new Date());
    }
    userAudioHistory.records[userId] = history;

    return hasExcededCount;
}

function playAudioClip(voiceChannel, filePath) {
    return new Promise((resolve, reject) => {
        console.log("Playing audio clip:", filePath);
        try {
            voiceChannel.join()
            .then(connection => {
                const dispatcher = connection.play(filePath, {volume: 0.7})
                dispatcher.on('finish', () => {
                    voiceChannel.leave();
                    console.log("Finished playing audio file", filePath);
                    resolve();
                })
            })
            .catch((error) => 
                {
                    console.error(error);
                    reject(new Error("Failed to join voice channel"))
        
                });
        } catch(error) {
            if (voiceChannel)
                voiceChannel.leave();
            reject(error);
        }
    });
}

function playUserAudioClip(message){
    var voiceChannel = message.member.voice.channel;
    if (voiceChannel) {
        var userFilePath = getUserAudioClipPath(message.member.user.id);
        if (userFilePath)
            playAudioClip(voiceChannel,userFilePath)
                .catch(err => { console.log(err)});
    } else {
        message.reply('You need to join a voice channel first!');
    }
}

function playAudioClipByTitle(message, title){
    if (hasExcededAudioCountLimit(message.member.id)){
        message.reply(`You have exceeded the number of audio clips that can be played. Only ${userAudioHistory.countLimit} clips can be played in ${userAudioHistory.expireAfter} hour.`);
    } else {
        var voiceChannel = message.member.voice.channel;
        if (voiceChannel) {
            var userFilePath = getAudioClipPathByTitle(title);
            if (userFilePath){
                playAudioClip(voiceChannel,userFilePath)
                    .catch(err => { console.log(err)});
            } else {
                message.reply(`Audio clip ${title} not found`);
            }
        } else {
            message.reply('You need to join a voice channel first!');
        }
    }
}