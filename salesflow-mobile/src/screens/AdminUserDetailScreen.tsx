import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius, colors, STATUS_COLORS } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { 
  IconChevronBack, IconCall, IconNote, IconTime, 
  IconPeopleOutline, IconCalendar, IconTrendingUp 
} from '../lib/Icons';
import { LEAD_TYPE_COLORS } from '../theme';

interface Interaction {
  id: string;
  client_id: string;
  type: string;
  content: string;
  created_at: string;
  author: string;
  client_name?: string;
}

interface Client {
  id: string;
  name: string;
  status: string;
  lead_type: 'Hot' | 'Warm' | 'Cold';
  phone: string;
}

export default function AdminUserDetailScreen({ route, navigation }: any) {
  const { profile } = route.params;
  const { colors: themeColors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [activeTab, setActiveTab] = useState<'clients' | 'timeline'>('clients');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    // 1. Fetch Clients
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, status, lead_type, phone')
      .eq('user_id', profile.id)
      .order('name', { ascending: true });

    if (clientsData) {
      setClients(clientsData);
      
      // 2. Fetch Interactions for these clients
      const clientIds = clientsData.map(c => c.id);
      if (clientIds.length > 0) {
        const { data: interactionsData, error: interactionsError } = await supabase
          .from('interactions')
          .select('*')
          .in('client_id', clientIds)
          .order('created_at', { ascending: false });

        if (interactionsData) {
          // Add client name to interactions for better display
          const enriched = interactionsData.map(i => ({
            ...i,
            client_name: clientsData.find(c => c.id === i.client_id)?.name || 'Unknown'
          }));
          setInteractions(enriched);
        }
      }
    }
    setLoading(false);
  }

  function renderClient({ item: c }: { item: Client }) {
    const sc = (STATUS_COLORS as any)[c.status] || STATUS_COLORS['Follow-up'];
    const lc = (LEAD_TYPE_COLORS as any)[c.lead_type] || LEAD_TYPE_COLORS['Cold'];
    return (
      <View style={styles.clientCard}>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{c.name}</Text>
          <Text style={styles.clientPhone}>{c.phone}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
              <Text style={[styles.statusText, { color: sc.text }]}>{c.status}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: lc.bg, borderColor: lc.border }]}>
              <Text style={[styles.statusText, { color: lc.text }]}>{c.lead_type}</Text>
            </View>
          </View>
        </View>
        <IconChevronBack size={16} color={themeColors.textMuted} style={{ transform: [{ rotate: '180deg' }] }} />
      </View>
    );
  }

  function renderInteraction({ item: i }: { item: Interaction }) {
    const type = i.type.toUpperCase();
    const isCall = type.includes('CALL');
    const isWA = type.includes('WHATSAPP');
    const isSystem = type.includes('SYSTEM') || type.includes('STATUS');

    let icon = <IconNote size={16} color={themeColors.textMuted} />;
    let iconBg = themeColors.bgPanel;
    let iconColor = themeColors.textMuted;

    if (isCall) {
      icon = <IconCall size={16} color={themeColors.accent} />;
      iconBg = themeColors.accentLight;
      iconColor = themeColors.accent;
    } else if (isWA) {
      icon = <IconTrendingUp size={16} color="#25D366" />;
      iconBg = 'rgba(37, 211, 102, 0.1)';
      iconColor = '#25D366';
    } else if (isSystem) {
      icon = <IconTrendingUp size={16} color={themeColors.warning} />;
      iconBg = 'rgba(245, 158, 11, 0.1)';
      iconColor = themeColors.warning;
    }

    return (
      <View style={styles.timelineItem}>
        <View style={styles.timelineLeft}>
          <View style={[styles.timelineIcon, { backgroundColor: iconBg }]}>
            {icon}
          </View>
          <View style={styles.timelineLine} />
        </View>
        <View style={styles.timelineContent}>
          <View style={styles.timelineHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineClient}>{i.client_name}</Text>
              <View style={[styles.typeBadge, { backgroundColor: iconBg }]}>
                 <Text style={{ fontSize: 9, fontWeight: '800', color: iconColor }}>{type}</Text>
              </View>
            </View>
            <Text style={styles.timelineDate}>
              {(() => { try { const d = new Date(i.created_at); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US') + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })()}
            </Text>
          </View>
          <Text style={styles.timelineText}>{i.content}</Text>
          <Text style={styles.timelineAuthor}>recorded by {i.author}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <IconChevronBack size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.profileSummary}>
          <Text style={styles.title}>{profile.username}</Text>
          <Text style={styles.subtitle}>{profile.role === 'User' ? 'Indoor Sales' : profile.role} · {profile.is_enabled ? 'Enabled' : 'Disabled'}</Text>
        </View>
      </View>

      {/* Quick Stats Card */}
      <View style={styles.statsCardContainer}>
        <View style={[styles.statsCard, { backgroundColor: themeColors.bgCard }]}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{clients.length}</Text>
            <Text style={styles.statName}>Total Clients</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: themeColors.border }]} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{interactions.length}</Text>
            <Text style={styles.statName}>Activities</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: themeColors.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: themeColors.success }]}>
              {clients.filter(cc => cc.status === 'Converted').length}
            </Text>
            <Text style={styles.statName}>Conversions</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'clients' && styles.activeTab]}
          onPress={() => setActiveTab('clients')}
        >
          <IconPeopleOutline size={18} color={activeTab === 'clients' ? themeColors.accent : themeColors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'clients' && styles.activeTabText]}>Clients ({clients.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'timeline' && styles.activeTab]}
          onPress={() => setActiveTab('timeline')}
        >
          <IconTime size={18} color={activeTab === 'timeline' ? themeColors.accent : themeColors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'timeline' && styles.activeTabText]}>Activity Timeline</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeColors.accent} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'clients' ? (
            <FlatList
              data={clients}
              keyExtractor={item => item.id}
              renderItem={renderClient}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<Text style={styles.emptyText}>No clients found for this member.</Text>}
            />
          ) : (
            <FlatList
              data={interactions}
              keyExtractor={item => item.id}
              renderItem={renderInteraction}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<Text style={styles.emptyText}>No activity recorded yet.</Text>}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { 
    flexDirection: 'row', alignItems: 'center', 
    paddingHorizontal: spacing.md, paddingVertical: spacing.lg 
  },
  backBtn: { padding: 8, marginRight: 8 },
  profileSummary: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: colors.accent },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  activeTabText: { color: colors.accent },
  list: { padding: spacing.lg, paddingBottom: 40 },
  clientCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  clientPhone: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusBadge: { 
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  timelineItem: { flexDirection: 'row', marginBottom: 20 },
  timelineLeft: { alignItems: 'center', marginRight: 12 },
  timelineIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  timelineLine: {
    position: 'absolute', top: 32, bottom: -20, left: 15.5,
    width: 1, backgroundColor: colors.border,
  },
  timelineContent: { 
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: 12, borderWidth: 1, borderColor: colors.border,
  },
  timelineHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 
  },
  timelineClient: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  timelineDate: { fontSize: 10, color: colors.textMuted },
  timelineText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  timelineAuthor: { 
    fontSize: 10, color: colors.textMuted, marginTop: 6, fontStyle: 'italic' 
  },
  emptyText: { 
    textAlign: 'center', color: colors.textMuted, marginTop: 40, fontSize: 14 
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsCardContainer: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  statsCard: { 
    flexDirection: 'row', padding: spacing.lg, borderRadius: radius.xl, 
    borderWidth: 1, borderColor: colors.border, alignItems: 'center' 
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statName: { fontSize: 10, color: colors.textMuted, marginTop: 4, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 30 },
  typeBadge: { 
    alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, 
    borderRadius: 4, marginTop: 2 
  },
});
