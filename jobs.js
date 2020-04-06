import schedule from 'node-schedule';

var jobs = [];

export function scheduleJobs(bot){

  // Cancel jobs previously setup. This can happen if the bot disconnects and reconnects.
  if (jobs.length > 0){
      jobs.forEach((job) => {
          schedule.cancelJob(job);
      });
  }
  jobs.push(schedule.scheduleJob('0 0 18 * * 3', function(){
      bot.textChannels[0].send(`<@&314584437751021575> Gameday is tomorrow (Thursday) 6 PM(PST)! :fire: :fire: :fire: `);
  }));
  jobs.push(schedule.scheduleJob('0 0 18 * * 4', function(){
      bot.textChannels[0].send(`<@&314584437751021575> It's MothaFukinGameDay time! Lets go!!! `);
  }));
}