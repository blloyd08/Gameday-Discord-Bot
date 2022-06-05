import { Client, Collection, Intents } from 'discord.js';
import { createLogger } from './logger';
import appConfig from './config/appConfig.json';
import { CommandContext, setClientSlashCommands, SlashCommand } from './util/slashCommands';
import { initialize_audio_files } from './aws/startup';
import { handleUserJoinVoiceChannel } from './commands/audio';
import { AudioConfig } from './config/audioConfig';


export class BotClient extends Client {
    commands = new Collection<string, SlashCommand>();
}

const logger = createLogger('gameday-bot');
let audioConfig: AudioConfig;

(async () => {
    const client = new BotClient({
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MEMBERS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_VOICE_STATES
        ]
    });

    audioConfig = await initialize_audio_files(logger);
    const context: CommandContext = {audioConfig, logger};
    await setClientSlashCommands(context, client);

    // Doc for client events https://discord.js.org/#/docs/discord.js/stable/class/Client
    client.on('ready', () => {
        logger.info(`Logged in to discord!`);
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute({audioConfig, logger}, interaction);
        } catch (error) {
            logger.error(error);
            if (!interaction.replied) {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }

    });

    client.on('voiceStateUpdate', async (oldVoiceState, newVoiceState) => {
        try {
            if (!newVoiceState.member?.user.bot) {
                if (!newVoiceState.channel) {
                    logger.info(`USER ${newVoiceState.member?.user.username} (${newVoiceState.member?.user.id}) LEFT VOICE CHANNEL`)
                } else if (!oldVoiceState.channel){
                    logger.info(`USER ${newVoiceState.member?.user.username}(${newVoiceState.member?.user.id}) HAS JOINED VOICE CHANNEL`)
                    handleUserJoinVoiceChannel(logger, audioConfig, newVoiceState);
                }
            }
        } catch (error) {
            logger.error(error);
        }
    })

    client.login(appConfig.auth.discordToken);
})();
