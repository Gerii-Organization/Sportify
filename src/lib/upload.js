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
export async function pickAndUploadImage({ bucket, pathPrefix, maxWidth = 1080, aspect = [16, 9] }) {
  const uri = await pickImage({ aspect });
  if (!uri) return null;

  return uploadPickedImage({ uri, bucket, pathPrefix, maxWidth });
}

/**
 * Just the picking half.
 *
 * Sign-up needs it on its own: there is no user id to store a file under until
 * the account exists, so the photo is chosen at step three and uploaded after
 * signUp returns. Resolves to a local uri, or null when cancelled.
 */
export async function pickImage({ aspect = [16, 9] } = {}) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo access is needed to choose an image.');
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    // Cropped to the shape it will be drawn in: a cover is a wide band, an
    // avatar is a circle. Letting the component crop instead means it picks
    // which part of a portrait photo to discard, and it always picks wrong.
    aspect,
    quality: 1,
  });

  if (picked.canceled) return null;
  return picked.assets[0].uri;
}

/** The uploading half. Returns the public URL, or throws. */
export async function uploadPickedImage({ uri, bucket, pathPrefix, maxWidth = 1080 }) {
  // JPEG rather than the source format: a PNG screenshot of a workout plan can
  // be several times larger than the photo it replaces, for no visible gain.
  const resized = await ImageManipulator.manipulateAsync(
    uri,
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
  return `${data.publicUrl}?v=${Date.now()}`;
}
