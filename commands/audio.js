var userAudioConfig = require('../config/userAudio.json');
var audioClipPath = `${__dirname}\\..\\audioClips\\`;

module.exports.audioCommand =  (bot, message, args) => {
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

module.exports.handleUserJoinVoiceChannel = (voiceState) => {
    var userFilePath = getUserAudioClipPath(voiceState.member.user.id);
    if (voiceState.channel && userFilePath){
        playAudioClip(voiceState.channel,userFilePath);
    }
}

function listAudioClips(message){
    let audioClipNames = Object.keys(userAudioConfig.clips);
    message.reply(`\n${audioClipNames.join(", ")}`);
}

function getUserAudioClipPath(userId){
    var userFileName = userAudioConfig.users[userId];
    if (!userFileName){
        return
    }
    return `${audioClipPath}${userFileName}`;
}

function getAudioClipPathByTitle(title){
    var audioClipFileName = userAudioConfig.clips[title];
    if (!audioClipFileName){
        return
    }
    return `${audioClipPath}${audioClipFileName}`;
}

function playAudioClip(voiceChannel, filePath) {
    try {
        voiceChannel.join()
        .then(connection => {
            const dispatcher = connection.play(filePath, {volume: 0.7})
            dispatcher.on('finish', () => {
                voiceChannel.leave();
            })
        })
        .catch(console.error);
    } catch {
        if (voiceChannel)
            voiceChannel.leave();
    }
}

function playUserAudioClip(message){
    var voiceChannel = message.member.voice.channel;
    if (voiceChannel) {
        var userFilePath = getUserAudioClipPath(message.member.user.id);
        if (userFilePath)
            playAudioClip(voiceChannel,userFilePath);
    } else {
        message.reply('You need to join a voice channel first!');
    }
}

function playAudioClipByTitle(message, title){
    var voiceChannel = message.member.voice.channel;
    if (voiceChannel) {
        var userFilePath = getAudioClipPathByTitle(title);
        if (userFilePath){
            playAudioClip(voiceChannel,userFilePath);
        } else {
            message.reply(`Audio clip ${title} not found`);
        }
    } else {
        message.reply('You need to join a voice channel first!');
    }
}