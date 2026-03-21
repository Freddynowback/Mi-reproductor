import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Alert,
  FlatList,
  TextInput,
} from 'react-native';
import TrackPlayer, { useProgress, Event } from 'react-native-track-player';
import RNFS from "react-native-fs";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';

export default function App() {

  const cancion = {
    id: '1',
    url: require('./mas_que_amigos_matise.mp3'),
    title: 'Más que amigos',
    artist: 'Matisse',
  };
  const [modoAgregar, setModoAgregar] = useState(false);
  const [songToAdd, setSongToAdd] = useState(null);
  const [queue, setQueue] = useState([]); // lista actual
  const [currentIndex, setCurrentIndex] = useState(0); // posición
  const [musicFolder, setMusicFolder] = useState(null);
  const [songs, setSongs] = useState([]);
  const [pantalla, setPantalla] = useState('home');
  const [reproduciendo, setReproduciendo] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const progress = useProgress();
  const [currentTrack, setCurrentTrack] = useState(null);
  const [editName, setEditName] = useState("");
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [search, setSearch] = useState("");
  const [filteredSongs, setFilteredSongs] = useState([]);
  const [shuffleHistory, setShuffleHistory] = useState([]);
  const confirmDelete = (mensaje, onConfirm) => {
    Alert.alert(
      "Confirmar",
      mensaje,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: onConfirm }
      ]
    );
  };

  useEffect(() => {
    if (search.trim() === "") {
      setFilteredSongs(songs);
    } else {
      const filtered = songs.filter(song =>
        song.title.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredSongs(filtered);
    }
  }, [search, songs]);

  const removeFromPlaylist = async (playlistIndex, songIndex) => {
    try {
      const updated = [...playlists];

      updated[playlistIndex].songs.splice(songIndex, 1);

      setPlaylists(updated);
      await AsyncStorage.setItem('playlists', JSON.stringify(updated));
    } catch (e) {
      console.log(e);
    }
  };
  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {

      // 🔁 repeat
      if (repeat && currentTrack) {
        await TrackPlayer.seekTo(0);
        await TrackPlayer.play();
        return;
      }

      // 🔀 shuffle
      // 🔀 shuffle inteligente
      if (shuffle && queue.length > 0) {
        const randomIndex = getNextShuffleIndex();
        setCurrentIndex(randomIndex);
        await reproducir(queue[randomIndex]);
        return;
      }

      // ▶ siguiente normal
      if (currentIndex < queue.length - 1) {
        const newIndex = currentIndex + 1;
        setCurrentIndex(newIndex);
        await reproducir(queue[newIndex]);
      } else {
        setReproduciendo(false);
      }

    });

    return () => sub.remove();
  }, [currentIndex, queue, repeat, shuffle, currentTrack]);


  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60) || 0;
    const secs = Math.floor(seconds % 60) || 0;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  const renamePlaylist = async (index, newName) => {
    const updated = [...playlists];
    updated[index].name = newName;

    setPlaylists(updated);
    await AsyncStorage.setItem('playlists', JSON.stringify(updated));
  };

  const onSeek = async (value) => {
    await TrackPlayer.seekTo(value);
  };

  const addToPlaylist = async (playlistIndex, song) => {
    try {
      const updated = [...playlists];

      // evitar duplicados (opcional pero pro)
      const exists = updated[playlistIndex].songs.find(s => s.url === song.url);
      if (exists) return;

      updated[playlistIndex].songs.push(song);

      setPlaylists(updated);
      await AsyncStorage.setItem('playlists', JSON.stringify(updated));

      Alert.alert("Agregada a playlist ✅");
    } catch (e) {
      console.log("Error:", e);
    }
  };

  function getNextShuffleIndex() {
    if (queue.length === 0) return 0;

    // canciones disponibles (las que NO están en el historial)
    const available = queue
      .map((_, i) => i)
      .filter(i => !shuffleHistory.includes(i));

    // si ya se usaron todas → reiniciar historial
    if (available.length === 0) {
      setShuffleHistory([]);
      return Math.floor(Math.random() * queue.length);
    }

    // elegir una random de las disponibles
    const randomIndex = available[Math.floor(Math.random() * available.length)];

    // guardar en historial
    setShuffleHistory(prev => [...prev, randomIndex]);

    return randomIndex;
  }

  const readMusicFiles = async (folderUri) => {
    try {
      const files = await RNFS.readDir(folderUri);
      const musicFiles = files
        .filter(file => file.isFile() && (file.name.endsWith('.mp3') || file.name.endsWith('.m4a')))
        .map((file, index) => ({
          id: index.toString(),
          title: file.name,
          url: 'file://' + file.path,
        }));
      setSongs(musicFiles);
      setFilteredSongs(musicFiles);
    } catch (err) {
      console.error(err);
    }
  };

  async function requestStoragePermission() {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        Platform.Version >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }

  async function reproducir(track = null, lista = null, index = 0) {
    try {
      // 🔥 SOLO REANUDAR
      if (!track && !lista && currentTrack) {
        await TrackPlayer.play();
        setReproduciendo(true);
        return;
      }

      // 🔥 NUEVA LISTA (playlist o songs)
      if (lista) {
        setQueue(lista);
        setCurrentIndex(index);
        setShuffleHistory([]); // 🔥 resetear historial
      }

      const song = track || queue[index] || queue[currentIndex];
      if (!song) return;

      // 🔥 SOLO reset si cambia canción
      if (!currentTrack || currentTrack.url !== song.url) {
        await TrackPlayer.reset();
        await TrackPlayer.add(song);
      }

      await TrackPlayer.play();

      setCurrentTrack(song);
      setReproduciendo(true);

    } catch (e) {
      console.log("Error reproducir:", e);
    }
  }
  async function siguiente() {
    if (queue.length === 0) return;

    let newIndex;

    if (shuffle) {
      newIndex = getNextShuffleIndex();
    } else {
      newIndex = (currentIndex + 1) % queue.length; // 🔥 loop automático
    }

    setCurrentIndex(newIndex);
    await reproducir(queue[newIndex]);
  }


  async function anterior() {
    if (queue.length === 0) return;

    let newIndex;

    if (shuffle) {
      newIndex = Math.floor(Math.random() * queue.length);
    } else {
      newIndex = currentIndex - 1 < 0 ? queue.length - 1 : currentIndex - 1;
    }

    setCurrentIndex(newIndex);
    await reproducir(queue[newIndex]);
  }

  async function pausar() {
    await TrackPlayer.pause();
    setReproduciendo(false);
  }

  async function reiniciar() {
    await TrackPlayer.seekTo(0);
    await TrackPlayer.play();
  }

  const createPlaylist = async () => {
    const name = `Playlist ${playlists.length + 1}`;
    const newList = [...playlists, { name, songs: [] }];
    setPlaylists(newList);
    await AsyncStorage.setItem('playlists', JSON.stringify(newList));
  };
  const deletePlaylist = async (index) => {
    const updated = playlists.filter((_, i) => i !== index);

    setPlaylists(updated);
    await AsyncStorage.setItem('playlists', JSON.stringify(updated));
  };

  useEffect(() => {
    async function initStorage() {
      const stored = await AsyncStorage.getItem('playlists');
      if (stored) setPlaylists(JSON.parse(stored));
    }
    initStorage();
  }, []);

  useEffect(() => {
    async function init() {
      try {
        await TrackPlayer.setupPlayer();
      } catch (e) {
        console.log("Ya estaba inicializado");
      }
    }

    init();
  }, []);

  return (
    <ImageBackground
      source={require('./imagenes/fondohome.jpg')}
      style={styles.background}
    >
      <View style={styles.overlay}>

        {pantalla === 'home' && (
          <>
            <Text style={styles.title}>Tu música 🎧</Text>
            <Text style={styles.subtitle}>Disfruta tu colección</Text>

            <View style={styles.cardsContainer}>
              <TouchableOpacity style={styles.card} onPress={() => setPantalla('player')}>
                <Text style={styles.cardEmoji}>🎵</Text>
                <Text style={styles.cardText}>Reproductor</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.card}
                onPress={async () => {
                  const permiso = await requestStoragePermission();
                  if (!permiso) return Alert.alert('Permiso denegado');

                  const path = '/storage/emulated/0/Music';
                  await readMusicFiles(path);
                  setPantalla('songs');
                }}
              >
                <Text style={styles.cardEmoji}>📂</Text>
                <Text style={styles.cardText}>Tu música</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.card} onPress={() => setPantalla('playlists')}>
                <Text style={styles.cardEmoji}>📀</Text>
                <Text style={styles.cardText}>Playlists</Text>
              </TouchableOpacity>


            </View>
          </>
        )}

        {pantalla === 'player' && (
          <>
            <Text style={styles.title}>{currentTrack?.title}</Text>
            <Text style={styles.subtitle}>{currentTrack?.artist || 'Desconocido'}</Text>

            <View style={styles.controls}>
              <TouchableOpacity style={styles.circleBtn} onPress={anterior}>
                <Text>⏮</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playBtn}
                onPress={() => reproduciendo ? pausar() : reproducir()}
              >
                <Text style={{ fontSize: 28 }}>
                  {reproduciendo ? "⏸" : "▶"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.circleBtn} onPress={siguiente}>
                <Text>⏭</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 10 }}>

              <TouchableOpacity onPress={() => setShuffle(!shuffle)}>
                <Text style={{
                  marginHorizontal: 15,
                  fontSize: shuffle ? 40 : 20,
                  color: shuffle ? "#f36aa0" : "#aaa",
                  fontWeight: shuffle ? "bold" : "normal"
                }}>
                  🔀
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setRepeat(!repeat)}>
                <Text style={{
                  marginHorizontal: 15,
                  fontSize: repeat ? 40 : 20,
                  color: repeat ? "#f36aa0" : "#aaa",
                  fontWeight: repeat ? "bold" : "normal"
                }}>
                  🔁
                </Text>
              </TouchableOpacity>

            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={progress.duration || 1}
              value={progress.position}
              onSlidingComplete={onSeek}
              minimumTrackTintColor="#f36aa0"
              maximumTrackTintColor="#ccc"
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text>{formatTime(progress.position)}</Text>
              <Text>{formatTime(progress.duration)}</Text>
            </View>

            <Text style={styles.time}>
              {formatTime(progress.position)} / {formatTime(progress.duration)}
            </Text>

            <TouchableOpacity style={styles.mainButton} onPress={() => setPantalla('home')}>
              <Text style={styles.mainButtonText}>Volver</Text>
            </TouchableOpacity>
          </>
        )}





        {pantalla === 'playlistDetails' && selectedPlaylist && (
          <>
            <Text style={styles.title}>{selectedPlaylist.name}</Text>

            <TextInput
              placeholder="Nuevo nombre"
              placeholderTextColor="#999"
              value={editName}
              onChangeText={setEditName}
              style={{
                backgroundColor: "#fff",
                color: "#000", // 🔥 clave
                padding: 10,
                borderRadius: 10,
                marginBottom: 10,
                borderWidth: 1, // 🔥 para que se vea
                borderColor: "#ccc"
              }}
            />

            <TouchableOpacity
              style={styles.mainButton}
              onPress={() => {
                const index = playlists.findIndex(p => p.name === selectedPlaylist.name);
                renamePlaylist(index, editName);
                setSelectedPlaylist({ ...selectedPlaylist, name: editName });
                setEditName("");
              }}
            >
              <Text style={styles.mainButtonText}>Renombrar</Text>
            </TouchableOpacity>

            <FlatList
              data={selectedPlaylist.songs}
              keyExtractor={(item, i) => i.toString()}
              renderItem={({ item, index }) => (
                <View style={styles.listItem}>
                  <TouchableOpacity
                    onPress={() => {
                      reproducir(item, selectedPlaylist.songs, index);
                      setPantalla('player');
                    }}
                  >
                    <Text style={styles.listText}>{item.title}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      const playlistIndex = playlists.findIndex(p => p.name === selectedPlaylist.name);

                      confirmDelete(
                        `¿Eliminar "${item.title}" de la playlist?`,
                        () => removeFromPlaylist(playlistIndex, index)
                      );
                    }}
                  >
                    <Text style={{ color: "red", marginTop: 5 }}>
                      🗑 Eliminar
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <Text style={{ textAlign: "center", marginTop: 20 }}>
                  No hay canciones
                </Text>
              }
            />

            <TouchableOpacity
              style={styles.mainButton}
              onPress={() => setPantalla('playlists')}
            >
              <Text style={styles.mainButtonText}>Volver</Text>
            </TouchableOpacity>
          </>
        )}

        {pantalla === 'songs' && (
          <>
            <Text style={styles.title}>Canciones</Text>
            <TextInput
              placeholder="Buscar canción..."
              placeholderTextColor="#999"
              value={search}
              onChangeText={setSearch}
              style={{
                backgroundColor: "#fff",
                color: "#000",
                padding: 10,
                borderRadius: 10,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: "#ccc"
              }}
            />

            <FlatList
              data={filteredSongs}
              keyExtractor={item => item.id}
              renderItem={({ item, index }) => (
                <View style={styles.listItem}>
                  <TouchableOpacity
                    onPress={() => {
                      reproducir(item, songs, index);
                      setPantalla('player');
                    }}
                  >
                    <Text style={styles.listText}>{item.title}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      if (playlists.length === 0) {
                        Alert.alert("Crea una playlist primero");
                        return;
                      }

                      // por ahora la agrega a la primera playlist
                      setSongToAdd(item);
                      setModoAgregar(true);
                      setPantalla('selectPlaylist');
                    }}
                  >
                    <Text style={{ color: "#f36aa0", marginTop: 5 }}>
                      ➕ Agregar a playlist
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />

            <TouchableOpacity style={styles.mainButton} onPress={() => setPantalla('home')}>
              <Text style={styles.mainButtonText}>Volver</Text>
            </TouchableOpacity>
          </>
        )}


        {pantalla === 'selectPlaylist' && (
          <>
            <Text style={styles.title}>Selecciona playlist</Text>

            <FlatList
              data={playlists}
              keyExtractor={(item, i) => i.toString()}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={styles.listItem}
                  onPress={async () => {
                    await addToPlaylist(index, songToAdd);
                    setModoAgregar(false);
                    setSongToAdd(null);
                    setPantalla('songs');
                  }}
                >
                  <Text style={styles.listText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.mainButton}
              onPress={() => setPantalla('songs')}
            >
              <Text style={styles.mainButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </>
        )}

        {pantalla === 'playlists' && (
          <>
            <Text style={styles.title}>Playlists</Text>

            <FlatList
              data={playlists}
              keyExtractor={(item, i) => i.toString()}
              renderItem={({ item, index }) => (
                <View style={styles.listItem}>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedPlaylist(item);
                      setPantalla('playlistDetails');
                    }}
                  >
                    <Text style={styles.listText}>{item.name}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => {
                    confirmDelete(
                      `¿Eliminar la playlist "${item.name}"?`,
                      () => deletePlaylist(index)
                    );
                  }}>
                    <Text style={{ color: "red", marginTop: 5 }}>
                      🗑 Eliminar
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />

            <TouchableOpacity style={styles.mainButton} onPress={createPlaylist}>
              <Text style={styles.mainButtonText}>Crear playlist</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mainButton} onPress={() => setPantalla('home')}>
              <Text style={styles.mainButtonText}>Volver</Text>
            </TouchableOpacity>
          </>
        )}


        {currentTrack && (
          <TouchableOpacity
            style={styles.miniPlayer}
            onPress={() => setPantalla('player')}
          >
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.miniTitle}>
                {currentTrack.title}
              </Text>
              <Text style={styles.miniArtist}>
                {currentTrack.artist || "Desconocido"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation(); // 🔥 evita abrir player
                reproduciendo ? pausar() : reproducir();
              }}
            >
              <Text style={{ fontSize: 22 }}>
                {reproduciendo ? "⏸" : "▶"}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.26)",
    padding: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 40,
    color: "#f511e2"
  },

  subtitle: {
    textAlign: "center",
    color: "#555",
    marginBottom: 20,
  },

  cardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",

  },

  card: {
    width: "47%",
    height: 150,
    backgroundColor: "#fff",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    elevation: 5,
  },

  cardEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },

  cardText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#f488eb"
  },

  listItem: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 15,
    marginVertical: 6,
    elevation: 3,
  },

  listText: {
    fontSize: 15,
    color: "#9d5096"
  },

  controls: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 30,
  },

  circleBtn: {
    backgroundColor: "#da86fb",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },

  playBtn: {
    backgroundColor: "#f36aa0",
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },

  mainButton: {
    marginTop: 20,
    backgroundColor: "#f36aa0",
    paddingVertical: 18,
    borderRadius: 35,
    alignItems: "center",
  },

  mainButtonText: {
    color: "#131212",
    fontSize: 18,
    fontWeight: "600",
  },

  time: {
    textAlign: "center",
    marginTop: 10,
    color: "#a72ad5",
  },
  miniPlayer: {
    position: "relative",
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: "#fdb6f8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderColor: "#ba00f7",
    elevation: 10,
  },

  miniTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },

  miniArtist: {
    fontSize: 12,
    color: "#666",
  },
});