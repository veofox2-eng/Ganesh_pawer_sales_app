import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';
import { Platform } from 'react-native';

const LOCATION_TASK_NAME = 'background-location-task';

// Define the background task FIRST outside of any function scope
if (Platform.OS !== 'web') {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
      console.error('Background Location Error:', error);
      return;
    }
    if (data) {
      const { locations } = data;
      if (locations && locations.length > 0) {
        const loc = locations[0];
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Upsert or insert location to Supabase
          await supabase.from('employee_locations').insert({
            user_id: user.id,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            updated_at: new Date().toISOString()
          });
          console.log('Background location synced:', loc.coords.latitude, loc.coords.longitude);
        } catch (err) {
          console.error('Failed to sync background location', err);
        }
      }
    }
  });
}

export async function startBackgroundLocationTracking() {
  if (Platform.OS === 'web') {
    console.log('Background location tracking is not supported on web.');
    return false;
  }
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    return false;
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') {
    return false;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (!isRegistered) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5 * 60 * 1000, // Update every 5 minutes
      distanceInterval: 100, // Or every 100 meters
      deferredUpdatesInterval: 5 * 60 * 1000,
      deferredUpdatesDistance: 100,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Field Tracking Active',
        notificationBody: 'Your location is being shared for team coordination.',
        notificationColor: '#f59e0b',
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
