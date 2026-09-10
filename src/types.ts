import type {MediaUrl} from '@rntp/player';

export type SongSource = 'gift' | 'device' | 'picked';

export type Song = {
  id: string;
  url: MediaUrl;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  mimeType?: string;
  addedAt: number;
  source: SongSource;
};

export type Playlist = {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type RepeatSetting = 'off' | 'one' | 'all';

export type PlayerPreferences = {
  repeat: RepeatSetting;
  shuffle: boolean;
};

export type AppScreen = 'home' | 'library' | 'player' | 'playlists' | 'queue';
