import 'reflect-metadata';
import {describe, expect, it, vi} from 'vitest';

vi.mock('../src/services/player.js', () => ({
  MediaSource: {Youtube: 0},
}));

import YoutubeAPI from '../src/services/youtube-api.js';

const makeVideo = ({id, duration = 'PT3M', live = false}: {id: string; duration?: string; live?: boolean}) => ({
  id,
  contentDetails: {videoId: id, duration},
  snippet: {
    title: id,
    channelTitle: 'Channel',
    liveBroadcastContent: live ? 'live' : 'none',
    description: '',
    thumbnails: {medium: {url: `https://example.com/${id}.jpg`}},
  },
});

const buildApi = (searchIds: string[], videos: ReturnType<typeof makeVideo>[]) => {
  const videoById = new Map(videos.map(video => [video.id, video]));
  const cache = {
    wrap: async (_fetch: unknown, {searchParams}: {searchParams: Record<string, string | undefined>}) => {
      if (searchParams.q !== undefined) {
        return {items: searchIds.map(id => ({id: {videoId: id}}))};
      }

      const ids = searchParams.id?.split(',').filter(Boolean) ?? [];
      return {items: ids.map(id => videoById.get(id)).filter(Boolean)};
    },
  };

  return new YoutubeAPI({YOUTUBE_API_KEY: 'test-key'} as never, cache as never);
};

describe('YoutubeAPI.searchMany', () => {
  it('builds a queue of individual tracks and drops compilations and clips', async () => {
    const searchIds = ['song1', 'comp1', 'song2', 'clip1', 'song3'];
    const videos = [
      makeVideo({id: 'song1', duration: 'PT3M'}),
      makeVideo({id: 'comp1', duration: 'PT2H'}), // compilation -> dropped
      makeVideo({id: 'song2', duration: 'PT4M'}),
      makeVideo({id: 'clip1', duration: 'PT30S'}), // too short -> dropped
      makeVideo({id: 'song3', duration: 'PT5M'}),
    ];

    const songs = await buildApi(searchIds, videos).searchMany('rock', 10);

    expect(songs.map(song => song.url)).toEqual(['song1', 'song2', 'song3']);
  });

  it('drops live broadcasts', async () => {
    const searchIds = ['live1', 'song1'];
    const videos = [
      makeVideo({id: 'live1', duration: 'PT3M', live: true}),
      makeVideo({id: 'song1', duration: 'PT3M'}),
    ];

    const songs = await buildApi(searchIds, videos).searchMany('jazz', 10);

    expect(songs.map(song => song.url)).toEqual(['song1']);
  });

  it('stops at the requested count and preserves search rank order', async () => {
    const searchIds = ['a', 'b', 'c'];
    const videos = searchIds.map(id => makeVideo({id, duration: 'PT3M'}));

    const songs = await buildApi(searchIds, videos).searchMany('jazz', 2);

    expect(songs.map(song => song.url)).toEqual(['a', 'b']);
  });

  it('returns nothing for a zero count without searching', async () => {
    const songs = await buildApi(['a'], [makeVideo({id: 'a'})]).searchMany('rock', 0);
    expect(songs).toEqual([]);
  });
});
