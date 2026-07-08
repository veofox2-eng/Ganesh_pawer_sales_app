import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, ScrollView, Alert, Modal, Pressable, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { 
  IconSearch, IconInfo, IconChevronRight, IconCloseCircle,
  IconPeopleOutline, IconMenu, IconDownload, IconCloudUpload
} from '../lib/Icons';
import { useSidebar } from '../context/SidebarContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

interface Client {
  id: string;
  name: string;
  lead_type: 'Hot' | 'Warm' | 'Cold';
  project_name?: string;
  user_id: string;
}

const CATEGORIES = ['All', 'Hot', 'Warm', 'Cold'] as const;

export default function ClientStatusScreen() {
  const { colors } = useTheme();
  const { openSidebar } = useSidebar();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<typeof CATEGORIES[number]>('All');
  const [showInfo, setShowInfo] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, lead_type, project_name, user_id')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('name', { ascending: true });

      if (!error && data) {
        setClients(data as any[]);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
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
      Alert.alert('Success', `Lead categorized as ${newType}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update category');
    } finally {
      setIsUpdating(false);
    }
  }

  const handleDownloadSample = async () => {
    try {
      const ws = XLSX.utils.aoa_to_sheet([['NAME', 'PHONE NUMBER'], ['John Doe', '9876543210']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Clients');
      
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const filename = FileSystem.documentDirectory + 'Sample_Clients_Upload.xlsx';
      
      await FileSystem.writeAsStringAsync(filename, b64, { encoding: FileSystem.EncodingType.Base64 });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filename, { dialogTitle: 'Download Sample Excel' });
      } else {
        Alert.alert('Sharing not available', 'Cannot download file on this device.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleUploadExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      
      setIsUploading(true);
      const fileUri = result.assets[0].uri;
      const b64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
      
      const wb = XLSX.read(b64, { type: 'base64' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      if (data.length < 2) {
        throw new Error("File is empty or missing data rows.");
      }

      // Check header (row 0)
      const headerRow = data[0];
      if (!headerRow || !headerRow[0]?.toString().toLowerCase().includes('name') || !headerRow[1]?.toString().toLowerCase().includes('phone')) {
        throw new Error("Invalid format. Column A must be NAME and Column B must be PHONE NUMBER.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const inserts = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0 || !row[0]) continue;
        
        const name = row[0].toString().trim();
        const phone = row[1] ? row[1].toString().trim() : '';
        
        if (name) {
          inserts.push({
            name,
            phone,
            lead_type: 'Cold',
            status: 'Follow-up',
            user_id: user.id
          });
        }
      }

      if (inserts.length === 0) {
        throw new Error("No valid client records found in the file.");
      }

      const { error } = await supabase.from('clients').insert(inserts);
      if (error) throw error;

      Alert.alert('Success', `Successfully imported ${inserts.length} clients!`);
      fetchClients();
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (c.project_name || '').toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'All' || c.lead_type === filter;
      return matchesSearch && matchesFilter;
    });
  }, [clients, search, filter]);

// ── Proper component so hooks are legal ──────────────────────────────────
function AnimatedClientCard({ c, index, colors, onPress }: { c: Client; index: number; colors: any; onPress: () => void }) {
  const leadColor = c.lead_type === 'Hot' ? colors.danger : c.lead_type === 'Warm' ? colors.warning : colors.textMuted;
  const itemAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(itemAnim, { toValue: 1, duration: 300, delay: index * 45, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: itemAnim, transform: [{ translateY: itemAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <View style={[styles.statusIndicator, { backgroundColor: leadColor }]} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.clientName, { color: colors.textPrimary }]}>{c.name}</Text>
          {c.project_name ? <Text style={[styles.projectName, { color: colors.textMuted }]}>{c.project_name}</Text> : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: leadColor + '18', borderColor: leadColor + '40', borderWidth: 1 }]}>
          <Text style={[styles.statusText, { color: leadColor }]}>{(c.lead_type || 'COLD').toUpperCase()}</Text>
        </View>
        <IconChevronRight size={18} color={colors.textMuted} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </Animated.View>
  );
}


  const renderItem = ({ item: c, index }: { item: Client; index: number }) => (
    <AnimatedClientCard
      c={c}
      index={index}
      colors={colors}
      onPress={() => setSelectedClient(c)}
    />
  );

  const renderHeader = () => (
    <View style={{ paddingTop: spacing.md, paddingBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Animated.Text style={{ fontSize: 26, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5, opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }}>Insights</Animated.Text>
        
        {/* Bulk Action Buttons */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={handleDownloadSample} style={[styles.actionBtn, { backgroundColor: colors.bgPanel, borderColor: colors.border, borderWidth: 1 }]}>
            <IconDownload size={16} color={colors.textPrimary} />
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Sample</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleUploadExcel} style={[styles.actionBtn, { backgroundColor: colors.accent }]} disabled={isUploading}>
            {isUploading ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <IconCloudUpload size={16} color="#fff" />
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>Upload</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.searchWrap, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}>
        <IconSearch size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search clients..."
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
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <FlatList
        data={loading ? [] : filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? (
            <View style={[styles.centered, { marginTop: 60 }]}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <IconPeopleOutline size={48} color={colors.border} />
              <Text style={{ color: colors.textMuted, marginTop: 12 }}>No clients found.</Text>
            </View>
          )
        }
      />

      {/* Info Modal */}
      <Modal visible={showInfo} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowInfo(false)}>
          <View style={[styles.infoModal, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Category Insights</Text>
            <View style={styles.infoItem}>
              <View style={[styles.dot, { backgroundColor: colors.danger }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: colors.danger }}>Hot:</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Already with us or showing strong interest in becoming clients.</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <View style={[styles.dot, { backgroundColor: colors.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: colors.warning }}>Warm:</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Under consideration; their decision is uncertain.</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: colors.textMuted }}>Cold:</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Not currently interested or show negative signals.</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.modalClose, { backgroundColor: colors.accent }]} onPress={() => setShowInfo(false)}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Lead Type Selection Modal */}
      <Modal visible={!!selectedClient} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => !isUpdating && setSelectedClient(null)}>
          <View style={[styles.statusModal, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 8 }]}>Update Lead Category</Text>
            <Text style={{ color: colors.textMuted, marginBottom: 24, textAlign: 'center' }}>
              Select a category for "{selectedClient?.name}"
            </Text>
            
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, gap: 6 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
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
  statusIndicator: { width: 4, height: 40, borderRadius: 2 },
  clientName: { fontSize: 16, fontWeight: '700' },
  projectName: { fontSize: 12, marginTop: 2 },
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
