import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { createLogger } from './logger';
import type { CommandContext, SlashCommand } from './util/slashCommands';
import { setClientSlashCommands } from './util/slashCommands';
import { initialize_audio_files } from './aws/startup';
import { BotAudioPlayer, handleUserJoinVoiceChannel, handleUserLeftGuildVoiceChannels } from './commands/audio';
import type { AudioConfig } from './config/audioConfig';
import { scheduleJobs } from './jobs';
import type { AppConfig} from './config/appConfig';
import { getAppConfig } from './config/appConfig';
import { voiceStateToString } from './util/util';

interface ConfigUpdater {
    audioConfig?: (audioConfig: AudioConfig) => void;
}

export class BotClient extends Client {
    commands = new Collection<string, SlashCommand>();
    update: ConfigUpdater;

    constructor(update: ConfigUpdater) {
        super({
            // Intents are like a filter for events that Discord will decide to send to the bot
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates,
            ],
        });
        this.update = update;
    }
}

export function createBotClient(update: ConfigUpdater): BotClient {
    return new BotClient(update);
}

(async (): Promise<void> => {
    const appConfig: AppConfig = await getAppConfig();
    const logger = createLogger('gameday-bot', appConfig.logLevel);
    const botAudioPlayer = new BotAudioPlayer(logger);

    let audioConfig: AudioConfig;

    function updateClient(newAudioConfig: AudioConfig): void {
        audioConfig = newAudioConfig;
    }

    try {
        const client = createBotClient({audioConfig: updateClient});

        audioConfig = await initialize_audio_files(logger);
        const context: CommandContext = {audioConfig, appConfig, logger, client, botAudioPlayer};
        await setClientSlashCommands(context, client);

        // Doc for client events https://discord.js.org/#/docs/discord.js/stable/class/Client
        client.on(Events.ClientReady, () => {
            scheduleJobs(logger, appConfig, client);
            logger.info('\n\n#########################################\nLogged in to discord! Client is now ready\n#########################################\n\n\n');
        });

        client.on(Events.InteractionCreate, async interaction => {
            if (!interaction.isCommand()) {return;}

            const command = client.commands.get(interaction.commandName);
            if (!command) {return;}

            try {
                await command.execute({audioConfig, appConfig, logger, client, botAudioPlayer}, interaction);
            } catch (error) {
                logger.error(error);
                if (!interaction.replied) {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        });

        client.on(Events.VoiceStateUpdate, async (oldVoiceState, newVoiceState) => {
            try {
                if (!newVoiceState.member?.user.bot) {
                    if (!newVoiceState.channel) {
                        logger.info(`👋 LEFT VOICE CHANNEL EVENT RECEIVED. ${voiceStateToString(oldVoiceState)}\n\n`);
                    } else if (!oldVoiceState.channel) {
                        logger.info(`🎉 JOINED VOICE CHANNEL EVENT RECEIVED. ${voiceStateToString(newVoiceState)}`);
                        handleUserJoinVoiceChannel(botAudioPlayer, audioConfig, newVoiceState);
                    }

                    if (oldVoiceState.channel && newVoiceState.channel?.guildId !== oldVoiceState.channel.guildId) {
                        logger.info(`User left guild voice channels. Old Voice State: ${voiceStateToString(oldVoiceState)}.  New voice state: ${voiceStateToString(newVoiceState)}`);
                        handleUserLeftGuildVoiceChannels(botAudioPlayer, oldVoiceState);
                    };
                }
            } catch (error) {
                logger.error(error);
            }
        });

        client.on(Events.Error, (error) => {
            logger.error('Client error encountered');
            logger.error(error);
        });

        client.on(Events.ShardError, error => {
            logger.error('A websocket connection encountered an error');
            logger.error(error);
        });

        client.on(Events.ShardDisconnect, (event, shardId) => {
            logger.error(`Shard disconnected: (${shardId}) ${event}`);
        });

        client.on(Events.ShardReconnecting, (shardId) => {
            logger.error(`Shard Reconnecting: ${shardId}`);
        });

        client.login(appConfig.auth.discord);
    } catch (e) {
        logger.error('Top level error handler caught an error');
        logger.error(e);
        throw(e);
    }
})();
