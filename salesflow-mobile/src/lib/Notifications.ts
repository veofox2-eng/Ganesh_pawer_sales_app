import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Behavior for local execution when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (Platform.OS === 'android') {
    try {
      await Notifications.deleteNotificationChannelAsync('reminders');
      await Notifications.deleteNotificationChannelAsync('reminders_v2');
    } catch (e) {}
    await Notifications.setNotificationChannelAsync('reminders_v3', {
      name: 'Follow-up Alarms',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lightColor: '#FF231F7C',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
      sound: 'alarm_sound.mp3',
    });
  }

  // Register notification categories for actionable notifications
  await Notifications.setNotificationCategoryAsync('REMINDER_ACTIONS', [
    {
      identifier: 'SNOOZE',
      buttonTitle: 'Snooze (15m)',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'CALL_CLIENT',
      buttonTitle: '📞 Call Now',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'WHATSAPP_CLIENT',
      buttonTitle: '💬 WhatsApp',
      options: { opensAppToForeground: false },
    }
  ]);

  return finalStatus === 'granted';
}

export async function scheduleClientReminder(title: string, body: string, date: Date, data?: any) {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  try {
    let finalBody = body;
    const cId = data?.clientId || data?.client_id || '';
    if (data && data.phone) {
      finalBody = `${body} [Ref: ${data.phone}${cId ? '|' + cId : ''}]`;
    }

    let notifId = undefined;
    if (cId) {
      notifId = `client_${cId}`;
    } else if (data && data.taskId) {
      notifId = `task_${data.taskId}`;
    }

    // Cancel any previous notification with this identifier explicitly first
    if (notifId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notifId);
      } catch (e) {
        console.log('[scheduleClientReminder] Cancel old reminder log:', e);
      }
    }

    // Prevent scheduling if the date is in the past
    // If it's less than Date.now(), it will fire immediately which is annoying.
    if (date.getTime() <= Date.now()) {
      console.log('[scheduleClientReminder] Skipped because date is in the past:', date);
      return null;
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: notifId,
      content: {
        title,
        body: finalBody,
        sound: 'alarm_sound',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 500, 500, 500],
        data: data || {},
        categoryIdentifier: 'REMINDER_ACTIONS',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: date,
        channelId: 'reminders_v3',
      },
    });
    return identifier;
  } catch (error) {
    console.error('Failed to schedule notification:', error);
    return null;
  }
}

export async function cancelNotification(identifier: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error('Failed to cancel notification:', error);
  }
}

export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Failed to cancel all notifications:', error);
  }
}
