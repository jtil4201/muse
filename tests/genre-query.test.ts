import {describe, expect, it} from 'vitest';
import {isGenreQuery} from '../src/utils/genre-query.js';

describe('isGenreQuery', () => {
  it.each([
    'rock',
    'Rock',
    '  jazz  ',
    'chill',
    'lofi',
    'lo-fi',
    'classic rock',
    'hard rock',
    'hip hop',
    '80s',
    '90s',
    '1980s',
    '2000s',
    '80s rock',
    '90s hip hop',
    'study music',
    'workout songs',
    'jazz mix',
    'chill lofi beats',
    'top 80s hits',
    'video game music',
    "70's",
  ])('treats %j as a genre query', query => {
    expect(isGenreQuery(query)).toBe(true);
  });

  it.each([
    'despacito',
    'bohemian rhapsody',
    'taylor swift',
    'never gonna give you up',
    'queen - bohemian rhapsody',
    'rick astley never gonna give you up',
    'the weeknd blinding lights official video',
    'hotel california lyrics',
    'smells like teen spirit cover',
    'pink floyd full album',
    'dark side of the moon album',
    '',
    '   ',
    'music',
  ])('treats %j as a specific query', query => {
    expect(isGenreQuery(query)).toBe(false);
  });
});
