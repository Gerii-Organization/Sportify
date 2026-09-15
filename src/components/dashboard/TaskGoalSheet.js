import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';
import BottomSheet from '../BottomSheet';
import Button from '../Button';

/**
 * Adding a daily quest: a custom task by name, or a gym / water goal by number.
 *
 * Lifted out of DashboardScreen (roadmap Q4), where it was a hand-built modal
 * with nine styles of its own; it is a BottomSheet now, like every other sheet
 * in the app, and the screen keeps only the state and the save.
 */
const TITLES = { gym: 'Set gym goal', water: 'Set water goal', manual: 'New custom task' };
const PLACEHOLDERS = { gym: 'Goal: 45 min', water: 'Goal: 2.5 liters' };

export default function TaskGoalSheet({ visible, type = 'manual', title, goal, onChangeTitle, onChangeGoal, onSave, onClose }) {
  const isGoal = type === 'gym' || type === 'water';

  return (
    <BottomSheet visible={visible} onClose={onClose} title={TITLES[type] || TITLES.manual}>
      <View style={styles.body}>
        {isGoal ? (
          <TextInput
            style={styles.input}
            placeholder={PLACEHOLDERS[type]}
            placeholderTextColor={colors.textFaint}
            keyboardType="numeric"
            value={goal}
            onChangeText={(text) => onChangeGoal(text.replace(/[^0-9.]/g, ''))}
            autoFocus
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="E.g. Morning yoga"
            placeholderTextColor={colors.textFaint}
            value={title}
            onChangeText={onChangeTitle}
            autoFocus
          />
        )}
        <Button label={isGoal ? 'Save goal' : 'Add task'} onPress={() => onSave(type)} />
        <Text style={styles.note}>
          {isGoal ? 'Tracked automatically from your workouts and water log.' : 'Tick it off yourself each day.'}
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, paddingBottom: spacing.lg },
  input: {
    backgroundColor: colors.surfaceHigh, color: colors.text, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
  },
  note: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
});
