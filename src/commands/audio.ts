import { SlashCommandBuilder, CommandInteraction, VoiceBasedChannel, VoiceState } from 'discord.js';
import { 
    DiscordGatewayAdapterCreator,
    entersState,
    joinVoiceChannel,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    StreamType,
    AudioPlayerStatus
} from '@discordjs/voice';
import { Logger } from 'winston';
import { CommandContext } from '../util/slashCommands';
import { AudioConfig, getAudioClipFilePath } from '../config/audioConfig';

const player = createAudioPlayer();

enum CommandOptions {
    Clip = 'clip'
}

export default (context: CommandContext) => {
    const logger = context.logger;
    logger.info("Building audio command.")
    const audioConfig: AudioConfig = context.audioConfig;
    const registeredAudioClips = Array.from(audioConfig.clips.entries()).map(([clipName, fileName]) => {
        return {name: clipName, value: fileName}
    }) 

    return {
        builder: new SlashCommandBuilder()
                .setName('audio')
                .setDescription('Plays audio clip')
                .addStringOption(option =>
                    option.setName(CommandOptions.Clip)
                        .setDescription('Name of audio clip')
                        .setRequired(true)
                        .addChoices(
                            {name:'intro', value:'intro'},
                            ...registeredAudioClips
                        )
                ),
        async execute(context: CommandContext, interaction: CommandInteraction) {
            if(!interaction.isChatInputCommand()) return;
            
            const logger = context.logger;
            const clip = interaction.options.getString(CommandOptions.Clip)
            const guildMember = interaction.guild?.members.cache.get(interaction.user.id);
            const voiceChannel = guildMember?.voice.channel;
            if (guildMember && voiceChannel && clip) {
                if (clip === 'intro' && interaction.member?.user.id) {
                    try {
                        playUserIntroClip(logger, context.audioConfig, interaction.user.id, voiceChannel);
                        await interaction.reply({content: `Playing your intro clip`, ephemeral: true});
                    } catch (err) {
                        logger.error(err);
                        await interaction.reply({content: `Failed to play intro clip`, ephemeral: true});
                    }
                } else {
                    const clipFilePath = getAudioClipFilePath(clip);
                    if (!clipFilePath) {
                        throw Error(`Unable to find file path for clip: ${clip}`);
                    }
                    playAudioClip(logger, voiceChannel, clipFilePath);
                    await interaction.reply({content: `Playing ${clip}`, ephemeral: true});
                }
            } else {
                // No voice channel
                await interaction.reply({content: 'You must join a voice channel before executing Play'});
            }
        },
    }
};

export function handleUserJoinVoiceChannel(logger: Logger, audioConfig: AudioConfig, voiceState: VoiceState) {
    if (voiceState.member && voiceState.channel) {
        playUserIntroClip(logger, audioConfig, voiceState.member.user.id, voiceState.channel)
    }
}

function playUserIntroClip(logger: Logger, audioConfig: AudioConfig, userId: string, voiceChannel: VoiceBasedChannel) {
    const userFilePath = getUserAudioClipPath(logger, audioConfig, userId);
    if (voiceChannel && userFilePath){
        playAudioClip(logger, voiceChannel, userFilePath)
            .catch(err => { logger.error(err)});
    }
}

export function playAudioClipByFilename(logger: Logger, voiceChannel: VoiceBasedChannel, fileName: string) {
    const clipFilePath = getAudioClipFilePath(fileName);
    playAudioClip(logger, voiceChannel, clipFilePath);
}

function getUserAudioClipPath(logger: Logger, audioConfig: AudioConfig, userId: string) {
    const userFileName = audioConfig.users.get(userId);
    if (!userFileName){
        logger.error(`User ${userId} does not have an intro clip`)
        throw Error("Intro clip does not exist");
    }
    return getAudioClipFilePath(userFileName);
}

async function connectToChannel(channel: VoiceBasedChannel) {
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guildId,
        adapterCreator: (channel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator)
    });
    try{
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        connection.subscribe(player);
    } catch (error) {
        connection.destroy();
        throw error;
    }
}

async function playAudioClip(logger: Logger, voiceChannel: VoiceBasedChannel, filePath: string) {
    await connectToChannel(voiceChannel);
    playClip(logger, filePath);
}

function playClip(logger: Logger, clipFilePath: string){
    const resource = createAudioResource(clipFilePath, {inputType: StreamType.Arbitrary});
    logger.info(`Starting to play clip: ${clipFilePath}`)
    player.play(resource);
    return entersState(player, AudioPlayerStatus.Playing, 5e3);
}