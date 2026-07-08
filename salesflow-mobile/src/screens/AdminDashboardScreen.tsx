import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius, colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { IconSearch, IconPeopleOutline, IconCloseCircle, IconChevronForward, IconAdd, IconMap } from '../lib/Icons';

interface Profile {
  id: string;
  username: string | null;
  role: 'Admin' | 'User' | 'Field';
  is_enabled: boolean;
  approval_status: 'Pending' | 'Approved' | 'Rejected';
  updated_at: string;
}

export default function AdminDashboardScreen({ navigation }: any) {
  const { colors: themeColors, isDark, toggleTheme } = useTheme();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProfiles();
    const unsubscribe = navigation.addListener('focus', fetchProfiles);
    return unsubscribe;
  }, [navigation]);

  async function fetchProfiles() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('username', { ascending: true });

    if (error) {
      Alert.alert('Error', 'Could not fetch team members');
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  }

  async function toggleUserStatus(profile: Profile, newValue: boolean) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_enabled: newValue })
      .eq('id', profile.id);

    if (error) {
      Alert.alert('Error', 'Could not update user status');
    } else {
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_enabled: newValue } : p));
    }
  }

  async function approveUser(profile: Profile, newRole: 'User' | 'Field') {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, approval_status: 'Approved', is_enabled: true })
      .eq('id', profile.id);

    if (error) {
      Alert.alert('Error', 'Could not approve user');
    } else {
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, role: newRole, approval_status: 'Approved', is_enabled: true } : p));
    }
  }

  async function rejectUser(profile: Profile) {
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: 'Rejected', is_enabled: false })
      .eq('id', profile.id);

    if (error) Alert.alert('Error', 'Could not reject user');
    else fetchProfiles();
  }

  const filtered = useMemo(() => {
    return profiles.filter(p => 
      (p.username || '').toLowerCase().includes(search.toLowerCase()) ||
      p.role.toLowerCase().includes(search.toLowerCase())
    );
  }, [profiles, search]);

  // Memoized Profile Item for stability
  const ProfileItem = React.memo(({ 
    item: p, 
    onPress, 
    onStatusToggle, 
    onApprove,
    themeColors 
  }: any) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(p)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(p.username || 'U')[0].toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.username}>{p.username || 'Unnamed User'}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
          <View style={[styles.roleBadge, { backgroundColor: p.role === 'Admin' ? themeColors.accentLight : themeColors.bgPanel }]}>
            <Text style={[styles.roleText, { color: p.role === 'Admin' ? themeColors.accent : themeColors.textMuted }]}>
              {p.role === 'User' ? 'Indoor Sales' : p.role}
            </Text>
          </View>
          {p.approval_status === 'Pending' && (
            <View style={[styles.roleBadge, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
              <Text style={[styles.roleText, { color: themeColors.warning }]}>Pending</Text>
            </View>
          )}
        </View>
      </View>

      {p.approval_status === 'Pending' ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
           <TouchableOpacity 
             style={{ padding: 8, backgroundColor: themeColors.success, borderRadius: 8 }} 
             onPress={() => onApprove(p, 'User')}
           >
             <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Sales</Text>
           </TouchableOpacity>
           <TouchableOpacity 
             style={{ padding: 8, backgroundColor: themeColors.accent, borderRadius: 8 }} 
             onPress={() => onApprove(p, 'Field')}
           >
             <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Field</Text>
           </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actions}>
          <Switch
            value={p.is_enabled}
            onValueChange={(val) => onStatusToggle(p, val)}
            trackColor={{ false: themeColors.border, true: themeColors.success }}
            thumbColor="#fff"
          />
          <IconChevronForward size={20} color={themeColors.textMuted} />
        </View>
      )}
    </TouchableOpacity>
  ));

  const renderItem = React.useCallback(({ item }: { item: Profile }) => (
    <ProfileItem 
      item={item}
      onPress={(p: Profile) => navigation.navigate('AdminUserDetail', { profile: p })}
      onStatusToggle={toggleUserStatus}
      onApprove={approveUser}
      themeColors={themeColors}
    />
  ), [themeColors, navigation]);

  const renderHeader = () => (
    <View style={{ paddingBottom: spacing.md }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>Admin Dashboard</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>Manage Members</Text>
            <View style={{ width: 1, height: 12, backgroundColor: themeColors.border }} />
            <Text style={{ fontSize: 11, color: themeColors.textMuted }}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: themeColors.border, true: themeColors.success }}
              thumbColor="#fff"
              style={{ transform: [{ scale: 0.8 }] }}
            />
          </View>
        </View>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => navigation.navigate('AdminCreateUser')}
        >
          <IconAdd size={20} color="#fff" />
          <Text style={styles.addBtnText}>New Member</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Summary Section */}
      <View style={styles.statsSection}>
        <View style={[styles.statCard, { backgroundColor: themeColors.bgCard }]}>
          <Text style={styles.statVal}>{profiles.length}</Text>
          <Text style={styles.statLabel}>Total Team</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.bgCard }]}>
          <Text style={[styles.statVal, { color: themeColors.success }]}>
            {profiles.filter(p => p.role === 'User').length}
          </Text>
          <Text style={styles.statLabel}>Indoor Sales</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.bgCard }]}>
          <Text style={[styles.statVal, { color: themeColors.accent }]}>
            {profiles.filter(p => p.role === 'Field').length}
          </Text>
          <Text style={styles.statLabel}>Field Staff</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <IconSearch size={18} color={themeColors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search team members..."
          placeholderTextColor={themeColors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <IconCloseCircle size={18} color={themeColors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity 
        style={[styles.trackingBtn, { backgroundColor: themeColors.accentLight }]}
        onPress={() => navigation.navigate('AdminFieldTracking')}
        activeOpacity={0.8}
      >
        <IconMap size={24} color={themeColors.accent} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.textPrimary }}>Live Map Tracking</Text>
          <Text style={{ fontSize: 13, color: themeColors.textMuted }}>View real-time locations of Field Employees</Text>
        </View>
        <IconChevronForward size={20} color={themeColors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]} edges={['top']}>
      <FlatList
        data={loading ? [] : filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? (
            <View style={[styles.centered, { marginTop: 60 }]}>
              <ActivityIndicator size="large" color={themeColors.accent} />
            </View>
          ) : (
            <View style={styles.centered}>
              <IconPeopleOutline size={48} color={themeColors.textMuted} />
              <Text style={{ color: themeColors.textMuted, marginTop: 12 }}>No team members found</Text>
            </View>
          )
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg 
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.full,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bgPanel, marginHorizontal: spacing.lg,
    paddingHorizontal: 16, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 12, color: colors.textPrimary, fontSize: 15 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  info: { flex: 1, marginLeft: 12 },
  username: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  roleBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, marginTop: 4,
  },
  roleText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  trackingBtn: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, 
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.2)'
  },
  statsSection: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
});
