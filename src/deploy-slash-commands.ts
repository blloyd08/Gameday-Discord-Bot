import { createLogger } from "./logger";
import { readCommandFiles, registerSlashCommands } from "./util/slashCommands";
import appConfig from './config/appConfig.json';
import { initialize_audio_files } from "./aws/startup";


const logger = createLogger('deploy-slash-commands');
initialize_audio_files(logger).then(audioConfig => {
    return readCommandFiles({audioConfig, logger})
})
.then(slashCommands => {
    for (const guildId of appConfig.guilds) {
        registerSlashCommands(logger, guildId, slashCommands);
    }
})
.catch(reason => logger.error(reason))
.finally(() => logger.info('Completed deploying commands.'));
