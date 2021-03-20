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

    parseParameters(bot, message, args){
        var args = message.content.substring(1).split(' ');
        var methodName = args.length > 0 ? args[0].toLowerCase() : undefined;
        if (methodName === '')
            methodName = undefined;
        return {
          bot: bot,
          message: message,
          args: args,
          methodName: methodName
        }
    }

    executeMethod(params){
        if (params.methodName in this.methods){
          this.methods[params.methodName].execute(params)
        } else {
            params["title"] = params.methodName;
            this.methods["<name of audio clip>"].execute(params);
        }
    }

    // AudioCommand doesn't use the name of the command when making a call. Remove name from output.
    toString(){
        let commandOutput = "";
        let methodKeys = Object.keys(this.methods);

        methodKeys.forEach(key => {
          let method = this.methods[key];
          commandOutput += `\n${this.prefix}${method.toString()}`;
        })

        return commandOutput;
    }
}

class DefaultCommand extends CommandMethod {
    constructor(){
        super(undefined, "Play the audio clip that's assigned to you when you join voice channel");
    }

    execute(params){
        var voiceChannel = params.message.member.voice.channel;
        if (voiceChannel) {
            var userFilePath = getUserAudioClipPath(params.message.member.user.id);
            if (userFilePath)
                playAudioClip(voiceChannel,userFilePath)
                    .catch(err => { console.log(err)});
        } else {
            params.message.reply('You need to join a voice channel first!');
        }
    }
}

class ClipCommand extends CommandMethod {
    constructor(){
        super("<name of audio clip>", "Play the audio clip with the given name");
    }

    execute(params){
        var unthrottleTime = getUnthrottleTime(params.message.member.id);
        if (unthrottleTime){
            console.log(`USER ${params.message.member.user.username}(${params.message.member.user.id}) exceded their play limit`);
            params.message.reply(`You have exceeded the number of audio clips that can be played. Only ${userAudioHistory.throttleLimit} clips can be played in ${userAudioHistory.throttleDuration} hour. You can play a new clip at ${unthrottleTime.toLocaleTimeString()} (PST)`);
        } else {
            var voiceChannel = params.message.member.voice.channel;
            if (voiceChannel) {
                var userFilePath = getAudioClipPathByTitle(params.title);
                if (userFilePath){
                    playAudioClip(voiceChannel,userFilePath)
                        .catch(err => { console.log(err)});
                } else {
                    params.message.reply(`Audio clip ${params.title} not found`);
                }
            } else {
                params.message.reply('You need to join a voice channel first!');
            }
        }
    }
}

class ListCommand extends CommandMethod {
    constructor(){
        super("list", "List all of the available audio clips");
    }

    execute(params){
        let audioClipNames = Object.keys(getAudioConfig().clips);
        params.message.reply(`\n${audioClipNames.join(", ")}`);
    }
}

let userAudioHistory = {
    throttleLimit: 5,
    throttleDuration: 1, // hours
    records: {}
};

const ONE_HOUR = 60 * 60 * 1000;


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
            var filePath = getAudioFilePath(fileName);
            playAudioClip(voiceChannel, filePath)
                .then(() => {resolve()})
                .catch(err => { reject(err) });
        } else {
            reject("voiceChannel or fileName doesn't have a value");
        }
    });
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

function getUnthrottleTime(userId){
    var offset = (ONE_HOUR * userAudioHistory.throttleDuration);
    var throttleBeginTime = new Date(Date.now() - offset);
    if (!(userId in userAudioHistory.records)){
        userAudioHistory.records[userId] = [];
    }

    let history = userAudioHistory.records[userId].filter((playedDate) => {
        return playedDate >= throttleBeginTime;
    });
    var hasExcededCount = history.length >= userAudioHistory.throttleLimit
    if (!hasExcededCount){
        history.push(new Date());
    }
    userAudioHistory.records[userId] = history;

    var unthrottleTime = null;
    if (hasExcededCount) {
        unthrottleTime = new Date(Math.min(...history) + offset);
    }

    return unthrottleTime;
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
