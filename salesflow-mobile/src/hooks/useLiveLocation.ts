import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Alert } from 'react-native';

export function useLiveLocation() {
  const { session, profile } = useAuth();
  const [watcher, setWatcher] = useState<Location.LocationSubscription | null>(null);

  useEffect(() => {
    // Only run this for Field employees when logged in
    if (!session?.user || profile?.role !== 'Field') {
      if (watcher) {
        watcher.remove();
        setWatcher(null);
      }
      return;
    }

    let isSubscribed = true;
    let subscription: Location.LocationSubscription | null = null;

    async function startLiveTracking() {
      try {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          Alert.alert('Permission Denied', 'Foreground location permission is required for Field Tracking.');
          return;
        }

        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          console.warn('[LiveLocation] Background permission not granted.');
        }

        // Start high-accuracy foreground watcher every 5 seconds
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 5000 },
          async (loc) => {
            if (!loc?.coords || !isSubscribed) return;
            
            try {
              const { error } = await supabase.from('employee_locations').insert({
                user_id: session.user.id,
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                updated_at: new Date().toISOString()
              });
              if (error) console.error('[LiveLocation] Supabase insert error:', error.message);
            } catch (err) {
              console.error('[LiveLocation] Failed to sync location to DB:', err);
            }
          }
        );

        if (isSubscribed) {
          setWatcher(subscription);
          console.log('[LiveLocation] Started global foreground location watcher for Field employee.');
        } else {
          subscription.remove();
        }
      } catch (err) {
        console.error('[LiveLocation] Error starting watcher:', err);
      }
    }

    startLiveTracking();

    return () => {
      isSubscribed = false;
      if (subscription) {
        subscription.remove();
      }
    };
  }, [session?.user?.id, profile?.role]);
}
