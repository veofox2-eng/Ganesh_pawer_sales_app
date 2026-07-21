import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { IconSearch, IconPeopleOutline, IconCloseCircle, IconChevronForward, IconTrendingUp, IconLogout, IconDocumentText, IconCallOutline } from '../lib/Icons';
import LogoutConfirmModal from '../components/LogoutConfirmModal';

interface SalesEmployee {
  id: string;
  username: string | null;
  is_enabled: boolean;
  approval_status: string;
  updated_at: string;
  clientCount?: number;
  activityCount?: number;
  conversionCount?: number;
}

export default function AdminSalesListScreen({ navigation }: any) {
  const { colors, isDark, toggleTheme } = useTheme();
  const [employees, setEmployees] = useState<SalesEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    fetchEmployees();
    const unsub = navigation.addListener('focus', fetchEmployees);
    return unsub;
  }, [navigation]);

  async function fetchEmployees() {
    setLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, username, is_enabled, approval_status, updated_at')
        .eq('role', 'User')
        .eq('approval_status', 'Approved')
        .order('username', { ascending: true });

      if (error || !profiles) {
        console.error('[AdminSales] Error fetching profiles:', error?.message);
        return;
      }

      if (profiles.length === 0) {
        setEmployees([]);
        return;
      }

      // Batch: get all client IDs for all employees in one query
      const employeeIds = profiles.map(p => p.id);

      const [clientsResult, convertedResult] = await Promise.allSettled([
        supabase
          .from('clients')
          .select('id, user_id, is_deleted')
          .in('user_id', employeeIds),
        supabase
          .from('clients')
          .select('id, user_id')
          .in('user_id', employeeIds)
          .eq('status', 'Converted')
          .eq('is_deleted', false),
      ]);

      const allClients = clientsResult.status === 'fulfilled' ? (clientsResult.value.data || []) : [];
      const convertedClients = convertedResult.status === 'fulfilled' ? (convertedResult.value.data || []) : [];

      // Batch: get interaction counts for all active client IDs
      const activeClientIds = allClients.filter(c => !c.is_deleted).map(c => c.id);
      let allInteractions: { client_id: string }[] = [];
      if (activeClientIds.length > 0) {
        const intResult = await supabase
          .from('interactions')
          .select('client_id')
          .in('client_id', activeClientIds);
        allInteractions = intResult.data || [];
      }

      // Map stats per employee
      const enriched: SalesEmployee[] = profiles.map(p => {
        const myClients = allClients.filter(c => c.user_id === p.id && !c.is_deleted);
        const myClientIds = myClients.map(c => c.id);
        const myActivities = allInteractions.filter(i => myClientIds.includes(i.client_id)).length;
        const myConversions = convertedClients.filter(c => c.user_id === p.id).length;
        return {
          ...p,
          clientCount: myClients.length,
          activityCount: myActivities,
          conversionCount: myConversions,
        };
      });

      setEmployees(enriched);
    } catch (err) {
      console.error('[AdminSales] Unexpected error:', err);
    } finally {
      // CRITICAL: always clear loading state even if queries fail
      setLoading(false);
    }
  }

  const filtered = useMemo(() =>
    employees.filter(e => (e.username || '').toLowerCase().includes(search.toLowerCase())),
    [employees, search]
  );

  const renderItem = useCallback(({ item: e }: { item: SalesEmployee }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      onPress={() => navigation.navigate('AdminEmployeeDetail', { profile: e, role: 'User' })}
      activeOpacity={0.75}
    >
      <View style={[styles.avatar, { backgroundColor: colors.success + '28' }]}>
        <Text style={[styles.avatarText, { color: colors.success }]}>
          {(e.username || 'U')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{e.username || 'Unnamed'}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={[styles.statNum, { color: colors.textPrimary }]}>{e.clientCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Clients</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statPill}>
            <Text style={[styles.statNum, { color: colors.accent }]}>{e.activityCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Activities</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statPill}>
            <Text style={[styles.statNum, { color: colors.success }]}>{e.conversionCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Conversions</Text>
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.statusDot, { backgroundColor: e.is_enabled ? colors.success : colors.danger }]} />
        <IconChevronForward size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  ), [colors, navigation]);

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Sales Team</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor="#fff"
              style={{ transform: [{ scale: 0.7 }], marginVertical: -6 }}
            />
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
            <IconPeopleOutline size={18} color={colors.success} />
            <Text style={[styles.badgeText, { color: colors.success }]}>{employees.length}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => setShowLogoutConfirm(true)}
            style={{ padding: 8 }}
          >
            <IconLogout size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 }}>My Workspace</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
          
          <TouchableOpacity 
            style={[styles.toolBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => navigation.navigate('CallSheetList')}
          >
            <View style={[styles.toolIcon, { backgroundColor: colors.accent + '20' }]}>
              <IconPeopleOutline size={22} color={colors.accent} />
            </View>
            <Text style={[styles.toolText, { color: colors.textPrimary }]}>Clients Page</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.toolBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => navigation.navigate('OtherRecords')}
          >
            <View style={[styles.toolIcon, { backgroundColor: colors.success + '20' }]}>
              <IconDocumentText size={22} color={colors.success} />
            </View>
            <Text style={[styles.toolText, { color: colors.textPrimary }]}>Other Records</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.toolBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => navigation.navigate('TaskBoard')}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#f59e0b' + '20' }]}>
              <IconTrendingUp size={22} color="#f59e0b" />
            </View>
            <Text style={[styles.toolText, { color: colors.textPrimary }]}>Timeline</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.toolBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => navigation.navigate('CallHistory')}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#8b5cf6' + '20' }]}>
              <IconCallOutline size={22} color="#8b5cf6" />
            </View>
            <Text style={[styles.toolText, { color: colors.textPrimary }]}>Call Logs</Text>
          </TouchableOpacity>

        </View>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}>
        <IconSearch size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search sales employees..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <IconCloseCircle size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity 
        style={[styles.sharedBtn, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' }]}
        onPress={() => navigation.navigate('AdminSharedClients')}
        activeOpacity={0.8}
      >
        <IconDocumentText size={20} color={colors.accent} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.accent }}>Shared Clients Log</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>View all clients shared between employees</Text>
        </View>
        <IconChevronForward size={20} color={colors.accent} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.success} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading team...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.list}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          ListEmptyComponent={
            <View style={styles.centered}>
              <IconPeopleOutline size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No sales employees found</Text>
            </View>
          }
        />
      )}

      <LogoutConfirmModal
        visible={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => { setShowLogoutConfirm(false); supabase.auth.signOut(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
  },
  badgeText: { fontSize: 14, fontWeight: '800' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing.lg, marginVertical: spacing.sm,
    paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.lg, borderWidth: 1,
    padding: spacing.md, marginBottom: 12,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  cardInfo: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statPill: { alignItems: 'center' },
  statNum: { fontSize: 14, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', marginTop: 1 },
  statDivider: { width: 1, height: 24 },
  cardRight: { alignItems: 'center', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14 },
  emptyText: { fontSize: 14, marginTop: 8 },
  sharedBtn: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, 
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    borderRadius: radius.lg, borderWidth: 1,
  },
  toolBtn: {
    width: '48%', padding: 14, borderRadius: 16,
    borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12
  },
  toolIcon: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center'
  },
  toolText: {
    fontSize: 14, fontWeight: '700'
  }
});
