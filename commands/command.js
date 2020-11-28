import { deleteMessage } from '../util.js';

export class Command {
    constructor(prefix, name, methods){
        this.prefix = prefix;
        this.name = name;
        this.methods = this._buildMethods(methods);
    }

    _buildMethods(methods){
      var methodsDict = {};
      methods.forEach(method => {
        methodsDict[method.name] = method;
      });
      return methodsDict;
    }

    onStartExecute(){

    }

    onFinishExecute(){

    }

    onValidate(params){
      return true;
    }

    parseParameters(bot, message, args){
      var methodName = args.length > 0 ? args[0].toLowerCase() : undefined;
      return {
        bot: bot,
        message: message,
        args: args,
        methodName: methodName
      }
    }
  
    execute(bot, message, args) {
      this.onStartExecute(bot, message, args);
      var params = this.parseParameters(bot, message, args);
      if (this.onValidate(params)) {
        this.executeMethod(params);
        deleteMessage(params.message, 10000);
      }
      this.onFinishExecute(params)
    }

    executeMethod(params){
      if (params.methodName in this.methods){
        this.methods[params.methodName].execute(params)
      } else {
        message.reply(`Method ${methodName} doesn't exist`);
      }
    }
  
    toString(){
      let commandOutput = "";

      let methodKeys = Object.keys(this.methods);

      methodKeys.forEach(key => {
        let method = this.methods[key];
        commandOutput += `\n${this.prefix}${this.name} ${method.toString()}`
      })

      return commandOutput;
    }
}