import { Share } from 'react-native';
import { supabase } from './supabase';

/**
 * Hands the signed-in user a copy of their data (GDPR article 20).
 *
 * The server assembles it — export_my_data() in 20260917_export_my_data.sql —
 * because only the server can see every table the account touches; the app's
 * own queries are limited by row-level security to the parts it displays.
 *
 * It leaves the phone through the system share sheet as JSON text, which is
 * "structured, commonly used and machine-readable" and needs no file access:
 * save it to Files, mail it, or AirDrop it. Writing a .json file first would
 * need expo-file-system, which this build does not include.
 *
 * Resolves `{ ok: true }` once the share sheet has closed — closing it without
 * picking anywhere to send the file is the user's choice, not a failure — or
 * `{ ok: false, reason }` with 'not_signed_in' or 'failed'.
 */
export async function exportMyData() {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) return { ok: false, reason: 'failed', message: error.message };
  if (!data?.ok) return { ok: false, reason: data?.reason || 'failed' };

  const { ok: _ok, ...document } = data;
  const json = JSON.stringify(document, null, 2);

  await Share.share(
    { title: 'Sportify data export', message: json },
    { subject: 'My Sportify data', dialogTitle: 'Export your data' }
  );
  return { ok: true, bytes: json.length };
}
