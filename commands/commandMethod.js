export class CommandMethod {
  constructor(name, documentation, example){
      this.name = name;
      this.documentation = documentation;
      this.example = example;
  }

  execute(bot, message, args) {
    
  }

  toString(){
    let name = this.name ? this.name : "";
    return `${name}\t\t\t\t\t\tDescription: ${this.documentation}`
  }
}