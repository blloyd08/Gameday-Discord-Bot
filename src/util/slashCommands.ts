import { REST } from 'discord.js';
import type { Logger } from 'winston';
import { Routes } from 'discord-api-types/v10';
import type { BotClient } from '../bot';
import { readdirSync } from 'node:fs';
import { join } from 'path';
import type { Interaction, SlashCommandBuilder } from 'discord.js';
import type { AudioConfig } from '../config/audioConfig';
import type { AppConfig } from '../config/appConfig';
import type { BotAudioPlayer } from '../commands/audio';

export interface SlashCommand {
    builder: SlashCommandBuilder,
    execute: (context: CommandContext, interaction: Interaction) => void
}

export interface CommandBuilder {
    getCommand: (context: CommandContext) => SlashCommand
}

export interface CommandContext {
    logger: Logger,
    audioConfig: AudioConfig,
    appConfig: AppConfig,
    client: BotClient,
    botAudioPlayer: BotAudioPlayer
}

export async function readCommandFiles(context: CommandContext): Promise<SlashCommand[]> {
    const logger = context.logger;
    const commandFolderPath = join(__dirname, '..', 'commands');
    logger.info('Started reading application (/) commands. Commands location %s', commandFolderPath);
    try {
        const commandFiles = readdirSync(commandFolderPath).filter(file => file.endsWith('.js'));
        logger.info('Found command files: %s', commandFiles);
    
        const commands: SlashCommand[] = [];
        for (const file of commandFiles) {
            const filePath = join(commandFolderPath, file);
            logger.info('Importing %s from %s', file, filePath);
            // eslint-disable-next-line no-await-in-loop
            const commandBuilder = (await import(join(filePath))).default;
            const command = commandBuilder(context);
            if (command && command.builder && command.builder.name) {
                logger.info('Found Command: %s', command.builder.name);
                commands.push(command);
            } else {
                logger.error(`Invalid command: ${filePath}`);
            }
        }
        logger.info('Finished reading application (/) commands. Found %s commands', commands.length);
        return commands;
    } catch (error) {
        logger.error(error);
        logger.info('Failed reading application (/) commands. Returning empty array');
        return [];
    }
}

export async function setClientSlashCommands(context: CommandContext, client: BotClient): Promise<void> {
    const slashCommands = await readCommandFiles(context);
    for (const command of slashCommands) {
        client.commands.set(command.builder.name, command);
    }
}

export async function registerSlashCommands(logger: Logger, appConfig: AppConfig, guildId: string, commands: SlashCommand[]): Promise<void> {
    try {
        logger.info('Starting to register %s application (/) commands. Guild ID: %s.', commands.length, guildId);
        const rest = new REST({ version: '9' }).setToken(appConfig.auth.discord);
        await rest.put(
            Routes.applicationGuildCommands(appConfig.clientId, guildId),
            { body: commands.map(command => command.builder.toJSON()) },
        );
        logger.info('Successfully registered application (/) commands. Guild ID: %s', guildId);
    } catch (error) {
        logger.error(error);
    }
}