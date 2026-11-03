export const ONE_HOUR_IN_SECONDS = 60 * 60;
export const ONE_MINUTE_IN_SECONDS = 1 * 60;
export const DEFAULT_PLAYING_MESSAGE_UPDATE_INTERVAL_SECONDS = 5;
// When the voice channel empties of listeners, pause and wait this long for
// someone to return before leaving (preserving the queue). Auto-resumes on return.
export const EMPTY_CHANNEL_LEAVE_GRACE_SECONDS = 5 * ONE_MINUTE_IN_SECONDS;

// These controls are added in playback order and intentionally use standard
// Unicode emoji so they work without guild-specific emoji configuration.
export const MUSIC_CONTROLS = {
  'previous-track': '⏮️',
  rewind: '⏪',
  'pause-resume': '⏯️',
  'fast-forward': '⏩',
  'next-track': '⏭️',
  stop: '⏹️',
  shuffle: '🔀',
} as const;
export const MUSIC_CONTROL_EMOJIS = Object.values(MUSIC_CONTROLS);
export const MUSIC_CONTROL_SEEK_SECONDS = 10;

// Native player buttons need no reaction-cleanup permissions. Keep channel,
// message-history, embed, and voice access for the shared player.
export const BOT_INVITE_PERMISSIONS = '36785152';
