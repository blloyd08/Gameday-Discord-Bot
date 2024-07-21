import { existsSync, readFileSync } from "fs";
import path from "path";
import { createLogger } from "../logger";
import { createDirectoryIfAbsent } from "../util/util";
import { downloadFile, BUCKET } from '../aws/download';

const CONFIG_FOLDER_PATH = path.join(__dirname, '..', 'config');
export const APP_CONFIG_FILE_NAME = 'appConfig.json';
const APP_CONFIG_FILE_PATH: string = path.join(CONFIG_FOLDER_PATH, APP_CONFIG_FILE_NAME);

export function getAppConfigFilePath() {
    createDirectoryIfAbsent(CONFIG_FOLDER_PATH);
    return APP_CONFIG_FILE_PATH;
}

export function getConfigFilePath(fileName: string) {  
    return path.join(CONFIG_FOLDER_PATH, fileName)
}

class Auth {
    constructor(
        public readonly discord: string
    ) {}
}

class GamedayJob {
    constructor(
        public readonly dayOfWeek: number,
        public readonly startHour: number,
        public readonly group: string
    ) {}
}

class Jobs {
    constructor(
        public readonly gameday: GamedayJob
    ) {}
}

export class AppConfig {
    constructor(
        public readonly logLevel: string,
        public readonly clientId: string,
        public readonly guilds: string[],
        public readonly auth: Auth,
        public readonly jobs: Jobs
    ) {}

    static fromSerialized(serialized: string): AppConfig {
        const jsonObject: AppConfig = JSON.parse(serialized);

        const auth: Auth = new Auth(
            jsonObject["auth"]["discord"]
        )

        const gamedayJob: GamedayJob = new GamedayJob(
            jsonObject["jobs"]["gameday"]['dayOfWeek'],
            jsonObject["jobs"]["gameday"]['startHour'],
            jsonObject["jobs"]["gameday"]['group'],
        )

        return new AppConfig(
            jsonObject["logLevel"],
            jsonObject["clientId"],
            jsonObject["guilds"],
            auth,
            new Jobs(gamedayJob)
        )
    }
}


export async function getAppConfig(): Promise<AppConfig> {
    const logger = createLogger('app-config', 'info');
    logger.info(`Reading app config from: ${APP_CONFIG_FILE_PATH}`);
    const appConfigFilePath = getAppConfigFilePath();

    // download json file
    return downloadFile(logger, getAppConfigFilePath(), BUCKET, APP_CONFIG_FILE_NAME).then(() =>{
        if (existsSync(APP_CONFIG_FILE_PATH)) {
            const appConfigJson: string = readFileSync(APP_CONFIG_FILE_PATH, {encoding:'utf8', flag:'r'}).toString();
            const appConfig: AppConfig = AppConfig.fromSerialized(appConfigJson)
            
            if (!appConfig.auth) {
                throw Error('No auth found in app config');
            }
            
            logger.info(`Finished loading app config. Log level: ${appConfig.logLevel} Client Id: ${appConfig.clientId}`)
            return appConfig;
        } else {
            throw Error(`App config doesn't exist at ${APP_CONFIG_FILE_PATH}`);
        }
    }).catch(e =>{
        logger.error("Error downloading app config", e);
        throw Error(`Unable to download app config to ${appConfigFilePath} from ${BUCKET}`);
    })


}
