import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';
import { Platform } from 'react-native';

const LOCATION_TASK_NAME = 'background-location-task';

// Define the background task FIRST outside of any function scope
if (Platform.OS !== 'web') {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
      console.error('[BackgroundLocation] Task Error:', error);
      return;
    }
    if (data) {
      const { locations } = data;
      if (locations && locations.length > 0) {
        const loc = locations[0];
        try {
          // SIMPLEST POSSIBLE SYNC: No broadcast, no fallback, just DB insert
          const { data: authData } = await supabase.auth.getUser();
          const user = authData?.user;

          if (user) {
            await supabase.from('employee_locations').upsert({
              user_id: user.id,
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            console.log('[BackgroundLocation] Synced:', loc.coords.latitude, loc.coords.longitude);
          }
        } catch (err) {
          console.error('[BackgroundLocation] Sync failed:', err);
        }
      }
    }
  });
}

export async function startBackgroundLocationTracking() {
  if (Platform.OS === 'web') return false;

  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') return false;

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') return false;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (!isRegistered) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5 * 60 * 1000, // Ping every 5 minutes
      distanceInterval: 0, // CRITICAL: Ping even if stationary
      deferredUpdatesInterval: 5 * 60 * 1000,
      deferredUpdatesDistance: 0,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'Field Tracking Active',
        notificationBody: 'Your live location is being shared with Admins.',
        notificationColor: '#6366f1',
      }
    });
  }
  return true;
}

export async function stopBackgroundLocationTracking() {
  if (Platform.OS === 'web') return;
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
