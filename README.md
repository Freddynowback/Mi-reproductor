# Nuestras Canciones

Un reproductor personal de música hecho para regalar: conserva el fondo original, lee la biblioteca local sin copiar los archivos y mantiene la música sonando fuera de la aplicación.

## Qué incluye

- Biblioteca Android vía `MediaStore`: accede a la música del teléfono como referencias `content://`; no mueve, sube ni duplica archivos.
- Selección de audios para casos puntuales mediante el selector del sistema.
- Búsqueda, favoritos, listas personales y cola de reproducción persistentes.
- Biblioteca, cola y listas virtualizadas para que cientos de canciones sigan desplazándose con fluidez.
- Reproducción, pausa, anterior, siguiente, adelantar y retroceder 15 segundos.
- Repetición (apagada, una, todas) y reproducción aleatoria.
- Controles nativos de notificación, pantalla bloqueada, auriculares y segundo plano mediante `@rntp/player` v5.
- Tema visual propio con el fondo `imagenes/fondohome.jpg`, tarjetas translúcidas y textos en español.
- Navegación nativa entre pantallas mediante React Navigation, sin sustituir la barra visual propia de la app.

## Base técnica

- React Native 0.87.1 / React 19.2.3
- React Navigation 7 con `react-native-screens` para transiciones nativas.
- Android Gradle Plugin moderno, Gradle Wrapper 9.4.1, Kotlin 2.2 y SDK de compilación 37.
- Nueva arquitectura y Hermes activados.
- Android mínimo 7.0 (API 24); Android 13+ solicita `READ_MEDIA_AUDIO` al actualizar la biblioteca.

## Antes de compilar

Instala las dependencias desde la raíz:

```bash
npm install
```

En macOS, para iOS también ejecuta:

```bash
cd ios && bundle install && bundle exec pod install && cd ..
```

Después puedes usar los scripts habituales `npm run android` o `npm run ios`.

## Notas importantes

- El reproductor usa `@rntp/player` v5. Su licencia permite uso personal/no comercial —este caso— y exige licencia si en el futuro se comercializa la app.
- La aplicación conserva el identificador Android `com.miproyecto` para no romper instalaciones existentes. Cambia la firma de `release` por una propia antes de publicar.
