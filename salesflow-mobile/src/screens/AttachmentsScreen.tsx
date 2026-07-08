import React, { useState, useEffect, useMemo } from 'react';
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
  IconAttach, IconMic, IconImage, IconRefresh, IconDocument, IconPlay, IconStop, IconChevronForward
} from '../lib/Icons';
import { Audio } from 'expo-av';

interface Attachment {
  id: string;
  client_id: string;
  type: string;
  content?: string;
  media_url: string;
  created_at: string;
  clients?: { name: string; phone: string };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate(logs: Attachment[]) {
  const groups: { label: string; data: Attachment[] }[] = [];
  const seen: Record<string, number> = {};
  logs.forEach(log => {
    const label = formatDate(log.created_at);
    if (seen[label] === undefined) { seen[label] = groups.length; groups.push({ label, data: [] }); }
    groups[seen[label]].data.push(log);
  });
  return groups;
}

export default function AttachmentsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const soundRef = React.useRef<Audio.Sound | null>(null);

  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    fetchAttachments();
    if (navigation) {
      const unsub = navigation.addListener('focus', fetchAttachments);
      return () => {
          unsub();
          stopAudio();
      };
    }
    return () => stopAudio();
  }, [navigation]);

  async function stopAudio() {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
      setPlayingUri(null);
    }
  }

  async function playRecording(uri: string) {
    if (playingUri === uri) {
      await stopAudio();
      return;
    }
    await stopAudio();
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingUri(uri);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setPlayingUri(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (e) {}
  }

  async function fetchAttachments() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('interactions')
      .select('*, clients!inner(name, phone, user_id)')
      .not('media_url', 'is', null)
      .in('type', ['VOICE_INSTRUCTION', 'ATTACHMENT_ADDED', 'CALL_RECORDING', 'PINNED_LOCATION'])
      .eq('clients.user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setItems(data as any);
    setLoading(false);
  }

  const groups = groupByDate(items);

  function renderAttachment(item: Attachment) {
    const isAudio = item.type === 'VOICE_INSTRUCTION' || item.type === 'CALL_RECORDING';
    const isImage = item.type === 'PINNED_LOCATION' || (item.content?.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/));
    const isPlaying = playingUri === item.media_url;
    const clientName = (item.clients as any)?.name || 'Unknown';

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.iconWrap, { backgroundColor: isAudio ? colors.accentLight : colors.bgPanel }]}>
             {isAudio ? <IconMic size={20} color={colors.accent} /> : isImage ? <IconImage size={20} color={colors.accent} /> : <IconDocument size={20} color={colors.accent} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.clientName}>{clientName}</Text>
            <Text style={styles.fileName} numberOfLines={1}>{item.content || 'File Attachment'}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('ClientDetail', { client: item.clients, id: item.client_id })}>
             <IconChevronForward size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.cardActions}>
          {isAudio ? (
            <TouchableOpacity 
              style={[styles.actionBtn, { borderColor: isPlaying ? colors.danger : colors.accent }]} 
              onPress={() => playRecording(item.media_url)}
            >
              {isPlaying ? <IconStop size={16} color={colors.danger} /> : <IconPlay size={16} color={colors.accent} />}
              <Text style={[styles.actionText, { color: isPlaying ? colors.danger : colors.accent }]}>
                {isPlaying ? 'Stop' : 'Listen'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.actionBtn, { borderColor: colors.accent }]} 
              onPress={async () => {
                try {
                  await Linking.openURL(item.media_url);
                } catch (err) {
                  Alert.alert('Error', 'Could not open file.');
                }
              }}
            >
              <IconAttach size={16} color={colors.accent} />
              <Text style={[styles.actionText, { color: colors.accent }]}>View File</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.dateText}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>All Files</Text>
          <Text style={styles.headerSub}>{items.length} attachments found</Text>
        </View>
        <TouchableOpacity onPress={fetchAttachments} style={styles.refreshBtn}>
          <IconRefresh size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <IconAttach size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No files or recordings yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
          {groups.map(group => (
            <View key={group.label} style={{ marginBottom: 20 }}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              {group.data.map(item => renderAttachment(item))}
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
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
    headerSub: { fontSize: 13, color: colors.textMuted },
    refreshBtn: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentLight,
      alignItems: 'center', justifyContent: 'center',
    },
    groupLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
    card: {
      backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    clientName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    fileName: { fontSize: 12, color: colors.textMuted },
    cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md },
    actionText: { fontSize: 13, fontWeight: '600' },
    dateText: { fontSize: 11, color: colors.textMuted },
    emptyText: { color: colors.textMuted, marginTop: 12 },
  });
}
