import React, { useState, useEffect } from 'react';
import { Platform, View, Text, StyleSheet, Dimensions, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius } from '../theme';
import { IconArrowBack, IconMap, IconPeopleOutline } from '../lib/Icons';
import TrackingMap from '../components/TrackingMap';

const { width, height } = Dimensions.get('window');

interface EmployeeLoc {
  user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  profiles: {
    username: string;
  };
}

export default function AdminFieldTrackingScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [locations, setLocations] = useState<EmployeeLoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLocations(true);
    // Subscribe to realtime updates
    const sub = supabase
      .channel('employee_locations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_locations' }, () => {
        fetchLocations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  async function fetchLocations(showLoader = false) {
    if (showLoader) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employee_locations')
        .select('user_id, latitude, longitude, updated_at, profiles(username)')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching locations', error);
      } else if (data) {
        const latest: Record<string, EmployeeLoc> = {};
        for (const row of data) {
          if (!latest[row.user_id]) {
            latest[row.user_id] = row as any;
          }
        }
        setLocations(Object.values(latest));
      }
    } catch (e) {
      console.error('[AdminFieldTracking] Error:', e);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  const initialRegion = {
    latitude: locations[0]?.latitude || 20.5937,
    longitude: locations[0]?.longitude || 78.9629,
    latitudeDelta: 10,
    longitudeDelta: 10,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <IconArrowBack size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Field Tracking</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.mapContainer}>
        <TrackingMap
          locations={locations}
          initialRegion={initialRegion}
          colors={colors}
        />
      </View>

      <View style={[styles.listContainer, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.listTitle, { color: colors.textPrimary }]}>Active Field Agents</Text>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={locations}
            keyExtractor={item => item.user_id}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={[styles.agentCard, { borderColor: colors.border }]}>
                <View style={[styles.agentAvatar, { backgroundColor: colors.accentLight }]}>
                  <Text style={[styles.agentAvatarText, { color: colors.accent }]}>
                    {(item.profiles?.username || 'U')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.agentName, { color: colors.textPrimary }]}>{item.profiles?.username}</Text>
                  <Text style={[styles.agentTime, { color: colors.textMuted }]}>
                    Updated: {(() => { try { const d = new Date(item.updated_at); return isNaN(d.getTime()) ? '' : d.toLocaleString('en-US'); } catch { return ''; } })()}
                  </Text>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  mapContainer: { height: height * 0.4 },
  markerWrap: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  markerText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  callout: {
    padding: 10, borderRadius: 8, borderWidth: 1,
    minWidth: 120, alignItems: 'center',
  },
  calloutTitle: { fontWeight: '700', fontSize: 14 },
  calloutSub: { fontSize: 11, marginTop: 4 },
  listContainer: { flex: 1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
  listTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  agentCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, marginBottom: 10,
  },
  agentAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  agentAvatarText: { fontWeight: '700', fontSize: 16 },
  agentName: { fontSize: 15, fontWeight: '600' },
  agentTime: { fontSize: 12, marginTop: 4 },
});
