import type { CommandInteraction, Guild, User, VoiceBasedChannel, VoiceState } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import type { 
    AudioPlayer,
    VoiceConnection,
} from '@discordjs/voice';
import {
    entersState,
    joinVoiceChannel,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    StreamType,
    AudioPlayerStatus,
    getVoiceConnection,
} from '@discordjs/voice';
import type { Logger } from 'winston';
import type { CommandContext } from '../util/slashCommands';
import type { AudioConfig} from '../config/audioConfig';
import { getAudioClipFilePath } from '../config/audioConfig';
import { getVoiceChannelMembers, getVoiceChannels, guildToString, userToString } from '../util/util';

enum CommandOptions {
    Clip = 'clip'
}

/**
 * https://discordjs.guide/voice/life-cycles
 * Discord voice API has 3 high level components
 * 
 * - Voice Connection: A network connection to a single Guild voice channel. Only 1 voice connection
 *   can be made to a guild at a time. If the bot joins a new voice channel within the same guild,
 *   the bot will leave the current voice channel and join the new voice channel. It is possible to
 *   join multiple guilds at a time, where you have 1 connection per guild.
 *
 * - Audio Player: Plays an audio resource on a voice channel. Voice channels can subscribe to a player
 *   and the player will play on all subscribed voice channels.
 * 
 * - Audio Resource: Contains the audio that can be played on a player
 */

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default (context: CommandContext) => {
    const logger = context.logger;
    logger.info('Building audio command.');
    const audioConfig: AudioConfig = context.audioConfig;
    const registeredAudioClips = Array.from(audioConfig.clips.entries()).map(([clipName, fileName]) => {
        return {name: clipName, value: fileName};
    }); 

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
                            ...registeredAudioClips,
                        ),
                ),
        async execute(context: CommandContext, interaction: CommandInteraction): Promise<void> {
            if(!interaction.isChatInputCommand()) {return;}
            
            const logger = context.logger;
            const botAudioPlayer = context.botAudioPlayer;
            const clip = interaction.options.getString(CommandOptions.Clip);
            const guildMember = interaction.guild?.members.cache.get(interaction.user.id);
            const voiceChannel = guildMember?.voice.channel;
            if (guildMember && voiceChannel && clip) {
                if (clip === 'intro' && interaction.member?.user.id) {
                    try {
                        playUserIntroClip(botAudioPlayer, context.audioConfig, interaction.user, voiceChannel);
                        await interaction.reply({content: 'Playing your intro clip', ephemeral: true});
                    } catch (err) {
                        logger.error(err);
                        await interaction.reply({content: 'Failed to play intro clip', ephemeral: true});
                    }
                } else {
                    const clipFilePath = getAudioClipFilePath(clip);
                    if (!clipFilePath) {
                        throw Error(`Unable to find file path for clip: ${clip}`);
                    }
                    botAudioPlayer.playAudioClip(voiceChannel, clipFilePath);
                    await interaction.reply({content: `Playing ${clip}`, ephemeral: true});
                }
            } else {
                // No voice channel
                await interaction.reply({content: 'You must join a voice channel before executing Play'});
            }
        },
    };
};

// Play a user's intro clip (if they have one)
export function handleUserJoinVoiceChannel(botAudioPlayer: BotAudioPlayer, audioConfig: AudioConfig, voiceState: VoiceState): void {
    if (voiceState.member && voiceState.channel) {
        playUserIntroClip(botAudioPlayer, audioConfig, voiceState.member.user, voiceState.channel);
    }
}

export function handleUserLeftGuildVoiceChannels(botAudioPlayer: BotAudioPlayer, oldVoiceState: VoiceState): void {
    if ( oldVoiceState.channel) {
        botAudioPlayer.leaveGuildChannelIfNoActiveVoiceChannelMembers(oldVoiceState.guild);
    }
}

export function playAudioClipByFilename(botAudioPlayer: BotAudioPlayer, voiceChannel: VoiceBasedChannel, fileName: string): void {
    const clipFilePath = getAudioClipFilePath(fileName);
    botAudioPlayer.playAudioClip(voiceChannel, clipFilePath);
}

function playUserIntroClip(botAudioPlayer: BotAudioPlayer, audioConfig: AudioConfig, user: User, voiceChannel: VoiceBasedChannel): void {
    const logger = botAudioPlayer.logger;
    const userFilePath = getUserAudioClipPath(logger, audioConfig, user);
    if (voiceChannel && userFilePath){
        botAudioPlayer.playAudioClip(voiceChannel, userFilePath)
            .catch(err => { logger.error(err);});
    }
}

function getUserAudioClipPath(logger: Logger, audioConfig: AudioConfig, user: User): string {
    const userId = user.id;
    const userFileName = audioConfig.users.get(userId);
    if (!userFileName){
        logger.error(`User ${userToString(user)} does not have an intro clip`);
        throw Error('Intro clip does not exist');
    }
    return getAudioClipFilePath(userFileName);
}


// TODO: Consider reverting back to not using a class for this because doing so requires passing around the 
// instantiated instance in all SlashCommand instances. The class was only added in an attempt to debug the
// bot playing the same intro clips across all guilds rather than only the guild that a user had just joined
// the voice channel of. In the end, there wasn't a bug. A user had mistakenly reported that they heard
// the intro clip when I joined a different guild
export class BotAudioPlayer {
    private readonly LOGGER_PREFIX = '\tVOICE: ';
    public readonly logger: Logger;
    private guildAudioPlayers: Map<string, AudioPlayer> = new Map();

    constructor(logger: Logger) {
        this.logger = logger;
    }

    public async playAudioClip(voiceChannel: VoiceBasedChannel, filePath: string): Promise<void> {
        // To play audio we need 3 things
        // - Voice Connection: Network connection to a guilds voice channel
        // - Audio Resource: Contains the audio object
        // - Audio Player: Plays an Audio Resource on all subscribed Voice Channels

        // Get or create a new audio player for the guild
        const audioPlayer = this.getAudioPlayerForGuild(voiceChannel.guild);

        // Get or create a new connection to a voice channel
        const connection = await this.connectToChannel(voiceChannel);
        connection.subscribe(audioPlayer);

        const resource = createAudioResource(filePath, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
        });
        resource.volume?.setVolume(0.6);

        this.log(`Starting to play clip: ${filePath}. Resource Player: ${resource.audioPlayer}  AudioPlayer Status: ${audioPlayer.state.status}. Player subscribers: ${audioPlayer.playable.length}`);
        audioPlayer.play(resource);
        
        /**
         * Here we are using a helper function. It will resolve if the player enters the Playing
         * state within 5 seconds, otherwise it will reject with an error.
         */
        await entersState(audioPlayer, AudioPlayerStatus.Playing, 5_000);
    }

    private log(content: string): void {
        this.logger.info(`${this.LOGGER_PREFIX} (${this.guildAudioPlayers.size} players): ${content}`);
    }
        
    private getAudioPlayerForGuild(guild: Guild): AudioPlayer {
        const guildId = guild.id;

        if (!this.guildAudioPlayers.has(guildId)) {
            const newAudioPlayer = createAudioPlayer();
            const guildString = guildToString(guild);

            this.guildAudioPlayers.set(guildId, newAudioPlayer);
            this.log(`Created new audio player for guild: ${guildString}`);
        }

        const audioPlayer = this.guildAudioPlayers.get(guildId);
        if (!audioPlayer) {
            throw new Error('Guild audio player not found. This should be impossible because we just created it');
        }

        return audioPlayer;
    }

    public async leaveGuildChannelIfNoActiveVoiceChannelMembers(guild: Guild): Promise<void> {
        const guildString = guildToString(guild);
        const existingGuildAudioPlayer = this.guildAudioPlayers.get(guild.id);
        const existingGuildVoiceConnection = getVoiceConnection(guild.id);

        if (!existingGuildVoiceConnection) {
            this.log(`Skipping bot connection cleanup. Bot does not have an active connection to guild: ${guildString}. Existing audio player: ${existingGuildAudioPlayer?.state.status}`);
            return;
        }

        const hasVoiceMembers = getVoiceChannels(guild)
            .some(voiceChannel => {
                return getVoiceChannelMembers(voiceChannel).length > 0;
            });
        
        if (!hasVoiceMembers) {
            existingGuildVoiceConnection.disconnect();
        }
        this.log(`Bot had connection to guild. Had voice members: ${hasVoiceMembers}. Guild: ${guild}`);
    }

    private async connectToChannel(channel: VoiceBasedChannel): Promise<VoiceConnection> {
        // Mostly copied from the voice examples
        // https://github.com/discordjs/voice-examples/blob/main/examples/basic/src/util/helpers.ts

        /**
         * Here, we try to establish a connection to a voice channel. If we're already connected
         * to this voice channel, \@discordjs/voice will just return the existing connection for us!
         */
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        /**
         * If we're dealing with a connection that isn't yet Ready, we can set a reasonable
         * time limit before giving up. In this example, we give the voice connection 30 seconds
         * to enter the ready state before giving up.
         */
        try {
            /**
             * Allow ourselves 30 seconds to join the voice channel. If we do not join within then,
             * an error is thrown.
             */
            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            /**
             * At this point, the voice connection is ready within 30 seconds! This means we can
             * start playing audio in the voice channel. We return the connection so it can be
             * used by the caller.
             */
            return connection;
        } catch (error) {
            /**
             * At this point, the voice connection has not entered the Ready state. We should make
             * sure to destroy it, and propagate the error by throwing it, so that the calling function
             * is aware that we failed to connect to the channel.
             */
            connection.destroy();

            throw error;
        }
    }
      
}