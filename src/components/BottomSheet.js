import { Modal, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
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
 * Tapping the backdrop closes the sheet; taps inside it do not bubble.
 */
export default function BottomSheet({ visible, onClose, title, children, avoidKeyboard = true }) {
  const body = (
    <TouchableOpacity style={common.sheetOverlay} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity activeOpacity={1} style={common.sheet} onPress={(e) => e.stopPropagation()}>
        {title ? (
          <View style={common.modalHeader}>
            <Text style={common.modalTitle}>{title}</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X color={colors.textMuted} size={24} />
            </TouchableOpacity>
          </View>
        ) : null}
        {children}
      </TouchableOpacity>
    </TouchableOpacity>
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
