import type { AppConfig } from '../config/appConfig';
import { existsSync, mkdirSync } from 'fs';
import type { BotClient } from '../bot';
import type { CommandInteraction, Guild, GuildMember, TextChannel, User, VoiceBasedChannel, VoiceState } from 'discord.js';
import { ChannelType } from 'discord.js';

export function createDirectoryIfAbsent(directory: string): void {
  if (!existsSync(directory)) {
    mkdirSync(directory);
  }
}

export function sendTextMessageToAllGuilds(appConfig: AppConfig, bot: BotClient, message: string): void {
  appConfig.guilds.forEach( guildId => {
    const textChannel = bot.guilds.cache.get(guildId)?.channels.cache.filter(channel => channel.type === ChannelType.GuildText).first();
    if (textChannel) {
        (textChannel as TextChannel).send(message);
    }
  });
}

export function getGuildMemberFromInteraction(interaction: CommandInteraction): GuildMember {
  const guildMember = interaction.guild?.members.cache.get(interaction.user.id);
  if (!guildMember) {
    throw new Error(`Interaction from user ${interaction.user.id} is not from a guild.`);
  }
  return guildMember;
}

export function getVoiceChannelFromInteraction(interaction: CommandInteraction): VoiceBasedChannel | null {
  const guildMember = getGuildMemberFromInteraction(interaction);
  return guildMember.voice.channel;
}

export function getVoiceChannels(guild: Guild): VoiceBasedChannel[]{
  if (guild) {
    const afkChannelId = guild.afkChannelId;
    return guild.channels.cache
      .filter(channel => channel.type === ChannelType.GuildVoice && channel.id !== afkChannelId)
      .map(voiceChannel => voiceChannel as VoiceBasedChannel);
  }
  return [];
}

export function getVoiceChannelMembers(voiceChannel: VoiceBasedChannel): GuildMember[] {
    return Array.from(voiceChannel.members.filter((member) => {
        return !member.user.bot;
    }).values());
}

export function userToString(user?: User | null): string {
  return `${user?.username}(${user?.id})`;
}

export function guildToString(guild: Guild): string {
  return `${guild.name} (${guild.id})`;
}

export function voiceChannelToString(voiceChannel: VoiceBasedChannel): string {
  return `${voiceChannel.name} (${voiceChannel.id})`;
}

export function voiceStateToString(voiceState: VoiceState): string {
  const userString = userToString(voiceState.member?.user);
  const guildString = guildToString(voiceState.guild);
  const voiceChannelString = voiceState.channel ? voiceChannelToString(voiceState.channel) : voiceState.channelId;
  return `Channel: ${voiceChannelString}  Guild: ${guildString}  User: ${userString}`;
}