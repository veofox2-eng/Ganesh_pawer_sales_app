import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius, STATUS_COLORS } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { IconCalendar, IconPeopleOutline, IconArrowBack } from '../lib/Icons';

export default function AdminSharedClientsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSharedClients();
    const unsubscribe = navigation.addListener('focus', fetchSharedClients);
    return unsubscribe;
  }, [navigation]);

  async function fetchSharedClients() {
    setLoading(true);
    const { data, error } = await supabase.from('clients')
      .select('*, receiver:profiles!user_id(username, feature_flags), sender:profiles!shared_by(username, feature_flags)')
      .not('shared_by', 'is', null)
      .order('shared_at', { ascending: false });

    if (data) {
      const formatted = data.map((c: any) => ({
        ...c,
        shared_from_name: c.sender ? (c.sender.username || c.sender.feature_flags?.email || 'Unknown') : 'Unknown',
        shared_to_name: c.receiver ? (c.receiver.username || c.receiver.feature_flags?.email || 'Unknown') : 'Unknown'
      }));
      setClients(formatted);
    }
    setLoading(false);
  }

  const renderItem = ({ item }: { item: any }) => {
    const sc = STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] || STATUS_COLORS['Follow-up'];
    const dateStr = item.reminder_date ? new Date(item.reminder_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No date';
    const sharedAtStr = item.shared_at ? new Date(item.shared_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.clientName, { color: colors.textPrimary }]}>{item.name}</Text>
            
            <View style={{ backgroundColor: colors.accent + '15', padding: 8, borderRadius: 8, marginBottom: 8, alignSelf: 'flex-start' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <IconPeopleOutline size={14} color={colors.accent} />
                <Text style={{ fontSize: 12, color: colors.textPrimary }}>From: <Text style={{ fontWeight: '700', color: colors.accent }}>{item.shared_from_name}</Text></Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconPeopleOutline size={14} color={colors.success} />
                <Text style={{ fontSize: 12, color: colors.textPrimary }}>To: <Text style={{ fontWeight: '700', color: colors.success }}>{item.shared_to_name}</Text></Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <IconCalendar size={12} color={colors.textMuted} />
              <Text style={{ fontSize: 12, color: colors.textMuted }}>Shared on: {sharedAtStr}</Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[styles.badgeText, { color: sc.text }]}>{item.status}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 12 }}>
          <IconArrowBack size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Shared Clients Log</Text>
      </View>
      
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={[styles.centered, { marginTop: 60 }]}>
              <IconPeopleOutline size={48} color={colors.textMuted} />
              <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: 12 }}>No shared clients found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  card: {
    padding: 16, marginHorizontal: spacing.lg, borderRadius: 16,
    marginBottom: 12, borderWidth: 1,
  },
  clientName: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
