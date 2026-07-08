import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import type { AppColors } from '../context/ThemeContext';
import {
  IconCall, IconMic, IconRefresh, IconPlay, IconStop, IconMenu
} from '../lib/Icons';
import { useSidebar } from '../context/SidebarContext';
import { Audio } from 'expo-av';

interface CallLog {
  id: string;
  client_id: string | null;
  type: string;
  content?: string;
  media_url?: string;
  created_at: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function groupByDate(logs: CallLog[]) {
  const groups: { label: string; data: CallLog[] }[] = [];
  const seen: Record<string, number> = {};
  logs.forEach(log => {
    const d = new Date(log.created_at);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    if (seen[label] === undefined) { seen[label] = groups.length; groups.push({ label, data: [] }); }
    groups[seen[label]].data.push(log);
  });
  return groups;
}

export default function OtherRecordsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { openSidebar } = useSidebar();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    fetchCallHistory();
    if (navigation) {
      const unsub = navigation.addListener('focus', fetchCallHistory);
      return unsub;
    }
  }, [navigation]);

  useEffect(() => {
    const { DeviceEventEmitter } = require('react-native');
    const syncSub = DeviceEventEmitter.addListener('RECORDING_SYNCED', fetchCallHistory);
    return () => syncSub.remove();
  }, []);

  useEffect(() => {
    return () => { stopAudio(); };
  }, []);

  async function fetchCallHistory() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('interactions')
      .select('*')
      .eq('type', 'CALL_RECORDING')
      .is('client_id', null)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (data) setLogs(data as any);
    setLoading(false);
  }

  async function stopAudio() {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch (e) { }
      soundRef.current = null;
    }
    setPlayingUri(null);
    setPlaybackLoading(false);
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
        }
      });
    } catch (err) {
      console.error('Play error', err);
      Alert.alert('Playback Error', 'Could not play this audio file. It might be corrupted or still uploading.');
      setPlayingUri(null);
    } finally {
      setPlaybackLoading(false);
    }
  }

  const groups = groupByDate(logs);

  function renderLog(log: CallLog) {
    // Extract phone number from content
    const phone = log.content?.replace(/📞\s*Other Recording\s*[—-]\s*/, '') || log.content || 'Unknown Number';
    const isPlaying = playingUri === log.media_url;

    return (
      <View key={log.id} style={styles.logCard}>
        <View style={[styles.avatar, { backgroundColor: colors.warning }]}>
          <IconMic size={20} color="#fff" />
        </View>
        <View style={styles.logContent}>
          <View style={styles.logTop}>
            <Text style={styles.logName} numberOfLines={1}>{phone}</Text>
            <Text style={styles.logTime}>{formatTime(log.created_at)}</Text>
          </View>
          
          <View style={styles.logBottom}>
            <View style={[styles.typeBadge, {
              backgroundColor: colors.warning + '22',
              borderColor: colors.warning + '44',
            }]}>
              <IconMic size={11} color={colors.warning} />
              <Text style={[styles.typeText, { color: colors.warning }]}>
                Other Recording
              </Text>
            </View>
            <Text style={styles.logDate}>{formatDate(log.created_at)}</Text>
          </View>
        </View>
        {log.media_url === 'DELETED' ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }}>
            <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 12 }}>Deleted File</Text>
          </View>
        ) : log.media_url ? (
          <View style={styles.logActions}>
            <TouchableOpacity
              onPress={() => playRecording(log.media_url!)}
              disabled={playbackLoading && playingUri !== log.media_url}
              style={[styles.actionBtn, { backgroundColor: isPlaying ? colors.danger : colors.accent }]}
            >
              {playbackLoading && playingUri === log.media_url ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : isPlaying ? (
                <IconStop size={16} color="#fff" />
              ) : (
                <IconPlay size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Other Records</Text>
          <Text style={styles.headerSub}>Calls to unknown numbers</Text>
        </View>
        <TouchableOpacity onPress={fetchCallHistory} style={styles.refreshBtn}>
          <IconRefresh size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading records...</Text>
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.warning + '22' }]}>
            <IconMic size={40} color={colors.warning} />
          </View>
          <Text style={styles.emptyTitle}>No other records found</Text>
          <Text style={styles.emptyText}>
            Calls made to non-client numbers will appear here automatically.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {groups.map(group => (
            <View key={group.label}>
              <View style={styles.dateHeader}>
                <View style={styles.dateLine} />
                <Text style={styles.dateLabel}>{group.label}</Text>
                <View style={styles.dateLine} />
              </View>
              {group.data.map(log => renderLog(log))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function getStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
    headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    refreshBtn: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentLight,
      alignItems: 'center', justifyContent: 'center',
    },
    dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
    dateLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dateLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    logCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      backgroundColor: colors.bgCard, borderRadius: radius.lg,
      borderWidth: 1, borderColor: colors.warning + '55', padding: spacing.md, marginBottom: 10,
      borderLeftWidth: 3,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    logContent: { flex: 1, gap: 3 },
    logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1 },
    logTime: { fontSize: 11, color: colors.textMuted },
    logBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    typeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1,
    },
    typeText: { fontSize: 11, fontWeight: '700' },
    logDate: { fontSize: 11, color: colors.textMuted },
    logActions: { gap: 8, alignItems: 'center', justifyContent: 'center', height: 44 },
    actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    loadingText: { fontSize: 14, color: colors.textMuted },
    emptyIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  });
}
