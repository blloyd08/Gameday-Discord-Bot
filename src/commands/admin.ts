import type { CommandInteraction } from 'discord.js';
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { CommandContext } from '../util/slashCommands.js';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');
const DISCORD_MAX_CHARS = 1900;

enum Subcommands {
    Logs = 'logs',
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default (context: CommandContext) => {
    const logger = context.logger;
    logger.info('Building admin command.');

    return {
        builder: new SlashCommandBuilder()
            .setName('admin')
            .setDescription('Bot owner commands')
            .addSubcommand(subcommand =>
                subcommand
                    .setName(Subcommands.Logs)
                    .setDescription('Tail the bot logs')
                    .addIntegerOption(option =>
                        option.setName('lines')
                            .setDescription('Number of lines to show (default 20)')
                            .setMinValue(1)
                            .setMaxValue(100),
                    )
                    .addStringOption(option =>
                        option.setName('level')
                            .setDescription('Filter by log level')
                            .addChoices(
                                { name: 'info', value: 'info' },
                                { name: 'warn', value: 'warn' },
                                { name: 'error', value: 'error' },
                            ),
                    ),
            ),
        async execute(context: CommandContext, interaction: CommandInteraction): Promise<void> {
            if (!interaction.isChatInputCommand()) { return; }

            if (interaction.user.id !== context.appConfig.ownerId) {
                await interaction.reply({ content: 'You do not have permissions to run this command', flags: MessageFlags.Ephemeral });
                return;
            }

            switch (interaction.options.getSubcommand()) {
                case Subcommands.Logs: {
                    tailLogs(context, interaction);
                    break;
                }
                default: {
                    await interaction.reply({ content: 'Not a valid command', flags: MessageFlags.Ephemeral });
                }
            }
        },
    };
};

function tailLogs(context: CommandContext, interaction: CommandInteraction): void {
    if (!interaction.isChatInputCommand()) {return;}

    const lineCount = interaction.options.getInteger('lines') ?? 20;
    const level = interaction.options.getString('level');

    try {
        const files = readdirSync(LOGS_DIR)
            .filter(f => f.startsWith('bot-combined-') && f.endsWith('.log'))
            .sort();

        if (files.length === 0) {
            interaction.reply({ content: 'No log files found.', flags: MessageFlags.Ephemeral });
            return;
        }

        const latestFile = path.join(LOGS_DIR, files[files.length - 1]);
        const rawLines = readFileSync(latestFile, 'utf8').trim().split('\n').filter(Boolean);

        interface LogEntry { level: string; message: string; timestamp: string; }
        const entries: LogEntry[] = rawLines
            .map(line => { try { return JSON.parse(line) as LogEntry; } catch { return null; } })
            .filter((e): e is LogEntry => e !== null)
            .filter(e => !level || e.level === level);

        const tail = entries.slice(-lineCount);

        if (tail.length === 0) {
            interaction.reply({ content: 'No log entries found matching the filter.', flags: MessageFlags.Ephemeral });
            return;
        }

        const formatted = tail.map(e => `${e.timestamp} [${e.level.toUpperCase().padEnd(5)}] ${e.message}`);
        let output = formatted.join('\n');

        if (output.length > DISCORD_MAX_CHARS) {
            const trimmed = output.split('\n');
            while (output.length > DISCORD_MAX_CHARS && trimmed.length > 0) {
                trimmed.shift();
                output = trimmed.join('\n');
            }
            output = '...(truncated)\n' + output;
        }

        interaction.reply({ content: `\`\`\`\n${output}\n\`\`\``, flags: MessageFlags.Ephemeral });
    } catch (err) {
        context.logger.error('Failed to tail logs:', err);
        interaction.reply({ content: 'Failed to read log files.', flags: MessageFlags.Ephemeral });
    }
}
