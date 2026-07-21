import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { IconSearch, IconPeopleOutline, IconCloseCircle, IconChevronForward, IconDocumentText } from '../lib/Icons';
import { formatDistanceToNow } from 'date-fns';

export default function AdminFieldListScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    
    // Failsafe for loading
    const timeoutId = setTimeout(() => {
      if (isMounted.current && loading) setLoading(false);
    }, 5000);

    // Update the "ago" text every 30 seconds
    const timer = setInterval(() => {
      if (isMounted.current) setNow(Date.now());
    }, 30000);

    // REALTIME: Listen for any location updates to refresh the live status
    const channel = supabase.channel('admin_field_list_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_locations' }, () => {
        fetchData(false); // Background refresh
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        fetchData(false);
      })
      .subscribe();

    const sub = navigation.addListener('focus', () => fetchData(false));
    
    return () => { 
      isMounted.current = false;
      clearTimeout(timeoutId);
      clearInterval(timer);
      supabase.removeChannel(channel);
      sub();
    };
  }, []);

  async function fetchData(showLoading = true) {
    if (showLoading && isMounted.current) setLoading(true);
    try {
      const { data: profiles } = await supabase.from('profiles').select('*').eq('role', 'Field').eq('approval_status', 'Approved').order('username');
      if (profiles) {
        // Fetch latest location for all
        const { data: locs } = await supabase.from('employee_locations').select('user_id, updated_at').in('user_id', profiles.map(p => p.id)).order('updated_at', { ascending: false });
        
        const latestLocs: Record<string, string> = {};
        if (locs) {
          locs.forEach(l => { if (!latestLocs[l.user_id]) latestLocs[l.user_id] = l.updated_at; });
        }

        if (isMounted.current) {
          const enriched = profiles.map(p => {
             const lastTime = latestLocs[p.id] || null;
             let isLive = false;
             if (lastTime) {
               try {
                 const timeStr = typeof lastTime === 'string' ? lastTime.replace(' ', 'T') : lastTime;
                 const diff = Date.now() - new Date(timeStr as string).getTime();
                 if (!isNaN(diff)) {
                   isLive = diff < 480000; // 8 mins (match the detail screen exactly)
                 }
               } catch(e) {}
             }
             return { ...p, lastTime, isLive };
          });
          setEmployees(enriched);
        }
      }
    } catch (e) {
    } finally { 
      if (isMounted.current) {
        setLoading(false); 
        setRefreshing(false); 
      }
    }
  }

  const filtered = useMemo(() => 
    employees.filter(e => (e.username || '').toLowerCase().includes(search.toLowerCase())),
    [employees, search]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Field Team</Text>
      </View>
      <View style={[styles.searchRow, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}>
         <IconSearch size={18} color={colors.textMuted} />
         <TextInput 
            style={[styles.input, { color: colors.textPrimary }]} 
            placeholder="Search field employees..." 
            placeholderTextColor={colors.textMuted} 
            value={search} 
            onChangeText={setSearch} 
         />
         {search.length > 0 && (
           <TouchableOpacity onPress={() => setSearch('')}>
             <IconCloseCircle size={18} color={colors.textMuted} />
           </TouchableOpacity>
         )}
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
      
      {loading && employees.length === 0 ? (
        <View style={styles.centered}><ActivityIndicator color={colors.warning} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(false); }} tintColor={colors.accent} />}
          renderItem={({ item }) => {
            const isLive = item.isLive;
            return (
              <TouchableOpacity 
                style={[
                  styles.card, 
                  { backgroundColor: colors.bgCard, borderColor: isLive ? colors.warning : colors.border },
                  isLive && { borderWidth: 1.5, shadowColor: colors.warning, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 }
                ]} 
                onPress={() => navigation.navigate('AdminEmployeeDetail', { profile: item, role: 'Field' })}
              >
                {isLive && <View style={[styles.liveIndicator, { backgroundColor: colors.warning }]} />}
                <View style={[styles.avatar, { backgroundColor: isLive ? colors.warning + '20' : colors.accent + '20' }]}>
                   <Text style={[styles.avatarText, { color: isLive ? colors.warning : colors.accent }]}>{(item.username || 'U')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.name, { color: colors.textPrimary }]}>{item.username || 'Unnamed'}</Text>
                    {isLive && (
                      <View style={[styles.liveBadge, { backgroundColor: colors.warning + '20' }]}>
                        <Text style={[styles.liveText, { color: colors.warning }]}>LIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: isLive ? colors.success : colors.textMuted, marginTop: 4, fontWeight: isLive ? 'bold' : 'normal' }}>
                    {isLive ? 'Active' : (item.lastTime ? 'Away' : 'No location data')}
                  </Text>
                </View>
                <IconChevronForward color={colors.textMuted} size={18} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <IconPeopleOutline size={48} color={colors.border} />
              <Text style={{ color: colors.textMuted, marginTop: 15, fontWeight: 'bold' }}>No employees found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 15 },
  title: { fontSize: 28, fontWeight: 'bold', letterSpacing: -0.5 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, paddingHorizontal: 15, height: 50, borderRadius: 12, borderWidth: 1, marginBottom: 15 },
  input: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '500' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, borderWidth: 1, marginBottom: 12, position: 'relative', overflow: 'hidden' },
  liveIndicator: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: 'bold' },
  name: { fontSize: 17, fontWeight: 'bold' },
  liveBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 10 },
  liveText: { fontSize: 9, fontWeight: 'bold' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 100 },
  sharedBtn: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, 
    marginHorizontal: 20, marginBottom: 15,
    borderRadius: radius.lg, borderWidth: 1,
  },
});
