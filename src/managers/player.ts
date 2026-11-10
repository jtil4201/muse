import {inject, injectable} from 'inversify';
import {TYPES} from '../types.js';
import Player from '../services/player.js';
import FileCacheProvider from '../services/file-cache.js';
import type YoutubeAPI from '../services/youtube-api.js';
import Config from '../services/config.js';
import ListeningSession from '../services/listening-session.js';
import SessionHistoryStore from '../services/session-history-store.js';
import GetSongs from '../services/get-songs.js';
import {MediaSource, type QueuedSong} from '../services/player-types.js';
import {getYouTubeRelatedVideoIds} from '../utils/yt-dlp.js';

@injectable()
export default class {
  private readonly guildPlayers: Map<string, Player>;
  private readonly fileCache: FileCacheProvider;
  private readonly youtubeAPI: YoutubeAPI;
  private readonly config: Config;

  constructor(@inject(TYPES.FileCache) fileCache: FileCacheProvider,
    @inject(TYPES.Services.YoutubeAPI) youtubeAPI: YoutubeAPI,
    @inject(TYPES.Config) config: Config,
    @inject(TYPES.Services.GetSongs) private readonly getSongs: GetSongs,
    @inject(TYPES.Services.SessionHistoryStore) private readonly sessionHistoryStore?: SessionHistoryStore) {
    this.guildPlayers = new Map();
    this.fileCache = fileCache;
    this.youtubeAPI = youtubeAPI;
    this.config = config;
  }

  get(guildId: string): Player {
    let player = this.guildPlayers.get(guildId);

    if (!player) {
      const autoplayResolver = this.config.ENABLE_AUTOPLAY
        ? async (song: QueuedSong) => this.resolveAutoplay(song)
        : undefined;

      player = new Player(
        this.fileCache,
        guildId,
        async song => this.youtubeAPI.findAudioFallback(song),
        this.config.PLAYING_MESSAGE_UPDATE_INTERVAL_SECONDS,
        this.sessionHistoryStore ? new ListeningSession(guildId, this.sessionHistoryStore) : undefined,
        autoplayResolver,
      );

      this.guildPlayers.set(guildId, player);
    }

    return player;
  }

  /**
   * Returns a player only when the guild already has one. Reaction events use
   * this to avoid allocating idle players for unrelated Discord messages.
   */
  getExisting(guildId: string): Player | undefined {
    return this.guildPlayers.get(guildId);
  }

  // Builds related YouTube tracks (via the video's Mix) to extend the queue when autoplay is on.
  private async resolveAutoplay(song: QueuedSong): Promise<QueuedSong[]> {
    if (song.source !== MediaSource.Youtube || song.url.length !== 11) {
      console.log(`[autoplay] seed rejected: source=${song.source} urlLen=${song.url.length} (need Youtube + 11-char id)`);
      return [];
    }

    const wanted = Math.max(1, this.config.AUTOPLAY_QUEUE_COUNT);
    // Fetch extra Mix IDs so dropped/failed tracks don't shrink the batch.
    let relatedIds: string[];
    try {
      relatedIds = await getYouTubeRelatedVideoIds(song.url, Math.max(12, wanted * 2));
    } catch (error) {
      console.error(`[autoplay] mix expansion failed for ${song.url}:`, error instanceof Error ? error.message : error);
      return [];
    }

    console.log(`[autoplay] mix for ${song.url} -> ${relatedIds.length} related ids`);
    const songs: QueuedSong[] = [];

    let failed = 0;
    for (const videoId of relatedIds) {
      if (songs.length >= wanted) {
        break;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        const [results] = await this.getSongs.getSongs(`https://www.youtube.com/watch?v=${videoId}`, 1, false);
        const metadata = results[0];
        if (metadata) {
          songs.push({...metadata, addedInChannelId: song.addedInChannelId, requestedBy: song.requestedBy});
        }
      } catch (error) {
        failed++;
        if (failed <= 2) {
          console.error(`[autoplay] related ${videoId} resolve failed:`, error instanceof Error ? error.message : error);
        }
      }
    }

    console.log(`[autoplay] resolved ${songs.length}/${relatedIds.length} related tracks (${failed} failed)`);
    return songs;
  }
}
