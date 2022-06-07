import { SlashCommandBuilder } from '@discordjs/builders';
import { Collection, CommandInteraction, GuildMember, VoiceBasedChannel, Permissions } from 'discord.js';
import { CommandContext } from '../util/slashCommands';
import { getGuildMemberFromInteraction, getVoiceChannelFromInteraction, getVoiceChannels } from '../util/util';
import { playAudioClipByFilename } from './audio';

enum Subcommands {
    Generate = 'generate',
    Move = 'move',
    Reset = 'reset'
}

interface ShuffledTeams {
    team1: GuildMember[],
    team2: GuildMember[]
}

export default (context: CommandContext) => {
    const logger = context.logger;
    logger.info("Building shuffle command.")

    return {
        builder: new SlashCommandBuilder()
                .setName('shuffle')
                .setDescription('Split voice channel members into 2 teams')
                .addSubcommand(subcommand => 
                    subcommand
                        .setName(Subcommands.Generate)
                        .setDescription("Shuffle Members and print results")
                )
                .addSubcommand(subcommand => 
                    subcommand
                        .setName(Subcommands.Move)
                        .setDescription("Move members into separate channels")
                )
                .addSubcommand(subcommand => 
                    subcommand
                        .setName(Subcommands.Reset)
                        .setDescription("Move shuffled member's back into their own channel")
                ),
        async execute(context: CommandContext, interaction: CommandInteraction) {
            if (!interaction.guild) {
                interaction.reply({content: "You must be in a server to use this command", ephemeral: true});
                return;
            }

            if (!getGuildMemberFromInteraction(interaction).permissions.has(Permissions.FLAGS.MOVE_MEMBERS)) {
                interaction.reply({content: "You do not have permissions to move members", ephemeral: true})
                return;
            }

            var voiceChannel = getVoiceChannelFromInteraction(interaction)
            if (!voiceChannel) {
                interaction.reply({content: "You must be in a voice channel to use this command", ephemeral: true})
                return;
            }

            var voiceChannels = getVoiceChannels(context.client);
            if (!voiceChannels.length) {
                interaction.reply({content: "There must be at least 2 voice channels to use this command"});
                return;
            }

            let subcommand = interaction.options.getSubcommand();
            if (getVoiceChannelMembers(voiceChannel).size < 2 && subcommand != Subcommands.Reset){
                interaction.reply({content: "You must have at least 2 users in your voice channel to shuffle", ephemeral: true});
                return;
            }

            switch(subcommand) {
                case Subcommands.Generate: {
                    shuffleChannelMembers(context, interaction, voiceChannel);
                    return;
                }
                case Subcommands.Move: {
                    moveShuffledMembers(context, interaction, voiceChannel, voiceChannels);
                    return;
                }
                case Subcommands.Reset: {
                    resetShuffle(context, interaction, voiceChannels[0]);
                    return;
                }
                default: {
                    interaction.reply({content: `${subcommand} is not a valid command`, ephemeral: true});
                    return;
                }
            }
        }
    }
}


var shuffledTeams: ShuffledTeams = {
    team1: [],
    team2: []
}

function getVoiceChannelMembers(voiceChannel: VoiceBasedChannel): Collection<string, GuildMember>{
    return voiceChannel.members.filter((member) => {
        return !member.user.bot;
    });
}

function buildTeamMessage(teamNumber: number, users: GuildMember[]){
    var message = "Team " + teamNumber + "\n";
    for (var i = 0; i < users.length; i++){
        message += users[i].user.username + "\n";
    }
    return message;
}

function shuffleChannelMembers(context: CommandContext, interaction: CommandInteraction, voiceChannel: VoiceBasedChannel) {
    shuffledTeams = {
        team1: [],
        team2: []
    }

    var members: GuildMember[] = Array.from(getVoiceChannelMembers(voiceChannel).values());
    var teams = randomlySplitArray(members);
    shuffledTeams.team1 = teams[0];
    shuffledTeams.team2 = teams[1];

    var team1Message = buildTeamMessage(1, shuffledTeams.team1);
    var team2Message = buildTeamMessage(2, shuffledTeams.team2);
    interaction.reply({content: `${team1Message}\n\n${team2Message}`, ephemeral: false});
}

function moveShuffledMembers(
    context: CommandContext,
    interaction: CommandInteraction,
    voiceChannel: VoiceBasedChannel,
    voiceChannels: VoiceBasedChannel[]
){
    playAudioClipByFilename(context.logger, voiceChannel, "fight.mp3");
    moveUsers(voiceChannels[0], shuffledTeams.team1);
    moveUsers(voiceChannels[1], shuffledTeams.team2);
    interaction.reply({content: "Moved users into teams"});

}

function resetShuffle(context: CommandContext, interaction: CommandInteraction, voiceChannel: VoiceBasedChannel){
    // We don't reset the shuffle state here so that users can reuse the same shuffle
    moveUsers(voiceChannel, shuffledTeams.team2);
    interaction.reply({content: "Shuffle has been reset", ephemeral: true});
}

function moveUsers(voiceChannel: VoiceBasedChannel, users: GuildMember[]){
    for (var i=0; i < users.length; i++){
        users[i].voice.setChannel(voiceChannel);
    }
}

function randomlySplitArray(fullArray: GuildMember[]){
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

function shuffleArray(a: GuildMember[]) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
