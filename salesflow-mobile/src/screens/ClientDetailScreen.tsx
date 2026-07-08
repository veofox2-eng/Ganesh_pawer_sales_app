import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Linking, Modal,
  ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions, BackHandler, AppState, NativeModules,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import PremiumDateTimePicker from '../components/PremiumDateTimePicker';
import { supabase } from '../lib/supabase';
import { spacing, radius, STATUS_COLORS } from '../theme';
import { requestNotificationPermissions, scheduleClientReminder, cancelNotification } from '../lib/Notifications';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import type { AppColors } from '../context/ThemeContext';
import {
  IconCall, IconCallOutline, IconWhatsApp, IconMic, IconMicOutline, IconMicCircle,
  IconNote, IconAttach, IconArrowBack, IconClose, IconCalendar,
  IconChevronDown, IconCloseCircle, IconPlay, IconStop, IconCloudUpload,
  IconImage, IconDocument, IconAdd, IconTime, IconCheck,
  IconPin, IconMap, IconTrash, IconMoreVert, IconCamera, IconSend
} from '../lib/Icons';
import VoiceRecorder from '../lib/VoiceRecorder';
import { useCallTracking } from '../hooks/useCallTracking';
import CallFeedbackModal from '../components/CallFeedbackModal';
import CallRecorderSetupModal from '../components/CallRecorderSetupModal';
import { useAuth } from '../context/AuthContext';
import { base64ToUint8Array, ensureFileUri } from '../lib/Utils';

const { width } = Dimensions.get('window');

type Status = 'Follow-up' | 'Converted' | 'Lost';
type Tab = 'add' | 'timeline' | 'notes' | 'files' | 'locations';
type InputMode = 'note' | 'voice' | 'file';

interface Client {
  id: string; name: string; phone: string; email?: string;
  project_name?: string; source?: string; status: Status;
  lead_type?: 'Hot' | 'Warm' | 'Cold'; address?: string; description?: string;
  reason_for_contact?: string; reminder_date?: string;
  deal_value?: number; is_deleted: boolean; created_at: string; user_id: string;
}

interface Interaction {
  id: string; client_id: string; type: string;
  content?: string; media_url?: string; amount?: number;
  author?: string; created_at: string;
}

interface CallRecording {
  uri: string; filename: string; duration?: number; creationTime: number;
}

const SUPABASE_STORAGE_URL = 'https://korgtxyzpznaondfiytk.supabase.co/storage/v1/object/public/client-attachments/';

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

function formatReminderDate(dateStr: string) {
  const today = new Date();
  const d = new Date(dateStr);
  today.setHours(0, 0, 0, 0);
  const dc = new Date(dateStr);
  dc.setHours(0, 0, 0, 0);
  const diff = Math.round((dc.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getInteractionLabel(type: string) {
  const map: Record<string, string> = {
    NOTE_ADDED: 'Note Added',
    CALL_MADE: 'Call Logged',
    CALL_RECORDING: 'Call Recording',
    VOICE_INSTRUCTION: 'Voice Note',
    ATTACHMENT_ADDED: 'Attachment',
    PINNED_LOCATION: 'Pinned Location',
    WHATSAPP_CONTACT: 'WhatsApp Chat',
    PROFILE_UPDATED: 'Profile Updated',
    REMINDER_POPPED: 'Reminder Popped',
    CLIENT_DELETED: 'Client Deleted',
    CLIENT_RESTORED: 'Client Restored',
  };
  return map[type] || type;
}

function isExceeded(dateStr?: string, status?: string) {
  if (!dateStr || status !== 'Follow-up') return false;
  // 30 minute buffer
  return new Date(dateStr).getTime() < (Date.now() - 1800000);
}

function getInteractionIconColor(type: string, colors: any) {
  const map: Record<string, string> = {
    NOTE_ADDED: colors.accent,
    CALL_MADE: colors.success,
    CALL_RECORDING: colors.danger,
    VOICE_INSTRUCTION: colors.purple,
    ATTACHMENT_ADDED: colors.cyan,
    PINNED_LOCATION: colors.accent,
    WHATSAPP_CONTACT: '#25D366',
    PROFILE_UPDATED: colors.warning,
    REMINDER_POPPED: colors.purple,
    CLIENT_DELETED: colors.danger,
    CLIENT_RESTORED: colors.success,
  };
  return map[type] || colors.textMuted;
}

function TimelineIcon({ type, colors, size = 14 }: { type: string; colors: any; size?: number }) {
  const color = getInteractionIconColor(type, colors);
  if (type === 'NOTE_ADDED') return <IconNote size={size} color={color} />;
  if (type === 'CALL_MADE') return <IconCallOutline size={size} color={color} />;
  if (type === 'CALL_RECORDING') return <IconMicCircle size={size} color={color} />;
  if (type === 'VOICE_INSTRUCTION') return <IconMic size={size} color={color} />;
  if (type === 'ATTACHMENT_ADDED') return <IconAttach size={size} color={color} />;
  if (type === 'PINNED_LOCATION') return <IconPin size={size} color={color} />;
  if (type === 'WHATSAPP_CONTACT') return <IconWhatsApp size={size} color={color} />;
  if (type === 'PROFILE_UPDATED') return <IconCheck size={size} color={color} />;
  if (type === 'REMINDER_POPPED') return <IconCalendar size={size} color={color} />;
  if (type === 'CLIENT_DELETED') return <IconTrash size={size} color={color} />;
  if (type === 'CLIENT_RESTORED') return <IconCheck size={size} color={color} />;
  return <IconNote size={size} color={color} />;
}

export default function ClientDetailScreen({ route, navigation }: any) {
  const { client: initialClient, isNew } = route.params || {};
  const { colors } = useTheme();
  const { profile, isField } = useAuth();
  const isAdmin = profile?.role === 'Admin' || profile?.role === 'SuperAdmin';
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [client, setClient] = useState<Client | null>(initialClient || null);
  const [tab, setTab] = useState<Tab>(route.params?.initialTab || 'add');
  const [inputMode, setInputMode] = useState<InputMode>('note');
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const { user } = useAuth();
  const [showDeletePinModal, setShowDeletePinModal] = useState(false);
  const [pinToDelete, setPinToDelete] = useState<Interaction | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletingPin, setIsDeletingPin] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [logCallNote, setLogCallNote] = useState('');
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [localVoiceNoteUri, setLocalVoiceNoteUri] = useState<string | null>(null);
  const [scanningRec, setScanningRec] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(isNew || false);
  const [showLogCall, setShowLogCall] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showCallRecModal, setShowCallRecModal] = useState(false);
  const [callRecordings, setCallRecordings] = useState<CallRecording[]>([]);
  const [showCallFeedback, setShowCallFeedback] = useState(false);
  const [showRecorderSetup, setShowRecorderSetup] = useState(false);
  const [pendingInteractions, setPendingInteractions] = useState<any[]>([]);
  const [callStartTime, setCallStartTime] = useState<number | undefined>(undefined);
  const [timelineFilter, setTimelineFilter] = useState('ALL');
  const [quickAction, setQuickAction] = useState<'status' | 'lead_type' | null>(null);


  const { startCall } = useCallTracking((call) => {
    setCallStartTime(call.startTime);
    setShowCallFeedback(true);
  });

  const lockedFields: string[] = [];
  const editPermissionsGranted: string[] = [];

  const soundRef = useRef<Audio.Sound | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [showInlineDatePicker, setShowInlineDatePicker] = useState(false);
  const [showInlineTimePicker, setShowInlineTimePicker] = useState(false);
  const [inlineDate, setInlineDate] = useState<Date>(new Date());

  const [form, setForm] = useState({
    name: '', phone: '', email: '', project_name: '', source: 'Manual',
    status: 'Follow-up' as Status, lead_type: 'Cold' as 'Hot'|'Warm'|'Cold',
    address: '', description: '',
    reason_for_contact: '', deal_value: '',
    reminder_date: '',
  });

  const [quickModalNote, setQuickModalNote] = useState('');
  const [isRecordingQuick, setIsRecordingQuick] = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let appStateSubscription: any;
    
    if (client) {
      if (!client.phone) fetchFullClient(client.id);
      fetchInteractions();
      fetchTasks();

      // Listen for app coming back to foreground to refresh data
      // (e.g. background uploads finishing while in the dialer)
      appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          fetchFullClient(client.id);
          fetchInteractions();
        }
      });
    }

    return () => {
      stopAudio();
      if (appStateSubscription) appStateSubscription.remove();
    };
  }, [client?.id]);

  useEffect(() => {
    if (!client) return;
    const { DeviceEventEmitter } = require('react-native');
    const syncSub = DeviceEventEmitter.addListener('RECORDING_SYNCED', (data) => {
      if (data.clientId === client.id) {
        fetchInteractions();
      }
    });
    return () => syncSub.remove();
  }, [client?.id]);

  async function fetchFullClient(id: string) {
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
    if (!error && data) setClient(data);
  }

  // Android back: close add-client modal → go back only if navigated via openEdit
  useEffect(() => {
    if (!showAddClientModal) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowAddClientModal(false);
      if (route.params?.openEdit) navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [showAddClientModal]);

  // Android back: close call rec modal
  useEffect(() => {
    if (!showCallRecModal) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowCallRecModal(false);
      stopAudio();
      return true;
    });
    return () => sub.remove();
  }, [showCallRecModal]);

  // Android back: close log call sheet
  useEffect(() => {
    if (!showLogCall) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowLogCall(false);
      return true;
    });
    return () => sub.remove();
  }, [showLogCall]);

  async function stopAudio() {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
      setPlayingUri(null);
    }
  }

  async function playRecording(uri: string) {
    if (playingUri === uri) { await stopAudio(); return; }
    await stopAudio();
    setPlaybackLoading(true);
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, null, true);
      soundRef.current = sound;
      setPlayingUri(uri);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setPlayingUri(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (e: any) {
      Alert.alert('Playback Error', 'Could not play this recording. ' + e.message);
    }
    setPlaybackLoading(false);
  }

  async function fetchInteractions() {
    if (!client) return;
    const { data } = await supabase.from('interactions').select('*')
      .eq('client_id', client.id).order('created_at', { ascending: false });
    if (data) setInteractions(data);
  }

  async function fetchTasks() {
    if (!client) return;
    const { data } = await supabase.from('tasks').select('*')
      .eq('client_id', client.id).order('created_at', { ascending: false });
    if (data) setTasks(data);
  }

  async function deleteInteraction(id: string, type: string) {
    Alert.alert('Delete Item', `Remove this ${type.toLowerCase()} from the timeline?`, [
       { text: 'Cancel', style: 'cancel' },
       { text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('interactions').delete().eq('id', id);
          if (error) { Alert.alert('Error', error.message); return; }
          setInteractions(prev => prev.filter(i => i.id !== id));
          await addInteraction('NOTE_ADDED', `Timeline item (${type}) was removed.`);
       }}
    ]);
  }

  async function handleSaveClient() {
    if (!form.name.trim()) { Alert.alert('Error', 'Client name is required'); return; }
    if (form.phone && form.phone.length > 0 && form.phone.length !== 14) {
      Alert.alert('Invalid Phone', 'Phone number must be exactly 10 digits after +91.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (client) {
      // Edit existing


      const { data, error } = await supabase.from('clients').update({
        name: form.name, phone: form.phone, email: form.email || null,
        project_name: form.project_name || null, source: form.source,
        status: form.status, lead_type: form.lead_type,
        address: form.address || null, description: form.description || null,
        reason_for_contact: form.reason_for_contact?.trim() || null,
        deal_value: form.deal_value ? parseFloat(String(form.deal_value)) : 0,
        reminder_date: form.reminder_date || null,
      }).eq('id', client.id).select().single();

      if (error) {
        if (error.message?.includes('column') && error.message?.includes('reason_for_contact')) {
          Alert.alert('Database Update Required', 'Please run the SQL command from the chat in your Supabase SQL Editor to finish the update.');
        } else {
          Alert.alert('Error Updating Client', error.message);
        }
        return;
      }
      setClient(data);
      // Sync form to reflect latest server state (fixes faded description bug)
      setForm({
        name: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        project_name: data.project_name || '',
        source: data.source || 'Manual',
        status: data.status || 'Follow-up',
        lead_type: data.lead_type || 'Cold',
        address: data.address || '',
        description: data.description || '',
        reason_for_contact: data.reason_for_contact || '',
        deal_value: data.deal_value ? String(data.deal_value) : '',
        reminder_date: data.reminder_date || '',
      });
      setShowAddClientModal(false);
      if (route.params?.openEdit) navigation.goBack();
      // Admin Lock Fields

      // Log update
      const updates = [];
      if (form.name !== client.name) updates.push(`Name edited from '${client.name || 'empty'}' to '${form.name}'`);
      if (form.phone !== client.phone) updates.push(`Phone number edited from '${client.phone || 'empty'}' to '${form.phone}'`);
      if (form.email !== client.email && (form.email || client.email)) updates.push(`Email edited from '${client.email || 'empty'}' to '${form.email || 'empty'}'`);
      if (form.project_name !== client.project_name && (form.project_name || client.project_name)) updates.push(`Project name edited from '${client.project_name || 'empty'}' to '${form.project_name || 'empty'}'`);
      if (form.source !== client.source && (form.source || client.source)) updates.push(`Source edited from '${client.source || 'empty'}' to '${form.source || 'empty'}'`);
      if (form.lead_type !== client.lead_type && (form.lead_type || client.lead_type)) updates.push(`Lead type edited from '${client.lead_type || 'empty'}' to '${form.lead_type || 'empty'}'`);
      if (form.address !== client.address && (form.address || client.address)) updates.push(`Address edited from '${client.address || 'empty'}' to '${form.address || 'empty'}'`);
      if (form.description !== client.description && (form.description || client.description)) updates.push(`Description edited from '${client.description || 'empty'}' to '${form.description || 'empty'}'`);
      if (form.reason_for_contact !== client.reason_for_contact && (form.reason_for_contact || client.reason_for_contact)) updates.push(`Reason for contact edited from '${client.reason_for_contact || 'empty'}' to '${form.reason_for_contact || 'empty'}'`);
      if (form.status !== client.status && (form.status || client.status)) updates.push(`Status edited from '${client.status || 'empty'}' to '${form.status || 'empty'}'`);
      
      if (form.deal_value !== String(client.deal_value || '') && (form.deal_value || client.deal_value)) {
        updates.push(`Deal Value edited from '₹${client.deal_value || 0}' to '₹${form.deal_value || 0}'`);
      }
      
      if (updates.length > 0) {
        await addInteraction('PROFILE_UPDATED', updates.join('\n'));
      } else {
        await addInteraction('PROFILE_UPDATED', 'Client details updated (settings).');
      }
      
      if (form.reminder_date && form.reminder_date !== client.reminder_date) {
        await scheduleClientReminder(`Follow-up: ${form.name}`, `Call ${form.name} today.`, new Date(form.reminder_date), { clientId: client.id, phone: client.phone });
        await addInteraction('NOTE_ADDED', `Follow-up set for ${new Date(form.reminder_date).toLocaleString()}`);
      }
      
      if (quickModalNote.trim().length > 0) {
        await addInteraction('NOTE_ADDED', quickModalNote.trim());
        setQuickModalNote('');
      }
    } else {
      // Create new
      const { data, error } = await supabase.from('clients').insert({
        name: form.name, phone: form.phone, email: form.email || null,
        project_name: form.project_name || null, source: form.source,
        status: form.status, lead_type: form.lead_type,
        address: form.address || null, description: form.description || null,
        reason_for_contact: form.reason_for_contact?.trim() || null,
        deal_value: form.deal_value ? parseFloat(String(form.deal_value)) : 0,
        reminder_date: form.reminder_date || null,
        user_id: user.id, is_deleted: false,
      }).select().single();

      if (error) {
        if (error.message?.includes('column') && error.message?.includes('reason_for_contact')) {
          Alert.alert('Database Update Required', 'Please run the SQL command from the chat in your Supabase SQL Editor to finish the update.');
        } else {
          Alert.alert('Error Saving Client', error.message);
        }
        return;
      }
      setClient(data);
      setShowAddClientModal(false);
      if (route.params?.openEdit) navigation.goBack();

      // Persist pending interactions
      if (pendingInteractions.length > 0) {
        const toInsert = pendingInteractions.map(pi => ({
          ...pi,
          client_id: data.id,
          user_id: user.id
        }));
        const { error: batchError } = await supabase.from('interactions').insert(toInsert);
        if (batchError) {
          Alert.alert('Save Warning', 'Client created, but some attachments failed to save: ' + batchError.message);
        } else {
          setPendingInteractions([]);
        }
      }

      if (localVoiceNoteUri) {
        await uploadAudio(localVoiceNoteUri, 'VOICE_INSTRUCTION', data.id);
        setLocalVoiceNoteUri(null);
      }

      if (form.reminder_date) {
        await scheduleClientReminder(`Follow-up: ${form.name}`, `Call ${form.name} today.`, new Date(form.reminder_date), { clientId: data.id, phone: form.phone });
      }
    }
  }

  function handleEditClientPress() {
    if (!client) return;
    setForm({
      name: client.name, phone: client.phone, email: client.email || '',
      project_name: client.project_name || '', source: client.source || 'Manual',
      status: client.status, lead_type: client.lead_type || 'Cold',
      address: client.address || '', description: client.description || '',
      reason_for_contact: client.reason_for_contact || '',
      deal_value: client.deal_value ? String(client.deal_value) : '',
      reminder_date: client.reminder_date || '',
    });
    if (client.reminder_date) {
      setSelectedDate(new Date(client.reminder_date));
    }
    setShowSettingsMenu(false);
    setShowAddClientModal(true);
  }
  useEffect(() => {
    if (route.params?.openEdit && client) {
      handleEditClientPress();
    }
  }, [route.params?.openEdit, client?.id]);
  function handleDeleteClient() {
    setShowSettingsMenu(false);
    Alert.alert('Delete Client', 'Move this client to the Deleted records?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (!client) return;
        await supabase.from('clients').update({ is_deleted: true }).eq('id', client.id);
        await supabase.from('interactions').insert({
          client_id: client.id,
          user_id: user?.id,
          type: 'CLIENT_DELETED',
          content: 'Client was moved to deleted folder.',
          author: profile?.role || 'Employee'
        });
        setClient({ ...client, is_deleted: true });
      }}
    ]);
  }

  function handleRestoreClient() {
    setShowSettingsMenu(false);
    Alert.alert('Restore Client', 'Restore this client from deleted records?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore', style: 'default', onPress: async () => {
        if (!client) return;
        await supabase.from('clients').update({ is_deleted: false }).eq('id', client.id);
        await supabase.from('interactions').insert({
          client_id: client.id,
          user_id: user?.id,
          type: 'CLIENT_RESTORED',
          content: 'Client was restored from deleted folder.',
          author: profile?.role || 'Employee'
        });
        setClient({ ...client, is_deleted: false });
      }}
    ]);
  }

  async function handleStatusChange(status: Status) {
    if (!client) return;

    // If Admin edited this, lock it!
    if (profile?.role === 'Admin') {
      const existingLock = interactions.find(i => i.type === 'ADMIN_LOCKED_FIELDS');
      let combined = ['status'];
      if (existingLock) {
        try { combined = Array.from(new Set([...JSON.parse(existingLock.content), 'status'])); } catch(e){}
      }
      await supabase.from('interactions').insert({
        client_id: client.id,
        user_id: user?.id,
        type: 'ADMIN_LOCKED_FIELDS',
        content: JSON.stringify(combined),
        author: 'Admin'
      });
      await supabase.from('clients').update({ status }).eq('id', client.id);
      setClient({ ...client, status });
      await addInteraction('PROFILE_UPDATED', `Status edited from '${client.status}' to '${status}' by Admin.`);
      fetchInteractions();
      return;
    }

    // If Employee, check if field is locked!
    const isLocked = lockedFields.includes('status');
    const hasPermission = editPermissionsGranted.includes('status');

    if (isLocked && !hasPermission) {
      const existingReq = interactions.find(i => i.type === 'EDIT_REQUESTED' && i.content?.includes('"field":"status"'));
      if (existingReq) {
        Alert.alert("Pending", "An approval request for editing status is already pending with the Admin.");
        return;
      }

      Alert.alert(
        "Admin Locked Detail",
        "This status was updated by Admin. Request permission?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Ask Permission", onPress: async () => {
              await supabase.from('interactions').insert({
                client_id: client.id,
                user_id: user?.id,
                type: 'EDIT_REQUESTED',
                content: JSON.stringify({ field: 'status', requestedValue: status }),
                author: profile?.username || 'Employee'
              });
              Alert.alert("Success", "Approval request sent to Admin.");
              fetchInteractions();
          }}
        ]
      );
      return;
    }

    await supabase.from('clients').update({ status }).eq('id', client.id);
    setClient({ ...client, status });
    await addInteraction('PROFILE_UPDATED', `Status edited from '${client.status}' to '${status}'.`);
  }

  async function handleInlineReminderUpdate(newDate: Date) {
    if (!client) return;

    if (profile?.role === 'Admin') {
      const existingLock = interactions.find(i => i.type === 'ADMIN_LOCKED_FIELDS');
      let combined = ['reminder_date'];
      if (existingLock) {
        try { combined = Array.from(new Set([...JSON.parse(existingLock.content), 'reminder_date'])); } catch(e){}
      }
      await supabase.from('interactions').insert({
        client_id: client.id,
        user_id: user?.id,
        type: 'ADMIN_LOCKED_FIELDS',
        content: JSON.stringify(combined),
        author: 'Admin'
      });
      const isoDate = newDate.toISOString();
      await supabase.from('clients').update({ reminder_date: isoDate }).eq('id', client.id);
      setClient({ ...client, reminder_date: isoDate } as any);
      await scheduleClientReminder(`Follow-up: ${client.name}`, `Call ${client.name} today as scheduled.`, newDate, { clientId: client.id, phone: client.phone });
      await addInteraction('PROFILE_UPDATED', `Follow-up set to ${newDate.toLocaleString()} by Admin.`);
      fetchInteractions();
      return;
    }

    const isLocked = lockedFields.includes('reminder_date');
    const hasPermission = editPermissionsGranted.includes('reminder_date');

    if (isLocked && !hasPermission) {
      const existingReq = interactions.find(i => i.type === 'EDIT_REQUESTED' && i.content?.includes('"field":"reminder_date"'));
      if (existingReq) {
        Alert.alert("Pending", "An approval request for rescheduling is already pending with the Admin.");
        return;
      }
      Alert.alert(
        "Admin Locked Detail",
        "Rescheduling was restricted by Admin. Request permission?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Ask Permission", onPress: async () => {
              await supabase.from('interactions').insert({
                client_id: client.id,
                user_id: user?.id,
                type: 'EDIT_REQUESTED',
                content: JSON.stringify({ field: 'reminder_date', requestedValue: newDate.toISOString() }),
                author: profile?.username || 'Employee'
              });
              Alert.alert("Success", "Permission request sent to Admin.");
              fetchInteractions();
          }}
        ]
      );
      return;
    }

    const isoDate = newDate.toISOString();
    await supabase.from('clients').update({ reminder_date: isoDate }).eq('id', client.id);
    setClient({ ...client, reminder_date: isoDate } as any);
    await scheduleClientReminder(`Follow-up: ${client.name}`, `Call ${client.name} today as scheduled.`, newDate, { clientId: client.id, phone: client.phone });
    await addInteraction('PROFILE_UPDATED', `Follow-up set to ${newDate.toLocaleString()}.`);
  }


  async function addInteraction(type: string, content?: string, mediaUrl?: string, forceClientId?: string) {
    if (!user) return;
    const targetId = forceClientId || client?.id;
    if (!targetId) {
      setPendingInteractions(prev => [
        { type, content: content || null, media_url: mediaUrl || null, author: profile?.username || 'You', created_at: new Date().toISOString() },
        ...prev
      ]);
      return;
    }
    const { data, error } = await supabase.from('interactions').insert({
      client_id: targetId, 
      user_id: user.id,
      type, 
      content: content || null,
      media_url: mediaUrl || null, 
      author: profile?.username || 'You',
    }).select().single();
    if (error) {
      console.error('Interaction save error:', error);
      Alert.alert('Save Failed', error.message);
      return;
    }
    if (data) setInteractions(prev => [data, ...prev]);
  }

  async function handleSaveNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    await addInteraction('NOTE_ADDED', newNote.trim());
    setNewNote('');
    setSavingNote(false);
  }

  async function handleLogCall() {
    await addInteraction('CALL_MADE', logCallNote || `Called ${client?.name}`);
    setLogCallNote('');
    setShowLogCall(false);
  }

  async function uploadAudio(uri: string, type: 'VOICE_INSTRUCTION' | 'CALL_RECORDING', forceClientId?: string) {
    setUploading(true);
    try {
      const ext = uri.split('.').pop() || 'mp4';
      const folderId = forceClientId || client?.id || `temp_${user?.id}`;
      const filename = `${folderId}/${Date.now()}.${ext}`;
      const fileUri = ensureFileUri(uri);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session for upload');

      const uploadUrl = `https://korgtxyzpznaondfiytk.supabase.co/storage/v1/object/client-attachments/${filename}`;
      const response = await FileSystem.uploadAsync(uploadUrl, fileUri, {
        httpMethod: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': `audio/${ext}` },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });

      if (response.status === 200 || response.status === 201) {
        const url = SUPABASE_STORAGE_URL + filename;
        await addInteraction(type, type === 'CALL_RECORDING' ? 'Call Recording' : 'Voice Note', url, forceClientId);
      } else {
        Alert.alert('Upload failed', `Status: ${response.status}`);
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
    setUploading(false);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadFile(result.assets[0].uri, result.assets[0].fileName || 'image.jpg', 'image/jpeg');
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      await uploadFile(result.assets[0].uri, result.assets[0].name, result.assets[0].mimeType || 'application/octet-stream');
    }
  }

  async function uploadFile(uri: string, name: string, mimeType: string) {
    setUploading(true);
    try {
      const folderId = client?.id || `temp_${user?.id}`;
      const filename = `${folderId}/${Date.now()}_${name}`;
      const fileUri = ensureFileUri(uri);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session for upload');

      const uploadUrl = `https://korgtxyzpznaondfiytk.supabase.co/storage/v1/object/client-attachments/${filename}`;
      const response = await FileSystem.uploadAsync(uploadUrl, fileUri, {
        httpMethod: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': mimeType },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });

      if (response.status === 200 || response.status === 201) {
        const url = SUPABASE_STORAGE_URL + filename;
        await addInteraction('ATTACHMENT_ADDED', name, url);
      } else Alert.alert('Upload failed', `Status: ${response.status}`);
    } catch (e: any) { Alert.alert('Error', e.message); }
    setUploading(false);
  }

  async function pinLocation() {
    if (!client) return;
    
    const requestPhoto = () => {
      return new Promise<'camera' | 'gallery' | 'none'>((resolve) => {
        Alert.alert(
          'Upload Photo?',
          'Would you like to attach a photo to this location pin?',
          [
            { text: 'Camera', onPress: () => resolve('camera') },
            { text: 'Gallery', onPress: () => resolve('gallery') },
            { text: 'No Photo', onPress: () => resolve('none'), style: 'cancel' },
          ],
          { cancelable: false }
        );
      });
    };

    try {
      const photoChoice = await requestPhoto();
      let photoUrl = null;

      if (photoChoice === 'camera') {
        const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (!res.canceled) {
          photoUrl = await uploadFileSilently(res.assets[0].uri, 'location_pin.jpg', 'image/jpeg');
        }
      } else if (photoChoice === 'gallery') {
        const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (!res.canceled) {
          photoUrl = await uploadFileSilently(res.assets[0].uri, 'location_pin.jpg', 'image/jpeg');
        }
      }

      setUploading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow location access to pin this client.');
        setUploading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      
      const { error } = await supabase.from('clients')
        .update({ latitude: lat, longitude: lng })
        .eq('id', client.id);

      if (error) throw error;
      setClient({ ...client, latitude: lat, longitude: lng } as any);
      
      let addrStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (addr) {
          addrStr = `${addr.name || ''} ${addr.street || ''}, ${addr.subregion || ''}, ${addr.city || ''}, ${addr.region || ''} ${addr.postalCode || ''}`
            .replace(/^[,\s]+|[,\s]+$/g, '')
            .replace(/\s*,\s*,/g, ',')
            .trim() || addrStr;
        }
      } catch(e){}
      
      // Log as PINNED_LOCATION
      await addInteraction('PINNED_LOCATION', `Pinned location: ${addrStr} (${lat.toFixed(5)}, ${lng.toFixed(5)})`, photoUrl || undefined);
      
      Alert.alert('Success', 'Location pinned successfully' + (photoUrl ? ' with photo.' : '.'));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setUploading(false);
  }

  async function uploadFileSilently(uri: string, name: string, mimeType: string) {
    if (!client) return null;
    try {
      const filename = `${client.id}/pins/${Date.now()}_${name}`;
      const fileUri = ensureFileUri(uri);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const uploadUrl = `https://korgtxyzpznaondfiytk.supabase.co/storage/v1/object/client-attachments/${filename}`;
      const response = await FileSystem.uploadAsync(uploadUrl, fileUri, {
        httpMethod: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': mimeType },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });

      if (response.status === 200 || response.status === 201) {
         return SUPABASE_STORAGE_URL + filename;
      }
    } catch (e) { console.error('Silent upload failed', e); }
    return null;
  }

  async function takePhoto() {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadFile(result.assets[0].uri, result.assets[0].fileName || 'camera.jpg', 'image/jpeg');
    }
  }

  function detectCallRecordings() {
    if (!client) return;
    
    // Instead of scanning local storage, we just show the recordings
    // that are already linked to this client in Supabase.
    const recordings = interactions
      .filter((i: any) => i.type === 'CALL_RECORDING' && i.media_url && i.media_url !== 'DELETED')
      .map((i: any) => ({
        uri: i.media_url,
        filename: i.content || 'Call Recording',
        creationTime: new Date(i.created_at).getTime(),
      }));

    if (recordings.length === 0) {
      Alert.alert(
        'No Recordings',
        'No call recordings have been saved for this client yet. Calls made to this client from the app will be recorded and attached automatically.'
      );
      return;
    }

    setCallRecordings(recordings);
    setShowCallRecModal(true);
  }

  async function attachCallRecording(rec: CallRecording) {
    setShowCallRecModal(false);
    await uploadAudio(rec.uri, 'CALL_RECORDING');
  }

  const timelineItems = useMemo(() => {
    let items = [
      ...interactions.map(i => {
        if (i.type === 'NOTE_ADDED' && i.content && (i.content.includes('Alarm Triggered:') || i.content.includes('popped up'))) {
          return { ...i, type: 'REMINDER_POPPED', _kind: 'interaction' as const };
        }
        return { ...i, _kind: 'interaction' as const };
      }),
      ...tasks.map(t => ({
        id: t.id, client_id: t.client_id || '', type: 'NOTE_ADDED',
        content: `Task: ${t.title}${t.due_date ? ' (Due: ' + t.due_date + ')' : ''}`,
        author: 'Task Board', created_at: t.created_at, _kind: 'interaction' as const,
      }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (timelineFilter === 'ALL') return items;
    return items.filter(item => {
      if (timelineFilter === 'CALLS') return item.type === 'CALL_MADE';
      if (timelineFilter === 'RECORDINGS') return item.type === 'CALL_RECORDING';
      if (timelineFilter === 'NOTES') return item.type === 'NOTE_ADDED';
      if (timelineFilter === 'VOICE') return item.type === 'VOICE_INSTRUCTION';
      if (timelineFilter === 'FILES') return item.type === 'ATTACHMENT_ADDED';
      if (timelineFilter === 'REMINDERS') return item.type === 'REMINDER_POPPED';
      if (timelineFilter === 'MAPS') return ['PINNED_LOCATION', 'LOCATION_SEARCHED', 'LOCATION_REACHED', 'TRAVEL_PLAN'].includes(item.type);
      return true;
    });
  }, [interactions, tasks, timelineFilter]);

  if (!client && !showAddClientModal) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const sc = client ? (STATUS_COLORS[client.status] || STATUS_COLORS['Follow-up']) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

      {/* ── Add Client Modal ── */}
      <Modal visible={showAddClientModal} animationType="slide" presentationStyle="pageSheet" statusBarTranslucent>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowAddClientModal(false); if (route.params?.openEdit) navigation.goBack(); }} style={{ padding: 4 }}>
              <IconClose size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{client ? 'Edit Client' : 'Add New Client'}</Text>
            <TouchableOpacity onPress={handleSaveClient}>
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 16 }}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Cancel hint */}
          <TouchableOpacity
            style={styles.cancelHintRow}
            onPress={() => { setShowAddClientModal(false); if (route.params?.openEdit) navigation.goBack(); }}
          >
            <Text style={styles.cancelHintText}>← Cancel — go back without saving</Text>
          </TouchableOpacity>

          <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: 220, flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEnabled={true}
            >
              {[
                { label: 'Full Name *', key: 'name', placeholder: 'Enter full name', keyboard: 'default' as any, autoComplete: 'name', textContentType: 'name' },
                { label: 'Phone Number', key: 'phone', placeholder: '+91 99999 99999', keyboard: 'phone-pad' as any, autoComplete: 'tel', textContentType: 'telephoneNumber' },
                { label: 'Email', key: 'email', placeholder: 'email@example.com', keyboard: 'email-address' as any, autoComplete: 'email', textContentType: 'emailAddress' },
                { label: 'Address', key: 'address', placeholder: 'Client location', keyboard: 'default' as any, autoComplete: 'street-address', textContentType: 'fullStreetAddress' },
                { label: 'Project Name', key: 'project_name', placeholder: 'Project name', keyboard: 'default' as any, autoComplete: 'off', textContentType: 'none', importantForAutofill: 'no' },
                { label: 'Deal Value (₹)', key: 'deal_value', placeholder: '0', keyboard: 'numeric' as any, autoComplete: 'off', textContentType: 'none', importantForAutofill: 'no' },
              ].filter(f => {
                // Filter fields based on role
                if (isField) {
                  // Field: Name, Phone, Project (Optional), Address
                  return ['name', 'phone', 'project_name', 'address'].includes(f.key);
                } else {
                  // Sales: Name, Phone, Email, Project, Deal Value
                  return ['name', 'phone', 'email', 'project_name', 'deal_value'].includes(f.key);
                }
              }).map(f => (
                <View key={f.key} style={styles.field}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.fieldLabel}>{f.label}</Text>
                    {isField && f.key === 'address' && (
                      <TouchableOpacity 
                        onPress={async () => {
                          const { status } = await Location.requestForegroundPermissionsAsync();
                          if (status !== 'granted') return;
                          const loc = await Location.getCurrentPositionAsync({});
                          const [addr] = await Location.reverseGeocodeAsync(loc.coords);
                          if (addr) {
                            const full = `${addr.name || ''} ${addr.street || ''}, ${addr.subregion || ''}, ${addr.city || ''}, ${addr.region || ''} ${addr.postalCode || ''}`
                              .replace(/^[,\s]+|[,\s]+$/g, '')
                              .replace(/\s*,\s*,/g, ',')
                              .trim();
                            setForm(prev => ({ ...prev, address: full }));
                          }
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                      >
                        <IconPin size={12} color={colors.accent} style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '600' }}>Current Loc</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={(form as any)[f.key]}
                    onChangeText={v => {
                      if (f.key === 'phone') {
                        if (v === '' || v === '+' || v === '+9' || v === '+91' || v === '+91 ') {
                          setForm(prev => ({ ...prev, phone: '' }));
                          return;
                        }
                        let clean = v.replace(/[^\d+]/g, '');
                        if (!clean.startsWith('+91')) {
                          const digits = clean.replace(/\D/g, '').replace(/^91/, '');
                          clean = '+91' + digits;
                        }
                        let formatted = clean;
                        if (clean.length > 3) {
                          formatted = '+91 ' + clean.substring(3);
                        }
                        if (formatted.length > 14) return;
                        setForm(prev => ({ ...prev, phone: formatted }));
                      } else {
                        setForm(prev => ({ ...prev, [f.key]: v }));
                      }
                    }}
                    keyboardType={f.keyboard}
                    autoComplete={f.autoComplete as any}
                    textContentType={f.textContentType as any}
                    importantForAutofill={f.importantForAutofill as any}
                  />
                </View>
              ))}

              {/* Lead Type / Status */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{isField ? 'Status (Lead Temp)' : 'Lead Type (Optional)'}</Text>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  {(['Hot', 'Warm', 'Cold'] as const).map((lt, idx) => {
                    const ltColor = lt === 'Hot' ? colors.danger : lt === 'Warm' ? colors.warning : colors.cyan;
                    return (
                      <TouchableOpacity key={lt} 
                        onPress={() => setForm(prev => ({ ...prev, lead_type: lt }))}
                        style={[styles.statusOption, { borderColor: form.lead_type === lt ? ltColor : colors.border, marginRight: idx < 2 ? 8 : 0 },
                          form.lead_type === lt && { backgroundColor: `${ltColor}15` }]}>
                        <Text style={[styles.statusOptionText, { color: form.lead_type === lt ? ltColor : colors.textMuted }]}>{lt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Follow-up Date & Time</Text>
                <TouchableOpacity 
                  style={styles.datePickerBtn} 
                  onPress={() => setShowDatePicker(true)}
                >
                  <IconCalendar size={18} color={colors.accent} />
                  <Text style={[styles.datePickerBtnText, !form.reminder_date && { color: colors.textMuted }]}>
                    {form.reminder_date
                      ? new Date(form.reminder_date).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })
                      : 'Select date and time'}
                  </Text>
                  {form.reminder_date ? (
                    <TouchableOpacity onPress={() => setForm(prev => ({ ...prev, reminder_date: '' }))}>
                      <IconCloseCircle size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  ) : (
                    <IconChevronDown size={16} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
                <PremiumDateTimePicker
                  visible={showDatePicker}
                  value={selectedDate}
                  minimumDate={new Date()}
                  onClose={() => setShowDatePicker(false)}
                  onChange={(date) => {
                    setSelectedDate(date);
                    setForm(prev => ({ ...prev, reminder_date: date.toISOString() }));
                  }}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Status</Text>
                <View style={{ flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' }}>
                  {(['Follow-up', 'Converted', 'Lost'] as Status[]).map((s, idx) => {
                    const c = STATUS_COLORS[s];
                    return (
                      <TouchableOpacity key={s} 
                        onPress={() => setForm(prev => ({ ...prev, status: s }))}
                        style={[styles.statusOption, { borderColor: form.status === s ? c.text : colors.border, marginRight: idx < 2 ? 8 : 0, marginBottom: 8 },
                          form.status === s && { backgroundColor: c.bg }]}>
                        <Text style={[styles.statusOptionText, { color: form.status === s ? c.text : colors.textMuted }]}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.fieldInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                  placeholder="Additional details about the client..."
                  placeholderTextColor={colors.textMuted}
                  value={form.description}
                  onChangeText={v => setForm(prev => ({ ...prev, description: v }))}
                  multiline
                />
              </View>
              {!client && (
                <View style={[styles.field, { marginTop: 12 }]}>
                  <Text style={styles.fieldLabel}>Notes & Attachments</Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <TextInput
                      style={[styles.fieldInput, { flex: 1, height: 48, paddingVertical: 12, marginRight: 8 }]}
                      placeholder="Type a note to save below..."
                      placeholderTextColor={colors.textMuted}
                      value={quickModalNote}
                      onChangeText={setQuickModalNote}
                    />
                    {quickModalNote.trim().length > 0 && (
                      <TouchableOpacity 
                        onPress={async () => {
                          await addInteraction('NOTE_ADDED', quickModalNote.trim());
                          setQuickModalNote('');
                          fetchInteractions();
                        }}
                        style={{ backgroundColor: colors.accent, padding: 12, borderRadius: 12 }}
                      >
                        <IconSend size={18} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: 10, justifyContent: 'space-around', backgroundColor: colors.bgPanel, padding: 12, borderRadius: 12 }}>
                    <TouchableOpacity 
                      onPress={async () => {
                        if (isRecordingQuick) {
                          await audioRecorder.stop();
                          setIsRecordingQuick(false);
                          const uri = audioRecorder.uri;
                          if (uri) {
                            if (!client) setLocalVoiceNoteUri(uri);
                            else await uploadAudio(uri, 'VOICE_INSTRUCTION');
                            fetchInteractions();
                          }
                        } else {
                          const permitted = await AudioModule.requestRecordingPermissionsAsync();
                          if (permitted.granted) {
                            await audioRecorder.record();
                            setIsRecordingQuick(true);
                          }
                        }
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
                    >
                      <IconMic size={18} color={isRecordingQuick ? colors.danger : colors.accent} />
                      <Text style={{ color: isRecordingQuick ? colors.danger : colors.textPrimary, marginLeft: 6, fontSize: 12, fontWeight: '600' }}>
                        {isRecordingQuick ? 'Stop' : 'Voice'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={async () => {
                        await pickImage();
                        fetchInteractions();
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
                    >
                      <IconCamera size={18} color={colors.accent} />
                      <Text style={{ color: colors.textPrimary, marginLeft: 6, fontSize: 12, fontWeight: '600' }}>Image</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={async () => {
                        await pickDocument();
                        fetchInteractions();
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
                    >
                      <IconAttach size={18} color={colors.accent} />
                      <Text style={{ color: colors.textPrimary, marginLeft: 6, fontSize: 12, fontWeight: '600' }}>Doc</Text>
                    </TouchableOpacity>
                  </View>

                  {localVoiceNoteUri && !client && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, padding: 12, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: colors.border }}>
                      <TouchableOpacity 
                        onPress={async () => {
                          if (playingUri === localVoiceNoteUri) stopAudio();
                          else playRecording(localVoiceNoteUri);
                        }}
                        style={{ backgroundColor: playingUri === localVoiceNoteUri ? colors.dangerLight : colors.accentLight, padding: 8, borderRadius: 20 }}
                      >
                        {playingUri === localVoiceNoteUri ? <IconStop size={16} color={colors.danger} /> : <IconPlay size={16} color={colors.accent} />}
                      </TouchableOpacity>
                      <Text style={{ flex: 1, color: colors.textPrimary, marginLeft: 12, fontSize: 13, fontWeight: '600' }}>New Voice Note Preview</Text>
                      <TouchableOpacity onPress={() => { setLocalVoiceNoteUri(null); stopAudio(); }} style={{ padding: 4 }}>
                        <IconCloseCircle size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                    {[...pendingInteractions, ...interactions].filter(i => ['NOTE_ADDED', 'VOICE_INSTRUCTION', 'ATTACHMENT_ADDED'].includes(i.type)).map((item, idx) => {
                      const isVoice = item.type === 'VOICE_INSTRUCTION';
                      const isNote = item.type === 'NOTE_ADDED';
                      return (
                        <TouchableOpacity 
                          key={item.id || idx}
                          onPress={async () => {
                            if (isVoice && item.media_url && item.media_url !== 'DELETED') {
                              await playRecording(item.media_url);
                            } else if (item.media_url && item.media_url !== 'DELETED') {
                              Linking.openURL(item.media_url).catch(err => Alert.alert('Error', 'Cannot open file.'));
                            } else if (isNote) {
                              Alert.alert('Note Details', item.content || '');
                            }
                          }}
                          style={{
                            flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, 
                            borderWidth: 1, borderColor: colors.border, borderRadius: 20,
                            paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8
                          }}
                        >
                          {isVoice ? (
                            <IconMic size={14} color={playingUri === item.media_url ? colors.danger : colors.success} />
                          ) : isNote ? (
                            <IconNote size={14} color={colors.accent} />
                          ) : (
                            <IconAttach size={14} color={colors.warning} />
                          )}
                          <Text 
                            numberOfLines={1} 
                            style={{ color: colors.textPrimary, marginLeft: 6, fontSize: 11, maxWidth: 100 }}
                          >
                            {isNote ? item.content : (item.content || 'Attachment')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Bottom cancel button */}
              <TouchableOpacity
                style={[styles.cancelBtn, { marginTop: 8 }]}
                onPress={() => { setShowAddClientModal(false); if (route.params?.openEdit) navigation.goBack(); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Log Call Modal ── */}
      <Modal visible={showLogCall} animationType="slide" presentationStyle="pageSheet" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetContent}>
              <View style={styles.sheetHandle} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.sheetTitle}>Log a Call</Text>
                <TouchableOpacity onPress={() => setShowLogCall(false)} style={{ padding: 4 }}>
                  <IconClose size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.fieldInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                placeholder="What was discussed? (optional)"
                placeholderTextColor={colors.textMuted}
                value={logCallNote}
                onChangeText={setLogCallNote}
                multiline
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={handleLogCall}>
                <IconCall size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Save Call Log</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLogCall(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Call Recordings Modal ── */}
      <Modal visible={showCallRecModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowCallRecModal(false); stopAudio(); }} style={{ padding: 4 }}>
              <IconClose size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Recordings ({callRecordings.length})</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={[styles.fieldLabel, { paddingHorizontal: spacing.lg, marginTop: 8, marginBottom: 4 }]}>
            Tap ▶ to play recorded calls
          </Text>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
            {callRecordings.map((rec, i) => {
              const isPlaying = playingUri === rec.uri;
              return (
                <View key={i} style={styles.recCard}>
                  <TouchableOpacity
                    style={[styles.recPlayBtn, { backgroundColor: isPlaying ? colors.dangerLight : colors.accentLight }]}
                    onPress={() => playRecording(rec.uri)}
                    disabled={playbackLoading}
                  >
                    {playbackLoading && playingUri === rec.uri ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : isPlaying ? (
                      <IconStop size={28} color={colors.danger} />
                    ) : (
                      <IconPlay size={28} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.recFilename} numberOfLines={1}>{rec.filename}</Text>
                    <Text style={styles.recDate}>
                      {new Date(rec.creationTime).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                      {rec.duration ? ` · ${formatDuration(rec.duration)}` : ''}
                    </Text>
                    {isPlaying && (
                      <View style={styles.playingBar}>
                        <View style={styles.playingPulse} />
                        <Text style={styles.playingText}>Playing...</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Main Detail View ── */}
      {client && (
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingBottom: 50 }}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0, 1]}
        >
          {/* Header */}
          <View style={{ zIndex: 10, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginLeft: -8 }}>
                <IconArrowBack size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {profile?.feature_flags?.actions?.edit_profile !== false && (
                  <TouchableOpacity 
                    onPress={handleEditClientPress} 
                    style={{ 
                      paddingHorizontal: 12, paddingVertical: 6, 
                      backgroundColor: colors.accent + '20', borderRadius: 8,
                      marginRight: 8
                    }}
                  >
                    <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Edit Details</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  onPress={() => setShowSettingsMenu(true)} 
                  style={{ padding: 8, marginRight: -8 }}
                >
                  <IconMoreVert size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={[styles.bigAvatar, { width: 64, height: 64, borderRadius: 32, marginRight: 16, backgroundColor: colors.accent }]}>
                <Text style={[styles.bigAvatarText, { fontSize: 24 }]}>{getInitials(client.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clientName, { fontSize: 24, fontWeight: '800', color: colors.textPrimary }]} numberOfLines={1}>{client.name}</Text>
                {client.phone ? (
                  <Text style={[styles.clientPhone, { fontSize: 15, color: colors.textSecondary, marginTop: 4 }]}>{client.phone}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* DELETED ALERT BANNER FOR ADMINS */}
          {client.is_deleted && isAdmin && (
            <View style={{ backgroundColor: colors.danger, padding: 8, marginHorizontal: 16, borderRadius: 8, marginBottom: 16, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 }}>DELETED CLIENT</Text>
            </View>
          )}

          {/* OVERDUE ALERT BANNER */}
          {!client.is_deleted && isExceeded(client.reminder_date, client.status) ? (
            <View style={{ backgroundColor: colors.danger, padding: 16, marginHorizontal: 16, borderRadius: 12, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 10 }} />
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>FOLLOW-UP OVERDUE</Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 13, marginBottom: 16, opacity: 0.9 }}>
                Action items and notes are disabled. Please reschedule this client to continue.
              </Text>
              <TouchableOpacity 
                style={{ backgroundColor: '#fff', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                onPress={() => {
                  setInlineDate(new Date(Date.now() + 15 * 60000));
                  setShowInlineDatePicker(true);
                }}
              >
                <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 14 }}>RESCHEDULE NOW</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          
          {/* Badges Row */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              {client.lead_type && (
                <TouchableOpacity 
                  onPress={() => setQuickAction('lead_type')}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: client.lead_type === 'Hot' ? `${colors.danger}20` : 
                                     client.lead_type === 'Warm' ? `${colors.warning}20` : `${colors.cyan}20`,
                    borderRadius: 100,
                    paddingHorizontal: 12, paddingVertical: 6
                  }}
                >
                  <Text style={{
                    fontSize: 12, fontWeight: '700',
                    color: client.lead_type === 'Hot' ? colors.danger : 
                           client.lead_type === 'Warm' ? colors.warning : colors.cyan 
                  }}>
                    {client.lead_type} Lead
                  </Text>
                </TouchableOpacity>
              )}

              {client.reminder_date && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <TouchableOpacity 
                    onPress={() => setQuickAction('status')}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: `${colors.warning}20`,
                      borderRadius: 100,
                      paddingHorizontal: 12, paddingVertical: 6
                    }}
                  >
                    <IconCalendar size={14} color={colors.warning} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.warning }}>
                      Follow-up: {formatReminderDate(client.reminder_date)}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: colors.accentLight,
                      borderRadius: 100, borderWidth: 1, borderColor: colors.accent + '40',
                      paddingHorizontal: 12, paddingVertical: 6
                    }}
                    onPress={() => {
                      setInlineDate(new Date(client.reminder_date!));
                      setShowInlineDatePicker(true);
                    }}
                  >
                    <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '700' }}>Reschedule</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Floating Settings Menu Overlay */}
          <Modal visible={showSettingsMenu} transparent animationType="fade" onRequestClose={() => setShowSettingsMenu(false)}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSettingsMenu(false)}>
              <View style={{
                position: 'absolute', top: 55, right: 16,
                backgroundColor: colors.bgCard, borderRadius: 8,
                padding: 4, minWidth: 160,
                shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15, shadowRadius: 10, elevation: 8,
                borderWidth: 1, borderColor: colors.border
              }}>
                {client.is_deleted ? (
                  <TouchableOpacity style={{ padding: 14 }} onPress={handleRestoreClient}>
                    <Text style={{ color: colors.success, fontSize: 15, fontWeight: '500' }}>Restore Client</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    {profile?.feature_flags?.actions?.edit_profile !== false && (
                      <TouchableOpacity style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={handleEditClientPress}>
                        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '500' }}>Edit Details</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={{ padding: 14 }} onPress={handleDeleteClient}>
                      <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '500' }}>Delete Client</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </Modal>

          {client.is_deleted && !isAdmin ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 64, marginBottom: 16 }}>😔</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>This client was deleted.</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                To use this window, please restore the client from the top right menu.
              </Text>
            </View>
          ) : (
            <>
              {/* Status Selector */}
              <View style={styles.statusRow}>
            {(['Follow-up', 'Converted', 'Lost'] as Status[]).map(s => {
              const c = STATUS_COLORS[s];
              return (
                <TouchableOpacity key={s} onPress={() => handleStatusChange(s)}
                  style={[styles.statusOption,
                    { borderColor: client.status === s ? c.text : colors.border },
                    client.status === s && { backgroundColor: c.bg }]}>
                  <Text style={[styles.statusOptionText, { color: client.status === s ? c.text : colors.textMuted }]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick Actions — 2x2 grid */}
          {!isExceeded(client.reminder_date, client.status) && (
            <View style={styles.qaGrid}>
              {profile?.feature_flags?.actions?.dialer !== false && (
                <TouchableOpacity
                  style={styles.qaCard}
                  onPress={() => {
                    if (client?.phone) {
                      startCall(client.id, client.name, client.phone);
                    } else {
                      alert('No phone number saved for this client.');
                    }
                  }}
                >
                  <View style={[styles.qaIconCircle, { backgroundColor: colors.success }]}>
                    <IconCall size={22} color="#fff" />
                  </View>
                  <Text style={[styles.qaCardText, { color: colors.success }]}>Call</Text>
                </TouchableOpacity>
              )}

              {profile?.feature_flags?.actions?.whatsapp !== false && (
                <TouchableOpacity
                  style={styles.qaCard}
                  onPress={async () => {
                    try {
                      await Linking.openURL(`https://wa.me/${(client.phone || '').replace(/\D/g, '')}`);
                    } catch (err) {
                      Alert.alert('Error', 'Could not open WhatsApp. Please ensure it is installed.');
                    }
                    await addInteraction('WHATSAPP_CONTACT', `Started WhatsApp chat with ${client.name}`);
                  }}
                >
                  <View style={[styles.qaIconCircle, { backgroundColor: '#25D366' }]}>
                    <IconWhatsApp size={22} color="#fff" />
                  </View>
                  <Text style={[styles.qaCardText, { color: '#25D366' }]}>WhatsApp</Text>
                </TouchableOpacity>
              )}

              {/* Temporarily disabled Log Call and Recordings
              <TouchableOpacity style={styles.qaCard} onPress={() => setShowLogCall(true)}>
                <View style={[styles.qaIconCircle, { backgroundColor: colors.purple }]}>
                  <IconNote size={22} color="#fff" />
                </View>
                <Text style={[styles.qaCardText, { color: colors.purple }]}>Log Call</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.qaCard} onPress={detectCallRecordings} disabled={scanningRec}>
                <View style={[styles.qaIconCircle, { backgroundColor: colors.danger }]}>
                  {scanningRec
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <IconMicCircle size={22} color="#fff" />
                  }
                </View>
                <Text style={[styles.qaCardText, { color: colors.danger }]}>
                  {scanningRec ? 'Scanning...' : 'Recordings'}
                </Text>
              </TouchableOpacity>
              */}

              {isField && (
                <TouchableOpacity style={styles.qaCard} onPress={pinLocation} disabled={uploading}>
                  <View style={[styles.qaIconCircle, { backgroundColor: colors.accent }]}>
                    {uploading ? <ActivityIndicator size="small" color="#fff" /> : <IconMap size={22} color="#fff" />}
                  </View>
                  <Text style={[styles.qaCardText, { color: colors.accent }]}>Pin Location</Text>
                </TouchableOpacity>
              )}

              {profile?.feature_flags?.actions?.upload_files !== false && (
                <TouchableOpacity style={styles.qaCard} onPress={takePhoto} disabled={uploading}>
                  <View style={[styles.qaIconCircle, { backgroundColor: colors.cyan }]}>
                    {uploading ? <ActivityIndicator size="small" color="#fff" /> : <IconCamera size={22} color="#fff" />}
                  </View>
                  <Text style={[styles.qaCardText, { color: colors.cyan }]}>Take Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {!isExceeded(client.reminder_date, client.status) && (
            <View style={{ flexDirection: 'column', alignItems: 'center', marginVertical: spacing.sm, gap: 12 }}>
              <TouchableOpacity 
                style={{ backgroundColor: colors.bgPanel, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
                onPress={() => {
                  if (NativeModules.CallRecordingModule?.syncPendingRecordings) {
                    NativeModules.CallRecordingModule.syncPendingRecordings();
                    Alert.alert('Sync Triggered', 'Checking deep storage for background recordings. If no other alert appears, storage is empty.');
                  } else {
                    Alert.alert('Error', 'Call Recording Module not found on this device.');
                  }
                }}
              >
                <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '600' }}>
                  Force Sync Background Recordings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowRecorderSetup(true)}>
                <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '500' }}>
                  Automatic Call Recording Not Working? Tap Here
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabs}>
            {([['add', 'Add'], ['timeline', 'Timeline'], ['notes', 'Notes'], ['files', 'Files'], ['locations', 'Locations']] as const).filter(([key]) => {
              if (key === 'locations' && !isField) return false;
              return true;
            }).map(([key, label]) => (
              <TouchableOpacity key={key} onPress={() => setTab(key as Tab)}
                style={[styles.tab, tab === key && styles.tabActive]}>
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          <View style={{ padding: spacing.lg }}>

            {/* ── ADD ── */}
            <View style={{ display: tab === 'add' ? 'flex' : 'none' }}>
                {isExceeded(client.reminder_date, client.status) ? (
                  <View style={{ padding: 20, alignItems: 'center', backgroundColor: colors.bgPanel, borderRadius: 12, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }}>
                    <IconCalendar size={32} color={colors.danger} style={{ marginBottom: 12 }} />
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>Note Entry Disabled</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center' }}>Please update the overdue follow-up date to enable notes and attachments.</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.inputModeTabs}>
                      {([['note', 'Note', IconNote],
                        ['voice', 'Voice', IconMicOutline],
                        ['file', 'File', IconAttach]] as const).filter(([mode]) => {
                          if (mode === 'voice' && profile?.feature_flags?.actions?.voice_record === false) return false;
                          if (mode === 'file' && profile?.feature_flags?.actions?.upload_files === false) return false;
                          return true;
                        }).map(([mode, label, ModeIcon]) => (
                        <TouchableOpacity key={mode} onPress={() => setInputMode(mode as InputMode)}
                          style={[styles.modeTab, inputMode === mode && styles.modeTabActive]}>
                          <ModeIcon size={14} color={inputMode === mode ? colors.accent : colors.textMuted} />
                          <Text style={[styles.modeTabText, inputMode === mode && { color: colors.accent }]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {inputMode === 'note' && (
                      <>
                        <TextInput
                          style={styles.noteInput}
                          placeholder="Write a note, update or instruction..."
                          placeholderTextColor={colors.textMuted}
                          value={newNote}
                          onChangeText={setNewNote}
                          multiline
                          textAlignVertical="top"
                        />
                        <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveNote}
                          disabled={savingNote || !newNote.trim()}>
                          {savingNote ? <ActivityIndicator color="#fff" /> : (
                            <Text style={styles.primaryBtnText}>Save Note</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    )}

                    <View style={{ display: inputMode === 'voice' ? 'flex' : 'none' }}>
                      <VoiceRecorder 
                        label="Client Voice Note"
                        folder={client?.id || 'temp'}
                        onUpload={async (url) => {
                            await addInteraction('VOICE_INSTRUCTION', 'Voice note attached to client.', url);
                        }}
                      />
                    </View>

                    {inputMode === 'file' && (
                      <View>
                        <TouchableOpacity style={[styles.fileBtn, { marginBottom: 12 }]} onPress={pickImage} disabled={uploading}>
                          <IconImage size={22} color={colors.accent} />
                          <Text style={styles.fileBtnText}>Upload Image / Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.fileBtn, { marginBottom: 12 }]} onPress={pickDocument} disabled={uploading}>
                          <IconDocument size={22} color={colors.cyan} />
                          <Text style={[styles.fileBtnText, { color: colors.cyan }]}>Upload Document (PDF, DOC...)</Text>
                        </TouchableOpacity>
                        {uploading && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <ActivityIndicator color={colors.accent} style={{ marginRight: 10 }} />
                            <Text style={{ color: colors.textSecondary }}>Uploading...</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
            </View>



            {/* ── TIMELINE ── */}
            {tab === 'timeline' && (
              <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {['ALL', 'CALLS', 'RECORDINGS', 'NOTES', 'VOICE', 'REMINDERS', 'FILES', 'MAPS']
                    .filter(f => f !== 'MAPS' || isField)
                    .map(f => {
                      const active = timelineFilter === f;
                      return (
                        <TouchableOpacity
                          key={f}
                          onPress={() => setTimelineFilter(f)}
                          style={{
                            paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                            backgroundColor: active ? colors.accent : colors.bgPanel,
                            marginRight: 8, borderWidth: 1, borderColor: active ? colors.accent : colors.border
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: active ? '#fff' : colors.textMuted }}>{f}</Text>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
                <Text style={styles.sectionTitle}>
                  {timelineFilter === 'ALL' ? 'All Activity' : `${timelineFilter} only`} • Newest First
                </Text>
                 {timelineItems.length === 0 ? (
                  <Text style={styles.emptyMsg}>No activity yet. Add notes or log calls.</Text>
                ) : (
                  timelineItems.map((item: any, idx) => {
                    const iconColor = getInteractionIconColor(item.type, colors);
                    const label = getInteractionLabel(item.type);
                    const isAudio = item.media_url && item.media_url !== 'DELETED' && (item.type === 'CALL_RECORDING' || item.type === 'VOICE_INSTRUCTION');
                    const isPlaying = playingUri === item.media_url;
                    return (
                      <View key={item.id} style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: iconColor + '20', borderColor: iconColor + '40' }]}>
                          <TimelineIcon type={item.type} colors={colors} size={14} />
                        </View>
                        {idx < timelineItems.length - 1 && <View style={styles.timelineLine} />}
                        <View style={styles.timelineBody}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.timelineType, { color: iconColor }]}>{label}</Text>
                              {item.content ? <Text style={styles.timelineContent}>{item.content}</Text> : null}
                            </View>
                            {item._kind === 'interaction' && isAdmin && (
                              <TouchableOpacity onPress={() => deleteInteraction(item.id, label)} style={{ padding: 4 }}>
                                <IconTrash size={14} color={colors.textMuted} />
                              </TouchableOpacity>
                            )}
                          </View>
                          {item.media_url === 'DELETED' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
                              <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>Deleted File</Text>
                            </View>
                          )}
                          {isAudio && (
                            <TouchableOpacity
                              style={[styles.audioPlayBtn, { borderColor: isPlaying ? colors.danger : iconColor + '60' }]}
                              onPress={() => playRecording(item.media_url)}
                            >
                              {isPlaying
                                ? <IconStop size={18} color={colors.danger} />
                                : <IconPlay size={18} color={iconColor} />
                              }
                              <Text style={[styles.audioPlayText, { color: isPlaying ? colors.danger : iconColor }]}>
                                {isPlaying ? 'Stop' : 'Play Recording'}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {item.media_url && !isAudio && item.media_url !== 'DELETED' && (
                             <TouchableOpacity 
                               style={[styles.primaryBtn, { height: 36, paddingVertical: 0, marginTop: 8, backgroundColor: colors.bgPanel, borderWidth: 1, borderColor: colors.accent }]}
                               onPress={() => Linking.openURL(item.media_url)}
                             >
                               <IconAttach size={16} color={colors.accent} />
                               <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700', marginLeft: 6 }}>Open Attachment</Text>
                             </TouchableOpacity>
                           )}
                          <Text style={styles.timelineDate}>{formatDate(item.created_at)}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* ── NOTES TAB ── */}
            {tab === 'notes' && (
              <View>
                <Text style={[styles.sectionTitle, { marginBottom: 12, fontSize: 16 }]}>Saved Notes & Attachments</Text>
                {interactions.filter(i => ['NOTE_ADDED', 'VOICE_INSTRUCTION', 'ATTACHMENT_ADDED', 'CALL_PICKED', 'CALL_MISSED'].includes(i.type)).length === 0 ? (
                  <Text style={styles.emptyMsg}>No notes saved yet.</Text>
                ) : (
                  interactions
                    .filter(i => ['NOTE_ADDED', 'VOICE_INSTRUCTION', 'ATTACHMENT_ADDED', 'CALL_PICKED', 'CALL_MISSED'].includes(i.type))
                    .map((item: any) => {
                      const iconColor = getInteractionIconColor(item.type, colors);
                      const label = getInteractionLabel(item.type);
                      const isAudio = item.media_url && item.media_url !== 'DELETED' && (item.type === 'CALL_RECORDING' || item.type === 'VOICE_INSTRUCTION');
                      const isPlaying = playingUri === item.media_url;
                      return (
                        <View key={item.id} style={[styles.timelineItem, { paddingVertical: 8 }]}>
                          <View style={[styles.timelineDot, { backgroundColor: iconColor + '20', borderColor: iconColor + '40' }]}>
                            <TimelineIcon type={item.type} colors={colors} size={14} />
                          </View>
                          <View style={styles.timelineBody}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.timelineType, { color: iconColor, fontWeight: 'bold' }]}>{label}</Text>
                                {item.content ? <Text style={styles.timelineContent}>{item.content}</Text> : null}
                              </View>
                              {isAdmin && (
                                <TouchableOpacity onPress={() => deleteInteraction(item.id, label)} style={{ padding: 4 }}>
                                  <IconTrash size={14} color={colors.textMuted} />
                                </TouchableOpacity>
                              )}
                            </View>

                            {item.media_url === 'DELETED' && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
                                  <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>Deleted File</Text>
                                </View>
                              )}
                            {isAudio && (
                              <TouchableOpacity
                                style={[styles.audioPlayBtn, { borderColor: isPlaying ? colors.danger : iconColor + '60', marginTop: 6 }]}
                                onPress={() => playRecording(item.media_url)}
                              >
                                {isPlaying ? <IconStop size={16} color={colors.danger} /> : <IconPlay size={16} color={iconColor} />}
                                <Text style={[styles.audioPlayText, { color: isPlaying ? colors.danger : iconColor, fontSize: 12 }]}>
                                  {isPlaying ? 'Stop Playback' : 'Play Audio'}
                                </Text>
                              </TouchableOpacity>
                            )}
                            {item.media_url && !isAudio && item.media_url !== 'DELETED' && (
                              <TouchableOpacity 
                                style={[styles.primaryBtn, { height: 36, paddingVertical: 0, marginTop: 8, backgroundColor: colors.bgPanel, borderWidth: 1, borderColor: colors.accent }]}
                                onPress={() => Linking.openURL(item.media_url)}
                              >
                                <IconAttach size={16} color={colors.accent} />
                                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700', marginLeft: 6 }}>Open Attachment</Text>
                              </TouchableOpacity>
                            )}
                            <Text style={styles.timelineDate}>{formatDate(item.created_at)}</Text>
                          </View>
                        </View>
                      );
                    })
                )}
              </View>
            )}

            {/* ── FILES TAB ── */}
            {tab === 'files' && (
              <View>
                <Text style={styles.sectionTitle}>Files & Audio Recordings</Text>
                 {interactions.filter(i => ['VOICE_INSTRUCTION', 'ATTACHMENT_ADDED', 'CALL_RECORDING'].includes(i.type)).length === 0 ? (
                  <Text style={styles.emptyMsg}>No files uploaded yet.</Text>
                ) : (
                  interactions
                    .filter(i => ['VOICE_INSTRUCTION', 'ATTACHMENT_ADDED', 'CALL_RECORDING'].includes(i.type))
                    .map((item: any) => {
                      const iconColor = getInteractionIconColor(item.type, colors);
                      const label = getInteractionLabel(item.type);
                      const isAudio = item.media_url && item.media_url !== 'DELETED' && (item.type === 'CALL_RECORDING' || item.type === 'VOICE_INSTRUCTION');
                      const isPlaying = playingUri === item.media_url;
                      return (
                        <View key={item.id} style={styles.timelineItem}>
                          <View style={[styles.timelineDot, { backgroundColor: iconColor + '20', borderColor: iconColor + '40' }]}>
                            <TimelineIcon type={item.type} colors={colors} size={14} />
                          </View>
                          <View style={styles.timelineBody}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.timelineType, { color: iconColor }]}>{label}</Text>
                                {item.content ? <Text style={styles.timelineContent}>{item.content}</Text> : null}
                              </View>
                              {isAdmin && (
                                <TouchableOpacity onPress={() => deleteInteraction(item.id, label)} style={{ padding: 4 }}>
                                  <IconTrash size={14} color={colors.textMuted} />
                                </TouchableOpacity>
                              )}
                            </View>
                            {item.media_url === 'DELETED' && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
                                  <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>Deleted File</Text>
                                </View>
                              )}
                            {isAudio && (
                              <TouchableOpacity
                                style={[styles.audioPlayBtn, { borderColor: isPlaying ? colors.danger : iconColor + '60' }]}
                                onPress={() => playRecording(item.media_url)}
                              >
                                {isPlaying ? <IconStop size={18} color={colors.danger} /> : <IconPlay size={18} color={iconColor} />}
                                <Text style={[styles.audioPlayText, { color: isPlaying ? colors.danger : iconColor }]}>
                                  {isPlaying ? 'Stop' : 'Play Note'}
                                </Text>
                              </TouchableOpacity>
                            )}
                            {item.media_url && !isAudio && (
                              <TouchableOpacity 
                                style={[styles.primaryBtn, { height: 36, paddingVertical: 0, marginTop: 8, backgroundColor: colors.bgPanel, borderWidth: 1, borderColor: colors.accent }]}
                                onPress={() => Linking.openURL(item.media_url)}
                              >
                                <IconAttach size={16} color={colors.accent} />
                                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700', marginLeft: 6 }}>Open Attachment</Text>
                              </TouchableOpacity>
                            )}
                            <Text style={styles.timelineDate}>{formatDate(item.created_at)}</Text>
                          </View>
                        </View>
                      );
                    })
                )}
              </View>
            )}
            {tab === 'locations' && (
              <View>
                <Text style={styles.sectionTitle}>Pinned Locations & Photos</Text>
                {interactions.filter(i => i.type === 'PINNED_LOCATION').length === 0 ? (
                  <Text style={styles.emptyMsg}>No pinned locations yet.</Text>
                ) : (
                  <View>
                    {interactions.filter(i => i.type === 'PINNED_LOCATION').map(item => (
                      <View key={item.id} style={[styles.qaCard, { width: '100%', alignItems: 'stretch', padding: 0, overflow: 'hidden', marginBottom: 16 }]}>
                        {item.media_url && (
                          <View style={{ width: '100%', height: 200, backgroundColor: colors.bgPanel }}>
                            {/* In a real app we'd use <Image source={{ uri: item.media_url }} /> */}
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                              <IconImage size={48} color={colors.textMuted} />
                              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>Pinned Location Photo</Text>
                            </View>
                          </View>
                        )}
                        <View style={{ padding: spacing.md }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <IconPin size={16} color={colors.accent} style={{ marginRight: 6 }} />
                              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Location Pinned</Text>
                            </View>
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>{formatDate(item.created_at)}</Text>
                          </View>
                          <Text style={{ fontSize: 13, color: colors.textSecondary }}>{item.content}</Text>
                          <TouchableOpacity 
                            style={[styles.primaryBtn, { height: 40, paddingVertical: 0, marginTop: 4, backgroundColor: colors.bgPanel, borderWidth: 1, borderColor: colors.accent }]}
                            onPress={async () => {
                              const match = item.content?.match(/(-?\d+\.\d+), (-?\d+\.\d+)/);
                              if (match) {
                                const [_, lat, lon] = match;
                                try {
                                  await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`);
                                } catch (err) {
                                  Alert.alert('Error', 'Could not open Maps. Please ensure Google Maps is installed.');
                                }
                              }
                            }}
                          >
                            <IconMap size={16} color={colors.accent} />
                            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Open in Maps</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                             style={[styles.primaryBtn, { height: 40, paddingVertical: 0, marginTop: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: colors.danger }]}
                             onPress={async () => {
                               setPinToDelete(item);
                               setShowDeletePinModal(true);
                             }}
                           >
                             <IconTrash size={16} color={colors.danger} />
                             <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '700' }}>Request Deletion</Text>
                           </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
          </>
          )}
        </ScrollView>
      )}

      <Modal visible={showDeletePinModal} transparent animationType="slide">
         <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
           <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 20 }}>
             <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>Request Deletion</Text>
             <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
               Why do you want to delete this pinned location?
             </Text>
             <TextInput
               style={{ 
                 backgroundColor: colors.bgPanel, color: colors.textPrimary, 
                 borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top',
                 borderWidth: 1, borderColor: colors.border
               }}
               placeholder="Enter reason here..."
               placeholderTextColor={colors.textMuted}
               value={deleteReason}
               onChangeText={setDeleteReason}
               multiline
             />
             <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
               <TouchableOpacity 
                 style={{ flex: 1, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                 onPress={() => { setShowDeletePinModal(false); setDeleteReason(''); }}
               >
                 <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Cancel</Text>
               </TouchableOpacity>
               <TouchableOpacity 
                 style={{ flex: 1, padding: 14, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center' }}
                 onPress={async () => {
                   if (!deleteReason.trim() || !pinToDelete) return;
                   setIsDeletingPin(true);
                   try {
                     await addInteraction('DELETE_REQUESTED', `Request to delete pinned location. Reason: ${deleteReason}`, pinToDelete.id);
                     Alert.alert("Success", "Deletion request sent to admin.");
                     setShowDeletePinModal(false);
                     setDeleteReason('');
                   } catch (e) {}
                   setIsDeletingPin(false);
                 }}
                 disabled={isDeletingPin || !deleteReason.trim()}
               >
                 {isDeletingPin ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Send Request</Text>}
               </TouchableOpacity>
             </View>
           </View>
         </View>
       </Modal>
      {client && (
        <>
          <CallFeedbackModal
            visible={showCallFeedback}
            clientId={client.id}
            clientName={client.name}
            startTime={callStartTime}
            onClose={() => {
              setShowCallFeedback(false);
              setCallStartTime(undefined);
            }}
            onSuccess={() => {
              fetchFullClient(client.id);
              fetchInteractions();
            }}
          />
          
          <CallRecorderSetupModal 
            visible={showRecorderSetup}
            onClose={() => setShowRecorderSetup(false)}
          />

          <PremiumDateTimePicker
            visible={showInlineDatePicker}
            value={inlineDate}
            minimumDate={new Date()}
            onClose={() => setShowInlineDatePicker(false)}
            onChange={(date) => {
              setInlineDate(date);
              handleInlineReminderUpdate(date);
            }}
          />
          {/* ── Quick Update Modal ── */}
          <Modal visible={!!quickAction} transparent animationType="fade">
            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
              onPress={() => setQuickAction(null)}
              activeOpacity={1}
            >
              <View style={{ backgroundColor: colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
                <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>
                  {quickAction === 'status' ? 'Update Client Status' : 'Update Lead Temperature'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 24, textAlign: 'center' }}>
                  {quickAction === 'status' ? 'Current: ' + client.status : 'Current: ' + client.lead_type}
                </Text>

                <View style={{ gap: 12 }}>
                  {quickAction === 'status' ? (
                    (['Follow-up', 'Converted', 'Lost'] as Status[]).map(s => {
                      const active = client.status === s;
                      return (
                        <TouchableOpacity 
                          key={s}
                          onPress={async () => {
                            setQuickAction(null);
                            await handleStatusUpdate(s);
                          }}
                          style={{
                            paddingVertical: 14, borderRadius: 12, borderWidth: 1,
                            borderColor: active ? colors.accent : colors.border,
                            backgroundColor: active ? colors.accent + '10' : colors.bgPanel,
                            alignItems: 'center'
                          }}
                        >
                          <Text style={{ color: active ? colors.accent : colors.textPrimary, fontWeight: '700' }}>{s}</Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    (['Hot', 'Warm', 'Cold'] as const).map(lt => {
                      const active = client.lead_type === lt;
                      const ltColor = lt === 'Hot' ? colors.danger : lt === 'Warm' ? colors.warning : colors.cyan;
                      return (
                        <TouchableOpacity 
                          key={lt}
                          onPress={async () => {
                            setQuickAction(null);
                            const { error } = await supabase.from('clients').update({ lead_type: lt }).eq('id', client.id);
                            if (!error) {
                              setClient({ ...client, lead_type: lt });
                              await addInteraction('PROFILE_UPDATED', `Lead temperature changed to ${lt}.`);
                            }
                          }}
                          style={{
                            paddingVertical: 14, borderRadius: 12, borderWidth: 1,
                            borderColor: active ? ltColor : colors.border,
                            backgroundColor: active ? ltColor + '10' : colors.bgPanel,
                            alignItems: 'center'
                          }}
                        >
                          <Text style={{ color: active ? ltColor : colors.textPrimary, fontWeight: '700' }}>{lt} Lead</Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>

                <TouchableOpacity 
                  onPress={() => setQuickAction(null)}
                  style={{ marginTop: 24, paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

        </>
      )}
    </SafeAreaView>
  );
}


function getStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
    cancelHintRow: {
      paddingHorizontal: spacing.lg, paddingVertical: 10,
      backgroundColor: colors.bgPanel,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    cancelHintText: { fontSize: 13, color: colors.textMuted },
    detailHeader: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { padding: 4 },
    clientSummary: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    bigAvatar: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    bigAvatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
    clientName: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
    clientPhone: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    reminderBadge: {
      flexDirection: 'row', alignItems: 'center', marginTop: 4,
      backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: radius.full,
      paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
    },
    reminderBadgeText: { fontSize: 11, color: colors.warning, fontWeight: '600' },
    statusRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    },
    statusOption: {
      height: 34, paddingHorizontal: 16, borderRadius: radius.full,
      borderWidth: 1, borderColor: colors.border, alignItems: 'center',
      justifyContent: 'center', flexShrink: 0, marginRight: 8,
    },
    statusOptionText: { fontSize: 12, fontWeight: '700' },
    qaGrid: {
      flexDirection: 'row', flexWrap: 'wrap',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      justifyContent: 'space-between'
    },
    qaCard: {
      width: (width - spacing.lg * 2 - 12) / 2,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      alignItems: 'center',
      minHeight: 90,
      justifyContent: 'center',
      backgroundColor: colors.bgCard,
      marginBottom: 12
    },
    qaIconCircle: {
      width: 48, height: 48, borderRadius: 24,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 8
    },
    qaCardText: { fontSize: 13, fontWeight: '700' },
    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: colors.accent },
    tabText: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
    tabTextActive: { color: colors.accent, fontWeight: '700' },
    tabContent: { flex: 1 },
    inputModeTabs: { flexDirection: 'row', marginBottom: 16 },
    modeTab: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
      borderWidth: 1, borderColor: colors.border,
      marginRight: 8
    },
    modeTabActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
    modeTabText: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginLeft: 6 },
    noteInput: {
      backgroundColor: colors.bgPanel,
      borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
      color: colors.textPrimary, padding: 14, fontSize: 14, minHeight: 100,
      marginBottom: 16
    },
    primaryBtn: {
      backgroundColor: colors.accent, borderRadius: radius.md,
      paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    cancelBtn: {
      borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
      borderWidth: 1, borderColor: colors.border, marginTop: 8,
    },
    cancelBtnText: { color: colors.textMuted, fontWeight: '500' },
    voiceBox: {
      borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
      padding: spacing.lg, alignItems: 'center',
      backgroundColor: colors.bgPanel,
    },
    voiceStatus: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 16 },
    recordBtn: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.full,
      borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    },
    recordBtnText: { fontWeight: '700', fontSize: 15, marginLeft: 10 },
    fileBtn: {
      flexDirection: 'row', alignItems: 'center',
      padding: spacing.lg, borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.bgPanel,
    },
    fileBtnText: { color: colors.accent, fontWeight: '600', fontSize: 15 },
    sectionTitle: {
      fontSize: 12, fontWeight: '600', letterSpacing: 0.07,
      textTransform: 'uppercase', color: colors.textMuted, marginBottom: 16,
    },
    emptyMsg: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 40 },
    timelineItem: { flexDirection: 'row', marginBottom: 20, position: 'relative' },
    timelineDot: {
      width: 32, height: 32, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0,
      marginRight: 12
    },
    timelineLine: {
      position: 'absolute', left: 15, top: 32,
      width: 1, bottom: -20, backgroundColor: colors.border,
    },
    timelineBody: { flex: 1, paddingTop: 4 },
    timelineType: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.05, marginBottom: 4 },
    timelineContent: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 4 },
    timelineAmount: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
    timelineDate: { fontSize: 12, color: colors.textMuted },
    audioPlayBtn: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: radius.md, borderWidth: 1,
      backgroundColor: colors.bgPanel, marginBottom: 6,
      alignSelf: 'flex-start',
    },
    audioPlayText: { fontSize: 13, fontWeight: '600', marginLeft: 8 },
    field: { marginBottom: 16 },
    fieldLabel: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 },
    fieldInput: {
      backgroundColor: colors.bgPanel,
      borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
      color: colors.textPrimary, padding: 14, fontSize: 14,
    },
    datePickerBtn: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.bgPanel,
      borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14,
    },
    datePickerBtnText: { flex: 1, fontSize: 14, color: colors.textPrimary, marginLeft: 10 },
    bottomSheet: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    bottomSheetContent: {
      backgroundColor: colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: spacing.xl,
    },
    sheetHandle: {
      width: 40, height: 4, backgroundColor: colors.border,
      borderRadius: 2, alignSelf: 'center', marginBottom: 4,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
    recCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.bgPanel, borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: 10,
    },
    recPlayBtn: {
      width: 52, height: 52, borderRadius: 26,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    recFilename: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    recDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    recAttachBtn: {
      flexDirection: 'column', alignItems: 'center',
      paddingHorizontal: 10, paddingVertical: 8,
      borderRadius: radius.md, borderWidth: 1, borderColor: colors.success + '50',
      backgroundColor: colors.successLight,
    },
    recAttachText: { fontSize: 10, fontWeight: '700', color: colors.success, marginTop: 2 },
    playingBar: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    playingPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginRight: 6 },
    playingText: { fontSize: 11, color: colors.danger, fontWeight: '600' },
  });
}
