import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

/**
 * Pick an image, shrink it, put it in a bucket, hand back a public URL.
 *
 * ChatScreen already did this inline, and did it by uploading whatever came out
 * of the picker — a modern phone photo is four or five megabytes, sent in full
 * to be displayed at 340 points wide. Resizing first is the difference between
 * a cover that appears and one that arrives after the screen has moved on.
 *
 * Returns `{ url, path }`, or null when the user cancelled. Throws on a real
 * failure so the caller can say what went wrong.
 */
export async function pickAndUploadImage({ bucket, pathPrefix, maxWidth = 1080 }) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo access is needed to choose an image.');
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    // Covers are drawn in a wide, short band, so cropping to that shape here
    // beats letting the card decide which part of a portrait photo to discard.
    aspect: [16, 9],
    quality: 1,
  });

  if (picked.canceled) return null;

  const original = picked.assets[0];

  // JPEG rather than the source format: a PNG screenshot of a workout plan can
  // be several times larger than the photo it replaces, for no visible gain.
  const resized = await ImageManipulator.manipulateAsync(
    original.uri,
    [{ resize: { width: maxWidth } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
  );

  const response = await fetch(resized.uri);
  const blob = await response.blob();

  // Overwriting one stable path per subject rather than accumulating a new file
  // per edit: without upsert, changing a cover five times leaves five orphans
  // nothing will ever delete.
  const path = `${pathPrefix}.jpg`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  // A cache-busting suffix, because the path is stable by design: without it
  // the old image stays on screen after a replacement.
  return { url: `${data.publicUrl}?v=${Date.now()}`, path };
}
