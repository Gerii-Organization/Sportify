import { useEffect, useState } from 'react';
import { getSetting, setSetting } from './settings';
import { REST_CHOICES } from './rest';

/**
 * The four preferences stored on the device rather than the account: rest
 * alerts, rest length, and the two evening reminders.
 *
 * Lifted out of DashboardScreen, which owned them only because the settings
 * drawer happens to open from there (roadmap Q4). The rest timer and the
 * reminders read the same keys through lib/settings.
 *
 * `onRemindersChanged` runs after either reminder toggle is saved. Switching
 * one off has to cancel what is already scheduled, or the notification you
 * just declined still arrives this evening.
 */
export default function useDeviceSettings({ onRemindersChanged } = {}) {
  const [restAlerts, setRestAlerts] = useState(true);
  /** null = follow the training goal. */
  const [restSeconds, setRestSeconds] = useState(null);
  const [streakReminders, setStreakReminders] = useState(true);
  const [waterReminders, setWaterReminders] = useState(false);

  useEffect(() => {
    getSetting('restAlerts').then(setRestAlerts);
    getSetting('restSeconds').then(setRestSeconds);
    getSetting('streakReminders').then(setStreakReminders);
    getSetting('waterReminders').then(setWaterReminders);
  }, []);

  const toggleRestAlerts = async () => {
    const next = !restAlerts;
    setRestAlerts(next);
    await setSetting('restAlerts', next);
  };

  /** Steps through the offered lengths and wraps back to Automatic. */
  const cycleRestLength = async () => {
    const index = REST_CHOICES.findIndex((c) => c === restSeconds);
    const next = REST_CHOICES[(index + 1) % REST_CHOICES.length];
    setRestSeconds(next);
    await setSetting('restSeconds', next);
  };

  const toggleStreakReminders = async () => {
    const next = !streakReminders;
    setStreakReminders(next);
    await setSetting('streakReminders', next);
    onRemindersChanged?.();
  };

  const toggleWaterReminders = async () => {
    const next = !waterReminders;
    setWaterReminders(next);
    await setSetting('waterReminders', next);
    onRemindersChanged?.();
  };

  return {
    restAlerts,
    restSeconds,
    streakReminders,
    waterReminders,
    toggleRestAlerts,
    cycleRestLength,
    toggleStreakReminders,
    toggleWaterReminders,
  };
}
