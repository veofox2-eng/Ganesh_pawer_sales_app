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
  IconCall, IconCallOutline, IconMic, IconMicOutline, IconWhatsApp,
  IconPeopleOutline, IconRefresh, IconCheckmarkDone, IconMenu,
} from '../lib/Icons';
import { useSidebar } from '../context/SidebarContext';

interface CallLog {
  id: string;
  client_id: string;
  type: string;
  content?: string;
  created_at: string;
  clients?: { name: string; phone: string };
}

type CallFilter = 'All' | 'Calls' | 'Recordings';

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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

export default function CallHistoryScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { openSidebar } = useSidebar();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [otherLogs, setOtherLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CallFilter>('All');

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

  async function fetchCallHistory() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Fetch main client-linked calls
    const { data } = await supabase
      .from('interactions')
      .select('*, clients!inner(name, phone, user_id)')
      .in('type', ['CALL_MADE', 'CALL_RECORDING'])
      .eq('clients.user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setLogs(data as any);

    // Fetch personal / non-client recordings
      const { data: otherData } = await supabase
        .from('interactions')
        .select('*')
        .eq('type', 'CALL_RECORDING')
        .is('client_id', null)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    if (otherData) setOtherLogs(otherData);

    setLoading(false);
  }

  const filtered = logs.filter(l => {
    if (filter === 'All') return true;
    if (filter === 'Calls') return l.type === 'CALL_MADE';
    if (filter === 'Recordings') return l.type === 'CALL_RECORDING';
    return true;
  });

  const groups = groupByDate(filtered);
  const totalCalls = logs.filter(l => l.type === 'CALL_MADE').length;
  const totalRecordings = logs.filter(l => l.type === 'CALL_RECORDING').length;
  const uniqueClients = new Set(logs.map(l => l.client_id)).size;

  const STAT_CARDS = [
    { label: 'Calls Made', count: totalCalls, color: colors.success, Icon: IconCall },
    { label: 'Clients', count: uniqueClients, color: colors.accent, Icon: IconPeopleOutline },
  ];

  const FILTER_ITEMS: { key: CallFilter; Icon: any; activeIcon: any }[] = [
    { key: 'All', Icon: IconCheckmarkDone, activeIcon: IconCheckmarkDone },
    { key: 'Calls', Icon: IconCallOutline, activeIcon: IconCall },
  ];

  function renderLog(log: CallLog) {
    const isRecording = log.type === 'CALL_RECORDING';
    const clientName = (log.clients as any)?.name || 'Unknown';
    const clientPhone = (log.clients as any)?.phone || '';
    const initials = getInitials(clientName);

    return (
      <TouchableOpacity
        key={log.id}
        style={styles.logCard}
        activeOpacity={0.8}
        onPress={async () => {
          if (log.client_id) {
            const { data } = await supabase.from('clients').select('*').eq('id', log.client_id).single();
            if (data) {
              navigation.navigate('ClientDetail', { client: data });
            }
          }
        }}
      >
        <View style={[styles.avatar, { backgroundColor: isRecording ? colors.danger : colors.success }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.logContent}>
          <View style={styles.logTop}>
            <Text style={styles.logName} numberOfLines={1}>{clientName}</Text>
            <Text style={styles.logTime}>{formatTime(log.created_at)}</Text>
          </View>
          {clientPhone ? <Text style={styles.logPhone}>{clientPhone}</Text> : null}
          {log.content && log.content !== `Called ${clientName}` ? (
            <Text style={styles.logNote} numberOfLines={2}>{log.content}</Text>
          ) : null}
          <View style={styles.logBottom}>
            <View style={[styles.typeBadge, {
              backgroundColor: isRecording ? 'rgba(239,68,68,0.1)' : colors.successLight,
              borderColor: isRecording ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
            }]}>
              {isRecording
                ? <IconMic size={11} color={colors.danger} />
                : <IconCall size={11} color={colors.success} />
              }
              <Text style={[styles.typeText, { color: isRecording ? colors.danger : colors.success }]}>
                {isRecording ? 'Recording' : 'Call Made'}
              </Text>
            </View>
            <Text style={styles.logDate}>{formatDate(log.created_at)}</Text>
          </View>
        </View>
        {clientPhone ? (
          <View style={styles.logActions}>
            <TouchableOpacity
              onPress={async () => {
                try {
                  await Linking.openURL(`tel:${clientPhone}`);
                } catch (err) {
                  Alert.alert('Error', 'Could not start call.');
                }
              }}
              style={[styles.actionBtn, { backgroundColor: colors.success }]}
            >
              <IconCall size={15} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                try {
                  await Linking.openURL(`https://wa.me/${clientPhone.replace(/\D/g, '')}`);
                } catch (err) {
                  Alert.alert('Error', 'Could not open WhatsApp.');
                }
              }}
              style={[styles.actionBtn, { backgroundColor: '#25D366' }]}
            >
              <IconWhatsApp size={15} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Call History</Text>
          <Text style={styles.headerSub}>{logs.length} logs tracked</Text>
        </View>
        <TouchableOpacity onPress={fetchCallHistory} style={styles.refreshBtn}>
          <IconRefresh size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {STAT_CARDS.map(({ label, count, color, Icon }) => (
          <View key={label} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: color }]}>
              <Icon size={16} color="#fff" />
            </View>
            <Text style={[styles.statValue, { color }]}>{count}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {FILTER_ITEMS.map(({ key, Icon, activeIcon: ActiveIcon }) => (
          <TouchableOpacity key={key} onPress={() => setFilter(key)}
            style={[styles.filterPill, filter === key && styles.filterPillActive]}>
            {filter === key
              ? <ActiveIcon size={13} color={colors.accent} />
              : <Icon size={13} color={colors.textMuted} />
            }
            <Text style={[styles.filterPillText, filter === key && styles.filterPillTextActive]}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading call history...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.accentLight }]}>
            <IconCallOutline size={40} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>
            {filter === 'All' ? 'No call history yet' : `No ${filter.toLowerCase()} logged`}
          </Text>
          <Text style={styles.emptyText}>
            {filter === 'All'
              ? 'Tap "Call" or "Log Call" from a client\'s profile to start tracking.'
              : `Switch to "All" or log a ${filter === 'Calls' ? 'call' : 'recording'} from a client profile.`
            }
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

          {/* ── Other Calls Section ───────────────────────────────── */}
          {otherLogs.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <View style={styles.dateHeader}>
                <View style={styles.dateLine} />
                <Text style={[styles.dateLabel, { color: colors.warning }]}>📵 OTHER CALLS</Text>
                <View style={styles.dateLine} />
              </View>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 10, marginTop: -4 }}>
                Calls not linked to any client in your CRM
              </Text>
              {otherLogs.map((log: any) => {
                const phone = log.content?.replace('📞 Other Recording — ', '') || log.content || 'Unknown';
                return (
                  <View key={log.id} style={[styles.logCard, { borderColor: colors.warning + '55', borderLeftWidth: 3 }]}>
                    <View style={[styles.avatar, { backgroundColor: colors.warning }]}>
                      <IconMic size={20} color="#fff" />
                    </View>
                    <View style={styles.logContent}>
                      <View style={styles.logTop}>
                        <Text style={styles.logName}>{phone}</Text>
                        <Text style={styles.logTime}>{formatTime(log.created_at)}</Text>
                      </View>
                      <Text style={[styles.logDate, { marginTop: 2 }]}>{formatDate(log.created_at)}</Text>
                      <View style={[styles.typeBadge, { backgroundColor: colors.warning + '22', borderColor: colors.warning + '44', marginTop: 6, alignSelf: 'flex-start' }]}>
                        <IconMic size={11} color={colors.warning} />
                        <Text style={[styles.typeText, { color: colors.warning }]}>Other Recording</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
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
    statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    statCard: {
      flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg,
      borderWidth: 1, borderColor: colors.border,
      padding: spacing.md, alignItems: 'center', gap: 4,
    },
    statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    statValue: { fontSize: 20, fontWeight: '800' },
    statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '500', textAlign: 'center' },
    filterRow: {
      flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.sm, alignItems: 'center',
    },
    filterPill: {
      flexDirection: 'row', alignItems: 'center', gap: 6, height: 34,
      paddingHorizontal: 14, borderRadius: radius.full,
      borderWidth: 1, borderColor: colors.border, marginRight: 8,
    },
    filterPillActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
    filterPillText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
    filterPillTextActive: { color: colors.accent },
    dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
    dateLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dateLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    logCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      backgroundColor: colors.bgCard, borderRadius: radius.lg,
      borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: 10,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 15, fontWeight: '800', color: '#fff' },
    logContent: { flex: 1, gap: 3 },
    logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1 },
    logTime: { fontSize: 11, color: colors.textMuted },
    logPhone: { fontSize: 12, color: colors.textSecondary },
    logNote: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    logBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    typeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1,
    },
    typeText: { fontSize: 11, fontWeight: '700' },
    logDate: { fontSize: 11, color: colors.textMuted },
    logActions: { gap: 8, alignItems: 'center' },
    actionBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    loadingText: { fontSize: 14, color: colors.textMuted },
    emptyIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  });
}
