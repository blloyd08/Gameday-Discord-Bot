import { ShuffleCommand } from './shuffle.js';
import { StratCommand } from './strat.js'
import { AudioCommand } from './audio.js'
import { AdminCommand } from './admin.js'


export class CommandManager{
  constructor(commands){
    this.commands = {};
    if (commands){
      commands.forEach(command => {
        this.registerCommand(command);
      });
    }
  }

  handleMessage(bot, message){
    try {
      let prefix = message.content.substring(0,1);
      if (prefix === '?'){
        this.sendHelp(bot, message);
      } else {
        this.executeCommand(bot, message, prefix);
      }
    } catch(err) {
      console.log(err);
      message.reply("Failed to run command");
    }
  }

  executeCommand(bot, message, prefix){
    if (prefix && this.commands[prefix]){
      var args = message.content.substring(1).split(' ');
      var cmd = args[0].toLowerCase();
      args = args.splice(1);

      let commands = this.commands[prefix];
      for (let command of commands){
        if (!(command.name) || command.name.toLowerCase() === cmd)
          command.execute(bot, message, args);
      }

    }
  }

  registerCommand(command) {
    if (command && command.prefix){      
      let prefixCommandList = this.commands[command.prefix]
      
      // Init list if first time encountering prefix
      if (prefixCommandList === undefined){
        prefixCommandList = []
      }

      prefixCommandList.push(command);
      this.commands[command.prefix] = prefixCommandList;
    }
  }

  sendHelp(bot, message){
    message.reply(`${this.getCommandsString()}`);
  }

  getCommandsString(){
    let commandsString = "";
    let prefixes = Object.keys(this.commands);

    prefixes.forEach(prefix => {
      let commands = this.commands[prefix];
      commands.forEach(command => {
        commandsString += `${command.toString()}\n`;
      })
      commandsString += "\n";
    })
    return commandsString;
  }
}

export const botCommandManager =  new CommandManager([
  new ShuffleCommand(),
  new StratCommand(),
  new AudioCommand(),
  new AdminCommand()
]);