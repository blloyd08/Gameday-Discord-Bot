import schedule from 'node-schedule';
import { messageEpicFreeGamesTweet } from "./twitter.js"

// Day of the week that gameday is scheduled (Sunday = 0)
const GAMEDAY_DAY_OF_WEEK = 3;
const GAMEDAY_START_HOUR = 19;
const JOB_TIMEZONE = "America/Los_Angeles"

var jobs = [];
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const gamedayGroup = '<@&314584437751021575>';

export function scheduleJobs(bot) {

    // Cancel jobs previously setup. This can happen if the bot disconnects and reconnects.
    cancelAllJobs();

    // Remind users that gameday is tomorrow
    var dayBeforeJobParameters = getDayBeforeJobParameters();
    // Notify users that gameday has started
    var gamedayJobParameters = getGamedayJobParameters();

    // Check for tweet about new Epic free games and share tweet
    messageEpicFreeGamesTweet(bot, gamedayGroup);
    var epic_job_schedule = buildScheduleRule(GAMEDAY_START_HOUR -1);
    jobs.push(schedule.scheduleJob(epic_job_schedule, function () {
        messageEpicFreeGamesTweet(bot, gamedayGroup);
    }));

    addMessageGamedayGroupJob(dayBeforeJobParameters, bot);
    addMessageGamedayGroupJob(gamedayJobParameters, bot);
}

function addMessageGamedayGroupJob(jobParameters, bot) {
    console.log("Adding job with parameters:", jobParameters);
    jobs.push(schedule.scheduleJob(jobParameters.schedule, function () {
        bot.textChannels[0].send(jobParameters.message);
    }));
}

function getDayBeforeJobParameters() {
    var dayBeforeName = days[GAMEDAY_DAY_OF_WEEK];
    var dayBeforeSchedule = buildScheduleRule(GAMEDAY_START_HOUR, GAMEDAY_DAY_OF_WEEK - 1);
    var dayBeforeMessage = `Gameday is tomorrow (${dayBeforeName}) 7 PM(PST)! :fire: :fire: :fire: `;

    var parameters = buildJobParameters(dayBeforeSchedule, dayBeforeMessage);
    return parameters
}

function getGamedayJobParameters() {
    var gamedayMessage = formatMessageToGamedayGroup("It's MothaFukinGameDay time! Lets go!!! ");
    var gamedaySchedule = buildScheduleRule(GAMEDAY_START_HOUR, GAMEDAY_DAY_OF_WEEK);

    var parameters = buildJobParameters(gamedaySchedule, gamedayMessage);
    return parameters;
}

function buildJobParameters(cronsSchedule, groupMessage) {
    return {
        schedule: cronsSchedule,
        message: groupMessage
    }
}

function formatMessageToGamedayGroup(message) {
    return `${gamedayGroup} ${message}`;
}

function buildScheduleRule(jobHour, jobDayOfWeek) {
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

function cancelAllJobs() {
    if (jobs.length > 0) {
        console.log("Cancelling all scheduled jobs")
        jobs.forEach((job) => {
            schedule.cancelJob(job);
        });
    }
}