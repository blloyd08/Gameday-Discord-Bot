import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import type { ButtonInteraction, Guild } from 'discord.js';
import type { Logger } from 'winston';
import type { BotClient } from './bot.js';
import type { BaseJob } from './config/appConfig.js';
import { AppConfig, APP_CONFIG_FILE_NAME, getAppConfigFilePath } from './config/appConfig.js';
import { uploadFile } from './aws/upload.js';
import { downloadFile, BUCKET, DataType } from './aws/download.js';
import { readFileSync, writeFileSync } from 'fs';
import { registerSlashCommands } from './util/slashCommands.js';
import type { SlashCommand } from './util/slashCommands.js';

const APPROVE_PREFIX = 'approve_job_';
const DENY_PREFIX = 'deny_job_';
const GUILD_APPROVE_PREFIX = 'approve_guild_';
const GUILD_DENY_PREFIX = 'deny_guild_';

export interface PendingJobRequest {
    guildId: string;
    guildName: string;
    requesterId: string;
    requesterName: string;
    jobName: string;
    // The job to add/update. Left undefined for a removal request.
    job?: BaseJob;
    jobSummary: string;
    existingJobSummary?: string;
}

const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

function isExpired(createdAt: number): boolean {
    return Date.now() - createdAt > REQUEST_TTL_MS;
}

function pruneExpired<T extends { createdAt: number }>(map: Map<string, T>): void {
    for (const [id, entry] of map) {
        if (isExpired(entry.createdAt)) {
            map.delete(id);
        }
    }
}

setInterval(() => {
    pruneExpired(pendingRequests);
    pruneExpired(pendingGuildRequests);
}, 60 * 60 * 1000).unref();

const pendingRequests = new Map<string, PendingJobRequest & { createdAt: number }>();

export async function sendJobApprovalDM(
    logger: Logger,
    client: BotClient,
    ownerId: string,
    request: PendingJobRequest,
): Promise<void> {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    pendingRequests.set(requestId, { ...request, createdAt: Date.now() });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`${APPROVE_PREFIX}${requestId}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`${DENY_PREFIX}${requestId}`)
            .setLabel('Deny')
            .setStyle(ButtonStyle.Danger),
    );

    const isUpdate = request.existingJobSummary !== undefined;
    const isRemoval = request.job === undefined;
    const title = isRemoval
        ? '**Job Removal Request**'
        : isUpdate
            ? '**Job Configuration Request — Update**'
            : '**Job Configuration Request — New Job**';

    const diffSection = isRemoval
        ? `\n${request.jobSummary}`
        : isUpdate
            ? `\n**Before:**\n${request.existingJobSummary}\n\n**After:**\n${request.jobSummary}`
            : `\n**New:**\n${request.jobSummary}`;

    const content = [
        title,
        `Guild: ${request.guildName} (\`${request.guildId}\`)`,
        `Requested by: ${request.requesterName} (\`${request.requesterId}\`)`,
        `Job name: \`${request.jobName}\``,
        diffSection,
    ].join('\n');

    try {
        const owner = await client.users.fetch(ownerId);
        await owner.send({ content, components: [row] });
        logger.info(`Sent job approval DM to owner for job "${request.jobName}" from guild ${request.guildId}`);
    } catch (err) {
        pendingRequests.delete(requestId);
        logger.error(`Failed to DM bot owner for job approval: ${err}`);
        throw new Error('Could not reach bot owner via DM. Ensure your DMs are open.', { cause: err });
    }
}

export async function handleJobApprovalButton(
    interaction: ButtonInteraction,
    logger: Logger,
    ownerId: string,
    updateAppConfig: (config: AppConfig) => void,
): Promise<void> {
    if (interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'You are not authorized to action this request.', flags: MessageFlags.Ephemeral });
        return;
    }

    const customId = interaction.customId;
    const isApprove = customId.startsWith(APPROVE_PREFIX);
    const isDeny = customId.startsWith(DENY_PREFIX);
    if (!isApprove && !isDeny) {return;}

    const requestId = isApprove ? customId.slice(APPROVE_PREFIX.length) : customId.slice(DENY_PREFIX.length);
    const request = pendingRequests.get(requestId);

    if (!request || isExpired(request.createdAt)) {
        pendingRequests.delete(requestId);
        await interaction.reply({ content: 'This request has already been handled or has expired.', flags: MessageFlags.Ephemeral });
        return;
    }

    pendingRequests.delete(requestId);

    if (isDeny) {
        await interaction.update({ content: `**Denied** — job \`${request.jobName}\` from ${request.guildName}.`, components: [] });
        await notifyRequester(interaction.client as BotClient, request.requesterId, `Your request to configure job \`${request.jobName}\` was denied.`, logger);
        return;
    }

    try {
        // Re-derive the change against the current config on disk rather than trusting a
        // snapshot captured back when the request was submitted, which could otherwise be
        // stale if another job/guild request was approved in the meantime.
        const currentAppConfig = AppConfig.fromSerialized(readFileSync(getAppConfigFilePath(), { encoding: 'utf8' }));
        const newAppConfig = request.job
            ? currentAppConfig.withUpdatedJob(request.guildId, request.jobName, request.job)
            : currentAppConfig.withRemovedJob(request.guildId, request.jobName);

        writeFileSync(getAppConfigFilePath(), JSON.stringify(newAppConfig.toJSON(), null, 4), 'utf8');
        await uploadFile(logger, getAppConfigFilePath(), BUCKET, APP_CONFIG_FILE_NAME);
        await downloadFile(logger, getAppConfigFilePath(), BUCKET, APP_CONFIG_FILE_NAME, DataType.Text);
        const updatedConfig = AppConfig.fromSerialized(readFileSync(getAppConfigFilePath(), { encoding: 'utf8' }));
        updateAppConfig(updatedConfig);

        await interaction.update({ content: `**Approved** — job \`${request.jobName}\` from ${request.guildName} is now active.`, components: [] });
        await notifyRequester(interaction.client as BotClient, request.requesterId, `Your request to configure job \`${request.jobName}\` was approved and is now active.`, logger);
    } catch (err) {
        logger.error(`Failed to apply approved job config: ${err}`);
        await interaction.reply({ content: 'Approval failed — could not update config. Check the logs.', flags: MessageFlags.Ephemeral });
    }
}

async function notifyRequester(client: BotClient, requesterId: string, message: string, logger: Logger): Promise<void> {
    try {
        const requester = await client.users.fetch(requesterId);
        await requester.send(message);
    } catch {
        logger.warn(`Could not DM requester ${requesterId}`);
    }
}

// ── Guild approval ────────────────────────────────────────────────────────────

interface PendingGuildRequest {
    guildId: string;
    guildName: string;
    guildOwnerId: string;
    memberCount: number;
    createdAt: number;
}

const pendingGuildRequests = new Map<string, PendingGuildRequest>();

export async function sendGuildApprovalDM(
    logger: Logger,
    client: BotClient,
    ownerId: string,
    guild: Guild,
): Promise<void> {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const guildOwner = await guild.fetchOwner();

    pendingGuildRequests.set(requestId, {
        guildId: guild.id,
        guildName: guild.name,
        guildOwnerId: guildOwner.id,
        memberCount: guild.memberCount,
        createdAt: Date.now(),
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`${GUILD_APPROVE_PREFIX}${requestId}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`${GUILD_DENY_PREFIX}${requestId}`)
            .setLabel('Deny')
            .setStyle(ButtonStyle.Danger),
    );

    const content = [
        '**New Guild Request**',
        `Guild: ${guild.name} (\`${guild.id}\`)`,
        `Owner: ${guildOwner.user.username} (\`${guildOwner.id}\`)`,
        `Members: ${guild.memberCount}`,
    ].join('\n');

    try {
        const owner = await client.users.fetch(ownerId);
        await owner.send({ content, components: [row] });
        logger.info(`Sent guild approval DM for "${guild.name}" (${guild.id})`);
    } catch (err) {
        pendingGuildRequests.delete(requestId);
        logger.error(`Failed to DM bot owner for guild approval: ${err}`);
        throw new Error('Could not reach bot owner via DM. Ensure your DMs are open.', { cause: err });
    }
}

export async function handleGuildApprovalButton(
    interaction: ButtonInteraction,
    logger: Logger,
    ownerId: string,
    updateAppConfig: (config: AppConfig) => void,
    getCommands: () => SlashCommand[],
): Promise<void> {
    if (interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'You are not authorized to action this request.', flags: MessageFlags.Ephemeral });
        return;
    }

    const customId = interaction.customId;
    const isApprove = customId.startsWith(GUILD_APPROVE_PREFIX);
    const isDeny = customId.startsWith(GUILD_DENY_PREFIX);
    if (!isApprove && !isDeny) {return;}

    const requestId = isApprove ? customId.slice(GUILD_APPROVE_PREFIX.length) : customId.slice(GUILD_DENY_PREFIX.length);
    const request = pendingGuildRequests.get(requestId);

    if (!request || isExpired(request.createdAt)) {
        pendingGuildRequests.delete(requestId);
        await interaction.reply({ content: 'This request has already been handled or has expired.', flags: MessageFlags.Ephemeral });
        return;
    }

    pendingGuildRequests.delete(requestId);

    const client = interaction.client as BotClient;

    if (isDeny) {
        await interaction.update({ content: `**Denied** — ${request.guildName} (\`${request.guildId}\`).`, components: [] });
        const guild = client.guilds.cache.get(request.guildId);
        if (guild) {
            try {
                await guild.systemChannel?.send('❌ Your server was not approved to use this bot.');
            } catch (err) {
                logger.warn(`Could not post denial message in guild ${request.guildId}: ${err}`);
            }
            try {
                const guildOwner = await client.users.fetch(request.guildOwnerId);
                await guildOwner.send(`Your server **${request.guildName}** was not approved to use this bot.`);
            } catch {
                logger.warn(`Could not DM guild owner ${request.guildOwnerId}`);
            }
            await guild.leave();
        }
        return;
    }

    try {
        const currentConfig = AppConfig.fromSerialized(readFileSync(getAppConfigFilePath(), { encoding: 'utf8' }));
        const newAppConfig = currentConfig.withAddedGuild(request.guildId);
        writeFileSync(getAppConfigFilePath(), JSON.stringify(newAppConfig.toJSON(), null, 4), 'utf8');
        await uploadFile(logger, getAppConfigFilePath(), BUCKET, APP_CONFIG_FILE_NAME);
        await downloadFile(logger, getAppConfigFilePath(), BUCKET, APP_CONFIG_FILE_NAME, DataType.Text);
        const updatedConfig = AppConfig.fromSerialized(readFileSync(getAppConfigFilePath(), { encoding: 'utf8' }));
        updateAppConfig(updatedConfig);

        await registerSlashCommands(logger, updatedConfig, request.guildId, getCommands());

        await interaction.update({ content: `**Approved** — ${request.guildName} (\`${request.guildId}\`) is now active.`, components: [] });

        const approvedGuild = client.guilds.cache.get(request.guildId);
        try {
            await approvedGuild?.systemChannel?.send(
                '✅ Your server has been approved!\n' +
                'A guild admin can run `/guild_admin set_admin_role` to designate a bot admin, ' +
                'then set up scheduled jobs with `/guild_admin configure_message_job` or `/guild_admin configure_audio_job`.',
            );
        } catch (err) {
            logger.warn(`Could not post approval message in guild ${request.guildId}: ${err}`);
        }
        try {
            const guildOwner = await client.users.fetch(request.guildOwnerId);
            await guildOwner.send(
                `Your server **${request.guildName}** has been approved! ` +
                'Check your server for setup instructions.',
            );
        } catch {
            logger.warn(`Could not DM guild owner ${request.guildOwnerId}`);
        }
    } catch (err) {
        logger.error(`Failed to approve guild ${request.guildId}: ${err}`);
        await interaction.reply({ content: 'Approval failed — could not update config. Check the logs.', flags: MessageFlags.Ephemeral });
    }
}
