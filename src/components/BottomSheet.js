import { Modal, View, Text, StyleSheet, Pressable, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { colors } from '../theme';
import common from '../styles/common';

/**
 * Bottom sheet modal with a title row and a close button.
 *
 * The Modal + dimmed overlay + header + X pattern was written out by hand eight
 * times across FriendsScreen, DashboardScreen, ScannerScreen and
 * WorkoutDetailScreen, each with slightly different padding and corner radii.
 *
 * The backdrop is a sibling behind the sheet, not its parent. It used to be a
 * TouchableOpacity wrapping a second one around the sheet — and a touchable is
 * an accessibility element, so VoiceOver merged the entire sheet into a single
 * control that read out every row at once and could not activate any of them.
 * A plain View around the content leaves each row its own element; taps inside
 * the sheet never reach the backdrop because it sits below it, not around it.
 */
export default function BottomSheet({ visible, onClose, title, children, avoidKeyboard = true }) {
  const body = (
    <View style={common.sheetOverlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Close"
        accessibilityRole="button"
      />
      <View style={common.sheet}>
        {title ? (
          <View style={common.modalHeader}>
            <Text style={common.modalTitle}>{title}</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X color={colors.textMuted} size={24} />
            </TouchableOpacity>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </Modal>
  );
}
