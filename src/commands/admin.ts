import { initialize_audio_files } from '../aws/startup.js';
import { CommandInteraction, Permissions } from 'discord.js';
import { CommandContext } from '../util/slashCommands.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { getGuildMemberFromInteraction } from '../util/util.js';

enum Subcommands {
    List = 'list',
    Update = 'update'
}

export default (context: CommandContext) => {
    const logger = context.logger;
    logger.info("Building admin command.")

    return {
        builder: new SlashCommandBuilder()
                .setName('admin')
                .setDescription('Split voice channel members into 2 teams')
                .addSubcommand(subcommand => 
                    subcommand
                        .setName(Subcommands.List)
                        .setDescription("List all user IDs")
                )
                .addSubcommand(subcommand => 
                    subcommand
                        .setName(Subcommands.Update)
                        .setDescription("Update configuration")
                        .addStringOption(option =>
                            option.setName('config')
                                .setDescription('Configuration to update')
                                .setRequired(true)
                                .addChoices(
                                    {name:'app', value:'app'},
                                    {name:'audio', value:'audio'}
                                )
                        )
                ),
        async execute(context: CommandContext, interaction: CommandInteraction) {
            var guildMember = getGuildMemberFromInteraction(interaction);
            if (!guildMember.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
                interaction.reply({content: "You do not have permissions to run this command", ephemeral: true})
            }
            switch(interaction.options.getSubcommand()) {
                case Subcommands.List: {
                    listUsers(context, interaction);
                    break;
                }
                case Subcommands.Update: {
                    update(context, interaction);
                    break;
                }
                default: {
                    await interaction.reply({content: 'Not a valid command', ephemeral: true});
                }
            }
        }
    }
}

function listUsers(context: CommandContext, interaction: CommandInteraction) {
    if (!interaction.guild) {
        interaction.reply({content: "Must be in a server to use this command"})
        return;
    }

    interaction.guild.members.fetch()
        .then(members => {
            var membersText: string[] = [];
            members.forEach(member => {
                membersText.push(`${member.user.username},${member.user.id}`);
                context.logger.info(`${member.user.username}(${member.user.id})`);
            });
            interaction.reply({content: membersText.join("\n"), ephemeral: true})
        })
        .catch(err =>{
            context.logger.error("Failed to send list of all users:", err);
            interaction.reply({content: "Failed to send list of all users", ephemeral: false})
        })
}

function update(context: CommandContext, interaction: CommandInteraction) {
    initialize_audio_files(context.logger)
        .then(audioConfig => {
            if (context.client.update.audioConfig)
                context.client.update.audioConfig(audioConfig);
        })
        .catch(err => {
            context.logger.error(`Update audio files failed: ${err}`);
            interaction.reply({content: `Update audio files failed: ${err}`, ephemeral: true});
            return;
        });
    interaction.reply({content: `Audio files have been updated`, ephemeral: true});
}