import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput, ScrollView, Animated, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { IconPeopleOutline, IconShieldOutline, IconMapOutline, IconChevronForward, IconSearch, IconLogout } from '../lib/Icons';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function SuperAdminDashboardScreen({ navigation }: any) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [limits, setLimits] = useState({ max_admin: '99', max_user: '99', max_field: '99' });
  const [appAccess, setAppAccess] = useState({ admin_app: false, employee_app: false });
  const [savingLimits, setSavingLimits] = useState(false);
  
  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    fetchUsers();
    fetchLimits();
    const unsub = navigation.addListener('focus', () => { fetchUsers(); fetchLimits(); });
    return unsub;
  }, [navigation]);

  async function fetchLimits() {
    try {
      const { data, error } = await supabase.from('tenant_config').select('*').single();
      if (data) {
        setLimits({
          max_admin: String(data.max_admin),
          max_user: String(data.max_user),
          max_field: String(data.max_field)
        });
        setAppAccess({
          admin_app: !!data.admin_app_active,
          employee_app: !!data.employee_app_active
        });
      }
    } catch (e) {}
  }

  async function saveLimits() {
    setSavingLimits(true);
    try {
      const { error } = await supabase
        .from('tenant_config')
        .update({
          max_admin: parseInt(limits.max_admin) || 0,
          max_user: parseInt(limits.max_user) || 0,
          max_field: parseInt(limits.max_field) || 0,
          admin_app_active: appAccess.admin_app,
          employee_app_active: appAccess.employee_app
        })
        .eq('id', 1);
      
      if (error) throw error;
      alert('Settings saved successfully');
    } catch (e: any) {
      alert('Error saving limits: ' + e.message);
    } finally {
      setSavingLimits(false);
    }
  }

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.log('Error fetching users:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'Admin': return colors.danger;
      case 'Field': return colors.success;
      case 'User': return colors.warning; // Sales
      default: return colors.accent;
    }
  };

  const getRoleLightColor = (role: string) => {
    switch(role) {
      case 'Admin': return colors.dangerLight;
      case 'Field': return colors.successLight;
      case 'User': return colors.warningLight;
      default: return colors.accentLight;
    }
  };

  const getRoleIcon = (role: string, color: string) => {
    switch(role) {
      case 'Admin': return <IconShieldOutline size={24} color={color} />;
      case 'Field': return <IconMapOutline size={24} color={color} />;
      default: return <IconPeopleOutline size={24} color={color} />;
    }
  };

  const getRoleDisplay = (role: string) => {
    if (role === 'User') return 'Sales Employee';
    if (role === 'Field') return 'Field Employee';
    return role || 'No Role Assigned';
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (u.username === 'Super Administrator') return false; // Hide super admins from this list
      const matchesSearch = (u.username || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = selectedRole === 'All' || u.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, selectedRole]);

  const AnimatedUserCard = ({ item }: { item: any }) => {
    const scale = React.useRef(new Animated.Value(1)).current;

    const handlePress = () => {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start(() => {
        navigation.navigate('SuperAdminUserControl', { profile: item });
      });
    };

    const roleColor = getRoleColor(item.role);
    const roleLightColor = getRoleLightColor(item.role);

    return (
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
        <Animated.View style={[styles.card, { transform: [{ scale }], borderLeftWidth: 4, borderLeftColor: roleColor }]}>
          <View style={[styles.cardIcon, { backgroundColor: roleLightColor }]}>
            {getRoleIcon(item.role, roleColor)}
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{item.username || 'Unknown User'}</Text>
            <Text style={styles.cardSubtitle}>{getRoleDisplay(item.role)}</Text>
          </View>
          <IconChevronForward size={20} color={colors.textMuted} />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: any }) => <AnimatedUserCard item={item} />;

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Super Admin</Text>
            <Text style={styles.subtitle}>Select a user to control their features</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={toggleTheme} style={styles.actionBtn}>
              <Ionicons name={isDark ? "sunny" : "moon"} size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => signOut()} style={[styles.actionBtn, styles.logoutBtn]}>
              <IconLogout size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.limitsContainer}>
        <View style={styles.limitsHeader}>
          <Text style={styles.limitsTitle}>Control Users (Registration Limits)</Text>
          <TouchableOpacity onPress={saveLimits} disabled={savingLimits} style={styles.saveBtn}>
            {savingLimits ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
        <View style={styles.limitsRow}>
          <View style={styles.limitInputWrap}>
            <Text style={styles.limitLabel}>Admin</Text>
            <TextInput style={styles.limitInput} value={limits.max_admin} onChangeText={(v) => setLimits({...limits, max_admin: v})} keyboardType="number-pad" maxLength={2} />
          </View>
          <View style={styles.limitInputWrap}>
            <Text style={styles.limitLabel}>Sales Emp</Text>
            <TextInput style={styles.limitInput} value={limits.max_user} onChangeText={(v) => setLimits({...limits, max_user: v})} keyboardType="number-pad" maxLength={2} />
          </View>
          <View style={styles.limitInputWrap}>
            <Text style={styles.limitLabel}>Field Emp</Text>
            <TextInput style={styles.limitInput} value={limits.max_field} onChangeText={(v) => setLimits({...limits, max_field: v})} keyboardType="number-pad" maxLength={2} />
          </View>
        </View>

        <View style={styles.divider} />
        
        <Text style={[styles.limitsTitle, { marginBottom: 12 }]}>Master App Toggles</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Admin App</Text>
          <Switch 
            value={appAccess.admin_app} 
            onValueChange={async (val) => {
              setAppAccess({ ...appAccess, admin_app: val });
              await supabase.from('tenant_config').update({ admin_app_active: val }).eq('id', 1);
            }} 
            trackColor={{ false: '#767577', true: colors.accent }}
            thumbColor={appAccess.admin_app ? '#fff' : '#f4f3f4'}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Employee App</Text>
          <Switch 
            value={appAccess.employee_app} 
            onValueChange={async (val) => {
              setAppAccess({ ...appAccess, employee_app: val });
              await supabase.from('tenant_config').update({ employee_app_active: val }).eq('id', 1);
            }} 
            trackColor={{ false: '#767577', true: colors.accent }}
            thumbColor={appAccess.employee_app ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <IconSearch size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {['All', 'Admin', 'User', 'Field'].map(role => (
            <TouchableOpacity 
              key={role} 
              style={[styles.filterChip, selectedRole === role && styles.filterChipActive]}
              onPress={() => setSelectedRole(role)}
            >
              <Text style={[styles.filterText, selectedRole === role && styles.filterTextActive]}>
                {role === 'User' ? 'Sales' : role}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No users found.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionBtn: { 
    width: 40, height: 40, borderRadius: 20, 
    backgroundColor: colors.bgPanel, 
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border 
  },
  logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'sans-serif' },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, fontFamily: 'sans-serif' },
  
  limitsContainer: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.md, backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  limitsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  limitsTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, fontFamily: 'sans-serif' },
  saveBtn: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.sm },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  limitsRow: { flexDirection: 'row', gap: 12 },
  limitInputWrap: { flex: 1 },
  limitLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4, fontFamily: 'sans-serif' },
  limitInput: { backgroundColor: colors.bgPanel, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, color: colors.textPrimary, textAlign: 'center', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, backgroundColor: colors.bgPanel, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  toggleLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', fontFamily: 'sans-serif' },

  searchContainer: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  searchInputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgPanel,
    borderRadius: radius.md, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border,
    marginBottom: 12
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: colors.textPrimary, fontFamily: 'sans-serif' },
  filterScroll: { flexDirection: 'row' },
  filterContent: { paddingRight: 20 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, 
    borderWidth: 1, borderColor: colors.border, marginRight: 8,
    backgroundColor: colors.bgPanel
  },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13, fontFamily: 'sans-serif' },
  filterTextActive: { color: '#fff' },

  list: { paddingHorizontal: spacing.lg, paddingBottom: 100, paddingTop: spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgPanel, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: 12,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: radius.full,
    backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4, fontFamily: 'sans-serif' },
  cardSubtitle: { fontSize: 13, color: colors.textMuted, fontFamily: 'sans-serif' },

  centered: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 15, marginTop: 12, fontFamily: 'sans-serif' },
});
