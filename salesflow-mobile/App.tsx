import 'react-native-gesture-handler';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Linking, Text, TouchableOpacity, Modal, Vibration, StyleSheet, NativeModules, Platform, AppState, ActivityIndicator, ScrollView, KeyboardAvoidingView, Dimensions, StatusBar as RNStatusBar, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SidebarProvider } from './src/context/SidebarContext';
import RootNavigator from './src/navigation/RootNavigator';
import { useCallRecorder } from './src/hooks/useCallRecorder';
import { Audio } from 'expo-av';

// Keep the splash screen visible while we fetch resources natively
SplashScreen.preventAutoHideAsync().catch(() => { });

import { requestNotificationPermissions, scheduleClientReminder } from './src/lib/Notifications';
import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import PremiumDateTimePicker from './src/components/PremiumDateTimePicker';
import { supabase } from './src/lib/supabase';
import { format } from 'date-fns';
import CallFeedbackModal from './src/components/CallFeedbackModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data && Platform.OS === 'android') {
    try {
      NativeModules.CallRecordingModule?.launchApp?.();
    } catch (e) {
      console.warn('Background launch failed', e);
    }
  }
});

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
class ErrorBoundary extends React.Component<any, { hasError: boolean, error: Error | null, info: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    this.setState({ info });
    console.error('Fatal Error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 20 }}>
          <Text style={{ fontSize: 22, color: 'red', fontWeight: 'bold', marginBottom: 10 }}>App Crashed</Text>
          <Text style={{ fontSize: 14, color: '#333', marginBottom: 20 }}>Please screenshot this and send it to the developer:</Text>
          <ScrollView style={{ width: '100%', backgroundColor: '#f5f5f5', padding: 10, borderRadius: 8 }}>
            <Text style={{ color: 'red', fontWeight: 'bold' }}>{this.state.error?.toString()}</Text>
            <Text style={{ color: '#555', marginTop: 10, fontSize: 11 }}>{this.state.info?.componentStack}</Text>
          </ScrollView>
          <TouchableOpacity 
            style={{ marginTop: 20, padding: 15, backgroundColor: '#6366f1', borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: null, info: null })}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}


// ── Alarm Modal Component ───────────────────────────────────────────────────
interface AlarmData {
  title: string;
  body: string;
  phone?: string;
  clientId?: string;
  taskId?: string;
  notifId?: string;
  rawData?: any;
}

/**
 * Global Alarm Modal
 * Appears over any screen when a reminder fires.
 * Mandatory action required: Reschedule, Call, or WhatsApp.
 */
function AlarmModal({
  alarm,
  onDismiss,
  onStartCall,
}: {
  alarm: AlarmData;
  onDismiss: () => void;
  onStartCall: (clientId: string, clientName: string, phone: string) => void;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [phone, setPhone] = useState(alarm.phone || '');
  const [title, setTitle] = useState(alarm.title);
  const [isVerified, setIsVerified] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const hasLoggedPoppedRef = useRef(false);

  useEffect(() => {
    let cId = alarm.clientId || alarm.rawData?.clientId || alarm.rawData?.client_id;
    let phoneVal = alarm.phone || '';
    const resolvedTitle = title || alarm.title || '';
    const resolvedBody = alarm.body || '';

    // Decouple Ref tag from title/body if present
    const refMatch = (resolvedBody || resolvedTitle).match(/\[Ref:\s*([^\]]+)\]/);
    if (refMatch && refMatch[1]) {
      const parts = refMatch[1].split('|');
      if (parts[0] && !phoneVal) phoneVal = parts[0];
      if (parts[1] && !cId) cId = parts[1];
    }

    if (phoneVal) setPhone(phoneVal);

    const performSelfHealing = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        let resolvedClient: { id: string; name: string; phone: string } | null = null;

        if (cId) {
          // 1. Resolve by ID
          const { data } = await supabase.from('clients').select('id, name, phone, is_deleted').eq('id', cId).maybeSingle();
          if (data && !data.is_deleted) resolvedClient = data;
        }

        if (!resolvedClient) {
          // 2. Fallback: Smart first-name case-insensitive substring search across all active follow-up clients
          const { data: clients } = await supabase.from('clients')
            .select('id, name, phone, is_deleted')
            .eq('status', 'Follow-up')
            .eq('user_id', authUser.id);

          if (clients) {
            const matched = clients.find(c => {
              if (c.is_deleted) return false;
              const firstWord = c.name.split(' ')[0].trim().toLowerCase();
              return firstWord.length > 2 && (
                resolvedTitle.toLowerCase().includes(firstWord) ||
                resolvedBody.toLowerCase().includes(firstWord)
              );
            });
            if (matched) resolvedClient = matched;
          }
        }

        if (resolvedClient) {
          if (resolvedClient.phone) {
            setPhone(resolvedClient.phone);
          }
          const updatedTitle = `Follow-up: ${resolvedClient.name}`;
          setTitle(updatedTitle);

          // Log popping to timeline if not logged already
          if (!hasLoggedPoppedRef.current) {
            hasLoggedPoppedRef.current = true;
            await supabase.from('interactions').insert({
              client_id: resolvedClient.id,
              user_id: authUser.id,
              type: 'NOTE_ADDED',
              content: `Alarm Triggered: "${updatedTitle}" popped up on mobile screen.`,
              author: 'System',
            });
          }
          setIsVerified(true);
        } else {
          // AUTO-DISMISS: Client is either deleted or no longer exists in active list
          console.log('[AlarmModal] Auto-dismissing alarm because client is deleted or missing.');
          onDismiss();
        }
      } catch (err) {
        console.warn('[AlarmModal] Self-healing failed:', err);
      }
    };

    performSelfHealing();
  }, [alarm.clientId, alarm.rawData, alarm.title, alarm.body]);

  useEffect(() => {
    if (!isVerified) return;
    async function playAlarm() {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          interruptionModeIOS: 1, // InterruptionModeIOS.DoNotMix
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1, // InterruptionModeAndroid.DoNotMix
          playThroughEarpieceAndroid: false,
        });

        let soundSource;
        try {
          soundSource = require('./assets/alarm_sound.mp3');
        } catch (err) {
          soundSource = { uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' };
        }

        const { sound } = await Audio.Sound.createAsync(
          soundSource,
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        soundRef.current = sound;
      } catch (e) {
        console.warn('Failed to play alarm sound:', e);
      }
    }

    playAlarm();
    Vibration.vibrate([0, 800, 400, 800], true);

    return () => {
      Vibration.cancel();
      if (soundRef.current) {
        soundRef.current.stopAsync();
        soundRef.current.unloadAsync();
      }
    };
  }, [isVerified]);

  const handleCall = () => {
    Vibration.cancel();
    const cId = alarm.clientId || alarm.rawData?.clientId || alarm.rawData?.client_id;
    let cName = 'Client';
    if (title && title.includes('Follow-up: ')) {
      cName = title.replace('Follow-up: ', '');
    } else if (alarm.body && alarm.body.includes('Call ')) {
      const match = alarm.body.match(/Call\s+([A-Za-z0-9_ ]+?)\s+today/);
      if (match && match[1]) {
        cName = match[1];
      }
    }
    if (phone && cId) {
      onStartCall(cId, cName, phone);
    } else if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
    onDismiss();
  };

  const handleWhatsApp = () => {
    Vibration.cancel();
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      Linking.openURL(`whatsapp://send?phone=${finalPhone}`);
    }
    onDismiss();
  };

  const handleSnooze = async () => {
    Vibration.cancel();
    const snoozeDate = new Date();
    snoozeDate.setMinutes(snoozeDate.getMinutes() + 15);
    const cId = alarm.clientId || alarm.rawData?.clientId || alarm.rawData?.client_id;

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (cId) {
        await supabase.from('interactions').insert({
          client_id: cId,
          user_id: authUser?.id || null,
          type: 'NOTE_ADDED',
          content: 'Employee snoozed the reminder for 15 minutes.',
          author: 'System'
        });
      }
    } catch (e) {
      console.warn('[AlarmModal] Failed to log snooze:', e);
    }

    await scheduleClientReminder(
      alarm.title,
      alarm.body,
      snoozeDate,
      { ...alarm.rawData, clientId: cId, phone }
    );
    onDismiss();
  };

  const handleReschedule = async (selectedDateTime: Date) => {
    setIsSaving(true);
    Vibration.cancel();

    const cId = alarm.clientId || alarm.rawData?.clientId || alarm.rawData?.client_id;

    try {
      if (cId) {
        const dateStr = format(selectedDateTime, 'PPp');
        await supabase.from('clients').update({ reminder_date: selectedDateTime.toISOString() }).eq('id', cId);
        await supabase.from('interactions').insert({
          client_id: cId,
          type: 'NOTE_ADDED',
          content: `Follow-up rescheduled via alarm to ${dateStr}`,
          author: 'System'
        });
      } else if (alarm.taskId) {
        await supabase.from('tasks').update({ due_date: selectedDateTime.toISOString() }).eq('id', alarm.taskId);
      }

      await scheduleClientReminder(
        alarm.title,
        alarm.body,
        selectedDateTime,
        { ...alarm.rawData, clientId: cId, phone }
      );
    } catch (e) {
      console.error('[AlarmModal] Failed to update follow-up reschedule:', e);
    }
    setIsSaving(false);
    onDismiss();
  };

  if (!isVerified) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { }}>
      <View style={alarmStyles.overlay}>
        <View style={alarmStyles.card}>
          <View style={alarmStyles.pulseRow}>
            <View style={alarmStyles.pulseDot} />
            <Text style={alarmStyles.liveText}>REMINDER</Text>
          </View>

          <Text style={alarmStyles.time}>
            {new Date().getHours()}:{new Date().getMinutes().toString().padStart(2, '0')}
          </Text>
          <Text style={alarmStyles.title} numberOfLines={2}>
            {(title || 'Follow-up Reminder').replace(/\[Ref:\s*[^\]]+\]/, '').trim()}
          </Text>
          <Text style={alarmStyles.body} numberOfLines={3}>
            {(alarm.body || '').replace(/\[Ref:\s*[^\]]+\]/, '').replace('Follow-up Reminder', '').trim() ||
              (title && title.includes('Follow-up: ') ? `Call ${title.replace('Follow-up: ', '')} today as scheduled.` : 'Time for follow-up reminder!')}
          </Text>

          {phone ? (
            <View style={alarmStyles.actionRow}>
              <TouchableOpacity style={[alarmStyles.actionBtn, alarmStyles.callBtn]} onPress={handleCall}>
                <Text style={alarmStyles.actionBtnText}>📞 Call Now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[alarmStyles.actionBtn, alarmStyles.waBtn]} onPress={handleWhatsApp}>
                <Text style={alarmStyles.actionBtnText}>💬 WhatsApp</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity style={alarmStyles.snoozeBtn} onPress={handleSnooze}>
            <Text style={alarmStyles.snoozeBtnText}>⏰ Snooze 15 minutes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={alarmStyles.dismissBtn}
            onPress={() => setShowDatePicker(true)}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#666" size="small" />
            ) : (
              <Text style={alarmStyles.dismissBtnText}>Reschedule & Dismiss</Text>
            )}
          </TouchableOpacity>

          <PremiumDateTimePicker
            visible={showDatePicker}
            value={rescheduleDate}
            minimumDate={new Date()}
            onClose={() => setShowDatePicker(false)}
            onChange={(date) => {
              setRescheduleDate(date);
              handleReschedule(date);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const alarmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: '#6C63FF40',
    alignItems: 'center',
  },
  pulseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  pulseDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#FF4444',
    marginRight: 8,
  },
  liveText: {
    fontSize: 11, fontWeight: '800', letterSpacing: 2,
    color: '#FF4444',
  },
  time: {
    fontSize: 48, fontWeight: '800', color: '#FFFFFF',
    letterSpacing: -1, marginBottom: 8,
  },
  title: {
    fontSize: 20, fontWeight: '700', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 8,
  },
  body: {
    fontSize: 14, color: '#A0A0C0',
    textAlign: 'center', marginBottom: 28, lineHeight: 20,
  },
  actionRow: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 12 },
  actionBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  callBtn: { backgroundColor: '#22C55E' },
  waBtn: { backgroundColor: '#25D366' },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  snoozeBtn: {
    width: '100%', paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#6C63FF',
    alignItems: 'center', marginBottom: 10,
  },
  snoozeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  dismissBtn: {
    width: '100%', paddingVertical: 12,
    alignItems: 'center',
  },
  dismissBtnText: { color: '#666', fontWeight: '500', fontSize: 13 },
});

// ── App Inner ────────────────────────────────────────────────────────────────
function AppInner({ onLayout, appConfig: initialAppConfig }: { onLayout: () => void, appConfig: any }) {
  const { colors } = useTheme();
  const { user, profile } = useAuth();
  const [activeAlarm, setActiveAlarm] = useState<AlarmData | null>(null);
  const [pendingCall, setPendingCall] = useState<{ clientId: string; clientName: string; phone: string; startTime: number } | null>(null);
  const [showCallFeedback, setShowCallFeedback] = useState(false);
  const [appConfig, setAppConfig] = useState<any>(initialAppConfig);
  const pendingCallRef = useRef<{ clientId: string; clientName: string; phone: string; startTime: number } | null>(null);

  useCallRecorder(profile);

  useEffect(() => {
    const promptForDeepPermissions = async () => {
      if (Platform.OS === 'android') {
        const hasPrompted = await AsyncStorage.getItem('has_prompted_alarms_settings');
        if (!hasPrompted) {
          Alert.alert(
            'Important: Enable Alarms',
            'To ensure your follow-ups ring even on silent mode, please enable "Alarms & Reminders" and "Do Not Disturb" access on the next screen.',
            [
              { text: 'Later', style: 'cancel', onPress: () => AsyncStorage.setItem('has_prompted_alarms_settings', 'true') },
              {
                text: 'Open Settings',
                onPress: async () => {
                  await AsyncStorage.setItem('has_prompted_alarms_settings', 'true');
                  Linking.openSettings();
                }
              }
            ]
          );
        }
      }
    };
    promptForDeepPermissions();
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: any) => {
      if (nextAppState === 'active') {
        try {
          const { data } = await supabase.from('tenant_config').select('admin_app_active, employee_app_active').single();
          if (data) setAppConfig(data);
        } catch(e){}
      }
      if (nextAppState === 'active' && pendingCallRef.current) {
        setTimeout(() => {
          if (NativeModules.CallRecordingModule) {
            NativeModules.CallRecordingModule.stopRecording();
            if (NativeModules.CallRecordingModule.clearActiveContext) {
              setTimeout(() => NativeModules.CallRecordingModule.clearActiveContext(), 2000);
            }
          }
          setShowCallFeedback(true);
        }, 500);
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  const handleStartCallFromModal = async (clientId: string, clientName: string, phoneNum: string) => {
    const cleanPhone = phoneNum.replace(/\D/g, '');
    if (!cleanPhone) return;

    if (Platform.OS === 'android') {
      const { PermissionsAndroid } = require('react-native');
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        ]);
      } catch (err) { }
    }

    if (NativeModules.CallRecordingModule) {
      NativeModules.CallRecordingModule.startRecording(phoneNum, clientId);
    }

    const { data: { user: authUser } } = await supabase.auth.getUser();
    await supabase.from('interactions').insert({
      client_id: clientId || null,
      user_id: authUser?.id,
      type: 'CALL_MADE',
      content: `Started call to ${clientName} (from alarm popup)`,
      author: 'You',
    });

    const callCtx = {
      clientId,
      clientName,
      phone: phoneNum,
      startTime: Date.now(),
    };
    setPendingCall(callCtx);
    pendingCallRef.current = callCtx;

    setTimeout(async () => {
      try {
        await Linking.openURL(`tel:${cleanPhone}`);
      } catch (err) {
        console.warn('Could not start call:', err);
      }
    }, 800);
  };

  useEffect(() => {
    // ── Alarm: fires when notification arrives
    const receivedSub = Notifications.addNotificationReceivedListener(notification => {
      try {
        // SECURITY: Don't show alarms if no one is logged in or if it's the Admin app
        if (!user || Application.applicationId?.includes('admin')) return;

        const { data, title, body } = notification.request.content;

        let parsedData = data;
        if (typeof data === 'string') {
          try {
            parsedData = JSON.parse(data);
          } catch (e) { }
        }

        let phone = (parsedData as any)?.phone || (parsedData as any)?.clientPhone || (parsedData as any)?.phoneNumber || '';
        let clientId = (parsedData as any)?.clientId;

        // Decouple Ref tag from title/body if present
        const refMatch = (body || title || '').match(/\[Ref:\s*([^\]]+)\]/);
        if (refMatch && refMatch[1]) {
          const parts = refMatch[1].split('|');
          if (parts[0]) phone = parts[0];
          if (parts[1]) clientId = parts[1];
        }

        // Auto-launch app if it's an alarm and we are in background
        if (Platform.OS === 'android' && AppState.currentState !== 'active') {
          NativeModules.CallRecordingModule?.launchApp?.();
        }

        setActiveAlarm({
          title: title || 'Follow-up Reminder',
          body: body || '',
          phone,
          clientId,
          taskId: (parsedData as any)?.taskId,
          notifId: notification.request.identifier,
          rawData: parsedData,
        });
      } catch (e) {
        console.error('[NotificationReceived] Error:', e);
      }
    });

    // ── Action handler: fires when user taps a notification action button ──
    const responseSub = Notifications.addNotificationResponseReceivedListener(async response => {
      try {
        if (!user || Application.applicationId?.includes('admin')) return;

        const { actionIdentifier, notification } = response;
        const { data, title, body } = notification.request.content;

        let parsedData = data;
        if (typeof data === 'string') {
          try {
            parsedData = JSON.parse(data);
          } catch (e) { }
        }

        const phone = (parsedData as any)?.phone || (parsedData as any)?.clientPhone || (parsedData as any)?.phoneNumber || '';

        if (actionIdentifier === 'SNOOZE') {
          const snoozeDate = new Date();
          snoozeDate.setMinutes(snoozeDate.getMinutes() + 15);

          let cId = (parsedData as any)?.clientId || (parsedData as any)?.client_id;
          const refMatch = (body || title || '').match(/\[Ref:\s*([^\]]+)\]/);
          if (refMatch && refMatch[1]) {
            const parts = refMatch[1].split('|');
            if (parts[1]) cId = parts[1];
          }

          try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (cId) {
              await supabase.from('interactions').insert({
                client_id: cId,
                user_id: authUser?.id || null,
                type: 'NOTE_ADDED',
                content: 'Employee snoozed the reminder for 15 minutes.',
                author: 'System'
              });
            }
          } catch (e) {
            console.warn('[BackgroundSnooze] Failed to log snooze interaction:', e);
          }

          await scheduleClientReminder(title || 'Reminder', body || '', snoozeDate, { ...parsedData, clientId: cId, phone });
        } else if (actionIdentifier === 'CALL_CLIENT') {
          if (phone) Linking.openURL(`tel:${phone}`);
        } else if (actionIdentifier === 'WHATSAPP_CLIENT') {
          if (phone) {
            const cleanPhone = phone.replace(/\D/g, '');
            const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
            Linking.openURL(`whatsapp://send?phone=${finalPhone}`);
          }
        }
        // When app was closed and user opens it via notification, show alarm
        if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && user) {
          let phoneVal = phone || (parsedData as any)?.phone || (parsedData as any)?.clientPhone || (parsedData as any)?.phoneNumber || '';
          let cId = (parsedData as any)?.clientId;

          const refMatch = (body || title || '').match(/\[Ref:\s*([^\]]+)\]/);
          if (refMatch && refMatch[1]) {
            const parts = refMatch[1].split('|');
            if (parts[0]) phoneVal = parts[0];
            if (parts[1]) cId = parts[1];
          }

          setActiveAlarm({
            title: title || 'Follow-up Reminder',
            body: body || '',
            phone: phoneVal,
            clientId: cId,
            taskId: (parsedData as any)?.taskId,
            notifId: notification.request.identifier,
            rawData: parsedData,
          });
        }
      } catch (e) {
        console.error('[NotificationResponse] Error:', e);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [user]);

  const pkg = Application?.applicationId || '';
  const isSuperAdminApp = pkg.includes('superadmin');
  const isAdminApp = pkg.includes('admin') && !isSuperAdminApp;

  const userRole = user?.user_metadata?.role;
  const isSuperAdminRole = userRole === 'Admin' && user?.user_metadata?.username === 'Super Administrator';
  const isAdminRole = userRole === 'Admin' && !isSuperAdminRole;
  const isEmployeeRole = userRole === 'User' || userRole === 'Field';

  // No longer forcefully signing out the user on lock. We just show the overlay.

  if (appConfig && !isSuperAdminApp && !isSuperAdminRole) {
    const adminLocked = (isAdminApp || isAdminRole) && appConfig.admin_app_active !== true;
    const empLocked = (!isAdminApp || isEmployeeRole) && appConfig.employee_app_active !== true;

    if (adminLocked || empLocked) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A2E' }} onLayout={onLayout}>
          <StatusBar style="light" />
          <Ionicons name="lock-closed" size={48} color="#FF4444" style={{ marginBottom: 20 }} />
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 12 }}>Access Restricted</Text>
          <Text style={{ color: '#A0A0C0', fontSize: 15, textAlign: 'center', paddingHorizontal: 40, lineHeight: 22 }}>
            App support stopped by FOX DIGITAL
          </Text>
        </View>
      );
    }
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <StatusBar style={colors.statusBar} backgroundColor={colors.bg} />
      <RootNavigator />
      {/* Global Alarm Overlay — only if user is logged in and not admin */}
      {activeAlarm && user && !Application.applicationId?.includes('admin') && (
        <AlarmModal
          alarm={activeAlarm}
          onDismiss={() => setActiveAlarm(null)}
          onStartCall={handleStartCallFromModal}
        />
      )}
      {showCallFeedback && pendingCall && (
        <CallFeedbackModal
          visible={showCallFeedback}
          clientId={pendingCall.clientId}
          clientName={pendingCall.clientName}
          startTime={pendingCall.startTime}
          onClose={() => {
            setShowCallFeedback(false);
            setPendingCall(null);
            pendingCallRef.current = null;
          }}
          onSuccess={() => {
            setShowCallFeedback(false);
            setPendingCall(null);
            pendingCallRef.current = null;
          }}
        />
      )}
    </View>
  );
}
// ── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [appConfig, setAppConfig] = useState<any>(null);

  useEffect(() => {
    // Helper to fetch config without cache
    const fetchConfigNoCache = async () => {
      try {
        const randomId = Math.floor(Math.random() * 10000000) + 1000; // cache buster
        const { data } = await supabase.from('tenant_config')
          .select('admin_app_active, employee_app_active')
          .eq('id', 1)
          .neq('id', randomId) // unique parameter on every request forces a real network call
          .single();
        if (data) setAppConfig(data);
      } catch (e) { }
    };

    async function prepare() {
      try {
        // One-time purge of old buggy notifications
        const hasPurged = await AsyncStorage.getItem('has_purged_alarms_v1');
        if (!hasPurged) {
          await Notifications.cancelAllScheduledNotificationsAsync();
          await AsyncStorage.setItem('has_purged_alarms_v1', 'true');
        }

        await Font.loadAsync(Ionicons.font);
        await requestNotificationPermissions();
        
        await fetchConfigNoCache();
      } catch (e) {
        console.warn('Error loading app dependencies:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();

    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        await fetchConfigNoCache();
      }
    });

    // Also poll every 10 seconds to catch changes instantly
    const interval = setInterval(async () => {
      await fetchConfigNoCache();
    }, 10000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      try {
        await SplashScreen.hideAsync().catch(() => { });
      } catch (e) {
        console.error('onLayout error:', e);
      }
    }
  }, [appIsReady]);

  if (!appIsReady) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <SidebarProvider>
                <AppInner onLayout={onLayoutRootView} appConfig={appConfig} />
              </SidebarProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
