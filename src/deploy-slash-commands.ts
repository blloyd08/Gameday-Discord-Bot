import { createLogger } from "./logger";
import { readCommandFiles, registerSlashCommands } from "./util/slashCommands";
import { getAppConfig } from './config/appConfig';
import { initialize_audio_files } from "./aws/startup";
import { createBotClient } from "./bot";


const appConfig = getAppConfig();
const logger = createLogger('deploy-slash-commands', appConfig);

initialize_audio_files(logger).then(audioConfig => {
    return readCommandFiles({audioConfig, logger, client: createBotClient()})
})
.then(slashCommands => {
    for (const guildId of appConfig.guilds) {
        registerSlashCommands(logger, appConfig, guildId, slashCommands);
    }
})
.catch(reason => logger.error(reason))
.finally(() => logger.info('Completed deploying commands.'));
