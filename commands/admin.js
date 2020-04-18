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

    onValidate(params){
        var permissionGranted = params.message.member.hasPermission(discord.Permissions.FLAGS.ADMINISTRATOR);
        if (!permissionGranted){
            params.message.reply(`You do not have admin permission`);
        }
        return permissionGranted;
    }

}

class DefaultCommand extends CommandMethod {
    constructor(){
        super(undefined, "Return a list of user ids");
    }

    execute(params){
        var members = params.bot.guilds.cache.first().members.cache;
        var membersText = [];
        members.forEach(member => {
            membersText.push(`${member.user.username}(${member.user.id}))`)
            console.log(`${member.user.username}(${member.user.id}))`);
        })
        params.message.member.createDM()
        .then(channel => {
            channel.send(membersText.join("\n"));
        })
        .catch(err =>{
            console.error("Failed to send list of all users:", err);
        })
    }
}

class UpdateAudioCommand extends CommandMethod{
    constructor(){
        super("updateaudio", "Download missing audio files", undefined);
    }

    execute(params){
        initialize_audio_files();
        params.message.reply(`Audio files have been updated`);
    }
}
