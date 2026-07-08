import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, ScrollView, Modal, Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { 
  IconSearch, IconInfo, IconChevronRight, IconCloseCircle,
  IconPeopleOutline, IconTrendingUp, IconLogout
} from '../lib/Icons';
import LogoutConfirmModal from '../components/LogoutConfirmModal';

interface Client {
  id: string;
  name: string;
  lead_type: 'Hot' | 'Warm' | 'Cold';
  project_name?: string;
  user_id: string;
  profiles?: { username: string };
}

const CATEGORIES = ['All', 'Hot', 'Warm', 'Cold'] as const;

export default function AdminClientStatusScreen() {
  const { colors } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<typeof CATEGORIES[number]>('All');
  const [showInfo, setShowInfo] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Status Change State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    try {
      // Join with profiles to get employee name
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, lead_type, project_name, user_id, profiles(username)')
        .eq('is_deleted', false)
        .order('name', { ascending: true });

      if (!error && data) {
        setClients(data as any[]);
      }
    } catch (err) {
      console.error('Error fetching admin clients:', err);
    } finally {
      setLoading(false);
    }
  }

  async function updateClientLeadType(clientId: string, newType: 'Hot' | 'Warm' | 'Cold') {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ lead_type: newType })
        .eq('id', clientId);

      if (error) throw error;

      // Update local state
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, lead_type: newType } : c));
      setSelectedClient(null);
      Alert.alert('Admin Success', `Lead category updated to ${newType}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update category');
    } finally {
      setIsUpdating(false);
    }
  }

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const clientName = (c.name || '').toLowerCase();
      const empName = (c.profiles?.username || '').toLowerCase();
      const projName = (c.project_name || '').toLowerCase();
      const query = search.toLowerCase();

      const matchesSearch = clientName.includes(query) || empName.includes(query) || projName.includes(query);
      const matchesFilter = filter === 'All' || c.lead_type === filter;
      return matchesSearch && matchesFilter;
    });
  }, [clients, search, filter]);

  const renderItem = ({ item: c }: { item: Client }) => {
    const leadColor = c.lead_type === 'Hot' ? colors.danger : c.lead_type === 'Warm' ? colors.warning : colors.textMuted;
    
    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        onPress={() => setSelectedClient(c)}
      >
        <View style={[styles.statusIndicator, { backgroundColor: leadColor }]} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.clientName, { color: colors.textPrimary }]}>{c.name}</Text>
          <Text style={[styles.projectName, { color: colors.textMuted }]}>
            {c.project_name || 'General Inquiry'}
          </Text>
          
          <View style={[styles.empBadge, { backgroundColor: colors.bgPanel }]}>
             <IconPeopleOutline size={12} color={colors.textMuted} />
             <Text style={[styles.empName, { color: colors.textSecondary }]}>{c.profiles?.username || 'Unassigned'}</Text>
          </View>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: leadColor + '15' }]}>
          <Text style={[styles.statusText, { color: leadColor }]}>{(c.lead_type || 'COLD').toUpperCase()}</Text>
        </View>
        <IconChevronRight size={20} color={colors.textMuted} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* Search & Filter UI */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>Insights</Text>
          <TouchableOpacity onPress={() => setShowLogoutConfirm(true)} style={{ padding: 8 }}>
            <IconLogout size={22} color={colors.danger} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchWrap, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}>
          <IconSearch size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search by client or employee name..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <IconCloseCircle size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => setFilter(cat)}
                style={[
                  styles.filterPill,
                  { borderColor: colors.border, backgroundColor: colors.bgPanel },
                  filter === cat && { backgroundColor: colors.accent, borderColor: colors.accent }
                ]}
              >
                <Text style={[styles.filterPillText, { color: filter === cat ? '#fff' : colors.textMuted }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.infoBtn}>
            <IconInfo size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ color: colors.textMuted, marginTop: 12 }}>Fetching lead data...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconTrendingUp size={48} color={colors.border} />
              <Text style={{ color: colors.textMuted, marginTop: 12 }}>No matching leads found.</Text>
            </View>
          }
        />
      )}

      {/* Info Modal */}
      <Modal visible={showInfo} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowInfo(false)}>
          <View style={[styles.infoModal, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Category Insights</Text>
            <View style={styles.infoItem}>
              <View style={[styles.dot, { backgroundColor: colors.danger }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: colors.danger }}>Hot:</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>High-value leads showing strong conversion signals.</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <View style={[styles.dot, { backgroundColor: colors.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: colors.warning }}>Warm:</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Qualified leads requiring follow-up and engagement.</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: colors.textMuted }}>Cold:</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Low-engagement leads or long-term prospects.</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.modalClose, { backgroundColor: colors.accent }]} onPress={() => setShowInfo(false)}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Admin Lead Type Selection Modal */}
      <Modal visible={!!selectedClient} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => !isUpdating && setSelectedClient(null)}>
          <View style={[styles.statusModal, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 8 }]}>Admin: Update Category</Text>
            <Text style={{ color: colors.textMuted, marginBottom: 12, textAlign: 'center' }}>
              Override lead category for "{selectedClient?.name}"
            </Text>

            {selectedClient?.profiles?.username && (
              <View style={[styles.empBadge, { alignSelf: 'center', marginBottom: 20, backgroundColor: colors.bgPanel + '80' }]}>
                <IconPeopleOutline size={12} color={colors.textMuted} />
                <Text style={[styles.empName, { color: colors.textSecondary }]}>
                  Handled by: {selectedClient.profiles.username}
                </Text>
              </View>
            )}
            
            <View style={{ gap: 12, width: '100%' }}>
              {(['Hot', 'Warm', 'Cold'] as const).map(s => (
                <TouchableOpacity 
                  key={s}
                  style={[
                    styles.statusOption, 
                    { borderColor: colors.border },
                    selectedClient?.lead_type === s && { 
                      backgroundColor: (s === 'Hot' ? colors.danger : s === 'Warm' ? colors.warning : colors.textMuted) + '15', 
                      borderColor: (s === 'Hot' ? colors.danger : s === 'Warm' ? colors.warning : colors.textMuted) 
                    }
                  ]}
                  onPress={() => updateClientLeadType(selectedClient!.id, s)}
                  disabled={isUpdating}
                >
                  <View style={[styles.dot, { backgroundColor: s === 'Hot' ? colors.danger : s === 'Warm' ? colors.warning : colors.textMuted }]} />
                  <Text style={[styles.statusOptionText, { color: colors.textPrimary }]}>{s}</Text>
                  {selectedClient?.lead_type === s && <Text style={{ fontSize: 10, color: colors.textMuted, marginLeft: 'auto' }}>Current</Text>}
                </TouchableOpacity>
              ))}
            </View>

            {isUpdating && <ActivityIndicator style={{ marginTop: 20 }} color={colors.accent} />}
          </View>
        </Pressable>
      </Modal>

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
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 46,
    borderRadius: radius.lg, borderWidth: 1, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8 },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  filterPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 13, fontWeight: '600' },
  infoBtn: { padding: 8, marginLeft: 8 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: radius.xl,
    borderWidth: 1, marginBottom: 12,
  },
  statusIndicator: { width: 4, height: 50, borderRadius: 2 },
  clientName: { fontSize: 16, fontWeight: '700' },
  projectName: { fontSize: 12, marginTop: 2 },
  empBadge: { 
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.md,
    gap: 4
  },
  empName: { fontSize: 11, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.md },
  statusText: { fontSize: 10, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  infoModal: { width: '100%', padding: 24, borderRadius: radius.xxl, alignItems: 'center' },
  statusModal: { 
    width: '100%', padding: 24, borderRadius: radius.xxl, alignItems: 'center', 
    position: 'absolute', bottom: 40 
  },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', marginBottom: 16 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12, marginTop: 4 },
  modalClose: { width: '100%', paddingVertical: 14, borderRadius: radius.lg, marginTop: 20, alignItems: 'center' },
  statusOption: { 
    flexDirection: 'row', alignItems: 'center', width: '100%', padding: 16, 
    borderRadius: radius.lg, borderWidth: 1 
  },
  statusOptionText: { fontSize: 15, fontWeight: '700' },
});
