import { initialize_audio_files } from '../aws/startup.js';
import type { CommandInteraction} from 'discord.js';
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { CommandContext} from '../util/slashCommands.js';
import { registerSlashCommands, setClientSlashCommands } from '../util/slashCommands.js';
import { getGuildMemberFromInteraction } from '../util/util.js';

enum Subcommands {
    List = 'list',
    Update = 'update'
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default (context: CommandContext) => {
    const logger = context.logger;
    logger.info('Building admin command.');

    return {
        builder: new SlashCommandBuilder()
                .setName('admin')
                .setDescription('Split voice channel members into 2 teams')
                .addSubcommand(subcommand => 
                    subcommand
                        .setName(Subcommands.List)
                        .setDescription('List all user IDs'),
                )
                .addSubcommand(subcommand => 
                    subcommand
                        .setName(Subcommands.Update)
                        .setDescription('Update configuration')
                        .addStringOption(option =>
                            option.setName('config')
                                .setDescription('Configuration to update')
                                .setRequired(true)
                                .addChoices(
                                    {name:'app', value:'app'},
                                    {name:'audio', value:'audio'},
                                ),
                        ),
                ),
        async execute(context: CommandContext, interaction: CommandInteraction): Promise<void> {
            if (!interaction.isChatInputCommand()) {return;}
            
            const guildMember = getGuildMemberFromInteraction(interaction);
            if (!guildMember.permissions.has(PermissionFlagsBits.Administrator)) {
                interaction.reply({content: 'You do not have permissions to run this command', ephemeral: true});
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
        },
    };
};

function listUsers(context: CommandContext, interaction: CommandInteraction): void {
    if (!interaction.guild) {
        interaction.reply({content: 'Must be in a server to use this command'});
        return;
    }

    interaction.guild.members.fetch()
        .then((members) => {
            const membersText: string[] = [];
            members.forEach(member => {
                membersText.push(`${member.user.username},${member.user.id}`);
                context.logger.info(`${member.user.username}(${member.user.id})`);
            });
            interaction.reply({content: membersText.join('\n'), ephemeral: true});
        })
        .catch((err) =>{
            context.logger.error('Failed to send list of all users:', err);
            interaction.reply({content: 'Failed to send list of all users', ephemeral: false});
        });
}

function update(context: CommandContext, interaction: CommandInteraction): void {
    initialize_audio_files(context.logger)
        .then(audioConfig => {
            if (context.client.update.audioConfig) {
                context.client.update.audioConfig(audioConfig);
                context = {
                    audioConfig,
                    appConfig: context.appConfig,
                    logger: context.logger,
                    client: context.client,
                    botAudioPlayer: context.botAudioPlayer,
                };
                setClientSlashCommands(context, context.client).then(() => {
                    for (const guildId of context.appConfig.guilds) {
                        registerSlashCommands(context.logger, context.appConfig, guildId, Array.from(context.client.commands.values()));
                    }
                });
            }
        })
        .catch(err => {
            context.logger.error(`Update audio files failed: ${err}`);
            interaction.reply({content: `Update audio files failed: ${err}`, ephemeral: true});
            return;
        });
    interaction.reply({content: 'Audio files have been updated', ephemeral: true});
}