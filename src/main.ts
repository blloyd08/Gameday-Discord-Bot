import { Events } from 'discord.js';
import { createLogger } from './logger';
import type { CommandContext } from './util/slashCommands';
import { setClientSlashCommands } from './util/slashCommands';
import { initialize_audio_files } from './aws/startup';
import { BotAudioPlayer, handleUserJoinVoiceChannel, handleUserLeftGuildVoiceChannels } from './commands/audio';
import type { AudioConfig } from './config/audioConfig';
import type { AppConfig } from './config/appConfig';
import { scheduleJobs } from './jobs';
import { getAppConfig } from './config/appConfig';
import { voiceStateToString } from './util/util';
import { createBotClient } from './bot';
import { handleJobApprovalButton, handleGuildApprovalButton, sendGuildApprovalDM } from './approvals';
import { registerSlashCommands } from './util/slashCommands';
import type { BotClient } from './bot';

(async (): Promise<void> => {
    let appConfig: AppConfig = await getAppConfig();
    const logger = createLogger('gameday-bot', appConfig.logLevel);
    const botAudioPlayer = new BotAudioPlayer(logger);

    let audioConfig: AudioConfig;
    let client: BotClient;

    function updateAudioConfig(newAudioConfig: AudioConfig): void {
        audioConfig = newAudioConfig;
    }

    function updateAppConfig(newAppConfig: AppConfig): void {
        appConfig = newAppConfig;
        scheduleJobs(logger, appConfig, client, botAudioPlayer);
    }

    async function dmOwner(message: string): Promise<void> {
        try {
            const owner = await client.users.fetch(appConfig.ownerId);
            await owner.send(message);
        } catch (err) {
            logger.warn(`Could not DM owner: ${err}`);
        }
    }

    function buildStartupSummary(): string {
        const guildLines = Array.from(appConfig.guilds.entries()).map(([guildId, guildConfig]) => {
            const guildName = client.guilds.cache.get(guildId)?.name ?? guildId;
            const jobCount = guildConfig.jobs.size;
            return `  • ${guildName} — ${jobCount} job${jobCount !== 1 ? 's' : ''}`;
        });

        return [
            '✅ Bot is online!',
            '',
            `**Guilds:** ${appConfig.guilds.size}`,
            ...guildLines,
            '',
            `**Log level:** ${appConfig.logLevel}`,
        ].join('\n');
    }

    try {
        client = createBotClient({ audioConfig: updateAudioConfig, appConfig: updateAppConfig });

        audioConfig = await initialize_audio_files(logger);
        const context: CommandContext = { audioConfig, appConfig, logger, client, botAudioPlayer };
        await setClientSlashCommands(context, client);

        client.on(Events.ClientReady, async () => {
            try {
                const disallowedGuilds = Array.from(client.guilds.cache.values())
                    .filter(guild => !appConfig.guilds.has(guild.id));
                await Promise.all(disallowedGuilds.map(guild => {
                    logger.warn(`Guild "${guild.name}" (${guild.id}) is not in the allowlist — leaving.`);
                    return guild.leave();
                }));
                scheduleJobs(logger, appConfig, client, botAudioPlayer);
                logger.info('\n\n#########################################\nLogged in to discord! Client is now ready\n#########################################\n\n\n');
                await dmOwner(buildStartupSummary());
            } catch (err) {
                logger.error(`Error during startup: ${err}`);
                await dmOwner(`⚠️ Bot encountered an error during startup:\n\`\`\`\n${err}\n\`\`\``);
            }
        });

        client.on(Events.GuildCreate, async (guild) => {
            if (appConfig.guilds.has(guild.id)) {
                await registerSlashCommands(logger, appConfig, guild.id, Array.from(client.commands.values()));
            } else {
                try {
                    await sendGuildApprovalDM(logger, client, appConfig.ownerId, guild);
                    if (guild.systemChannel) {
                        await guild.systemChannel.send(
                            '👋 Thanks for adding this bot! Your request is pending review by the bot owner. ' +
                            'You\'ll be notified here once a decision has been made.',
                        );
                    }
                } catch (err) {
                    logger.error(`Could not request approval for guild "${guild.name}" (${guild.id}): ${err}`);
                }
            }
        });

        client.on(Events.InteractionCreate, async interaction => {
            if (interaction.isButton()) {
                if (interaction.customId.startsWith('approve_guild_') || interaction.customId.startsWith('deny_guild_')) {
                    await handleGuildApprovalButton(
                        interaction,
                        logger,
                        appConfig.ownerId,
                        updateAppConfig,
                        () => Array.from(client.commands.values()),
                    );
                    return;
                }
                await handleJobApprovalButton(interaction, logger, appConfig.ownerId, updateAppConfig);
                return;
            }

            if (!interaction.isCommand()) { return; }

            const command = client.commands.get(interaction.commandName);
            if (!command) { return; }

            try {
                await command.execute({ audioConfig, appConfig, logger, client, botAudioPlayer }, interaction);
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
                    }
                }
            } catch (error) {
                logger.error(error);
            }
        });

        client.on(Events.Error, async (error) => {
            logger.error('Client error encountered');
            logger.error(error);
            await dmOwner(`⚠️ Client error:\n\`\`\`\n${error.message}\n\`\`\``);
        });

        client.on(Events.ShardError, async (error) => {
            logger.error('A websocket connection encountered an error');
            logger.error(error);
            await dmOwner(`⚠️ Shard error:\n\`\`\`\n${error.message}\n\`\`\``);
        });

        client.on(Events.ShardDisconnect, async (event, shardId) => {
            logger.error(`Shard disconnected: (${shardId}) ${event}`);
            await dmOwner(`⚠️ Shard ${shardId} disconnected (code: ${event.code}).`);
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
