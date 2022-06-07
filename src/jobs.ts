import schedule from 'node-schedule';
import { Logger } from 'winston';
import { BotClient } from './bot.js';
import { AppConfig } from './config/appConfig';
import { messageEpicFreeGamesTweet } from "./twitter"
import { sendTextMessageToAllGuilds } from './util/util.js';

// Day of the week that gameday is scheduled (Sunday = 0)
const JOB_TIMEZONE = "America/Los_Angeles"

var jobs: schedule.Job[] = [];
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
    var dayBeforeJobParameters = getDayBeforeJobParameters(appConfig);
    // Notify users that gameday has started
    var gamedayJobParameters = getGamedayJobParameters(appConfig);

    // Check for tweet about new Epic free games and share tweet
    messageEpicFreeGamesTweet(logger, appConfig, bot, gamedayGroup);
    var epic_job_schedule = buildScheduleRule(appConfig.jobs.gameday.startHour -1, appConfig.jobs.gameday.dayOfWeek);
    jobs.push(schedule.scheduleJob(epic_job_schedule, function () {
        messageEpicFreeGamesTweet(logger, appConfig, bot, gamedayGroup);
    }));

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
    var dayBeforeName = days[appConfig.jobs.gameday.dayOfWeek];
    var dayBeforeSchedule = buildScheduleRule(appConfig.jobs.gameday.startHour, appConfig.jobs.gameday.dayOfWeek - 1);
    var dayBeforeMessage = `Gameday is tomorrow (${dayBeforeName}) 7 PM(PST)! :fire: :fire: :fire: `;

    var parameters = buildJobParameters(dayBeforeSchedule, dayBeforeMessage);
    return parameters
}

function getGamedayJobParameters(appConfig: AppConfig) {
    var gamedayMessage = formatMessageToGamedayGroup("It's MothaFukinGameDay time! Lets go!!! ");
    var gamedaySchedule = buildScheduleRule(appConfig.jobs.gameday.startHour, appConfig.jobs.gameday.dayOfWeek);

    var parameters = buildJobParameters(gamedaySchedule, gamedayMessage);
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
    let schedule_rule = new schedule.RecurrenceRule();
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