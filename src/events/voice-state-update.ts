import {VoiceChannel, VoiceState} from 'discord.js';
import {VoiceConnectionStatus} from '@discordjs/voice';
import container from '../inversify.config.js';
import {TYPES} from '../types.js';
import PlayerManager from '../managers/player.js';
import {getSizeWithoutBots} from '../utils/channels.js';
import {getGuildSettings} from '../utils/get-guild-settings.js';
import {EMPTY_CHANNEL_LEAVE_GRACE_SECONDS} from '../utils/constants.js';

export default async (oldState: VoiceState, newState: VoiceState): Promise<void> => {
  const playerManager = container.get<PlayerManager>(TYPES.Managers.Player);

  const player = playerManager.get(oldState.guild.id);

  const {voiceConnection} = player;
  if (!voiceConnection || voiceConnection.state.status !== VoiceConnectionStatus.Ready) {
    return;
  }

  const {channelId} = voiceConnection.joinConfig;
  if (!channelId || (oldState.channelId !== channelId && newState.channelId !== channelId)) {
    return;
  }

  const {leaveIfNoListeners} = await getGuildSettings(player.guildId);
  // A settings lookup can outlive a move, reconnect, or disconnect.
  if (player.voiceConnection !== voiceConnection
    || voiceConnection.state.status !== VoiceConnectionStatus.Ready
    || voiceConnection.joinConfig.channelId !== channelId) {
    return;
  }

  const voiceChannel = newState.guild.channels.cache.get(channelId) as VoiceChannel | undefined;
  if (!voiceChannel) {
    // Channel no longer exists; leave immediately.
    player.disconnect();
    return;
  }

  const listeners = getSizeWithoutBots(voiceChannel);
  if (listeners === 0) {
    if (leaveIfNoListeners) {
      // Don't drop the queue on a brief disconnect: pause and wait out a grace
      // period, leaving only if nobody returns.
      player.handleEmptyVoiceChannel(EMPTY_CHANNEL_LEAVE_GRACE_SECONDS);
    }
  } else {
    // Someone is (still) listening; cancel any pending leave and auto-resume.
    player.handleVoiceChannelRepopulated();
  }
};
