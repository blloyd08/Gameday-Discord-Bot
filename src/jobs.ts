import schedule from 'node-schedule';
import { Logger } from 'winston';
import { BotClient } from './bot.js';
import { AppConfig } from './config/appConfig';
import { sendTextMessageToAllGuilds } from './util/util.js';

// Day of the week that gameday is scheduled (Sunday = 0)
const JOB_TIMEZONE = "America/Los_Angeles"

const jobs: schedule.Job[] = [];
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const gamedayGroup = '<@&314584437751021575>';

interface JobParameters {
    schedule: schedule.RecurrenceRule,
    message: string
}

export function scheduleJobs(logger: Logger, appConfig: AppConfig, bot: BotClient) {

    // Cancel jobs previously setup. This can happen if the bot disconnects and reconnects.
    cancelAllJobs(logger);

    // Remind users that gameday is tomorrow
    const dayBeforeJobParameters = getDayBeforeJobParameters(appConfig);
    // Notify users that gameday has started
    const gamedayJobParameters = getGamedayJobParameters(appConfig);

    addMessageGamedayGroupJob(logger, appConfig, bot, dayBeforeJobParameters);
    addMessageGamedayGroupJob(logger, appConfig, bot, gamedayJobParameters);
}

function addMessageGamedayGroupJob(logger: Logger, appConfig: AppConfig, bot: BotClient, jobParameters: JobParameters) {
    logger.info("Adding job with parameters:", jobParameters);
    jobs.push(schedule.scheduleJob(jobParameters.schedule, function () {
        sendTextMessageToAllGuilds(appConfig, bot, jobParameters.message);
    }));
}

function getDayBeforeJobParameters(appConfig: AppConfig): JobParameters {
    const dayBeforeName = days[appConfig.jobs.gameday.dayOfWeek];
    const dayBeforeSchedule = buildScheduleRule(appConfig.jobs.gameday.startHour, appConfig.jobs.gameday.dayOfWeek - 1);
    const dayBeforeMessage = `Gameday is tomorrow (${dayBeforeName}) 7 PM(PST)! :fire: :fire: :fire: `;

    const parameters = buildJobParameters(dayBeforeSchedule, dayBeforeMessage);
    return parameters
}

function getGamedayJobParameters(appConfig: AppConfig) {
    const gamedayMessage = formatMessageToGamedayGroup("It's MothaFukinGameDay time! Lets go!!! ");
    const gamedaySchedule = buildScheduleRule(appConfig.jobs.gameday.startHour, appConfig.jobs.gameday.dayOfWeek);

    const parameters = buildJobParameters(gamedaySchedule, gamedayMessage);
    return parameters;
}


function buildJobParameters(cronsSchedule: schedule.RecurrenceRule, groupMessage: string): JobParameters {
    return {
        schedule: cronsSchedule,
        message: groupMessage
    }
}

function formatMessageToGamedayGroup(message: string) {
    return `${gamedayGroup} ${message}`;
}

function buildScheduleRule(jobHour: number, jobDayOfWeek: number): schedule.RecurrenceRule {
    const schedule_rule = new schedule.RecurrenceRule();
    schedule_rule.tz = JOB_TIMEZONE;
    schedule_rule.second = 0;
    schedule_rule.minute = 0;
    schedule_rule.hour = jobHour;
    if (jobDayOfWeek) {
        schedule_rule.dayOfWeek = jobDayOfWeek;
    }
    return schedule_rule;
}

function cancelAllJobs(logger: Logger) {
    if (jobs.length > 0) {
        logger.info("Cancelling all scheduled jobs")
        jobs.forEach((job) => {
            schedule.cancelJob(job);
        });
    }
}