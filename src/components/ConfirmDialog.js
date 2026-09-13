import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors } from '../theme';
import { ENTER_SPRING } from '../lib/motion';
import Press from './Press';

/**
 * The app's own confirmation dialog, in place of the system Alert.
 *
 *   const confirmAction = useConfirm();
 *   const ok = await confirmAction({
 *     tone: 'danger', icon: Trash2,
 *     title: 'Delete "Leg Day"?', message: '…', confirmLabel: 'Delete',
 *   });
 *
 * Promise-shaped so a call site reads top to bottom — ask, then act — instead
 * of burying the action in an onPress three levels into an Alert button array.
 *
 * One dialog for the whole app, mounted beside the navigator. A second question
 * asked straight from the answer to the first (delete account asks twice)
 * swaps the content of the dialog already on screen rather than dismissing one
 * Modal and presenting another, which iOS will not do at the same moment.
 */

const ConfirmContext = createContext(null);

const TONES = {
  danger: {
    tint: colors.danger,
    soft: 'rgba(255, 180, 171, 0.14)',
    fill: colors.danger,
    onFill: '#2A0E0C',
  },
  accent: {
    tint: colors.accent,
    soft: colors.accentSoft,
    fill: colors.accent,
    onFill: colors.onAccent,
  },
};

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const pending = useRef(null);
  const nextId = useRef(0);
  // What the dialog last showed, kept through the fade-out so the card does
  // not vanish a frame before the backdrop does.
  const lastShown = useRef(null);
  if (request) lastShown.current = request;

  const confirmAction = useCallback((options) => new Promise((resolve) => {
    // A new question while one is open answers the old one with "no" rather
    // than leaving its caller waiting forever.
    pending.current?.resolve(false);
    nextId.current += 1;
    const id = nextId.current;
    pending.current = { id, resolve };
    setRequest({ ...options, id });
  }), []);

  const answer = useCallback((value) => {
    const current = pending.current;
    if (!current) return;
    pending.current = null;
    current.resolve(value);

    // Closed on the next tick, and only if nothing replaced it in the meantime.
    setTimeout(() => {
      setRequest((shown) => (shown?.id === current.id ? null : shown));
    }, 0);
  }, []);

  const shown = request || lastShown.current;

  return (
    <ConfirmContext.Provider value={confirmAction}>
      {children}
      <Modal
        visible={!!request}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => answer(false)}
      >
        {shown ? <Dialog key={shown.id} request={shown} onAnswer={answer} /> : null}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext) || alertConfirm;
}

/** Outside the provider (a test render, a crash screen) the system dialog still works. */
function alertConfirm({ title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', tone }) {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: tone === 'danger' ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

function Dialog({ request, onAnswer }) {
  const tone = TONES[request.tone] || TONES.accent;
  const Icon = request.icon;
  const pop = useSharedValue(0);

  useEffect(() => {
    pop.value = withSpring(1, ENTER_SPRING);
  }, [pop]);

  const card = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.94 + pop.value * 0.06 }, { translateY: (1 - pop.value) * 14 }],
  }));

  return (
    <View style={styles.backdrop}>
      {/* Tapping outside is "no". Destructive actions never happen by accident. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => onAnswer(false)} accessibilityLabel="Dismiss" />

      <Animated.View style={[styles.card, card]} accessibilityViewIsModal>
        {Icon ? (
          <View style={[styles.disc, { backgroundColor: tone.soft }]}>
            <Icon color={tone.tint} size={24} />
          </View>
        ) : null}

        <Text style={styles.title}>{request.title}</Text>
        {request.message ? <Text style={styles.message}>{request.message}</Text> : null}

        <View style={styles.actions}>
          <Press
            scale={0.97}
            style={[styles.button, styles.cancel]}
            onPress={() => onAnswer(false)}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText} numberOfLines={1}>{request.cancelLabel || 'Cancel'}</Text>
          </Press>
          <Press
            scale={0.97}
            style={[styles.button, { backgroundColor: tone.fill }]}
            onPress={() => onAnswer(true)}
            accessibilityRole="button"
          >
            <Text style={[styles.confirmText, { color: tone.onFill }]} numberOfLines={1} adjustsFontSizeToFit>
              {request.confirmLabel || 'OK'}
            </Text>
          </Press>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28,
    backgroundColor: 'rgba(6, 7, 12, 0.72)',
  },
  card: {
    width: '100%', maxWidth: 360, alignItems: 'center',
    backgroundColor: colors.sheet, borderWidth: 1, borderColor: colors.border,
    borderRadius: 28, paddingTop: 26, paddingHorizontal: 22, paddingBottom: 20,
    shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  disc: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: colors.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  message: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22, alignSelf: 'stretch' },
  button: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  cancel: { backgroundColor: colors.surfaceRaised },
  cancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  confirmText: { fontSize: 15, fontWeight: '800' },
});
