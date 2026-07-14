import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Linking, Alert, ScrollView, Platform,
  Modal
} from 'react-native';
import PremiumDateTimePicker from '../components/PremiumDateTimePicker';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius, STATUS_COLORS } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { AppColors } from '../context/ThemeContext';
import {
  IconCall, IconCallOutline, IconWhatsApp, IconAdd, IconSearch,
  IconCloseCircle, IconCalendar, IconSun, IconMoon, IconLogout,
  IconPeopleOutline, IconTrash, IconCheck, IconMenu
} from '../lib/Icons';
import { useSidebar } from '../context/SidebarContext';
import { useCallTracking } from '../hooks/useCallTracking';
import CallFeedbackModal from '../components/CallFeedbackModal';
import CallRecorderSetupModal from '../components/CallRecorderSetupModal';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import { scheduleClientReminder, cancelNotification } from '../lib/Notifications';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { IconDownload, IconCloudUpload } from '../lib/Icons';

type Status = 'Follow-up' | 'Converted' | 'Lost';

interface Client {
  id: string; name: string; phone: string; email?: string;
  project_name?: string; source?: string; status: Status;
  reason_for_contact?: string; reminder_date?: string;
  deal_value?: number; is_deleted: boolean; created_at: string; user_id: string;
}

const FILTERS = ['All', 'Follow-up', 'Converted', 'Lost', 'Deleted'];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatReminderDate(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function isToday(dateStr?: string) {
  if (!dateStr) return false;
  const today = new Date();
  const d = new Date(dateStr);
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
}

function isExceeded(dateStr?: string, status?: string) {
  if (!dateStr || status !== 'Follow-up') return false;
  return new Date(dateStr).getTime() < Date.now();
}

// Memoized Client Item to prevent full list re-renders
const ClientItem = React.memo(({ 
  item: c, 
  onPress, 
  onStartCall, 
  onWhatsApp, 
  onDelete, 
  onRestore, 
  onPermDelete,
  onReschedule,
  isAdmin,
  theme,
  styles 
}: any) => {
  const sc = STATUS_COLORS[c.status as Status] || STATUS_COLORS['Follow-up'];
  const hasFollowupToday = isToday(c.reminder_date);
  const exceeded = isExceeded(c.reminder_date, c.status);
  const colors = theme;

  const renderRightActions = () => {
    if (c.is_deleted) {
      return (
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            style={styles.restoreAction}
            onPress={() => onRestore(c)}
          >
            <IconCheck size={24} color="#fff" />
            <Text style={styles.actionText}>Restore</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.deleteAction, { backgroundColor: '#000' }]}
              onPress={() => onPermDelete(c)}
            >
              <IconTrash size={24} color="#fff" />
              <Text style={styles.actionText}>Perm. Del</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => onDelete(c)}
      >
        <IconTrash size={24} color="#fff" />
        <Text style={styles.actionText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable 
      renderRightActions={renderRightActions} 
      friction={2} 
      rightThreshold={40}
      activeOffsetX={[-20, 20]} // Increased threshold to prevent accidental swipes while scrolling
    >
      <TouchableOpacity
        style={[styles.card, hasFollowupToday && styles.cardHighlight, { marginHorizontal: spacing.lg }]}
        onPress={() => onPress(c)}
        activeOpacity={0.75}
      >
        {hasFollowupToday && <View style={styles.todayAccent} />}
        <View style={styles.cardLeft}>
          <View style={[styles.avatar, hasFollowupToday && styles.avatarHighlight]}>
            <Text style={styles.avatarText}>{getInitials(c.name)}</Text>
          </View>
        </View>
        <View style={styles.cardMid}>
          <Text style={styles.clientName} numberOfLines={1}>{c.name}</Text>
          <View style={styles.metaRow}>
            {c.phone ? (
              <View style={styles.metaItem}>
                <IconCallOutline size={11} color={colors.textMuted} />
                <Text style={styles.metaText}>{c.phone}</Text>
              </View>
            ) : null}
            {c.project_name ? (
              <View style={styles.projectBadge}>
                <Text style={styles.projectBadgeText}>{c.project_name}</Text>
              </View>
            ) : null}
          </View>
          {c.reminder_date ? (
            <View style={styles.reminderRow}>
              <IconCalendar size={11} color={hasFollowupToday ? colors.warning : colors.textMuted} />
              <Text style={[styles.reminderText, hasFollowupToday && styles.reminderTextToday]}>
                {formatReminderDate(c.reminder_date)}
              </Text>
            </View>
          ) : null}
          {c.deal_value ? (
            <Text style={styles.dealValue}>Deal: ₹{Number(c.deal_value).toLocaleString('en-IN')}</Text>
          ) : null}
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{c.status}</Text>
          </View>
          {!exceeded && (
            <View style={styles.quickActions}>
              <TouchableOpacity
                onPress={() => onStartCall(c.id, c.name, c.phone)}
                style={[styles.qBtn, { backgroundColor: colors.success }]}
              >
                <IconCall size={15} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onWhatsApp(c.phone)}
                style={[styles.qBtn, { backgroundColor: '#25D366' }]}
              >
                <IconWhatsApp size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {exceeded && (
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => onReschedule(c)}
            style={styles.exceededOverlay}
          >
            <View style={styles.exceededBanner}>
              <View style={styles.exceededPulse} />
              <Text style={styles.exceededText}>FOLLOW-UP OVERDUE</Text>
              <Text style={styles.exceededActionText}>Tap to update date and time</Text>
            </View>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
});

export default function CallSheetScreen({ navigation, route }: any) {
  const { user, profile } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  
  const isAdmin = profile?.role === 'Admin';
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow'>('all');
  const [search, setSearch] = useState('');
  const [showCallFeedback, setShowCallFeedback] = useState(false);
  const [showRecorderSetup, setShowRecorderSetup] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeCallClient, setActiveCallClient] = useState<{ id: string; name: string; phone?: string } | null>(null);

  const [rescheduleClient, setRescheduleClient] = useState<Client | null>(null);
  const { openSidebar } = useSidebar();
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [newReminderDate, setNewReminderDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [updatingDate, setUpdatingDate] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);


  const { startCall } = useCallTracking((call) => {
    setActiveCallClient({ id: call.clientId, name: call.clientName, phone: '' });
    setCallStartTime(call.startTime);
    setShowCallFeedback(true);
  });

  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    fetchClients();
    const unsubscribe = navigation.addListener('focus', fetchClients);
    return unsubscribe;
  }, [navigation]);

  async function fetchClients() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from('clients').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setClients(data);
    setLoading(false);
  }

  const handleDownloadSample = async () => {
    try {
      const ws = XLSX.utils.aoa_to_sheet([['NAME', 'PHONE NUMBER'], ['John Doe', '9876543210']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Clients');
      
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) {
        return;
      }
      
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, 'Sample_Clients_Upload.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
      
      Alert.alert('Success', 'Sample file saved successfully!', [
        { text: 'Close', style: 'cancel' },
        { 
          text: 'Open File', 
          onPress: async () => {
            try {
              const IntentLauncher = await import('expo-intent-launcher');
              await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                data: uri,
                flags: 1,
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              });
            } catch (e) {
              Alert.alert('Cannot Open', 'No app found to open Excel files. Please open it from your file manager.');
            }
          }
        }
      ]);
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

  async function handleSignOut() {
    setShowLogoutConfirm(true);
  }

  async function handleDeleteClient(client: Client) {
    Alert.alert(
      'Delete Client',
      `Are you sure you want to delete ${client.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('clients')
              .update({ is_deleted: true })
              .eq('id', client.id);
            
            if (error) {
              Alert.alert('Error', 'Could not delete client');
            } else {
              await supabase.from('interactions').insert({
                client_id: client.id,
                user_id: user?.id,
                type: 'CLIENT_DELETED',
                content: 'Client was moved to deleted folder.',
                author: profile?.role || 'Employee'
              });
              await cancelNotification(`client_${client.id}`);
              setClients(prev => prev.map(c => c.id === client.id ? { ...c, is_deleted: true } : c));
            }
          }
        }
      ]
    );
  }

  async function handlePermanentDeleteClient(client: Client) {
    Alert.alert(
      'Permanently Delete',
      `This will remove ${client.name} and ALL their interactions forever. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'PERMANENTLY DELETE',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('clients')
              .delete()
              .eq('id', client.id);
            
            if (error) {
              Alert.alert('Error', 'Could not permanently delete client');
            } else {
              await cancelNotification(`client_${client.id}`);
              setClients(prev => prev.filter(c => c.id !== client.id));
              Alert.alert('Deleted', 'Client removed permanently.');
            }
          }
        }
      ]
    );
  }

  async function handleRestoreClient(client: Client) {
    const { error } = await supabase
      .from('clients')
      .update({ is_deleted: false })
      .eq('id', client.id);
    
    if (error) {
      Alert.alert('Error', 'Could not restore client');
    } else {
      await supabase.from('interactions').insert({
        client_id: client.id,
        user_id: user?.id,
        type: 'CLIENT_RESTORED',
        content: 'Client was restored from deleted folder.',
        author: profile?.role || 'Employee'
      });
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, is_deleted: false } : c));
      Alert.alert('Restored', `${client.name} has been restored.`);
    }
  }

  async function handleReschedule() {
    if (!rescheduleClient) return;
    setUpdatingDate(true);
    const { error } = await supabase
      .from('clients')
      .update({ reminder_date: newReminderDate.toISOString() })
      .eq('id', rescheduleClient.id);

    if (error) {
      Alert.alert('Error', 'Could not update date: ' + error.message);
    } else {
      await scheduleClientReminder(
        `Follow-up: ${rescheduleClient.name}`,
        `Call ${rescheduleClient.name} today as scheduled.`,
        newReminderDate,
        { clientId: rescheduleClient.id, phone: rescheduleClient.phone }
      );
      fetchClients();
      setShowRescheduleModal(false);
      setRescheduleClient(null);
    }
    setUpdatingDate(false);
  }

  const filtered = clients.filter(c => {
    if (filter === 'Deleted') {
      return c.is_deleted === true;
    }
    if (c.is_deleted === true) return false;

    const matchStatus = filter === 'All' || c.status === filter;
    const matchSearch = [c.name, c.phone, c.project_name || '']
      .join(' ').toLowerCase().includes(search.toLowerCase());
    let matchDate = true;
    if (dateFilter === 'today') {
      matchDate = isToday(c.reminder_date);
    } else if (dateFilter === 'tomorrow') {
      if (!c.reminder_date) { matchDate = false; }
      else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const d = new Date(c.reminder_date);
        matchDate = d.getDate() === tomorrow.getDate() &&
          d.getMonth() === tomorrow.getMonth() &&
          d.getFullYear() === tomorrow.getFullYear();
      }
    }
    return matchStatus && matchSearch && matchDate;
  });

  const topThree = useMemo(() => {
    return filtered
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);
  }, [filtered]);

  const remaining = useMemo(() => {
    const topIds = topThree.map(t => t.id);
    return filtered.filter(f => !topIds.includes(f.id));
  }, [filtered, topThree]);

  const activeCount = clients.filter(c => !c.is_deleted).length;
  const todayCount = clients.filter(c => !c.is_deleted && isToday(c.reminder_date)).length;

  const renderItem = React.useCallback(({ item }: { item: Client }) => (
    <ClientItem 
      item={item}
      onPress={(c: Client) => navigation.navigate('ClientDetail', { client: c })}
      onStartCall={startCall}
                onWhatsApp={async (phone: string) => {
                  try {
                    await Linking.openURL(`https://wa.me/${(phone || '').replace(/\D/g, '')}`);
                  } catch (err) {
                    Alert.alert('Error', 'Could not open WhatsApp.');
                  }
                }}
      onDelete={handleDeleteClient}
      onRestore={handleRestoreClient}
      onPermDelete={handlePermanentDeleteClient}
      onReschedule={(c: Client) => {
        setRescheduleClient(c);
        setNewReminderDate(new Date());
        setShowRescheduleModal(true);
      }}
      isAdmin={isAdmin}
      theme={colors}
      styles={styles}
    />
  ), [colors, styles, isAdmin, navigation, startCall]);

  const renderHeader = () => (
    <View style={{ paddingTop: spacing.md }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>{profile?.username || 'Employee'}</Text>
            <View style={{ backgroundColor: colors.accentLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, color: colors.accent, fontWeight: '700', textTransform: 'uppercase' }}>{profile?.feature_flags?.industry_position || profile?.role}</Text>
            </View>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>Client Call Sheet</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{activeCount} clients{todayCount > 0 ? ` · ${todayCount} follow-up today` : ''}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={{ flexShrink: 1, maxWidth: '60%' }} contentContainerStyle={styles.headerActions}>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
            {isDark
              ? <IconSun size={20} color={colors.warning} />
              : <IconMoon size={20} color={colors.accent} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.themeBtn, { backgroundColor: colors.accentLight, borderColor: colors.accent }]}
            onPress={() => navigation.navigate('Dialer')}
          >
            <IconCall size={18} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('ClientDetail', { client: null, isNew: true })}
          >
            <IconAdd size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <IconLogout size={20} color={colors.danger} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Excel Bulk Upload Actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <TouchableOpacity onPress={handleDownloadSample} style={[styles.actionBtn, { backgroundColor: colors.bgPanel, borderColor: colors.border, borderWidth: 1 }]}>
          <IconDownload size={14} color={colors.textPrimary} />
          <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Sample</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleUploadExcel} style={[styles.actionBtn, { backgroundColor: colors.accent, flex: 1, justifyContent: 'center' }]} disabled={isUploading}>
          {isUploading ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <IconCloudUpload size={14} color="#fff" />
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>Upload Excel</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <IconSearch size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, phone, project..."
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
        style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, alignItems: 'flex-start' }}
        onPress={() => setShowRecorderSetup(true)}
      >
        <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '500' }}>
          Automatic Call Recording Not Working? Tap Here
        </Text>
      </TouchableOpacity>

      {/* Status Filter Pills */}
      <View style={{ marginBottom: spacing.xs }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {FILTERS.map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)}
              style={[styles.filterPill, filter === f && styles.filterPillActive]}>
              <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Follow-up Date Filter */}
      <View style={{ paddingBottom: spacing.sm }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateFilterRow}
        >
          {([
            ['all', 'All Dates'],
            ['today', 'Today'],
            ['tomorrow', 'Tomorrow'],
          ] as const).map(([val, label]) => (
            <TouchableOpacity key={val} onPress={() => setDateFilter(val)}
              style={[styles.datePill, dateFilter === val && styles.datePillActive]}>
              <IconCalendar size={12} color={dateFilter === val ? colors.warning : colors.textMuted} />
              <Text style={[styles.datePillText, dateFilter === val && styles.datePillTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {topThree.length > 0 && (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[styles.sectionTitle, { marginHorizontal: spacing.lg, marginBottom: spacing.sm }]}>Recently Added Clients</Text>
          <View style={{ gap: 10 }}>
            {topThree.map(c => (
              <ClientItem 
                key={c.id}
                item={c}
                onPress={(cl: Client) => navigation.navigate('ClientDetail', { client: cl })}
                onStartCall={startCall}
                          onWhatsApp={async (phone: string) => {
                  try {
                    await Linking.openURL(`https://wa.me/${(phone || '').replace(/\D/g, '')}`);
                  } catch (err) {
                    Alert.alert('Error', 'Could not open WhatsApp.');
                  }
                }}
                onDelete={handleDeleteClient}
                onRestore={handleRestoreClient}
                onPermDelete={handlePermanentDeleteClient}
                onReschedule={(cl: Client) => {
                  setRescheduleClient(cl);
                  setNewReminderDate(new Date(Date.now() + 15 * 60000));
                  setShowRescheduleModal(true);
                }}
                isAdmin={isAdmin}
                theme={colors}
                styles={styles}
              />
            ))}
          </View>
        </View>
      )}

      {remaining.length > 0 && (
        <Text style={[styles.sectionTitle, { marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm }]}>All Other Clients</Text>
      )}
    </View>
  );

  return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <FlatList
            data={remaining}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListHeaderComponent={renderHeader()}
            contentContainerStyle={{ paddingBottom: 100 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={() => (
              topThree.length === 0 ? (
                <View style={styles.centered}>
                  <Text style={styles.emptyTextSub}>No active clients match your filters.</Text>
                </View>
              ) : null
            )}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            // Performance Optimizations
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        )}

        {activeCallClient && (
          <CallFeedbackModal
            visible={showCallFeedback}
            clientId={activeCallClient.id}
            clientName={activeCallClient.name}
            startTime={callStartTime}
            onClose={() => {
              setShowCallFeedback(false);
              setCallStartTime(undefined);
            }}
            onSuccess={fetchClients}
          />
        )}

        <CallRecorderSetupModal 
          visible={showRecorderSetup}
          onClose={() => setShowRecorderSetup(false)}
        />

        <LogoutConfirmModal
          visible={showLogoutConfirm}
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={() => { setShowLogoutConfirm(false); supabase.auth.signOut(); }}
        />

        {/* Reschedule Modal */}
        <Modal 
          visible={showRescheduleModal} 
          animationType="slide" 
          transparent
          onRequestClose={() => setShowRescheduleModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: colors.bgCard, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 }}>Update Follow-up</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 20 }}>
                Please set a new date and time for {rescheduleClient?.name} to enable call and message options.
              </Text>

              <TouchableOpacity 
                style={{
                  flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgPanel,
                  padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
                  marginBottom: 20
                }}
                onPress={() => setShowDatePicker(true)}
              >
                <IconCalendar size={20} color={colors.accent} style={{ marginRight: 12 }} />
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                  {newReminderDate.toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </Text>
              </TouchableOpacity>

              <PremiumDateTimePicker
                visible={showDatePicker}
                value={newReminderDate}
                minimumDate={new Date()}
                onClose={() => setShowDatePicker(false)}
                onChange={(date) => {
                  setNewReminderDate(date);
                }}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.bgPanel, alignItems: 'center' }}
                  onPress={() => setShowRescheduleModal(false)}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center' }}
                  onPress={handleReschedule}
                  disabled={updatingDate}
                >
                  {updatingDate ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Update & Enable Actions</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
  );
}

function getStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
    headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    themeBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: colors.bgPanel, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: radius.full,
    },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    signOutBtn: { padding: 8 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, gap: 6 },
    actionBtnText: { fontSize: 13, fontWeight: '700' },
    searchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.bgPanel, borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.border,
      marginHorizontal: spacing.lg, marginVertical: spacing.sm,
      paddingHorizontal: 14,
    },
    searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: 12 },
    filtersRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    filterPill: {
      height: 34, paddingHorizontal: 16, borderRadius: radius.full,
      borderWidth: 1, borderColor: colors.border, marginRight: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    filterPillActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
    filterPillText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
    filterPillTextActive: { color: colors.accent },
    dateFilterRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    datePill: {
      flexDirection: 'row', alignItems: 'center', gap: 5, height: 30,
      paddingHorizontal: 12, borderRadius: radius.full,
      borderWidth: 1, borderColor: colors.border, marginRight: 8,
    },
    datePillActive: { backgroundColor: 'rgba(217,119,6,0.12)', borderColor: colors.warning },
    datePillText: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
    datePillTextActive: { color: colors.warning },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 40 },
    card: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.bgCard, borderRadius: radius.lg,
      borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 12,
      overflow: 'hidden',
    },
    cardHighlight: {
      borderColor: 'rgba(245,158,11,0.35)',
      backgroundColor: 'rgba(245,158,11,0.04)',
    },
    todayAccent: {
      position: 'absolute', left: 0, top: 0, bottom: 0,
      width: 3, backgroundColor: colors.warning, borderRadius: 3,
    },
    cardLeft: {},
    avatar: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    },
    avatarHighlight: { backgroundColor: colors.warning },
    avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    cardMid: { flex: 1, gap: 3 },
    clientName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: colors.textSecondary },
    projectBadge: {
      backgroundColor: colors.accentLight, borderRadius: radius.full,
      paddingHorizontal: 8, paddingVertical: 2,
    },
    projectBadgeText: { fontSize: 11, color: colors.accent, fontWeight: '600' },
    reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    reminderText: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
    reminderTextToday: { color: colors.warning, fontWeight: '700' },
    dealValue: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    cardRight: { alignItems: 'flex-end', gap: 8 },
    statusBadge: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
      borderWidth: 1,
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    quickActions: { flexDirection: 'row', gap: 6 },
    qBtn: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: 'center', justifyContent: 'center',
    },
    deleteAction: {
      backgroundColor: colors.danger,
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      height: '100%',
      borderRadius: radius.lg,
    },
    restoreAction: {
      backgroundColor: colors.success,
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      height: '100%',
      borderRadius: radius.lg,
    },
    actionText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 12, fontWeight: '700', color: colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    emptyTextSub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
    exceededOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(239, 68, 68, 0.95)', // Strong red
      paddingVertical: 8,
      alignItems: 'center',
    },
    exceededBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    exceededPulse: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#fff',
    },
    exceededText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    exceededActionText: {
      color: '#fff',
      fontSize: 10,
      opacity: 0.9,
      fontWeight: '600',
    },
  });
}
