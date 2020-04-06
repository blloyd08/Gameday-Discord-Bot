export class Command {
    constructor(prefix, name, methods){
        this.prefix = prefix;
        this.name = name;
        this.methods = methods;
    }
  
    execute(bot, message, args) {
      return false;
    }
  
    toString(){
      let commandOutput = "";
      this.methods.forEach(method => {
        commandOutput += `\n${this.prefix}${this.name} ${method.toString()}`;
      })
      return commandOutput;
    }
}