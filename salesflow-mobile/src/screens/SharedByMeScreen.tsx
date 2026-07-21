import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, STATUS_COLORS } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { IconMenu, IconCalendar, IconPeopleOutline } from '../lib/Icons';

export default function SharedByMeScreen({ navigation }: any) {
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch clients shared by this user
    // We join on user_id because the current user_id is the receiver
    const { data } = await supabase.from('clients')
      .select('*, profiles!user_id(username, feature_flags)')
      .eq('shared_by', user.id)
      .order('shared_at', { ascending: false });

    if (data) {
      const formatted = data.map((c: any) => ({
        ...c,
        shared_to_name: c.profiles ? (c.profiles.username || c.profiles.feature_flags?.email || 'Unknown') : 'Unknown'
      }));
      setClients(formatted);
    }
    setLoading(false);
  }

  const renderItem = ({ item }: { item: any }) => {
    const sc = STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] || STATUS_COLORS['Follow-up'];
    const dateStr = item.reminder_date ? new Date(item.reminder_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No date';

    return (
      <View style={{ backgroundColor: colors.bgCard, padding: 16, marginHorizontal: spacing.lg, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>{item.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <IconPeopleOutline size={14} color={colors.textSecondary} />
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>Shared to: <Text style={{ fontWeight: '600', color: colors.accent }}>{item.shared_to_name}</Text></Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <IconCalendar size={12} color={colors.textMuted} />
              <Text style={{ fontSize: 12, color: colors.textMuted }}>Follow-up: {dateStr}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: sc.bg, borderColor: sc.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: sc.text }}>{item.status}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => navigation.openDrawer && navigation.openDrawer()} style={{ marginRight: 16 }}>
          <IconMenu size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>Shared By Me</Text>
      </View>
      
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: 'center' }}>You haven't shared any clients yet.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </SafeAreaView>
  );
}
