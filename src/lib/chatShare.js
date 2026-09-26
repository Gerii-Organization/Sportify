import { supabase } from './supabase';
import { uploadPickedImage } from './upload';

/**
 * Sending a finished workout's card to a friend's chat.
 *
 * The card is uploaded once and the same URL goes to everyone it is sent to,
 * so sending it to three friends is one upload and three rows. It lands in
 * `chat_images` under your own folder, where ChatScreen already keeps photos,
 * and shows in the chat like any photo you sent.
 */

/** Uploads a captured card. Resolves to its URL, or throws. */
export async function uploadShareCard(uri, userId) {
  return uploadPickedImage({
    uri,
    bucket: 'chat_images',
    pathPrefix: `${userId}/workout-${Date.now()}`,
    // A story card is 9:16, so 1080 wide is the full 1080 × 1920.
    maxWidth: 1080,
  });
}

/** One chat message with an image and a line of text. Throws on failure. */
export async function sendImageMessage({ from, to, imageUrl, text }) {
  const { error } = await supabase.from('messages').insert([{
    sender_id: from,
    receiver_id: to,
    content: text || '',
    image_url: imageUrl,
  }]);
  if (error) throw error;
}
