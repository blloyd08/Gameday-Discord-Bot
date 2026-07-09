import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { createLogger } from '../logger';
import { createDirectoryIfAbsent } from '../util/util';
import { downloadFile, BUCKET, DataType } from '../aws/download';

const CONFIG_FOLDER_PATH = path.join(__dirname, '..', 'config');
export const APP_CONFIG_FILE_NAME = 'appConfig.json';
const APP_CONFIG_FILE_PATH: string = path.join(CONFIG_FOLDER_PATH, APP_CONFIG_FILE_NAME);

export function getAppConfigFilePath(): string {
    createDirectoryIfAbsent(CONFIG_FOLDER_PATH);
    return APP_CONFIG_FILE_PATH;
}

export function getConfigFilePath(fileName: string): string {
    return path.join(CONFIG_FOLDER_PATH, fileName);
}

class Auth {
    constructor(
        public readonly discord: string,
    ) {}
}

export abstract class BaseJob {
    abstract readonly type: string;
    constructor(
        public readonly dayOfWeek: number,
        public readonly hour: number,
        public readonly minute: number,
    ) {}
}

export class MessageJob extends BaseJob {
    readonly type = 'message' as const;
    constructor(
        dayOfWeek: number,
        hour: number,
        minute: number,
        public readonly channelId: string,
        public readonly message: string,
    ) { super(dayOfWeek, hour, minute); }
}

export class AudioJob extends BaseJob {
    readonly type = 'audio' as const;
    constructor(
        dayOfWeek: number,
        hour: number,
        minute: number,
        public readonly clipFileName: string,
        public readonly voiceChannelId?: string,
    ) { super(dayOfWeek, hour, minute); }
}

export class GuildConfig {
    constructor(
        public readonly jobs: Map<string, BaseJob>,
        public readonly botAdminRoleId?: string,
    ) {}
}

interface RawMessageJob {
    type: 'message';
    dayOfWeek: number;
    hour: number;
    minute: number;
    channelId: string;
    message: string;
}

interface RawAudioJob {
    type: 'audio';
    dayOfWeek: number;
    hour: number;
    minute: number;
    clipFileName: string;
    voiceChannelId?: string;
}

type RawJob = RawMessageJob | RawAudioJob;

interface RawGuild {
    botAdminRoleId?: string;
    jobs?: Record<string, RawJob>;
}

interface RawAppConfig {
    logLevel: string;
    clientId: string;
    ownerId: string;
    auth: { discord: string };
    guilds: Record<string, RawGuild>;
}

export class AppConfig {
    constructor(
        public readonly logLevel: string,
        public readonly clientId: string,
        public readonly ownerId: string,
        public readonly guilds: Map<string, GuildConfig>,
        public readonly auth: Auth,
    ) {}

    withAddedGuild(guildId: string): AppConfig {
        const newGuilds = new Map(this.guilds);
        newGuilds.set(guildId, new GuildConfig(new Map()));
        return new AppConfig(this.logLevel, this.clientId, this.ownerId, newGuilds, this.auth);
    }

    withUpdatedJob(guildId: string, jobName: string, job: BaseJob): AppConfig {
        const existing = this.guilds.get(guildId);
        const newJobs = new Map(existing?.jobs ?? []);
        newJobs.set(jobName, job);
        const newGuilds = new Map(this.guilds);
        newGuilds.set(guildId, new GuildConfig(newJobs, existing?.botAdminRoleId));
        return new AppConfig(this.logLevel, this.clientId, this.ownerId, newGuilds, this.auth);
    }

    withRemovedJob(guildId: string, jobName: string): AppConfig {
        const existing = this.guilds.get(guildId);
        if (!existing) {throw new Error(`Guild ${guildId} not found in config`);}
        const newJobs = new Map(existing.jobs);
        newJobs.delete(jobName);
        const newGuilds = new Map(this.guilds);
        newGuilds.set(guildId, new GuildConfig(newJobs, existing.botAdminRoleId));
        return new AppConfig(this.logLevel, this.clientId, this.ownerId, newGuilds, this.auth);
    }

    withUpdatedBotAdminRole(guildId: string, roleId: string): AppConfig {
        const existing = this.guilds.get(guildId);
        if (!existing) {throw new Error(`Guild ${guildId} not found in config`);}
        const newGuilds = new Map(this.guilds);
        newGuilds.set(guildId, new GuildConfig(existing.jobs, roleId));
        return new AppConfig(this.logLevel, this.clientId, this.ownerId, newGuilds, this.auth);
    }

    toJSON(): object {
        const guildsObj: Record<string, object> = {};
        this.guilds.forEach((guildConfig, guildId) => {
            const jobsObj: Record<string, object> = {};
            guildConfig.jobs.forEach((job, jobName) => {
                if (job instanceof MessageJob) {
                    jobsObj[jobName] = {
                        type: 'message',
                        dayOfWeek: job.dayOfWeek,
                        hour: job.hour,
                        minute: job.minute,
                        channelId: job.channelId,
                        message: job.message,
                    };
                } else if (job instanceof AudioJob) {
                    jobsObj[jobName] = {
                        type: 'audio',
                        dayOfWeek: job.dayOfWeek,
                        hour: job.hour,
                        minute: job.minute,
                        clipFileName: job.clipFileName,
                        ...(job.voiceChannelId && { voiceChannelId: job.voiceChannelId }),
                    };
                }
            });
            guildsObj[guildId] = {
                ...(guildConfig.botAdminRoleId && { botAdminRoleId: guildConfig.botAdminRoleId }),
                jobs: jobsObj,
            };
        });
        return {
            logLevel: this.logLevel,
            clientId: this.clientId,
            ownerId: this.ownerId,
            auth: { discord: this.auth.discord },
            guilds: guildsObj,
        };
    }

    static fromSerialized(serialized: string): AppConfig {
        const jsonObject = JSON.parse(serialized) as RawAppConfig;

        const auth: Auth = new Auth(jsonObject.auth.discord);

        const guilds = new Map<string, GuildConfig>();
        for (const [guildId, rawGuild] of Object.entries(jsonObject.guilds)) {
            const jobs = new Map<string, BaseJob>();
            for (const [jobName, rawJob] of Object.entries(rawGuild.jobs ?? {})) {
                if (rawJob.type === 'message') {
                    jobs.set(jobName, new MessageJob(
                        rawJob.dayOfWeek,
                        rawJob.hour,
                        rawJob.minute,
                        rawJob.channelId,
                        rawJob.message,
                    ));
                } else if (rawJob.type === 'audio') {
                    jobs.set(jobName, new AudioJob(
                        rawJob.dayOfWeek,
                        rawJob.hour,
                        rawJob.minute,
                        rawJob.clipFileName,
                        rawJob.voiceChannelId,
                    ));
                } else {
                    const unknownType = (rawJob as { type: unknown }).type;
                    throw new Error(`Unknown job type "${unknownType}" for job "${jobName}" in guild "${guildId}"`);
                }
            }
            guilds.set(guildId, new GuildConfig(jobs, rawGuild.botAdminRoleId));
        }

        return new AppConfig(
            jsonObject['logLevel'],
            jsonObject['clientId'],
            jsonObject['ownerId'],
            guilds,
            auth,
        );
    }
}


export async function getAppConfig(): Promise<AppConfig> {
    const logger = createLogger('app-config', 'info');
    logger.info(`Reading app config from: ${APP_CONFIG_FILE_PATH}`);
    const appConfigFilePath = getAppConfigFilePath();

    return downloadFile(logger, getAppConfigFilePath(), BUCKET, APP_CONFIG_FILE_NAME, DataType.Text).then(() => {
        if (existsSync(APP_CONFIG_FILE_PATH)) {
            const appConfigJson: string = readFileSync(APP_CONFIG_FILE_PATH, { encoding: 'utf8', flag: 'r' }).toString();
            const appConfig: AppConfig = AppConfig.fromSerialized(appConfigJson);

            if (!appConfig.auth) {
                throw Error('No auth found in app config');
            }

            logger.info(`Finished loading app config. Log level: ${appConfig.logLevel} Client Id: ${appConfig.clientId}`);
            return appConfig;
        } else {
            throw Error(`App config doesn't exist at ${APP_CONFIG_FILE_PATH}`);
        }
    }).catch(e => {
        logger.error('Error downloading app config', e);
        throw Error(`Unable to download app config to ${appConfigFilePath} from ${BUCKET}`);
    });
}
