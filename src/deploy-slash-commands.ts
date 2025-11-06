import { createLogger } from './logger';
import { readCommandFiles, registerSlashCommands } from './util/slashCommands';
import { getAppConfig } from './config/appConfig';
import { initialize_audio_files } from './aws/startup';
import { createBotClient } from './bot';
import { BotAudioPlayer } from './commands/audio';


getAppConfig()
    .then(appConfig => {
        const logger = createLogger('deploy-slash-commands', appConfig.logLevel);
        const botAudioPlayer = new BotAudioPlayer(logger);
        initialize_audio_files(logger)
        .then(audioConfig => {
            return readCommandFiles({audioConfig, appConfig, logger, client: createBotClient({}), botAudioPlayer});
        })
        .then(slashCommands => {
            for (const guildId of appConfig.guilds) {
                registerSlashCommands(logger, appConfig, guildId, slashCommands);
            }
        })
        .catch(reason => logger.error(reason))
        .finally(() => logger.info('Completed deploying commands.'));
    },
);

