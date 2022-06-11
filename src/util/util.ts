import { AppConfig } from '../config/appConfig';
import { existsSync, mkdirSync } from 'fs';
import { BotClient } from '../bot';
import { CommandInteraction, GuildMember, TextChannel, VoiceBasedChannel } from 'discord.js';

export function createDirectoryIfAbsent(directory: string) {
  if (!existsSync(directory)) {
    mkdirSync(directory);
  }
}

export function sendTextMessageToAllGuilds(appConfig: AppConfig, bot: BotClient, message: string) {
  appConfig.guilds.forEach( guildId => {
    var textChannel = bot.guilds.cache.get(guildId)?.channels.cache.filter(channel => channel.isText()).first();
    if (textChannel) {
        (textChannel as TextChannel).send(message)
    }
  });
}

export function getGuildMemberFromInteraction(interaction: CommandInteraction): GuildMember {
  const guildMember = interaction.guild?.members.cache.get(interaction.user.id);
  if (!guildMember) {
    throw new Error(`Interaction from user ${interaction.user.id} is not from a guild.`)
  }
  return guildMember;
}

export function getVoiceChannelFromInteraction(interaction: CommandInteraction): VoiceBasedChannel | null {
  const guildMember = getGuildMemberFromInteraction(interaction);
  return guildMember.voice.channel;
}

export function getVoiceChannels(interaction: CommandInteraction): VoiceBasedChannel[]{
  if (interaction.guild) {
    const afkChannelId = interaction.guild.afkChannelId;
    return interaction.guild.channels.cache
      .filter(channel => channel.isVoice() && channel.id !== afkChannelId)
      .map(voiceChannel => voiceChannel as VoiceBasedChannel);
  }
  return [];
}