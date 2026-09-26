/**
 * Captures a rendered view as a PNG and opens the system share sheet with it.
 *
 * Both native modules are required on first use rather than imported at the
 * top of a file. `expo-sharing` looks its native module up the moment it is
 * imported, so a JS bundle running on a binary built before the module was
 * added would crash whatever screen imported it — here that would be the end
 * of a workout. Loaded lazily, the same situation becomes a message.
 *
 * Resolves `{ ok: true }`, or `{ ok: false, reason }` where reason is
 * 'unavailable' (not in this build, or no share target), 'not_ready' (the view
 * has not laid out yet) or 'failed'. Dismissing the share sheet is not a
 * failure.
 */
/**
 * Captures a rendered view to a temporary PNG without sharing it, for sending
 * the same picture somewhere inside the app (a chat). Resolves
 * `{ ok: true, uri }` or `{ ok: false, reason }` with the reasons above.
 */
export async function captureViewToFile(ref, { width, height } = {}) {
  let captureRef;
  try {
    ({ captureRef } = require('react-native-view-shot'));
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (!ref?.current) return { ok: false, reason: 'not_ready' };

  try {
    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      ...(width && height ? { width, height } : null),
    });
    return { ok: true, uri };
  } catch (error) {
    const message = error?.message || '';
    if (/null|undefined|not.*(linked|available)/i.test(message)) {
      return { ok: false, reason: 'unavailable' };
    }
    return { ok: false, reason: 'failed', message };
  }
}

export async function shareViewAsImage(ref, { dialogTitle = 'Share', width, height } = {}) {
  let captureRef;
  let Sharing;

  try {
    ({ captureRef } = require('react-native-view-shot'));
    Sharing = require('expo-sharing');
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (!ref?.current) return { ok: false, reason: 'not_ready' };

  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'unavailable' };

    // A temp file rather than base64: Instagram and Photos both want a file,
    // and a story-sized PNG as a data string is several megabytes of JS memory.
    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      ...(width && height ? { width, height } : null),
    });

    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle });
    return { ok: true };
  } catch (error) {
    // The native side reports a missing module as an ordinary error once the
    // JS import has succeeded, so it lands here rather than in the first catch.
    const message = error?.message || '';
    if (/null|undefined|not.*(linked|available)/i.test(message)) {
      return { ok: false, reason: 'unavailable' };
    }
    return { ok: false, reason: 'failed', message };
  }
}
