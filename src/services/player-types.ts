import type {Snowflake} from 'discord.js';

export enum MediaSource {
  Youtube,
  HLS,
  SoundCloud,
}

export interface QueuedPlaylist {
  title: string;
  source: string;
}

export interface SongMetadata {
  title: string;
  artist: string;
  url: string; // For YT, it's the video ID (not the full URI)
  length: number;
  offset: number;
  playlist: QueuedPlaylist | null;
  isLive: boolean;
  thumbnailUrl: string | null;
  source: MediaSource;
}

export interface QueuedSong extends SongMetadata {
  addedInChannelId: Snowflake;
  requestedBy: string;
}

export type AgeRestrictedFallbackResolver = (song: QueuedSong) => Promise<SongMetadata | null>;

// Returns related tracks to keep playback going when the queue runs out (autoplay/radio).
export type AutoplayResolver = (song: QueuedSong) => Promise<QueuedSong[]>;

export enum STATUS {
  PLAYING,
  PAUSED,
  IDLE,
}

export interface PlayerEvents {
  statusChange: (oldStatus: STATUS, newStatus: STATUS) => void;
}

export const DEFAULT_VOLUME = 100;
