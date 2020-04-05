import userAudioConfig from '../config/userAudio.json';
var audioClipPath = `${__dirname}\\..\\audioClips\\`;

let userAudioHistory = {
    countLimit: 5,
    expireAfter: 1, // hours
    records: {}
};

export function audioCommand(bot, message, args) {
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
            var filePath = audioClipPath + fileName;
            playAudioClip(voiceChannel, filePath)
                .then(() => {resolve()})
                .catch(err => { reject(err) });
        } else {
            reject("voiceChannel or fileName doesn't have a value");
        }
    });
}

function listAudioClips(message) {
    let audioClipNames = Object.keys(userAudioConfig.clips);
    message.reply(`\n${audioClipNames.join(", ")}`);
}

function getUserAudioClipPath(userId) {
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