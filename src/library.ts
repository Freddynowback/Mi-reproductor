import {
  NativeModules,
  PermissionsAndroid,
  Platform,
  type Permission,
} from 'react-native';
import {pick, types} from '@react-native-documents/picker';

import {cleanTitle} from './format';
import type {Song} from './types';

type NativeSong = {
  id: string;
  uri: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  mimeType?: string;
  addedAt?: number;
};

type MusicLibraryModule = {
  getDeviceTracks(): Promise<NativeSong[]>;
};

const nativeMusicLibrary = NativeModules.MusicLibrary as
  | MusicLibraryModule
  | undefined;

function fromNativeSong(song: NativeSong): Song {
  return {
    id: song.id,
    url: song.uri,
    title: cleanTitle(song.title),
    artist: song.artist?.trim() || 'Artista desconocido',
    album: song.album?.trim() || undefined,
    duration: song.duration,
    mimeType: song.mimeType,
    addedAt: song.addedAt || Date.now(),
    source: 'device',
  };
}

export function uniqueSongs(songs: Song[]): Song[] {
  const byId = new Map<string, Song>();
  songs.forEach(song => {
    if (song.id && song.url) {
      byId.set(song.id, song);
    }
  });

  return [...byId.values()].sort((left, right) =>
    left.title.localeCompare(right.title, 'es', {sensitivity: 'base'}),
  );
}

async function requestAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const permission: Permission =
    Number(Platform.Version) >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

  const result = await PermissionsAndroid.request(permission, {
    title: 'Tu música, solo para ti',
    message:
      'Nuestras Canciones necesita leer tu biblioteca para mostrarla sin copiar ni duplicar archivos.',
    buttonPositive: 'Permitir',
    buttonNegative: 'Ahora no',
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function scanDeviceMusic(): Promise<Song[]> {
  if (Platform.OS !== 'android' || !nativeMusicLibrary) {
    return [];
  }

  const isAllowed = await requestAudioPermission();
  if (!isAllowed) {
    throw new Error('permission-denied');
  }

  return uniqueSongs((await nativeMusicLibrary.getDeviceTracks()).map(fromNativeSong));
}

export async function pickAudioFiles(): Promise<Song[]> {
  const files = await pick({
    type: [types.audio],
    allowMultiSelection: true,
    mode: 'open',
    requestLongTermAccess: true,
  });

  return uniqueSongs(
    files.map(file => ({
      id: `picked:${encodeURIComponent(file.uri)}`,
      url: file.uri,
      title: cleanTitle(file.name),
      artist: 'Añadida por ti',
      duration: undefined,
      mimeType: file.type || undefined,
      addedAt: Date.now(),
      source: 'picked',
    })),
  );
}
