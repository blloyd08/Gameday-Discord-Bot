import schedule from 'node-schedule';
import type { Logger } from 'winston';
import type { TextChannel, VoiceBasedChannel } from 'discord.js';
import type { BotClient } from './bot.js';
import type { AppConfig, GuildConfig, BaseJob } from './config/appConfig';
import { MessageJob, AudioJob } from './config/appConfig';
import type { BotAudioPlayer } from './commands/audio.js';
import { getAudioClipFilePath } from './config/audioConfig.js';
import { getVoiceChannels, getVoiceChannelMembers } from './util/util.js';

const JOB_TIMEZONE = 'America/Los_Angeles';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const jobs: schedule.Job[] = [];

interface JobTableRow {
    guild: string;
    name: string;
    type: string;
    schedule: string;
    details: string;
}

export function scheduleJobs(logger: Logger, appConfig: AppConfig, bot: BotClient, botAudioPlayer: BotAudioPlayer): void {
    cancelAllJobs(logger);

    const tableRows: JobTableRow[] = [];

    appConfig.guilds.forEach((guildConfig, guildId) => {
        const guildName = bot.guilds.cache.get(guildId)?.name ?? guildId;
        scheduleGuildJobs(logger, bot, botAudioPlayer, guildId, guildName, guildConfig, tableRows);
    });

    logger.info(formatJobsTable(tableRows));
}

function scheduleGuildJobs(logger: Logger, bot: BotClient, botAudioPlayer: BotAudioPlayer, guildId: string, guildName: string, guildConfig: GuildConfig, tableRows: JobTableRow[]): void {
    guildConfig.jobs.forEach((job, jobName) => {
        const rule = buildScheduleRule(job.hour, job.minute, job.dayOfWeek);

        jobs.push(schedule.scheduleJob(rule, () => {
            if (job instanceof MessageJob) {
                sendMessageToGuild(logger, bot, guildId, job.channelId, job.message);
            } else if (job instanceof AudioJob) {
                playAudioInGuild(logger, bot, botAudioPlayer, guildId, job.clipFileName, job.voiceChannelId);
            }
        }));

        tableRows.push(buildTableRow(guildName, jobName, job, bot, guildId));
    });
}

function buildTableRow(guildName: string, jobName: string, job: BaseJob, bot: BotClient, guildId: string): JobTableRow {
    const scheduleStr = `${DAYS[job.dayOfWeek]} ${job.hour}:${String(job.minute).padStart(2, '0')}`;

    let details: string;
    if (job instanceof MessageJob) {
        const channelName = bot.guilds.cache.get(guildId)?.channels.cache.get(job.channelId)?.name;
        const channel = channelName ? `#${channelName}` : job.channelId;
        const preview = job.message.length > 30 ? `${job.message.slice(0, 30)}…` : job.message;
        details = `${channel} | "${preview}"`;
    } else if (job instanceof AudioJob) {
        const channelName = job.voiceChannelId
            ? (bot.guilds.cache.get(guildId)?.channels.cache.get(job.voiceChannelId)?.name ?? job.voiceChannelId)
            : 'auto';
        details = `${job.clipFileName} | ${channelName}`;
    } else {
        details = '(unknown job type)';
    }

    return { guild: guildName, name: jobName, type: job.type, schedule: scheduleStr, details };
}

function formatJobsTable(rows: JobTableRow[]): string {
    if (rows.length === 0) return 'No jobs scheduled.';

    const headers = ['Guild', 'Job', 'Type', 'Schedule', 'Details'];
    const columns = [
        rows.map(r => r.guild),
        rows.map(r => r.name),
        rows.map(r => r.type),
        rows.map(r => r.schedule),
        rows.map(r => r.details),
    ];
    const widths = headers.map((h, i) => Math.max(h.length, ...columns[i].map(c => c.length)));

    const pad = (s: string, w: number) => s.padEnd(w);
    const divider = `+${widths.map(w => '-'.repeat(w + 2)).join('+')}+`;
    const headerRow = `|${headers.map((h, i) => ` ${pad(h, widths[i])} `).join('|')}|`;
    const dataRows = rows.map(r => {
        const cells = [r.guild, r.name, r.type, r.schedule, r.details];
        return `|${cells.map((c, i) => ` ${pad(c, widths[i])} `).join('|')}|`;
    });

    return ['\nScheduled Jobs:', divider, headerRow, divider, ...dataRows, divider].join('\n');
}

function sendMessageToGuild(logger: Logger, bot: BotClient, guildId: string, channelId: string, message: string): void {
    const channel = bot.guilds.cache.get(guildId)?.channels.cache.get(channelId);
    if (channel) {
        (channel as TextChannel).send(message);
    } else {
        logger.error(`Could not find text channel ${channelId} for guild ${guildId}`);
    }
}

function playAudioInGuild(logger: Logger, bot: BotClient, botAudioPlayer: BotAudioPlayer, guildId: string, clipFileName: string, voiceChannelId?: string): void {
    const guild = bot.guilds.cache.get(guildId);
    if (!guild) {
        logger.error(`Could not find guild ${guildId}`);
        return;
    }

    let voiceChannel: VoiceBasedChannel | undefined;

    if (voiceChannelId) {
        voiceChannel = guild.channels.cache.get(voiceChannelId) as VoiceBasedChannel | undefined;
        if (!voiceChannel) {
            logger.error(`Could not find voice channel ${voiceChannelId} for guild ${guildId}`);
            return;
        }
    } else {
        voiceChannel = getVoiceChannels(guild)
            .reduce<VoiceBasedChannel | undefined>((busiest, channel) => {
                const memberCount = getVoiceChannelMembers(channel).length;
                const busiestCount = busiest ? getVoiceChannelMembers(busiest).length : -1;
                return memberCount > busiestCount ? channel : busiest;
            }, undefined);

        if (!voiceChannel) {
            logger.error(`No active voice channels found in guild ${guildId}`);
            return;
        }
    }

    const clipPath = getAudioClipFilePath(clipFileName);
    botAudioPlayer.playAudioClip(voiceChannel, clipPath).catch(err => {
        logger.error(`Failed to play audio clip "${clipFileName}" for job in guild ${guildId}: ${err}`);
    });
}

function buildScheduleRule(hour: number, minute: number, dayOfWeek: number): schedule.RecurrenceRule {
    const rule = new schedule.RecurrenceRule();
    rule.tz = JOB_TIMEZONE;
    rule.second = 0;
    rule.minute = minute;
    rule.hour = hour;
    if (dayOfWeek) {
        rule.dayOfWeek = dayOfWeek;
    }
    return rule;
}

function cancelAllJobs(logger: Logger): void {
    if (jobs.length > 0) {
        logger.info('Cancelling all scheduled jobs');
        jobs.forEach(job => schedule.cancelJob(job));
        jobs.length = 0;
    }
}
