import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { NativeModules, Platform } from 'react-native';

import App from './App';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error, executionContext }) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    // If we receive a notification while closed, wake up the app
    if (Platform.OS === 'android') {
      NativeModules.CallRecordingModule?.launchApp?.();
    }
  }
});

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(() => {});

registerRootComponent(App);
