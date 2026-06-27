import { Client, Collection, GatewayIntentBits } from 'discord.js';
import type { SlashCommand } from './util/slashCommands';
import type { AudioConfig } from './config/audioConfig';
import type { AppConfig } from './config/appConfig';

export interface ConfigUpdater {
    audioConfig?: (audioConfig: AudioConfig) => void;
    appConfig?: (appConfig: AppConfig) => void;
}

export class BotClient extends Client {
    commands = new Collection<string, SlashCommand>();
    update: ConfigUpdater;

    constructor(update: ConfigUpdater) {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates,
            ],
        });
        this.update = update;
    }
}

export function createBotClient(update: ConfigUpdater): BotClient {
    return new BotClient(update);
}
