// Decides whether a free-text /play query is a genre/mood/vibe request
// (e.g. "rock", "80s", "chill lofi", "study music") rather than a specific
// song or artist. Genre queries build a multi-song queue instead of grabbing
// the single top search hit, which for a genre is almost always a 2hr
// compilation upload.

// Single-word genre, mood, and activity terms.
const GENRE_WORDS = new Set<string>([
  // Genres
  'rock',
  'pop',
  'jazz',
  'blues',
  'metal',
  'country',
  'rap',
  'hiphop',
  'edm',
  'electronic',
  'electronica',
  'house',
  'techno',
  'trance',
  'dubstep',
  'lofi',
  'lo-fi',
  'chill',
  'chillhop',
  'chillout',
  'ambient',
  'classical',
  'orchestral',
  'reggae',
  'reggaeton',
  'funk',
  'soul',
  'rnb',
  'r&b',
  'punk',
  'indie',
  'folk',
  'disco',
  'gospel',
  'latin',
  'salsa',
  'merengue',
  'bachata',
  'cumbia',
  'kpop',
  'jpop',
  'dnb',
  'grunge',
  'emo',
  'ska',
  'synthwave',
  'vaporwave',
  'phonk',
  'trap',
  'drill',
  'afrobeat',
  'afrobeats',
  'bollywood',
  'instrumental',
  'acoustic',
  'piano',
  'guitar',
  'motown',
  'bluegrass',
  'swing',
  'bossa',
  'opera',
  'hardstyle',
  'lounge',
  'dancehall',
  'dubstep',
  // Moods / activities
  'workout',
  'gym',
  'running',
  'study',
  'studying',
  'focus',
  'sleep',
  'sleeping',
  'relax',
  'relaxing',
  'meditation',
  'party',
  'dance',
  'romantic',
  'sad',
  'happy',
  'energetic',
  'upbeat',
  'mellow',
  'christmas',
  'holiday',
  'halloween',
  'gaming',
  'anime',
  'oldies',
  'classics',
  'throwback',
  'throwbacks',
]);

// Multi-word genre phrases checked as substrings of the normalized query.
const GENRE_PHRASES = [
  'hip hop',
  'lo fi',
  'drum and bass',
  'drum n bass',
  'k pop',
  'j pop',
  'classic rock',
  'hard rock',
  'soft rock',
  'deep house',
  'video game',
  'death metal',
  'heavy metal',
  'black metal',
  'pop punk',
  'post rock',
  'new wave',
  'old school',
  'oldschool',
  'boom bap',
  'white noise',
  'r and b',
  'west coast',
  'east coast',
];

// Filler words that are allowed and stripped before the vocab check, so
// "study music" or "90s hits" still read as genre queries.
const FILLER = new Set<string>([
  'music',
  'song',
  'songs',
  'mix',
  'mixes',
  'playlist',
  'playlists',
  'hits',
  'vibes',
  'vibe',
  'beats',
  'beat',
  'tracks',
  'tunes',
  'radio',
  'station',
  'best',
  'top',
  'greatest',
  'ultimate',
  'essential',
  'essentials',
  'collection',
  'the',
  'of',
  'a',
  'some',
  'play',
  'me',
  'my',
  'good',
]);

// Strong signals that the query names a specific recording, not a genre.
const SONG_MARKERS = [
  ' - ',
  ' – ',
  ' — ',
  '"',
  ' feat',
  ' ft ',
  ' ft.',
  'featuring',
  'official',
  'lyric',
  'remix',
  'cover',
  'parody',
  'full album',
  ' album',
];

// Matches decade tokens like 70s, 80s, 1990s, 2000s.
const DECADE_RE = /^(?:19|20)?\d0s$/;

export const isGenreQuery = (query: string): boolean => {
  const normalized = query.trim().toLowerCase().replace(/[’']/g, '');
  if (!normalized) {
    return false;
  }

  if (SONG_MARKERS.some(marker => normalized.includes(marker))) {
    return false;
  }

  if (GENRE_PHRASES.some(phrase => normalized.includes(phrase))) {
    return true;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) {
    return false;
  }

  let sawGenreSignal = false;
  let sawUnknown = false;
  for (const token of tokens) {
    if (FILLER.has(token)) {
      continue;
    }

    if (DECADE_RE.test(token) || GENRE_WORDS.has(token)) {
      sawGenreSignal = true;
      continue;
    }

    sawUnknown = true;
  }

  return sawGenreSignal && !sawUnknown;
};
