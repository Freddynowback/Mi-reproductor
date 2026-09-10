package com.miproyecto.musiclibrary

import android.content.ContentUris
import android.os.Build
import android.provider.MediaStore
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Reads Android's MediaStore directly: files stay where the user put them. */
class MusicLibraryModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "MusicLibrary"

  @ReactMethod
  fun getDeviceTracks(promise: Promise) {
    try {
      val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
      } else {
        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
      }
      val projection = arrayOf(
        MediaStore.Audio.Media._ID,
        MediaStore.Audio.Media.TITLE,
        MediaStore.Audio.Media.ARTIST,
        MediaStore.Audio.Media.ALBUM,
        MediaStore.Audio.Media.DURATION,
        MediaStore.Audio.Media.MIME_TYPE,
        MediaStore.Audio.Media.DATE_ADDED,
      )
      val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media.DURATION} > ?"
      val selectionArgs = arrayOf("30000")
      val result = Arguments.createArray()

      reactContext.contentResolver.query(
        collection,
        projection,
        selection,
        selectionArgs,
        "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC",
      )?.use { cursor ->
        val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
        val titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
        val artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
        val albumColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
        val durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
        val mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE)
        val addedColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)

        while (cursor.moveToNext()) {
          val mediaId = cursor.getLong(idColumn)
          val track = Arguments.createMap()
          track.putString("id", "media-$mediaId")
          track.putString("uri", ContentUris.withAppendedId(collection, mediaId).toString())
          track.putString("title", cursor.getString(titleColumn))
          track.putString("artist", cursor.getString(artistColumn))
          track.putString("album", cursor.getString(albumColumn))
          track.putDouble("duration", cursor.getLong(durationColumn).toDouble() / 1000.0)
          track.putString("mimeType", cursor.getString(mimeColumn))
          track.putDouble("addedAt", cursor.getLong(addedColumn).toDouble() * 1000.0)
          result.pushMap(track)
        }
      }
      promise.resolve(result)
    } catch (exception: Exception) {
      promise.reject("MUSIC_LIBRARY_ERROR", "No se pudo leer la biblioteca de música.", exception)
    }
  }
}
