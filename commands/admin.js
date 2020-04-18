import { initialize_audio_files } from '../aws/startup.js';
import discord from 'discord.js';
import { Command } from './command.js'
import { CommandMethod } from './commandMethod.js'


export class AdminCommand extends Command {
    constructor(){
        super("#", "admin", [
            new DefaultCommand(),
            new UpdateAudioCommand(),
        ]);
    }

    execute(bot, message, args) {
        if (validateAdministratorPermission(message)) {
            var firstArg = args.length > 0 ? args[0].toLowerCase() : "";

            switch (firstArg){
                case "updateaudio":
                    updateAudioFiles(bot, message);
                    break;
                default:
                    listUsers(bot, message);
            }
        }
    }
}

class DefaultCommand extends CommandMethod {
    constructor(){
        super(undefined, "Return a list of user ids");
    }
}

class UpdateAudioCommand extends CommandMethod{
    constructor(){
        super("updateaudio", "Download missing audio files", undefined);
    }
}

function updateAudioFiles(bot, message){
    initialize_audio_files();
    message.reply(`Audio files have been updated`);
}

function listUsers(bot, message) {
    var members = bot.guilds.cache.first().members.cache;
    var membersText = [];
    members.forEach(member => {
        membersText.push(`${member.user.username}(${member.user.id}))`)
        console.log(`${member.user.username}(${member.user.id}))`);
    })
    message.member.createDM()
    .then(channel => {
        channel.send(membersText.join("\n"));
    })
    .catch(err =>{
        console.error("Failed to send list of all users:", err);
    })
}

function validateAdministratorPermission(message){
    var permissionGranted = message.member.hasPermission(discord.Permissions.FLAGS.ADMINISTRATOR);
    if (!permissionGranted){
        message.reply(`You do not have admin permission`);
    }
    return permissionGranted;
}
