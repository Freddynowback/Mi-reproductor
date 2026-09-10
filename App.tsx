import Slider from '@react-native-community/slider';
import TrackPlayer, {
  useActiveMediaItem,
  useIsPlaying,
  useProgress,
} from '@rntp/player';
import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {errorCodes, isErrorWithCode} from '@react-native-documents/picker';
import {DarkTheme, NavigationContainer, useNavigationContainerRef} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {cleanTitle, formatTime, uniqueId} from './src/format';
import {pickAudioFiles, scanDeviceMusic, uniqueSongs} from './src/library';
import {applyPlayerPreferences, initializePlayer, playSongs} from './src/player';
import {libraryStorage} from './src/storage';
import {colors, sharedStyles} from './src/theme';
import type {AppScreen, PlayerPreferences, Playlist, Song} from './src/types';

const giftSong: Song = {
  id: 'para-ti-mas-que-amigos',
  url: require('./mas_que_amigos_matise.mp3'),
  title: 'Más que amigos',
  artist: 'Matise',
  album: 'Para ti',
  source: 'gift',
  addedAt: 0,
};

// Todas las filas tienen una altura estable. Así FlatList puede calcular su
// posición sin medir cada una de las cientos de canciones de la biblioteca.
const SONG_ROW_HEIGHT = 66;

type RootStackParamList = {
  Home: undefined;
  Library: undefined;
  Player: undefined;
  Playlists: undefined;
  Queue: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const routeForScreen: Record<AppScreen, keyof RootStackParamList> = {
  home: 'Home', library: 'Library', player: 'Player', playlists: 'Playlists', queue: 'Queue',
};

const screenForRoute: Record<keyof RootStackParamList, AppScreen> = {
  Home: 'home', Library: 'library', Player: 'player', Playlists: 'playlists', Queue: 'queue',
};

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
    border: 'transparent',
    card: 'transparent',
    notification: colors.rose,
    primary: colors.rose,
    text: colors.ink,
  },
};

function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      initializePlayer();
      setReady(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo preparar el reproductor.');
    }
  }, []);

  return <SafeAreaProvider>{ready ? <MusicApp /> : <Loading error={error} />}</SafeAreaProvider>;
}

function MusicApp(): React.JSX.Element {
  const media = useActiveMediaItem();
  const playing = useIsPlaying();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [screen, setScreen] = useState<AppScreen>('home');
  const [songs, setSongs] = useState<Song[]>([giftSong]);
  const [queue, setQueue] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<PlayerPreferences>({repeat: 'all', shuffle: false});
  const [query, setQuery] = useState('');
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [playlistDraft, setPlaylistDraft] = useState('');
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [songForPlaylist, setSongForPlaylist] = useState<Song | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      libraryStorage.loadSongs(),
      libraryStorage.loadPlaylists(),
      libraryStorage.loadFavourites(),
      libraryStorage.loadPreferences(),
    ]).then(([savedSongs, savedPlaylists, savedFavourites, savedPreferences]) => {
      if (!alive) return;
      setSongs(uniqueSongs([giftSong, ...savedSongs]));
      setPlaylists(savedPlaylists);
      setFavouriteIds(savedFavourites);
      setPreferences(savedPreferences);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    applyPlayerPreferences(preferences);
    void libraryStorage.savePreferences(preferences);
  }, [preferences]);

  const favourites = useMemo(() => new Set(favouriteIds), [favouriteIds]);
  const activeSong = useMemo<Song | null>(() => {
    if (!media) return null;
    const fromLibrary = songs.find(song => song.id === media.mediaId);
    if (fromLibrary) return fromLibrary;
    return {
      id: media.mediaId || String(media.url), url: media.url,
      title: cleanTitle(media.title), artist: media.artist || 'Artista desconocido',
      album: media.albumTitle, duration: media.duration, source: 'picked', addedAt: Date.now(),
    };
  }, [media, songs]);
  const visibleSongs = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return songs.filter(song => {
      const matchesText = !term || `${song.title} ${song.artist} ${song.album || ''}`.toLocaleLowerCase('es').includes(term);
      return matchesText && (!onlyFavourites || favourites.has(song.id));
    });
  }, [favourites, onlyFavourites, query, songs]);
  const selectedPlaylist = useMemo(
    () => playlists.find(item => item.id === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId],
  );
  const selectedSongs = useMemo(() => {
    if (!selectedPlaylist) return [];
    const songsById = new Map(songs.map(song => [song.id, song]));
    return selectedPlaylist.songIds
      .map(id => songsById.get(id))
      .filter((song): song is Song => Boolean(song));
  }, [selectedPlaylist, songs]);

  function navigateTo(nextScreen: AppScreen): void {
    if (navigationRef.isReady()) {
      navigationRef.navigate(routeForScreen[nextScreen]);
    }
  }

  function syncActiveScreen(): void {
    const route = navigationRef.getCurrentRoute();
    if (route) {
      setScreen(screenForRoute[route.name as keyof RootStackParamList]);
    }
  }

  function saveSongs(next: Song[]): void {
    setSongs(next);
    void libraryStorage.saveSongs(next.filter(song => song.source !== 'gift'));
  }
  function savePlaylists(next: Playlist[]): void {
    setPlaylists(next);
    void libraryStorage.savePlaylists(next);
  }
  function play(collection: Song[], id: string): void {
    const cleanCollection = uniqueSongs(collection);
    const index = cleanCollection.findIndex(song => song.id === id);
    if (index < 0) return;
    try {
      playSongs(cleanCollection, index);
      setQueue(cleanCollection);
      navigateTo('player');
    } catch (reason) {
      Alert.alert('No pudimos reproducirla', reason instanceof Error ? reason.message : 'Inténtalo de nuevo.');
    }
  }
  async function readDeviceLibrary(): Promise<void> {
    setLoadingLibrary(true);
    try {
      const found = await scanDeviceMusic();
      if (!found.length) {
        Alert.alert('Aún no encontramos música', 'Revisa que tus archivos sean visibles para Android e inténtalo de nuevo.');
        return;
      }
      saveSongs(uniqueSongs([...songs, ...found]));
      Alert.alert('Biblioteca actualizada', `${found.length} canciones leídas sin copiar ni duplicar archivos.`);
    } catch (reason) {
      const permissionDenied = reason instanceof Error && reason.message === 'permission-denied';
      Alert.alert(permissionDenied ? 'Necesitamos tu permiso' : 'No pudimos leer tu música', permissionDenied
        ? 'Solo necesitamos leer tu biblioteca. Nada se sube, mueve o duplica.'
        : reason instanceof Error ? reason.message : 'Inténtalo de nuevo.');
    } finally { setLoadingLibrary(false); }
  }
  async function addAudioFiles(): Promise<void> {
    try {
      const added = await pickAudioFiles();
      if (added.length) {
        saveSongs(uniqueSongs([...songs, ...added]));
        Alert.alert('Canciones añadidas', 'Se agregaron como referencias: no se creó ninguna copia.');
      }
    } catch (reason) {
      if (!isErrorWithCode(reason) || reason.code !== errorCodes.OPERATION_CANCELED) Alert.alert('No pudimos añadir esos archivos', reason instanceof Error ? reason.message : 'Inténtalo de nuevo.');
    }
  }
  function toggleFavourite(id: string): void {
    const next = favourites.has(id) ? favouriteIds.filter(item => item !== id) : [...favouriteIds, id];
    setFavouriteIds(next);
    void libraryStorage.saveFavourites(next);
  }
  function changeRepeat(): void {
    setPreferences(current => ({...current, repeat: current.repeat === 'off' ? 'all' : current.repeat === 'all' ? 'one' : 'off'}));
  }
  function createPlaylist(): void {
    const name = playlistDraft.trim();
    if (!name) return;
    const now = Date.now();
    savePlaylists([{id: uniqueId('playlist'), name, songIds: [], createdAt: now, updatedAt: now}, ...playlists]);
    setPlaylistDraft(''); setShowPlaylistModal(false);
  }
  function addToPlaylist(playlist: Playlist, song: Song): void {
    const next = playlists.map(item => item.id !== playlist.id || item.songIds.includes(song.id) ? item : {...item, songIds: [...item.songIds, song.id], updatedAt: Date.now()});
    savePlaylists(next); setSongForPlaylist(null);
    Alert.alert('Guardada con cariño', `“${song.title}” ya está en “${playlist.name}”.`);
  }
  function removeFromPlaylist(songId: string): void {
    if (!selectedPlaylist) return;
    savePlaylists(playlists.map(item => item.id === selectedPlaylist.id ? {...item, songIds: item.songIds.filter(id => id !== songId), updatedAt: Date.now()} : item));
  }

  return <NavigationContainer ref={navigationRef} theme={navigationTheme} onReady={syncActiveScreen} onStateChange={syncActiveScreen}>
    <ImageBackground source={require('./imagenes/fondohome.jpg')} style={styles.background} imageStyle={styles.backgroundImage}>
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.glow} />
        <Header onPlayer={() => navigateTo(activeSong ? 'player' : 'library')} />
        <View style={styles.content}>
          <Stack.Navigator initialRouteName="Home" screenOptions={{headerShown: false, animation: 'fade', contentStyle: styles.stackContent}}>
            <Stack.Screen name="Home">{() => <Home activeSong={activeSong} playing={playing} songs={songs.length - 1} favourites={favouriteIds.length} playlists={playlists.length} onLibrary={() => navigateTo('library')} onPlaylists={() => navigateTo('playlists')} onQueue={() => navigateTo('queue')} onPlayer={() => navigateTo(activeSong ? 'player' : 'library')} />}</Stack.Screen>
            <Stack.Screen name="Library">{() => <Library songs={visibleSongs} total={songs.length - 1} query={query} onlyFavourites={onlyFavourites} favourites={favourites} loading={loadingLibrary} onQuery={setQuery} onToggleFilter={() => setOnlyFavourites(value => !value)} onScan={readDeviceLibrary} onAdd={addAudioFiles} onPlay={song => play(visibleSongs, song.id)} onHeart={toggleFavourite} onPlaylist={song => { setSongForPlaylist(song); setSelectedPlaylistId(null); navigateTo('playlists'); }} />}</Stack.Screen>
            <Stack.Screen name="Player">{() => <Player song={activeSong} playing={playing} favourite={activeSong ? favourites.has(activeSong.id) : false} preferences={preferences} onBack={() => navigateTo('home')} onHeart={() => activeSong && toggleFavourite(activeSong.id)} onRepeat={changeRepeat} onShuffle={() => setPreferences(value => ({...value, shuffle: !value.shuffle}))} />}</Stack.Screen>
            <Stack.Screen name="Playlists">{() => <Playlists playlists={playlists} selected={selectedPlaylist} songs={selectedPlaylist ? selectedSongs : songs} pending={songForPlaylist} favourites={favourites} onBack={() => { if (selectedPlaylist) { setSelectedPlaylistId(null); } else { setSongForPlaylist(null); navigateTo('home'); } }} onCreate={() => setShowPlaylistModal(true)} onOpen={playlist => songForPlaylist ? addToPlaylist(playlist, songForPlaylist) : setSelectedPlaylistId(playlist.id)} onPlay={song => play(selectedPlaylist ? selectedSongs : songs, song.id)} onRemove={removeFromPlaylist} onDelete={playlist => Alert.alert('¿Eliminar esta lista?', `“${playlist.name}” dejará de existir.`, [{text: 'Conservar', style: 'cancel'}, {text: 'Eliminar', style: 'destructive', onPress: () => { savePlaylists(playlists.filter(item => item.id !== playlist.id)); setSelectedPlaylistId(null); }}])} />}</Stack.Screen>
            <Stack.Screen name="Queue">{() => <Queue songs={queue} activeId={activeSong?.id} onBack={() => navigateTo('home')} onPlay={song => play(queue, song.id)} />}</Stack.Screen>
          </Stack.Navigator>
        </View>
        {activeSong && screen !== 'player' ? <MiniPlayer song={activeSong} playing={playing} onOpen={() => navigateTo('player')} /> : null}
        <Navigation active={screen} onChange={navigateTo} />
      </SafeAreaView>
      <PlaylistModal visible={showPlaylistModal} value={playlistDraft} onChange={setPlaylistDraft} onClose={() => { setShowPlaylistModal(false); setPlaylistDraft(''); }} onSave={createPlaylist} />
    </ImageBackground>
  </NavigationContainer>;
}

function Header({onPlayer}: {onPlayer: () => void}): React.JSX.Element {
  return <View style={styles.header}><View><Text style={styles.brand}>NUESTRAS CANCIONES</Text><Text style={styles.tagline}>Un rincón que suena a nosotros</Text></View><Pressable onPress={onPlayer} style={styles.headerHeart}><Text style={styles.headerHeartText}>♥</Text></Pressable></View>;
}

function Home({activeSong, playing, songs, favourites, playlists, onLibrary, onPlaylists, onQueue, onPlayer}: {activeSong: Song | null; playing: boolean; songs: number; favourites: number; playlists: number; onLibrary: () => void; onPlaylists: () => void; onQueue: () => void; onPlayer: () => void}): React.JSX.Element {
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <Text style={sharedStyles.eyebrow}>PARA CADA MOMENTO</Text><Text style={styles.hero}>Para ti,{`\n`}mi amor.</Text><Text style={styles.heroCopy}>Cada canción tiene un lugar. Este es el nuestro: bonito, suave y siempre listo para sonar.</Text>
    <Pressable onPress={onPlayer} style={styles.nowCard}><Artwork song={activeSong} /><View style={styles.nowInfo}><Text style={styles.kicker}>{activeSong ? playing ? 'SONANDO AHORA' : 'PAUSADA' : 'PRIMERA CANCIÓN'}</Text><Text numberOfLines={1} style={styles.nowTitle}>{activeSong?.title || 'Elige una canción para empezar'}</Text><Text numberOfLines={1} style={styles.nowArtist}>{activeSong?.artist || 'Tu música, sin copias'}</Text></View><View style={styles.nowPlay}><Text style={styles.nowPlayText}>{playing ? 'Ⅱ' : '▶'}</Text></View></Pressable>
    <View style={styles.sectionLine}><Text style={styles.sectionTitle}>Tu pequeño universo</Text><Text style={styles.sectionNote}>todo a un toque</Text></View>
    <View style={styles.grid}><HomeButton icon="♫" title="Mi música" copy={`${songs} canciones`} onPress={onLibrary} /><HomeButton icon="♡" title="Favoritas" copy={`${favourites} guardadas`} onPress={onLibrary} /><HomeButton icon="☾" title="La cola" copy="Lo que sigue" onPress={onQueue} /><HomeButton icon="✦" title="Listas" copy={`${playlists} para crear`} onPress={onPlaylists} /></View>
    <View style={styles.promise}><Text style={styles.promiseIcon}>∞</Text><View style={styles.promiseInfo}><Text style={styles.promiseTitle}>La música no se detiene</Text><Text style={styles.promiseCopy}>Sigue en segundo plano, con controles en la notificación y pantalla bloqueada.</Text></View></View>
  </ScrollView>;
}

function Library({songs, total, query, onlyFavourites, favourites, loading, onQuery, onToggleFilter, onScan, onAdd, onPlay, onHeart, onPlaylist}: {songs: Song[]; total: number; query: string; onlyFavourites: boolean; favourites: Set<string>; loading: boolean; onQuery: (value: string) => void; onToggleFilter: () => void; onScan: () => void; onAdd: () => void; onPlay: (song: Song) => void; onHeart: (id: string) => void; onPlaylist: (song: Song) => void}): React.JSX.Element {
  return <View style={styles.fill}><View style={styles.titleRow}><View><Text style={sharedStyles.eyebrow}>BIBLIOTECA</Text><Text style={sharedStyles.title}>Tus canciones</Text></View><Text style={styles.count}>{Math.max(total, 0)}</Text></View><View style={styles.search}><Text style={styles.searchSymbol}>⌕</Text><TextInput value={query} onChangeText={onQuery} placeholder="Busca una canción o artista" placeholderTextColor={colors.dimmed} style={styles.searchInput} selectionColor={colors.blush} /></View><View style={styles.actions}><Action label={loading ? 'Leyendo…' : 'Actualizar'} icon={loading ? '…' : '↻'} disabled={loading} onPress={onScan} /><Action label="Añadir" icon="＋" onPress={onAdd} /></View><Pressable onPress={onToggleFilter} style={[styles.chip, onlyFavourites && styles.chipOn]}><Text style={[styles.chipText, onlyFavourites && styles.chipTextOn]}>{onlyFavourites ? '♥ Favoritas' : 'Todas las canciones'}</Text></Pressable><FlatList style={styles.songList} data={songs} keyExtractor={song => song.id} renderItem={({item: song}) => <SongRow song={song} favourite={favourites.has(song.id)} onPlay={() => onPlay(song)} onHeart={() => onHeart(song.id)} onAction={() => onPlaylist(song)} />} getItemLayout={(_, index) => ({length: SONG_ROW_HEIGHT, offset: SONG_ROW_HEIGHT * index, index})} initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7} updateCellsBatchingPeriod={50} removeClippedSubviews={Platform.OS === 'android'} contentContainerStyle={styles.rows} showsVerticalScrollIndicator={false} ListEmptyComponent={<Empty icon="♫" title="Tu biblioteca espera" copy="Toca Actualizar para leer la música de tu teléfono. Solo la indexamos: no se sube ni se duplica." />} /></View>;
}

function Player({song, playing, favourite, preferences, onBack, onHeart, onRepeat, onShuffle}: {song: Song | null; playing: boolean; favourite: boolean; preferences: PlayerPreferences; onBack: () => void; onHeart: () => void; onRepeat: () => void; onShuffle: () => void}): React.JSX.Element {
  const progress = useProgress(0.5);
  const position = progress.position;
  const duration = progress.duration || song?.duration || 0;
  const [seeking, setSeeking] = useState(false); const [value, setValue] = useState(0); const max = Math.max(duration, 1); const shown = seeking ? value : position;
  return <ScrollView contentContainerStyle={styles.player} showsVerticalScrollIndicator={false}><View style={styles.playerTop}><IconButton icon="‹" onPress={onBack} /><Text style={styles.playerKicker}>SONANDO PARA TI</Text><IconButton icon={favourite ? '♥' : '♡'} active={favourite} onPress={onHeart} /></View><Artwork song={song} large /><View style={styles.playerInfo}><View style={styles.playerText}><Text numberOfLines={1} style={styles.playerTitle}>{song?.title || 'Elige una canción'}</Text><Text numberOfLines={1} style={styles.playerArtist}>{song?.artist || 'Tu música aparecerá aquí'}</Text></View><Text style={[styles.playerHeart, favourite && styles.active]}>{favourite ? '♥' : '♡'}</Text></View><Slider minimumValue={0} maximumValue={max} value={Math.min(shown, max)} minimumTrackTintColor={colors.blush} maximumTrackTintColor="rgba(255,255,255,0.22)" thumbTintColor={colors.ink} disabled={!song} onSlidingStart={() => {setSeeking(true); setValue(position);}} onValueChange={setValue} onSlidingComplete={next => {setSeeking(false); TrackPlayer.seekTo(next);}} style={styles.slider} /><View style={styles.times}><Text style={styles.time}>{formatTime(shown)}</Text><Text style={styles.time}>{formatTime(duration)}</Text></View><View style={styles.transport}><Pressable onPress={onShuffle} style={styles.transportSide}><Text style={[styles.transportSideText, preferences.shuffle && styles.active]}>⇄</Text></Pressable><Pressable onPress={() => TrackPlayer.skipToPrevious()} style={styles.transportButton}><Text style={styles.transportIcon}>◀◀</Text></Pressable><Pressable disabled={!song} onPress={() => playing ? TrackPlayer.pause() : TrackPlayer.play()} style={[styles.playButton, !song && styles.disabled]}><Text style={styles.playIcon}>{playing ? 'Ⅱ' : '▶'}</Text></Pressable><Pressable onPress={() => TrackPlayer.skipToNext()} style={styles.transportButton}><Text style={styles.transportIcon}>▶▶</Text></Pressable><Pressable onPress={onRepeat} style={styles.transportSide}><Text style={[styles.transportSideText, preferences.repeat !== 'off' && styles.active]}>{preferences.repeat === 'one' ? '↻¹' : '↻'}</Text></Pressable></View><View style={styles.seek}><Pressable onPress={() => TrackPlayer.seekBy(-15)}><Text style={styles.seekText}>↶ 15</Text></Pressable><Text style={styles.seekHint}>Tú eliges el ritmo</Text><Pressable onPress={() => TrackPlayer.seekBy(15)}><Text style={styles.seekText}>15 ↷</Text></Pressable></View></ScrollView>;
}

function Playlists({playlists, selected, songs, pending, favourites, onBack, onCreate, onOpen, onPlay, onRemove, onDelete}: {playlists: Playlist[]; selected: Playlist | null; songs: Song[]; pending: Song | null; favourites: Set<string>; onBack: () => void; onCreate: () => void; onOpen: (playlist: Playlist) => void; onPlay: (song: Song) => void; onRemove: (id: string) => void; onDelete: (playlist: Playlist) => void}): React.JSX.Element {
  if (selected) return <View style={styles.fill}><View style={styles.titleRow}><IconButton icon="‹" onPress={onBack} /><View style={styles.listHeading}><Text style={sharedStyles.eyebrow}>LISTA PERSONAL</Text><Text numberOfLines={1} style={styles.listTitle}>{selected.name}</Text></View><IconButton icon="⌫" danger onPress={() => onDelete(selected)} /></View><FlatList style={styles.songList} data={songs} keyExtractor={song => song.id} renderItem={({item: song}) => <SongRow song={song} favourite={favourites.has(song.id)} onPlay={() => onPlay(song)} onHeart={() => undefined} onAction={() => onRemove(song.id)} action="−" />} getItemLayout={(_, index) => ({length: SONG_ROW_HEIGHT, offset: SONG_ROW_HEIGHT * index, index})} initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7} updateCellsBatchingPeriod={50} removeClippedSubviews={Platform.OS === 'android'} contentContainerStyle={styles.rows} showsVerticalScrollIndicator={false} ListEmptyComponent={<Empty icon="✦" title="Esta lista está esperando" copy="Añade canciones desde tu biblioteca y crea una banda sonora muy tuya." />} /></View>;
  return <View style={styles.fill}><View style={styles.titleRow}><View><Text style={sharedStyles.eyebrow}>{pending ? 'ELIGE UN DESTINO' : 'HECHAS CON CARIÑO'}</Text><Text style={sharedStyles.title}>{pending ? 'Añadir a una lista' : 'Tus listas'}</Text></View><Pressable onPress={onCreate} style={styles.create}><Text style={styles.createText}>＋</Text></Pressable></View>{pending ? <Text style={styles.pending}>Vas a guardar “{pending.title}”.</Text> : null}<ScrollView contentContainerStyle={styles.playlistRows} showsVerticalScrollIndicator={false}>{playlists.length ? playlists.map(playlist => <Pressable key={playlist.id} onPress={() => onOpen(playlist)} style={styles.playlistCard}><View style={styles.playlistCover}><Text style={styles.playlistCoverText}>✦</Text></View><View style={styles.playlistInfo}><Text numberOfLines={1} style={styles.playlistName}>{playlist.name}</Text><Text style={styles.playlistCount}>{playlist.songIds.length} canción{playlist.songIds.length === 1 ? '' : 'es'}</Text></View><Text style={styles.chevron}>›</Text></Pressable>) : <Empty icon="✦" title="Crea la primera" copy="Una lista para una noche tranquila, un viaje o simplemente para ustedes." />}</ScrollView></View>;
}

function Queue({songs, activeId, onBack, onPlay}: {songs: Song[]; activeId?: string; onBack: () => void; onPlay: (song: Song) => void}): React.JSX.Element {
  return <View style={styles.fill}><View style={styles.titleRow}><IconButton icon="‹" onPress={onBack} /><View style={styles.listHeading}><Text style={sharedStyles.eyebrow}>SIGUE DESPUÉS</Text><Text style={sharedStyles.title}>La cola</Text></View></View><FlatList style={styles.songList} data={songs} keyExtractor={song => song.id} renderItem={({item: song}) => <SongRow song={song} favourite={song.id === activeId} onPlay={() => onPlay(song)} onHeart={() => undefined} onAction={() => undefined} action={song.id === activeId ? '♪' : '·'} />} getItemLayout={(_, index) => ({length: SONG_ROW_HEIGHT, offset: SONG_ROW_HEIGHT * index, index})} initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7} updateCellsBatchingPeriod={50} removeClippedSubviews={Platform.OS === 'android'} contentContainerStyle={styles.rows} showsVerticalScrollIndicator={false} ListEmptyComponent={<Empty icon="☾" title="Nada en espera todavía" copy="Reproduce una canción desde tu biblioteca y aquí verás el orden de la música." />} /></View>;
}

function SongRow({song, favourite, onPlay, onHeart, onAction, action = '＋'}: {song: Song; favourite: boolean; onPlay: () => void; onHeart: () => void; onAction: () => void; action?: string}): React.JSX.Element {
  return <View style={styles.songRow}><Pressable onPress={onPlay} style={styles.songMain}><Artwork song={song} /><View style={styles.songInfo}><Text numberOfLines={1} style={styles.songTitle}>{song.title}</Text><Text numberOfLines={1} style={styles.songArtist}>{song.artist}</Text></View></Pressable><Pressable onPress={onHeart} style={styles.rowButton}><Text style={[styles.rowIcon, favourite && styles.active]}>{favourite ? '♥' : '♡'}</Text></Pressable><Pressable onPress={onAction} style={styles.rowButton}><Text style={styles.rowIcon}>{action}</Text></Pressable></View>;
}

function MiniPlayer({song, playing, onOpen}: {song: Song; playing: boolean; onOpen: () => void}): React.JSX.Element {
  return <Pressable onPress={onOpen} style={styles.mini}><Artwork song={song} /><View style={styles.miniInfo}><Text numberOfLines={1} style={styles.miniTitle}>{song.title}</Text><Text numberOfLines={1} style={styles.miniArtist}>{song.artist}</Text></View><Pressable onPress={event => {event.stopPropagation(); playing ? TrackPlayer.pause() : TrackPlayer.play();}} style={styles.miniButton}><Text style={styles.miniButtonText}>{playing ? 'Ⅱ' : '▶'}</Text></Pressable></Pressable>;
}

function Artwork({song, large = false}: {song: Song | null; large?: boolean}): React.JSX.Element {
  return <View style={[styles.artwork, large ? styles.artLarge : styles.artSmall]}><View style={styles.artGlowOne} /><View style={styles.artGlowTwo} /><Text style={[styles.artLetter, large && styles.artLetterLarge]}>{song?.title?.slice(0, 1).toUpperCase() || '♥'}</Text>{large ? <Text style={styles.artCaption}>PARA TI</Text> : null}</View>;
}

function Navigation({active, onChange}: {active: AppScreen; onChange: (screen: AppScreen) => void}): React.JSX.Element {
  const items: Array<[AppScreen, string, string]> = [['home', '⌂', 'Inicio'], ['library', '♫', 'Música'], ['playlists', '✦', 'Listas'], ['queue', '☾', 'Cola']];
  return <View style={styles.nav}>{items.map(([id, icon, label]) => {const chosen = active === id || active === 'player' && id === 'home'; return <Pressable key={id} onPress={() => onChange(id)} style={styles.navItem}><Text style={[styles.navIcon, chosen && styles.active]}>{icon}</Text><Text style={[styles.navLabel, chosen && styles.navLabelOn]}>{label}</Text></Pressable>;})}</View>;
}

function HomeButton({icon, title, copy, onPress}: {icon: string; title: string; copy: string; onPress: () => void}): React.JSX.Element {
  return <Pressable onPress={onPress} style={styles.homeButton}><Text style={styles.homeIcon}>{icon}</Text><Text style={styles.homeTitle}>{title}</Text><Text style={styles.homeCopy}>{copy}</Text></Pressable>;
}
function Action({icon, label, onPress, disabled = false}: {icon: string; label: string; onPress: () => void; disabled?: boolean}): React.JSX.Element { return <Pressable disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.disabled]}><Text style={styles.actionIcon}>{icon}</Text><Text style={styles.actionText}>{label}</Text></Pressable>; }
function IconButton({icon, onPress, active = false, danger = false}: {icon: string; onPress: () => void; active?: boolean; danger?: boolean}): React.JSX.Element { return <Pressable onPress={onPress} style={styles.iconButton}><Text style={[styles.iconText, active && styles.active, danger && styles.danger]}>{icon}</Text></Pressable>; }
function Empty({icon, title, copy}: {icon: string; title: string; copy: string}): React.JSX.Element { return <View style={styles.empty}><Text style={styles.emptyIcon}>{icon}</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyCopy}>{copy}</Text></View>; }

function PlaylistModal({visible, value, onChange, onClose, onSave}: {visible: boolean; value: string; onChange: (value: string) => void; onClose: () => void; onSave: () => void}): React.JSX.Element {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}><View style={styles.modal}><Text style={sharedStyles.eyebrow}>UNA NUEVA BANDA SONORA</Text><Text style={styles.modalTitle}>Ponle un nombre bonito</Text><TextInput autoFocus value={value} onChangeText={onChange} onSubmitEditing={onSave} placeholder="Ej. Noches contigo" placeholderTextColor={colors.dimmed} selectionColor={colors.blush} style={styles.modalInput} /><View style={styles.modalActions}><Pressable onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Ahora no</Text></Pressable><Pressable disabled={!value.trim()} onPress={onSave} style={[styles.save, !value.trim() && styles.disabled]}><Text style={styles.saveText}>Crear lista</Text></Pressable></View></View></KeyboardAvoidingView></Modal>;
}

function Loading({error}: {error: string | null}): React.JSX.Element {
  return <ImageBackground source={require('./imagenes/fondohome.jpg')} style={styles.background}><View style={styles.loadingOverlay} /><SafeAreaView style={styles.loading}><Text style={styles.loadingHeart}>♥</Text>{error ? <><Text style={styles.loadingTitle}>No pudimos abrir la música</Text><Text style={styles.loadingCopy}>{error}</Text></> : <><ActivityIndicator size="large" color={colors.blush} /><Text style={styles.loadingTitle}>Preparando nuestro rincón…</Text><Text style={styles.loadingCopy}>La música está afinando los detalles.</Text></>}</SafeAreaView></ImageBackground>;
}

const styles = StyleSheet.create({
  background: {flex: 1, backgroundColor: colors.night}, backgroundImage: {opacity: 0.96}, overlay: {...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,5,17,0.68)'}, safe: {flex: 1, paddingHorizontal: 18}, glow: {position: 'absolute', width: 260, height: 260, right: -110, top: -50, borderRadius: 130, backgroundColor: 'rgba(185,156,255,0.16)'},
  header: {paddingTop: 8, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}, brand: {color: colors.ink, fontSize: 13, fontWeight: '900', letterSpacing: 2}, tagline: {color: colors.muted, fontSize: 12, marginTop: 4}, headerHeart: {width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.whiteGlass, borderColor: colors.line, borderWidth: 1}, headerHeartText: {color: colors.blush, fontSize: 21},
  content: {flex: 1, minHeight: 0}, stackContent: {backgroundColor: 'transparent'}, scroll: {paddingBottom: 10}, hero: {color: colors.ink, fontSize: 39, lineHeight: 42, fontWeight: '900', letterSpacing: -1.5, marginTop: 6}, heroCopy: {color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 12, marginBottom: 22, paddingRight: 24}, nowCard: {minHeight: 102, backgroundColor: colors.glassStrong, borderColor: colors.line, borderWidth: 1, borderRadius: 24, padding: 13, flexDirection: 'row', alignItems: 'center'}, nowInfo: {flex: 1, marginHorizontal: 12}, kicker: {color: colors.blush, fontSize: 10, fontWeight: '900', letterSpacing: 1.1}, nowTitle: {color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 5}, nowArtist: {color: colors.muted, fontSize: 13, marginTop: 3}, nowPlay: {width: 38, height: 38, borderRadius: 19, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center'}, nowPlayText: {color: colors.night, fontSize: 17, fontWeight: '900'},
  sectionLine: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 28, marginBottom: 12}, sectionTitle: {color: colors.ink, fontSize: 19, fontWeight: '800'}, sectionNote: {color: colors.dimmed, fontSize: 12}, grid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10}, homeButton: {width: '48.5%', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: 15, minHeight: 125}, homeIcon: {color: colors.blush, fontSize: 26, marginBottom: 15}, homeTitle: {color: colors.ink, fontSize: 15, fontWeight: '800'}, homeCopy: {color: colors.muted, fontSize: 12, marginTop: 5}, promise: {marginTop: 20, backgroundColor: 'rgba(255,173,207,0.13)', borderWidth: 1, borderColor: 'rgba(255,190,216,0.24)', borderRadius: 22, padding: 15, flexDirection: 'row'}, promiseIcon: {color: colors.blush, fontSize: 28, fontWeight: '800', width: 42, textAlign: 'center'}, promiseInfo: {flex: 1, paddingLeft: 8}, promiseTitle: {color: colors.ink, fontSize: 14, fontWeight: '800'}, promiseCopy: {color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4},
  fill: {flex: 1}, titleRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 15}, count: {backgroundColor: 'rgba(255,182,207,0.17)', color: colors.blush, minWidth: 36, textAlign: 'center', paddingVertical: 7, paddingHorizontal: 9, borderRadius: 16, fontWeight: '800'}, search: {height: 52, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassStrong, borderRadius: 17, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 15}, searchSymbol: {color: colors.dimmed, fontSize: 25, marginRight: 9}, searchInput: {flex: 1, color: colors.ink, fontSize: 14, padding: 0}, actions: {flexDirection: 'row', gap: 10, marginTop: 11}, action: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 15, paddingVertical: 10, backgroundColor: colors.whiteGlass, borderWidth: 1, borderColor: colors.line}, actionIcon: {color: colors.blush, fontWeight: '900', fontSize: 16}, actionText: {color: colors.ink, fontWeight: '700', fontSize: 13}, chip: {alignSelf: 'flex-start', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 8, marginVertical: 14, backgroundColor: 'rgba(24,12,30,0.48)', borderWidth: 1, borderColor: colors.line}, chipOn: {backgroundColor: colors.rose, borderColor: colors.rose}, chipText: {color: colors.muted, fontSize: 12, fontWeight: '800'}, chipTextOn: {color: colors.night}, songList: {flex: 1, minHeight: 0}, rows: {paddingBottom: 12},
  songRow: {minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.13)'}, songMain: {flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0}, songInfo: {flex: 1, minWidth: 0, marginLeft: 11}, songTitle: {color: colors.ink, fontSize: 15, fontWeight: '700'}, songArtist: {color: colors.muted, fontSize: 12, marginTop: 3}, rowButton: {width: 30, height: 38, alignItems: 'center', justifyContent: 'center'}, rowIcon: {color: colors.muted, fontSize: 20},
  artwork: {overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violet, borderRadius: 15}, artSmall: {width: 48, height: 48, borderRadius: 14}, artLarge: {width: '100%', aspectRatio: 1, borderRadius: 32, marginTop: 25}, artGlowOne: {position: 'absolute', width: '75%', height: '75%', borderRadius: 200, backgroundColor: 'rgba(255,187,219,0.34)', top: '-18%', left: '-18%'}, artGlowTwo: {position: 'absolute', width: '60%', height: '60%', borderRadius: 180, backgroundColor: 'rgba(42,20,78,0.35)', bottom: '-16%', right: '-12%'}, artLetter: {color: colors.ink, fontWeight: '900', fontSize: 20}, artLetterLarge: {fontSize: 92, letterSpacing: -4}, artCaption: {position: 'absolute', bottom: 25, color: 'rgba(255,255,255,0.8)', fontSize: 11, letterSpacing: 4, fontWeight: '800'},
  player: {paddingBottom: 18}, playerTop: {height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, playerKicker: {color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.4}, iconButton: {width: 39, height: 39, borderRadius: 20, backgroundColor: colors.whiteGlass, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center'}, iconText: {color: colors.ink, fontSize: 27, lineHeight: 30, marginTop: -3}, playerInfo: {marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, playerText: {flex: 1, minWidth: 0, paddingRight: 15}, playerTitle: {color: colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.5}, playerArtist: {color: colors.muted, fontSize: 15, marginTop: 5}, playerHeart: {color: colors.dimmed, fontSize: 25}, slider: {width: '100%', height: 34, marginTop: 18}, times: {flexDirection: 'row', justifyContent: 'space-between', marginTop: -2}, time: {color: colors.dimmed, fontSize: 11, fontVariant: ['tabular-nums']}, transport: {marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, transportButton: {width: 52, height: 52, alignItems: 'center', justifyContent: 'center'}, transportIcon: {color: colors.ink, fontSize: 20, letterSpacing: -6, marginRight: 4}, transportSide: {width: 38, alignItems: 'center', justifyContent: 'center'}, transportSideText: {color: colors.dimmed, fontSize: 19, fontWeight: '800'}, playButton: {width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.rose, borderWidth: 5, borderColor: 'rgba(255,255,255,0.16)'}, playIcon: {color: colors.night, fontSize: 29, fontWeight: '900'}, seek: {marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, seekText: {color: colors.muted, fontSize: 14, fontWeight: '800'}, seekHint: {color: colors.dimmed, fontSize: 12, fontStyle: 'italic'},
  listHeading: {flex: 1, minWidth: 0, marginLeft: 11}, listTitle: {color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 2}, danger: {color: colors.danger}, active: {color: colors.rose}, create: {width: 42, height: 42, borderRadius: 21, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center'}, createText: {color: colors.night, fontSize: 26}, pending: {color: colors.blush, fontSize: 13, marginBottom: 10}, playlistRows: {paddingTop: 2, paddingBottom: 16}, playlistCard: {minHeight: 82, padding: 11, marginBottom: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.line, borderWidth: 1, borderRadius: 21}, playlistCover: {height: 58, width: 58, borderRadius: 17, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center'}, playlistCoverText: {color: colors.blush, fontSize: 24}, playlistInfo: {flex: 1, marginLeft: 13}, playlistName: {color: colors.ink, fontSize: 16, fontWeight: '800'}, playlistCount: {color: colors.muted, fontSize: 12, marginTop: 4}, chevron: {color: colors.muted, fontSize: 28, marginRight: 4},
  mini: {minHeight: 65, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 8, marginBottom: 9, backgroundColor: 'rgba(26,12,33,0.95)', borderColor: colors.line, borderWidth: 1, borderRadius: 19}, miniInfo: {flex: 1, minWidth: 0, marginHorizontal: 10}, miniTitle: {color: colors.ink, fontSize: 14, fontWeight: '800'}, miniArtist: {color: colors.muted, fontSize: 11, marginTop: 2}, miniButton: {width: 37, height: 37, borderRadius: 19, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center'}, miniButtonText: {color: colors.night, fontSize: 16, fontWeight: '900'}, nav: {height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginHorizontal: -3}, navItem: {width: '25%', alignItems: 'center', justifyContent: 'center'}, navIcon: {color: colors.dimmed, fontSize: 20}, navLabel: {color: colors.dimmed, fontSize: 10, fontWeight: '700'}, navLabelOn: {color: colors.ink},
  empty: {alignItems: 'center', marginTop: 58, paddingHorizontal: 32}, emptyIcon: {color: colors.blush, fontSize: 42, marginBottom: 10}, emptyTitle: {color: colors.ink, fontSize: 18, fontWeight: '800', textAlign: 'center'}, emptyCopy: {color: colors.muted, lineHeight: 20, fontSize: 13, textAlign: 'center', marginTop: 8}, modalBackdrop: {flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.6)'}, modal: {backgroundColor: '#2A1734', borderRadius: 28, padding: 22, borderWidth: 1, borderColor: colors.line}, modalTitle: {color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 7}, modalInput: {color: colors.ink, backgroundColor: 'rgba(0,0,0,0.24)', borderWidth: 1, borderColor: colors.line, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginTop: 19}, modalActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 19}, cancel: {paddingHorizontal: 15, paddingVertical: 12}, cancelText: {color: colors.muted, fontWeight: '700'}, save: {backgroundColor: colors.rose, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12}, saveText: {color: colors.night, fontWeight: '900'}, disabled: {opacity: 0.45},
  loadingOverlay: {...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,5,17,0.79)'}, loading: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36}, loadingHeart: {color: colors.rose, fontSize: 55, marginBottom: 21}, loadingTitle: {color: colors.ink, fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 20}, loadingCopy: {color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: 9},
});

export default App;
