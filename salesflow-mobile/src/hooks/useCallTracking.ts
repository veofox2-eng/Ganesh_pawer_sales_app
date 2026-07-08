import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus, Linking, NativeModules, Platform, Alert } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { supabase } from '../lib/supabase';
const { CallRecordingModule } = NativeModules;

export interface PendingCall {
  clientId: string;
  clientName: string;
  phone: string;
  startTime: number;
}

export function useCallTracking(onReturnFromCall: (call: PendingCall) => void) {
  const [pendingCall, setPendingCall] = useState<PendingCall | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [pendingCall, onReturnFromCall]);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && pendingCall) {
      // Small delay to ensure the UI is ready
      setTimeout(() => {
        onReturnFromCall(pendingCall);
        
        // Stop Native Recording — the service will fire a broadcast when done,
        // which useCallRecorder picks up immediately. No need to also call
        // syncPendingRecordings() here, as that would create a duplicate timeline entry.
        if (CallRecordingModule) {
          CallRecordingModule.stopRecording();
          // Clear the stored client context so personal calls made later
          // are not incorrectly saved under this client's timeline.
          if (CallRecordingModule.clearActiveContext) {
            setTimeout(() => CallRecordingModule.clearActiveContext(), 2000);
          }
        }

        setPendingCall(null);
      }, 500);
    }
  }, [pendingCall, onReturnFromCall]);

  const startCall = async (clientId: string, clientName: string, phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) return;

    if (Platform.OS === 'android') {
      const { PermissionsAndroid } = require('react-native');
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        ]);
        
        if (
          granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED ||
          granted[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] !== PermissionsAndroid.RESULTS.GRANTED ||
          granted[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG] !== PermissionsAndroid.RESULTS.GRANTED
        ) {
          Alert.alert(
            'Permissions Required',
            'You must grant Microphone and Phone permissions for the CRM to record calls successfully.'
          );
          // We can proceed with the call, but recording might fail
        }
      } catch (err) {
        console.warn('Failed to request permissions', err);
      }
    }

    if (CallRecordingModule) {
      const isAccessibilityActive = await CallRecordingModule.checkAccessibilityEnabled();
      if (!isAccessibilityActive && Platform.OS === 'android') {
        Alert.alert(
          'Call Recording Required',
          'To record calls properly, you must enable the "SalesFlow Accessibility Service" in your phone settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                try {
                  IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.ACCESSIBILITY_SETTINGS);
                } catch (e) {
                  console.warn('Could not open accessibility settings', e);
                }
              }
            }
          ]
        );
        return; // Block call until enabled
      }
    }

    // Log the call in interactions immediately
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('interactions').insert({
      client_id: clientId || null,
      user_id: user?.id,
      type: 'CALL_MADE',
      content: `Started call to ${clientName}`,
      author: 'You',
    });

    setPendingCall({
      clientId,
      clientName,
      phone,
      startTime: Date.now(),
    });

    // Start Native Recording proactively to avoid relying solely on the broadcast receiver
    if (CallRecordingModule) {
      CallRecordingModule.startRecording(phone, clientId);
    }

    // Delay the dialer slightly so MediaRecorder can lock the microphone first
    setTimeout(async () => {
      try {
        await Linking.openURL(`tel:${cleanPhone}`);
      } catch (err) {
        Alert.alert('Error', 'Could not start call.');
      }
    }, 800);
  };

  return { startCall, pendingCall };
}
