import { initialize_audio_files } from '../aws/startup.js';
import type { CommandInteraction } from 'discord.js';
import { SlashCommandBuilder, MessageFlags, ChannelType } from 'discord.js';
import type { CommandContext } from '../util/slashCommands.js';
import { registerSlashCommands, setClientSlashCommands } from '../util/slashCommands.js';
import { getGuildMemberFromInteraction } from '../util/util.js';
import type { AppConfig } from '../config/appConfig.js';
import { MessageJob, AudioJob } from '../config/appConfig.js';
import { APP_CONFIG_FILE_NAME, getAppConfigFilePath } from '../config/appConfig.js';
import { uploadFile } from '../aws/upload.js';
import { BUCKET } from '../aws/download.js';
import { writeFileSync } from 'fs';
import { sendJobApprovalDM } from '../approvals.js';

enum Subcommands {
    List = 'list',
    SetAdminRole = 'set_admin_role',
    ConfigureMessageJob = 'configure_message_job',
    ConfigureAudioJob = 'configure_audio_job',
    RemoveJob = 'remove_job',
    Update = 'update',
}

function hasAdminPermission(context: CommandContext, interaction: CommandInteraction): boolean {
    if (!interaction.guildId) return false;
    const guildMember = getGuildMemberFromInteraction(interaction);
    const guildConfig = context.appConfig.guilds.get(interaction.guildId);

    if (guildConfig?.botAdminRoleId) {
        return guildMember.roles.cache.has(guildConfig.botAdminRoleId) ||
               interaction.guild?.ownerId === interaction.user.id;
    }

    return interaction.guild?.ownerId === interaction.user.id ||
           guildMember.permissions.has(BigInt(8)); // Administrator
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default (context: CommandContext) => {
    const logger = context.logger;
    logger.info('Building guild_admin command.');

    const audioClipChoices = Array.from(context.audioConfig.clips.entries()).map(([clipName, fileName]) => ({
        name: clipName,
        value: fileName,
    }));

    return {
        builder: new SlashCommandBuilder()
            .setName('guild_admin')
            .setDescription('Guild administration commands')
            .addSubcommand(subcommand =>
                subcommand
                    .setName(Subcommands.SetAdminRole)
                    .setDescription('Set the role that can administer the bot (guild owner only)')
                    .addRoleOption(option =>
                        option.setName('role')
                            .setDescription('Role to grant bot admin access')
                            .setRequired(true),
                    ),
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName(Subcommands.List)
                    .setDescription('List all user IDs'),
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName(Subcommands.ConfigureMessageJob)
                    .setDescription('Add or update a scheduled message job')
                    .addStringOption(option =>
                        option.setName('name')
                            .setDescription('Job name (e.g. "pre-gameday", "gameday")')
                            .setRequired(true),
                    )
                    .addIntegerOption(option =>
                        option.setName('day')
                            .setDescription('Day of the week')
                            .setRequired(true)
                            .addChoices(
                                { name: 'Sunday', value: 0 },
                                { name: 'Monday', value: 1 },
                                { name: 'Tuesday', value: 2 },
                                { name: 'Wednesday', value: 3 },
                                { name: 'Thursday', value: 4 },
                                { name: 'Friday', value: 5 },
                                { name: 'Saturday', value: 6 },
                            ),
                    )
                    .addIntegerOption(option =>
                        option.setName('hour')
                            .setDescription('Hour in 24h format (e.g. 19 = 7 PM)')
                            .setRequired(true)
                            .setMinValue(0)
                            .setMaxValue(23),
                    )
                    .addIntegerOption(option =>
                        option.setName('minute')
                            .setDescription('Minute (0–59)')
                            .setRequired(true)
                            .setMinValue(0)
                            .setMaxValue(59),
                    )
                    .addChannelOption(option =>
                        option.setName('channel')
                            .setDescription('Channel to send the message to')
                            .setRequired(true)
                            .addChannelTypes(ChannelType.GuildText),
                    )
                    .addStringOption(option =>
                        option.setName('message')
                            .setDescription('Message to send')
                            .setRequired(true),
                    ),
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName(Subcommands.ConfigureAudioJob)
                    .setDescription('Add or update a scheduled audio clip job')
                    .addStringOption(option =>
                        option.setName('name')
                            .setDescription('Job name (e.g. "gameday-intro")')
                            .setRequired(true),
                    )
                    .addIntegerOption(option =>
                        option.setName('day')
                            .setDescription('Day of the week')
                            .setRequired(true)
                            .addChoices(
                                { name: 'Sunday', value: 0 },
                                { name: 'Monday', value: 1 },
                                { name: 'Tuesday', value: 2 },
                                { name: 'Wednesday', value: 3 },
                                { name: 'Thursday', value: 4 },
                                { name: 'Friday', value: 5 },
                                { name: 'Saturday', value: 6 },
                            ),
                    )
                    .addIntegerOption(option =>
                        option.setName('hour')
                            .setDescription('Hour in 24h format (e.g. 19 = 7 PM)')
                            .setRequired(true)
                            .setMinValue(0)
                            .setMaxValue(23),
                    )
                    .addIntegerOption(option =>
                        option.setName('minute')
                            .setDescription('Minute (0–59)')
                            .setRequired(true)
                            .setMinValue(0)
                            .setMaxValue(59),
                    )
                    .addStringOption(option =>
                        option.setName('clip')
                            .setDescription('Audio clip to play')
                            .setRequired(true)
                            .addChoices(...audioClipChoices),
                    )
                    .addChannelOption(option =>
                        option.setName('channel')
                            .setDescription('Voice channel to play the clip in (omit to use the most populated channel)')
                            .addChannelTypes(ChannelType.GuildVoice),
                    ),
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName(Subcommands.RemoveJob)
                    .setDescription('Remove a scheduled job')
                    .addStringOption(option =>
                        option.setName('name')
                            .setDescription('Job name to remove')
                            .setRequired(true),
                    ),
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName(Subcommands.Update)
                    .setDescription('Update configuration')
                    .addStringOption(option =>
                        option.setName('config')
                            .setDescription('Configuration to update')
                            .setRequired(true)
                            .addChoices(
                                { name: 'app', value: 'app' },
                                { name: 'audio', value: 'audio' },
                            ),
                    ),
            ),
        async execute(context: CommandContext, interaction: CommandInteraction): Promise<void> {
            if (!interaction.isChatInputCommand()) { return; }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === Subcommands.SetAdminRole) {
                await setAdminRole(context, interaction);
                return;
            }

            if (!hasAdminPermission(context, interaction)) {
                await interaction.reply({ content: 'You do not have permissions to run this command', flags: MessageFlags.Ephemeral });
                return;
            }

            switch (subcommand) {
                case Subcommands.List: {
                    listUsers(context, interaction);
                    break;
                }
                case Subcommands.ConfigureMessageJob: {
                    await configureMessageJob(context, interaction);
                    break;
                }
                case Subcommands.ConfigureAudioJob: {
                    await configureAudioJob(context, interaction);
                    break;
                }
                case Subcommands.RemoveJob: {
                    await removeJob(context, interaction);
                    break;
                }
                case Subcommands.Update: {
                    update(context, interaction);
                    break;
                }
                default: {
                    await interaction.reply({ content: 'Not a valid command', flags: MessageFlags.Ephemeral });
                }
            }
        },
    };
};

async function persistAndUpdate(context: CommandContext, newAppConfig: AppConfig): Promise<void> {
    writeFileSync(getAppConfigFilePath(), JSON.stringify(newAppConfig.toJSON(), null, 4), 'utf8');
    await uploadFile(context.logger, getAppConfigFilePath(), BUCKET, APP_CONFIG_FILE_NAME);
    context.client.update.appConfig?.(newAppConfig);
}

function formatJobSummary(job: MessageJob | AudioJob): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const time = `${days[job.dayOfWeek]} at ${job.hour}:${String(job.minute).padStart(2, '0')}`;
    if (job instanceof MessageJob) {
        return `Type: message\nSchedule: ${time}\nChannel: <#${job.channelId}>\nMessage: ${job.message}`;
    }
    const channel = job.voiceChannelId ? `<#${job.voiceChannelId}>` : 'auto (most populated)';
    return `Type: audio\nSchedule: ${time}\nVoice channel: ${channel}\nClip: ${job.clipFileName}`;
}

async function setAdminRole(context: CommandContext, interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

    if (interaction.guild?.ownerId !== interaction.user.id) {
        await interaction.reply({ content: 'Only the server owner can set the bot admin role.', flags: MessageFlags.Ephemeral });
        return;
    }

    const role = interaction.options.getRole('role', true);
    try {
        await persistAndUpdate(context, context.appConfig.withUpdatedBotAdminRole(interaction.guildId, role.id));
        await interaction.reply({ content: `Bot admin role set to ${role.name}.`, flags: MessageFlags.Ephemeral });
    } catch (err) {
        context.logger.error('Failed to set admin role:', err);
        await interaction.reply({ content: 'Failed to save admin role configuration.', flags: MessageFlags.Ephemeral });
    }
}

async function configureMessageJob(context: CommandContext, interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

    const jobName = interaction.options.getString('name', true);
    const dayOfWeek = interaction.options.getInteger('day', true);
    const hour = interaction.options.getInteger('hour', true);
    const minute = interaction.options.getInteger('minute', true);
    const channel = interaction.options.getChannel('channel', true);
    const message = interaction.options.getString('message', true);

    const job = new MessageJob(dayOfWeek, hour, minute, channel.id, message);
    const newAppConfig = context.appConfig.withUpdatedJob(interaction.guildId, jobName, job);
    const existingJob = context.appConfig.guilds.get(interaction.guildId)?.jobs.get(jobName);

    try {
        await sendJobApprovalDM(context.logger, context.client, context.appConfig.ownerId, {
            newAppConfig,
            guildId: interaction.guildId,
            guildName: interaction.guild?.name ?? interaction.guildId,
            requesterId: interaction.user.id,
            requesterName: interaction.user.username,
            jobName,
            jobSummary: formatJobSummary(job),
            existingJobSummary: existingJob ? formatJobSummary(existingJob as MessageJob | AudioJob) : undefined,
        });
        await interaction.reply({ content: `Job \`${jobName}\` request sent to bot owner for approval.`, flags: MessageFlags.Ephemeral });
    } catch (err) {
        context.logger.error(`Failed to send approval DM for message job "${jobName}":`, err);
        await interaction.reply({ content: `Failed to submit request: ${err instanceof Error ? err.message : err}`, flags: MessageFlags.Ephemeral });
    }
}

async function configureAudioJob(context: CommandContext, interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

    const jobName = interaction.options.getString('name', true);
    const dayOfWeek = interaction.options.getInteger('day', true);
    const hour = interaction.options.getInteger('hour', true);
    const minute = interaction.options.getInteger('minute', true);
    const channel = interaction.options.getChannel('channel');
    const clipFileName = interaction.options.getString('clip', true);

    const job = new AudioJob(dayOfWeek, hour, minute, clipFileName, channel?.id);
    const newAppConfig = context.appConfig.withUpdatedJob(interaction.guildId, jobName, job);
    const existingJob = context.appConfig.guilds.get(interaction.guildId)?.jobs.get(jobName);

    try {
        await sendJobApprovalDM(context.logger, context.client, context.appConfig.ownerId, {
            newAppConfig,
            guildId: interaction.guildId,
            guildName: interaction.guild?.name ?? interaction.guildId,
            requesterId: interaction.user.id,
            requesterName: interaction.user.username,
            jobName,
            jobSummary: formatJobSummary(job),
            existingJobSummary: existingJob ? formatJobSummary(existingJob as MessageJob | AudioJob) : undefined,
        });
        await interaction.reply({ content: `Job \`${jobName}\` request sent to bot owner for approval.`, flags: MessageFlags.Ephemeral });
    } catch (err) {
        context.logger.error(`Failed to send approval DM for audio job "${jobName}":`, err);
        await interaction.reply({ content: `Failed to submit request: ${err instanceof Error ? err.message : err}`, flags: MessageFlags.Ephemeral });
    }
}

async function removeJob(context: CommandContext, interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

    const jobName = interaction.options.getString('name', true);
    const existingJob = context.appConfig.guilds.get(interaction.guildId)?.jobs.get(jobName);

    if (!existingJob) {
        await interaction.reply({ content: `No job named \`${jobName}\` found.`, flags: MessageFlags.Ephemeral });
        return;
    }

    const newAppConfig = context.appConfig.withRemovedJob(interaction.guildId, jobName);

    try {
        await sendJobApprovalDM(context.logger, context.client, context.appConfig.ownerId, {
            newAppConfig,
            guildId: interaction.guildId,
            guildName: interaction.guild?.name ?? interaction.guildId,
            requesterId: interaction.user.id,
            requesterName: interaction.user.username,
            jobName,
            jobSummary: `**Removal request** for existing job:\n${formatJobSummary(existingJob as MessageJob | AudioJob)}`,
        });
        await interaction.reply({ content: `Removal request for job \`${jobName}\` sent to bot owner for approval.`, flags: MessageFlags.Ephemeral });
    } catch (err) {
        context.logger.error(`Failed to send removal approval DM for job "${jobName}":`, err);
        await interaction.reply({ content: `Failed to submit request: ${err instanceof Error ? err.message : err}`, flags: MessageFlags.Ephemeral });
    }
}

function listUsers(context: CommandContext, interaction: CommandInteraction): void {
    if (!interaction.guild) {
        interaction.reply({ content: 'Must be in a server to use this command' });
        return;
    }

    interaction.guild.members.fetch()
        .then((members) => {
            const membersText: string[] = [];
            members.forEach(member => {
                membersText.push(`${member.user.username},${member.user.id}`);
                context.logger.info(`${member.user.username}(${member.user.id})`);
            });
            interaction.reply({ content: membersText.join('\n'), flags: MessageFlags.Ephemeral });
        })
        .catch((err) => {
            context.logger.error('Failed to send list of all users:', err);
            interaction.reply({ content: 'Failed to send list of all users' });
        });
}

function update(context: CommandContext, interaction: CommandInteraction): void {
    initialize_audio_files(context.logger)
        .then(audioConfig => {
            if (context.client.update.audioConfig) {
                context.client.update.audioConfig(audioConfig);
                context = {
                    audioConfig,
                    appConfig: context.appConfig,
                    logger: context.logger,
                    client: context.client,
                    botAudioPlayer: context.botAudioPlayer,
                };
                setClientSlashCommands(context, context.client).then(() => {
                    for (const guildId of context.appConfig.guilds.keys()) {
                        registerSlashCommands(context.logger, context.appConfig, guildId, Array.from(context.client.commands.values()));
                    }
                });
            }
        })
        .catch(err => {
            context.logger.error(`Update audio files failed: ${err}`);
            interaction.reply({ content: `Update audio files failed: ${err}`, flags: MessageFlags.Ephemeral });
            return;
        });
    interaction.reply({ content: 'Audio files have been updated', flags: MessageFlags.Ephemeral });
}
