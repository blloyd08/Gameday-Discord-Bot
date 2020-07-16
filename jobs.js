import schedule from 'node-schedule';

// Day of the week that gameday is scheduled (Sunday = 0)
const gamdayDayIndex = 4;

var jobs = [];
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function scheduleJobs(bot) {

    // Cancel jobs previously setup. This can happen if the bot disconnects and reconnects.
    cancelAllJobs();

    // Remind users that gameday is tomorrow
    var dayBeforeJobParameters = getDayBeforeJobParameters();
    // Notify users that gameday has started
    var gamedayJobParameters = getGamedayJobParameters();


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
    var dayBeforeIndex = gamdayDayIndex - 1;
    var dayBeforeName = days[gamdayDayIndex];
    var dayBeforeSchedule = formatCronJobSchedule(dayBeforeIndex);
    var dayBeforeMessage = `Gameday is tomorrow (${dayBeforeName}) 6 PM(PST)! :fire: :fire: :fire: `;

    var parameters = buildJobParameters(dayBeforeSchedule, dayBeforeMessage);
    return parameters
}

function getGamedayJobParameters() {
    var gamedayMessage = formatMessageToGamedayGroup("It's MothaFukinGameDay time! Lets go!!! ");
    var gamedaySchedule = formatCronJobSchedule(gamdayDayIndex);

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
    return `<@&314584437751021575> ${message}`;
}

function formatCronJobSchedule(dayOfWeek) {
    return `0 0 18 * * ${dayOfWeek}`;
}

function cancelAllJobs() {
    if (jobs.length > 0) {
        console.log("Cancelling all scheduled jobs")
        jobs.forEach((job) => {
            schedule.cancelJob(job);
        });
    }
}