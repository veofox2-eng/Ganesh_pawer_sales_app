import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { IconCheck, IconClose, IconPin } from '../lib/Icons';

interface PendingProfile {
  id: string;
  username: string | null;
  role: string; // Holds the requested role ('User' | 'Field') set at signup
  approval_status: string;
  updated_at: string; // used as registration timestamp (set at profile creation)
}

interface DeleteRequest {
  id: string;
  type: string;
  content: string;
  media_url: string; // the interaction ID to delete
  created_at: string;
  author: string;
  client_id: string;
  user_id: string;
  profiles?: { username: string };
  clients?: { name: string };
}

// ─── Helper: derive what the employee registered for ─────────────────────────
function getRegistrationLabel(role: string): { label: string; color: string; bg: string } {
  if (role === 'User') {
    return { label: 'Registered for Sales', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  }
  if (role === 'Field') {
    return { label: 'Registered for Field', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  }
  return { label: 'Role not specified', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
}

export default function AdminApprovalsScreen() {
  const { colors } = useTheme();
  const [pending, setPending] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'users' | 'pins' | 'leads'>('users');
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>([]);
  const [leadDeleteRequests, setLeadDeleteRequests] = useState<DeleteRequest[]>([]);
  // Track which specific user IDs have an action in progress
  const [actionIds, setActionIds] = useState<Record<string, string>>({});
  // Avoid fetch conflicts — skip realtime fetch during active action
  const activeActionRef = useRef(false);

  useEffect(() => {
    fetchPending(true);
    fetchDeleteRequests();

    const sub = supabase
      .channel('approvals_updates')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'profiles',
      }, () => {
        if (!activeActionRef.current) fetchPending(false);
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'interactions',
        filter: 'type=eq.DELETE_REQUESTED'
      }, () => {
        fetchDeleteRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  async function fetchDeleteRequests() {
    const { data } = await supabase
      .from('interactions')
      .select('*, profiles(username), clients(name)')
      .eq('type', 'DELETE_REQUESTED')
      .order('created_at', { ascending: false });
    
    if (data) {
      setDeleteRequests(data.filter((d: any) => d.content && d.content.includes('pinned location')));
      setLeadDeleteRequests(data.filter((d: any) => d.content && d.content.includes('lead project')));
    }
  }



  async function fetchPending(isInitial = false) {
    if (isInitial) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, role, approval_status, updated_at')
        .eq('approval_status', 'Pending')
        .order('updated_at', { ascending: true })
        .limit(100);

      if (!error) {
        setPending(data || []);
      }
    } catch (e) {
      // fail silently on background refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchPending(false), fetchDeleteRequests()]);
    setRefreshing(false);
  }

  async function approveAs(profile: PendingProfile, newRole: 'User' | 'Field') {
    // Mark action in progress — prevent realtime from triggering a re-fetch
    activeActionRef.current = true;
    setActionIds(prev => ({ ...prev, [profile.id]: `approve-${newRole}` }));

    // Optimistically remove from UI immediately so it feels instant
    setPending(prev => prev.filter(p => p.id !== profile.id));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, approval_status: 'Approved', is_enabled: true })
        .eq('id', profile.id);

      if (error) {
        // Rollback optimistic update on error
        Alert.alert('Error', 'Could not approve user. Please try again.');
        setPending(prev => [...prev, profile].sort((a, b) => {
          try { return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(); } catch { return 0; }
        }));
      }
    } catch (e) {
      Alert.alert('Error', 'Network issue. Please check your connection and try again.');
      setPending(prev => [...prev, profile].sort((a, b) => {
        try { return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(); } catch { return 0; }
      }));
    } finally {
      setActionIds(prev => { const n = { ...prev }; delete n[profile.id]; return n; });
      activeActionRef.current = false;
    }
  }

  async function handleReject(profile: PendingProfile) {
    Alert.alert(
      'Reject Request',
      `Reject account for "${profile.username || 'this user'}"?\nThey will not be able to access the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject', style: 'destructive',
          onPress: async () => {
            activeActionRef.current = true;
            setActionIds(prev => ({ ...prev, [profile.id]: 'reject' }));

            // Optimistic remove
            setPending(prev => prev.filter(p => p.id !== profile.id));

            try {
              const { error } = await supabase
                .from('profiles')
                .update({ approval_status: 'Rejected', is_enabled: false })
                .eq('id', profile.id);

              if (error) {
                Alert.alert('Error', 'Could not reject user. Please try again.');
                setPending(prev => [...prev, profile]);
              }
            } catch (e) {
              Alert.alert('Error', 'Network issue. Please try again.');
              setPending(prev => [...prev, profile]);
            } finally {
              setActionIds(prev => { const n = { ...prev }; delete n[profile.id]; return n; });
              activeActionRef.current = false;
            }
          },
        },
      ]
    );
  }

  async function handleApproveDelete(req: DeleteRequest) {
    activeActionRef.current = true;
    setActionIds(prev => ({ ...prev, [req.id]: 'approving' }));
    
    try {
      // 1. Delete the actual PIN interaction
      const { error: err1 } = await supabase.from('interactions').delete().eq('id', req.media_url);
      // 2. Delete the request itself
      const { error: err2 } = await supabase.from('interactions').delete().eq('id', req.id);
      
      if (!err1 && !err2) {
        setDeleteRequests(prev => prev.filter(r => r.id !== req.id));
        Alert.alert("Success", "Location pin deleted successfully.");
      } else {
        Alert.alert("Error", "Could not process deletion.");
      }
    } catch (e) {} finally {
      setActionIds(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      activeActionRef.current = false;
    }
  }

  async function handleRejectDelete(req: DeleteRequest) {
    activeActionRef.current = true;
    setActionIds(prev => ({ ...prev, [req.id]: 'rejecting' }));
    try {
      const { error } = await supabase.from('interactions').delete().eq('id', req.id);
      if (!error) {
        setDeleteRequests(prev => prev.filter(r => r.id !== req.id));
      }
    } catch (e) {} finally {
      setActionIds(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      activeActionRef.current = false;
    }
  }

  async function handleApproveLeadDelete(req: DeleteRequest) {
    activeActionRef.current = true;
    setActionIds(prev => ({ ...prev, [req.id]: 'approving' }));
    
    try {
      const { error: err1 } = await supabase.from('lead_projects').delete().eq('id', req.media_url);
      const { error: err2 } = await supabase.from('interactions').delete().eq('id', req.id);
      
      if (!err1 && !err2) {
        setLeadDeleteRequests(prev => prev.filter(r => r.id !== req.id));
        Alert.alert("Success", "Lead project deleted successfully.");
      } else {
        Alert.alert("Error", "Could not process deletion.");
      }
    } catch (e) {} finally {
      setActionIds(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      activeActionRef.current = false;
    }
  }

  async function handleRejectLeadDelete(req: DeleteRequest) {
    activeActionRef.current = true;
    setActionIds(prev => ({ ...prev, [req.id]: 'rejecting' }));
    try {
      await supabase.from('lead_projects').update({ delete_status: 'None' }).eq('id', req.media_url);
      const { error } = await supabase.from('interactions').delete().eq('id', req.id);
      if (!error) {
        setLeadDeleteRequests(prev => prev.filter(r => r.id !== req.id));
      }
    } catch (e) {} finally {
      setActionIds(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      activeActionRef.current = false;
    }
  }

  const renderItem = useCallback(({ item: p }: { item: PendingProfile }) => {
    const reg = getRegistrationLabel(p.role);
    const registeredAt = p.updated_at;
    const submittedTime = registeredAt ? new Date(registeredAt) : null;
    const isValidTime = submittedTime && !isNaN(submittedTime.getTime());
    const hoursAgo = isValidTime ? Math.floor((Date.now() - submittedTime!.getTime()) / 3600000) : -1;
    const timeLabel = !isValidTime
      ? ''
      : hoursAgo < 1
      ? 'Just now'
      : hoursAgo < 24
      ? `${hoursAgo}h ago`
      : submittedTime!.toLocaleDateString('en-US');

    const initials = (p.username || 'U').slice(0, 2).toUpperCase();
    const currentAction = actionIds[p.id];
    const isBusy = !!currentAction;
    const isApprovingSales = currentAction === 'approve-User';
    const isApprovingField = currentAction === 'approve-Field';
    const isRejecting = currentAction === 'reject';

    return (
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {/* User info row */}
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: colors.warning + '22' }]}>
            <Text style={[styles.avatarText, { color: colors.warning }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            {/* Username + registration type on same row */}
            <Text style={[styles.username, { color: colors.textPrimary }]}>
              {p.username || 'Unnamed User'}
            </Text>
            {/* Registration type badge */}
            <View style={[styles.regBadge, { backgroundColor: reg.bg }]}>
              <Text style={[styles.regBadgeText, { color: reg.color }]}>{reg.label}</Text>
            </View>
          </View>
          {/* Time pill on the right */}
          <Text style={[styles.timeText, { color: colors.textMuted }]}>{timeLabel}</Text>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Action label */}
        <Text style={[styles.question, { color: colors.textMuted }]}>Approve this account as:</Text>

        {/* Action buttons */}
        <View style={styles.actions}>
          {/* Approve as Sales */}
          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: isBusy ? colors.bgPanel : colors.success + '18',
              borderColor: isBusy ? colors.border : colors.success + '50',
              opacity: isBusy && !isApprovingSales ? 0.4 : 1,
            }]}
            onPress={() => approveAs(p, 'User')}
            disabled={isBusy}
            activeOpacity={0.7}
          >
            {isApprovingSales ? (
              <ActivityIndicator size="small" color={colors.success} />
            ) : (
              <>
                <IconCheck size={14} color={isBusy ? colors.textMuted : colors.success} />
                <Text style={[styles.actionLabel, { color: isBusy ? colors.textMuted : colors.success }]}>
                  Sales
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Approve as Field */}
          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: isBusy ? colors.bgPanel : colors.warning + '18',
              borderColor: isBusy ? colors.border : colors.warning + '50',
              opacity: isBusy && !isApprovingField ? 0.4 : 1,
            }]}
            onPress={() => approveAs(p, 'Field')}
            disabled={isBusy}
            activeOpacity={0.7}
          >
            {isApprovingField ? (
              <ActivityIndicator size="small" color={colors.warning} />
            ) : (
              <>
                <IconCheck size={14} color={isBusy ? colors.textMuted : colors.warning} />
                <Text style={[styles.actionLabel, { color: isBusy ? colors.textMuted : colors.warning }]}>
                  Field
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Reject */}
          <TouchableOpacity
            style={[styles.rejectBtn, {
              backgroundColor: isBusy ? colors.bgPanel : colors.danger + '14',
              borderColor: isBusy ? colors.border : colors.danger + '40',
              opacity: isBusy && !isRejecting ? 0.4 : 1,
            }]}
            onPress={() => handleReject(p)}
            disabled={isBusy}
            activeOpacity={0.7}
          >
            {isRejecting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <IconClose size={14} color={isBusy ? colors.textMuted : colors.danger} />
                <Text style={[styles.actionLabel, { color: isBusy ? colors.textMuted : colors.danger }]}>
                  Reject
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [colors, actionIds]);

  const renderDeleteRequest = (req: DeleteRequest) => {
    const isBusy = !!actionIds[req.id];
    return (
      <View key={req.id} style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: colors.danger + '22' }]}>
            <IconPin size={20} color={colors.danger} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.username, { color: colors.textPrimary }]}>{req.profiles?.username || req.author}</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>Request for: {req.clients?.name || 'Client'}</Text>
          </View>
          <Text style={[styles.timeText, { color: colors.textMuted }]}>{(() => { try { const d = new Date(req.created_at); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US'); } catch { return ''; } })()}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.question, { color: colors.textPrimary, fontWeight: '600' }]}>Reason for deletion:</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, fontStyle: 'italic' }}>
          "{req.content.replace('Request to delete pinned location. Reason: ', '')}"
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.danger + '18', borderColor: colors.danger + '50' }]}
            onPress={() => handleApproveDelete(req)}
            disabled={isBusy}
          >
            {isBusy && actionIds[req.id] === 'approving' ? <ActivityIndicator size="small" color={colors.danger} /> : <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12 }}>Approve Deletion</Text>}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}
            onPress={() => handleRejectDelete(req)}
            disabled={isBusy}
          >
            <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 12 }}>Ignore</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };



  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Approvals</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Approvals</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {pending.length} pending {pending.length === 1 ? 'request' : 'requests'}
          </Text>
        </View>
        {(pending.length > 0 || deleteRequests.length > 0) && (
          <View style={[styles.countBadge, { backgroundColor: colors.warning + '22' }]}>
            <Text style={[styles.countText, { color: colors.warning }]}>{pending.length + deleteRequests.length}</Text>
          </View>
        )}
      </View>

      {/* Tab Switcher */}
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: 12 }}>
        <TouchableOpacity 
          onPress={() => setTab('users')}
          style={{ 
            flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
            backgroundColor: tab === 'users' ? colors.accent : colors.bgCard,
            borderWidth: 1, borderColor: tab === 'users' ? colors.accent : colors.border,
            marginRight: 6
          }}
        >
          <Text style={{ color: tab === 'users' ? '#fff' : colors.textMuted, fontWeight: '700', fontSize: 11 }}>Users ({pending.length})</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => setTab('pins')}
          style={{ 
            flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
            backgroundColor: tab === 'pins' ? colors.accent : colors.bgCard,
            borderWidth: 1, borderColor: tab === 'pins' ? colors.accent : colors.border,
            marginRight: 6
          }}
        >
          <Text style={{ color: tab === 'pins' ? '#fff' : colors.textMuted, fontWeight: '700', fontSize: 11 }}>Pins ({deleteRequests.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setTab('leads')}
          style={{ 
            flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
            backgroundColor: tab === 'leads' ? colors.accent : colors.bgCard,
            borderWidth: 1, borderColor: tab === 'leads' ? colors.accent : colors.border,
          }}
        >
          <Text style={{ color: tab === 'leads' ? '#fff' : colors.textMuted, fontWeight: '700', fontSize: 11 }}>Leads ({leadDeleteRequests.length})</Text>
        </TouchableOpacity>
      </View>

      {tab === 'users' ? (
        <FlatList
          data={pending}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, pending.length === 0 && styles.listEmpty]}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          removeClippedSubviews={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.success + '18' }]}>
                <IconCheck size={36} color={colors.success} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>All caught up!</Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                No pending user approval requests.
              </Text>
            </View>
          }
        />
      ) : tab === 'pins' ? (
        <FlatList
          data={deleteRequests}
          keyExtractor={item => item.id}
          renderItem={({ item }) => renderDeleteRequest(item)}
          contentContainerStyle={[styles.list, deleteRequests.length === 0 && styles.listEmpty]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} colors={[colors.accent]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.success + '18' }]}>
                <IconCheck size={36} color={colors.success} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Requests</Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>No location pin deletion requests found.</Text>
            </View>
          }
        />
      ) : tab === 'leads' ? (
        <FlatList
          data={leadDeleteRequests}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View key={item.id} style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.userRow}>
                <View style={[styles.avatar, { backgroundColor: colors.danger + '22' }]}>
                  <IconPin size={20} color={colors.danger} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.username, { color: colors.textPrimary }]}>{item.profiles?.username || item.author}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>Request for: Lead Project</Text>
                </View>
                <Text style={[styles.timeText, { color: colors.textMuted }]}>{(() => { try { const d = new Date(item.created_at); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US'); } catch { return ''; } })()}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.question, { color: colors.textPrimary, fontWeight: '600' }]}>Reason for deletion:</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, fontStyle: 'italic' }}>
                "{item.content.replace('Request to delete lead project: ', '')}"
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: colors.danger + '18', borderColor: colors.danger + '50' }]}
                  onPress={() => handleApproveLeadDelete(item)}
                  disabled={!!actionIds[item.id]}
                >
                  {!!actionIds[item.id] && actionIds[item.id] === 'approving' ? <ActivityIndicator size="small" color={colors.danger} /> : <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12 }}>Approve Deletion</Text>}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}
                  onPress={() => handleRejectLeadDelete(item)}
                  disabled={!!actionIds[item.id]}
                >
                  <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 12 }}>Ignore</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={[styles.list, leadDeleteRequests.length === 0 && styles.listEmpty]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} colors={[colors.accent]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.success + '18' }]}>
                <IconCheck size={36} color={colors.success} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Requests</Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>No lead project deletion requests found.</Text>
            </View>
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  countBadge: {
    minWidth: 40, height: 40, borderRadius: 20,
    paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontSize: 16, fontWeight: '800' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100, paddingTop: 4 },
  listEmpty: { flex: 1 },
  card: {
    borderRadius: radius.xl, borderWidth: 1,
    padding: spacing.md, marginBottom: 14,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800' },
  username: { fontSize: 15, fontWeight: '700', marginBottom: 5 },
  regBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full,
  },
  regBadgeText: { fontSize: 10, fontWeight: '700' },
  timeText: { fontSize: 11, marginLeft: 8 },
  divider: { height: 1, marginBottom: 10 },
  question: { fontSize: 12, marginBottom: 8, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, minHeight: 38,
  },
  rejectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, minHeight: 38,
  },
  actionLabel: { fontSize: 12, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
