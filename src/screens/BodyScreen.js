import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Modal, StyleSheet, Alert, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Plus, Camera, Lock, X, Trash2, Columns2 } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, gradients, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import useLoad from '../lib/useLoad';
import { unwrap } from '../lib/query';
import { todayKey, formatMonthYear } from '../lib/date';
import {
  MEASUREMENTS, summarise, toDisplayLength, fromInputLength, formatChange, lengthLabel,
} from '../lib/measurements';
import { pickImage, takePhoto, uploadPrivateImage } from '../lib/upload';
import { useConfirm } from '../components/ConfirmDialog';
import BottomSheet from '../components/BottomSheet';
import Button from '../components/Button';
import Press from '../components/Press';
import FadeIn from '../components/FadeIn';
import AmbientGlow from '../components/AmbientGlow';
import ErrorState from '../components/ErrorState';
import CachedImage from '../components/CachedImage';

/**
 * Measurements and progress photos (roadmap T6).
 *
 * The scale says how much you weigh; this is for what that weight is made of.
 * A tape measure and a photo every few weeks show changes the number hides —
 * the same 80 kg with a smaller waist is a good month.
 *
 * Photos live in a private bucket and are shown through signed URLs that expire
 * after an hour (see 20260917_body_progress.sql). They never touch the feed,
 * the profile or anyone else's screen.
 */

const BUCKET = 'progress_photos';
const POSES = [
  { key: 'front', label: 'Front' },
  { key: 'side', label: 'Side' },
  { key: 'back', label: 'Back' },
];
const EMPTY = { measurements: [], photos: [] };

const shortDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function BodyScreen({ navigation }) {
  const { user, units } = useAuth();
  const confirmAction = useConfirm();
  const { width } = useWindowDimensions();

  const [pose, setPose] = useState('front');
  const [measureOpen, setMeasureOpen] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [comparing, setComparing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return EMPTY;
    const [measurements, photos] = await Promise.all([
      unwrap(supabase.from('body_measurements').select('*').order('measured_on')),
      unwrap(supabase.from('progress_photos').select('*').order('taken_on', { ascending: false }).order('created_at', { ascending: false })),
    ]);

    // One round trip for every URL. An hour is longer than anyone stays on
    // this screen and short enough that a copied link stops working.
    const urls = {};
    if (photos?.length) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(photos.map((p) => p.path), 3600);
      (data || []).forEach((entry) => {
        if (entry?.signedUrl) urls[entry.path] = entry.signedUrl;
      });
    }
    return {
      measurements: measurements || [],
      photos: (photos || []).map((photo) => ({ ...photo, url: urls[photo.path] || null })),
    };
  }, [user]);

  const { data, loading, error, reload, refreshControl } = useLoad(load, EMPTY);
  const summary = useMemo(() => summarise(data.measurements), [data.measurements]);
  const posePhotos = data.photos.filter((photo) => photo.pose === pose);
  const hasMeasurements = summary.some((row) => row.latest !== null);

  // ---- Measurements -------------------------------------------------------

  const openMeasure = () => {
    // Prefilled with the latest figures: most entries change one or two numbers.
    setForm(Object.fromEntries(summary.map((row) => [row.key, row.latest === null ? '' : String(toDisplayLength(row.latest, units))])));
    setMeasureOpen(true);
  };

  const saveMeasurements = async () => {
    if (saving || !user) return;
    const values = Object.fromEntries(MEASUREMENTS.map(({ key }) => [key, fromInputLength(form[key], units)]));
    if (Object.values(values).every((v) => v === null)) {
      setMeasureOpen(false);
      return;
    }

    setSaving(true);
    const { error: saveError } = await supabase
      .from('body_measurements')
      .upsert({ user_id: user.id, measured_on: todayKey(), ...values }, { onConflict: 'user_id,measured_on' });
    setSaving(false);

    if (saveError) {
      // The table's bounds are the likely cause: a waist typed in inches while
      // the app shows centimetres, say.
      Alert.alert('Could not save', 'Check the numbers look right for the unit shown, then try again.');
      return;
    }
    setMeasureOpen(false);
    reload();
  };

  // ---- Photos -------------------------------------------------------------

  const addPhoto = () => {
    Alert.alert('Add a progress photo', `Saved as a ${pose} photo. Only you can see it.`, [
      { text: 'Take photo', onPress: () => uploadFrom(takePhoto) },
      { text: 'Choose from library', onPress: () => uploadFrom(pickImage) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadFrom = async (source) => {
    if (!user || uploading) return;
    try {
      const uri = await source({ aspect: [3, 4] });
      if (!uri) return;
      setUploading(true);
      const path = await uploadPrivateImage({ uri, bucket: BUCKET, path: `${user.id}/${Date.now()}.jpg` });
      const { error: rowError } = await supabase.from('progress_photos').insert({ user_id: user.id, path, pose, taken_on: todayKey() });
      if (rowError) {
        // Do not leave a file nothing points at.
        await supabase.storage.from(BUCKET).remove([path]);
        throw rowError;
      }
      reload();
    } catch (e) {
      Alert.alert('Could not add the photo', e?.message || 'Try again in a moment.');
    } finally {
      setUploading(false);
    }
  };

  const toggleSelect = (photo) => {
    setSelected((current) => {
      if (current.some((p) => p.id === photo.id)) return current.filter((p) => p.id !== photo.id);
      // Two at most: the second tap after two replaces the older choice.
      return [...current, photo].slice(-2);
    });
  };

  const deletePhoto = async (photo) => {
    const ok = await confirmAction({
      tone: 'danger',
      icon: Trash2,
      title: 'Delete this photo?',
      message: 'It is removed from your account for good.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;

    const { error: rowError } = await supabase.from('progress_photos').delete().eq('id', photo.id);
    if (rowError) {
      Alert.alert('Could not delete the photo', 'Try again in a moment.');
      return;
    }
    await supabase.storage.from(BUCKET).remove([photo.path]);
    setSelected((current) => current.filter((p) => p.id !== photo.id));
    reload();
  };

  // Oldest on the left, like a before and after.
  const pair = [...selected].sort((a, b) => String(a.taken_on).localeCompare(String(b.taken_on)) || a.id - b.id);
  const tile = Math.floor((width - spacing.lg * 2 - spacing.md * 2 - 16) / 3);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.screen} style={styles.gradient}>
        <AmbientGlow tone="accent" height={300} intensity={0.25} />

        <View style={styles.nav}>
          <Press scale={0.92} onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Go back">
            <ChevronLeft color={colors.text} size={24} />
          </Press>
          <Text style={styles.navTitle}>Body & photos</Text>
          <View style={styles.back} />
        </View>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
            <FadeIn style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Measurements</Text>
                <Press scale={0.95} onPress={openMeasure} style={styles.headBtn} accessibilityLabel="Log measurements">
                  <Plus color={colors.accent} size={16} />
                  <Text style={styles.headBtnText}>Log</Text>
                </Press>
              </View>

              {hasMeasurements ? (
                summary.map((row) => (
                  <View key={row.key} style={styles.measureRow}>
                    <Text style={styles.measureLabel}>{row.label}</Text>
                    <Text style={styles.measureValue}>
                      {row.latest === null ? '—' : `${toDisplayLength(row.latest, units)} ${lengthLabel(units)}`}
                    </Text>
                    <Text style={styles.measureChange} numberOfLines={1}>
                      {row.change === null ? '' : `${formatChange(row.change, units)} since ${formatMonthYear(row.since) || shortDate(row.since)}`}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.empty}>
                  Nothing measured yet. Once a month is plenty: same time of day, tape snug but not tight.
                </Text>
              )}
            </FadeIn>

            <FadeIn index={1} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Progress photos</Text>
                <Press scale={0.95} onPress={addPhoto} style={styles.headBtn} accessibilityLabel={`Add a ${pose} photo`}>
                  {uploading ? <ActivityIndicator color={colors.accent} size="small" /> : <Camera color={colors.accent} size={16} />}
                  <Text style={styles.headBtnText}>Add</Text>
                </Press>
              </View>

              <View style={styles.privacy}>
                <Lock color={colors.textFaint} size={12} />
                <Text style={styles.privacyText}>Private. Only you can see these.</Text>
              </View>

              <View style={styles.poses}>
                {POSES.map((p) => (
                  <Press
                    key={p.key}
                    scale={0.97}
                    onPress={() => { setPose(p.key); setSelected([]); }}
                    style={[styles.pose, pose === p.key && styles.poseOn]}
                    accessibilityState={{ selected: pose === p.key }}
                  >
                    <Text style={[styles.poseText, pose === p.key && styles.poseTextOn]}>{p.label}</Text>
                  </Press>
                ))}
              </View>

              {posePhotos.length === 0 ? (
                <Text style={styles.empty}>
                  No {pose} photos yet. Same spot, same light, every few weeks makes the comparison fair.
                </Text>
              ) : (
                <>
                  <Text style={styles.hint}>Tap two photos to compare them. Hold one to delete it.</Text>
                  <View style={styles.grid}>
                    {posePhotos.map((photo) => {
                      const picked = selected.some((p) => p.id === photo.id);
                      return (
                        <Press
                          key={photo.id}
                          scale={0.97}
                          onPress={() => toggleSelect(photo)}
                          onLongPress={() => deletePhoto(photo)}
                          style={[styles.tile, { width: tile, height: Math.round(tile * 4 / 3) }, picked && styles.tileOn]}
                          accessibilityLabel={`${pose} photo from ${shortDate(photo.taken_on)}${picked ? ', selected' : ''}`}
                        >
                          {photo.url ? (
                            <CachedImage source={{ uri: photo.url }} style={styles.tileImage} recyclingKey={photo.path} />
                          ) : (
                            <View style={styles.tileMissing} />
                          )}
                          <View style={styles.tileDate}>
                            <Text style={styles.tileDateText}>{shortDate(photo.taken_on)}</Text>
                          </View>
                        </Press>
                      );
                    })}
                  </View>
                </>
              )}

              {selected.length === 2 ? (
                <Button
                  label="Compare"
                  icon={<Columns2 color={colors.onAccent} size={18} />}
                  onPress={() => setComparing(true)}
                  style={{ marginTop: spacing.md }}
                />
              ) : null}
            </FadeIn>
          </ScrollView>
        )}

        <BottomSheet visible={measureOpen} onClose={() => setMeasureOpen(false)} title="Today's measurements">
          {MEASUREMENTS.map(({ key, label }) => (
            <View key={key} style={styles.inputRow}>
              <Text style={styles.inputLabel}>{label}</Text>
              <TextInput
                value={form[key] ?? ''}
                onChangeText={(text) => setForm((f) => ({ ...f, [key]: text }))}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                accessibilityLabel={`${label} in ${lengthLabel(units)}`}
              />
              <Text style={styles.inputUnit}>{lengthLabel(units)}</Text>
            </View>
          ))}
          <Text style={styles.sheetNote}>Leave a field empty to skip it. Saving again today replaces today's entry.</Text>
          <Button label="Save" onPress={saveMeasurements} loading={saving} />
        </BottomSheet>

        <Modal visible={comparing} animationType="fade" onRequestClose={() => setComparing(false)}>
          <View style={styles.compare}>
            <Press scale={0.9} onPress={() => setComparing(false)} style={styles.compareClose} accessibilityLabel="Close comparison">
              <X color={colors.text} size={24} />
            </Press>
            <View style={styles.compareRow}>
              {pair.map((photo, i) => (
                <View key={photo.id} style={styles.compareSide}>
                  <Text style={styles.compareLabel}>{i === 0 ? 'Before' : 'After'}</Text>
                  {photo.url ? <CachedImage source={{ uri: photo.url }} style={styles.compareImage} resizeMode="cover" recyclingKey={photo.path} /> : null}
                  <Text style={styles.compareDate}>{shortDate(photo.taken_on)}</Text>
                </View>
              ))}
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradient: { flex: 1 },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
  },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 60 },

  card: { backgroundColor: colors.card, borderRadius: 24, padding: spacing.md, marginBottom: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  headBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.accentSoft,
  },
  headBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 13, lineHeight: 19, paddingVertical: spacing.sm },

  measureRow: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border },
  measureLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', width: 64 },
  measureValue: { color: colors.text, fontSize: 16, fontWeight: '800', width: 90, fontVariant: ['tabular-nums'] },
  measureChange: { flex: 1, color: colors.textMuted, fontSize: 12, textAlign: 'right', fontVariant: ['tabular-nums'] },

  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  privacyText: { color: colors.textFaint, fontSize: 12 },
  poses: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 3, marginBottom: spacing.sm },
  pose: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  poseOn: { backgroundColor: colors.surfaceHigh },
  poseText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  poseTextOn: { color: colors.text },
  hint: { color: colors.textFaint, fontSize: 12, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surfaceHigh, borderWidth: 2, borderColor: 'transparent' },
  tileOn: { borderColor: colors.accent },
  tileImage: { width: '100%', height: '100%' },
  tileMissing: { flex: 1, backgroundColor: colors.surfaceHigh },
  tileDate: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 3, backgroundColor: 'rgba(14, 16, 23, 0.6)' },
  tileDateText: { color: colors.text, fontSize: 10, fontWeight: '700', textAlign: 'center' },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  inputLabel: { color: colors.textSecondary, fontSize: 15, fontWeight: '600', width: 64 },
  input: {
    flex: 1, backgroundColor: colors.surfaceHigh, color: colors.text, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '600', textAlign: 'right',
  },
  inputUnit: { color: colors.textMuted, fontSize: 14, width: 24 },
  sheetNote: { color: colors.textFaint, fontSize: 12, lineHeight: 17, marginVertical: spacing.sm },

  compare: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', paddingHorizontal: spacing.md },
  compareClose: {
    position: 'absolute', top: 60, right: 20, width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  compareRow: { flexDirection: 'row', gap: 10 },
  compareSide: { flex: 1, alignItems: 'center' },
  compareLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  compareImage: { width: '100%', aspectRatio: 3 / 4, borderRadius: 16, backgroundColor: colors.surfaceHigh },
  compareDate: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 8 },
});
