import AsyncStorage from '@react-native-async-storage/async-storage';

import type {PlayerPreferences, Playlist, Song} from './types';

const keys = {
  songs: '@nuestras-canciones/songs-v1',
  playlists: '@nuestras-canciones/playlists-v1',
  favourites: '@nuestras-canciones/favourites-v1',
  preferences: '@nuestras-canciones/preferences-v1',
};

const defaultPreferences: PlayerPreferences = {repeat: 'all', shuffle: false};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const libraryStorage = {
  loadSongs: () => readJson<Song[]>(keys.songs, []),
  saveSongs: (songs: Song[]) => writeJson(keys.songs, songs),
  loadPlaylists: () => readJson<Playlist[]>(keys.playlists, []),
  savePlaylists: (playlists: Playlist[]) => writeJson(keys.playlists, playlists),
  loadFavourites: () => readJson<string[]>(keys.favourites, []),
  saveFavourites: (ids: string[]) => writeJson(keys.favourites, ids),
  loadPreferences: async (): Promise<PlayerPreferences> => ({
    ...defaultPreferences,
    ...(await readJson<Partial<PlayerPreferences>>(keys.preferences, {})),
  }),
  savePreferences: (preferences: PlayerPreferences) =>
    writeJson(keys.preferences, preferences),
};
