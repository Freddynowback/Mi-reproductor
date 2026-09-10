import TrackPlayer, {
  PlayerCommand,
  RepeatMode,
  type MediaItem,
} from '@rntp/player';

import type {PlayerPreferences, Song} from './types';

let didInitialize = false;

export function initializePlayer(): void {
  if (didInitialize) {
    return;
  }

  try {
    TrackPlayer.setupPlayer({
      contentType: 'music',
      handleAudioBecomingNoisy: true,
      android: {
        wakeMode: 'local',
        taskRemovedBehavior: 'continue',
        notification: {
          channelId: 'nuestras-canciones',
          channelName: 'Nuestras Canciones',
          smallIcon: 'ic_launcher',
        },
      },
    });
    TrackPlayer.setCommands({
      capabilities: [
        PlayerCommand.PlayPause,
        PlayerCommand.Previous,
        PlayerCommand.Next,
        PlayerCommand.Seek,
        PlayerCommand.SkipBackward,
        PlayerCommand.SkipForward,
      ],
      handling: 'native',
      backwardInterval: 15,
      forwardInterval: 15,
    });
    didInitialize = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('already set up')) {
      didInitialize = true;
      return;
    }
    throw error;
  }
}

export function toMediaItem(song: Song): MediaItem {
  return {
    mediaId: song.id,
    url: song.url,
    title: song.title,
    artist: song.artist,
    albumTitle: song.album,
    duration: song.duration,
    mimeType: song.mimeType,
  };
}

export function playSongs(songs: Song[], index: number): void {
  if (!songs.length || index < 0 || index >= songs.length) {
    return;
  }

  TrackPlayer.setMediaItems(songs.map(toMediaItem), index);
  TrackPlayer.play();
}

export function applyPlayerPreferences(preferences: PlayerPreferences): void {
  TrackPlayer.setRepeatMode(
    preferences.repeat === 'one'
      ? RepeatMode.One
      : preferences.repeat === 'all'
        ? RepeatMode.All
        : RepeatMode.Off,
  );
  TrackPlayer.setShuffleEnabled(preferences.shuffle);
}
