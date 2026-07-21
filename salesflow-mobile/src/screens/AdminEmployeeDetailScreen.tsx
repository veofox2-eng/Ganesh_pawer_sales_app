import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Linking, Switch,
  RefreshControl, FlatList, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { IconChevronBack, IconCall, IconTime, IconMap, IconPin, IconPeopleFilled, IconPlay, IconStop, IconMic, IconTrash } from '../lib/Icons';
import { format, formatDistanceToNow } from 'date-fns';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';

const fmtTime = (ts: any) => {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '' : format(d, 'hh:mm a, dd MMM');
  } catch { return ''; }
};

// Color + label config for each interaction type
const INTERACTION_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  LOCATION_SEARCHED: { color: '#F59E0B', label: 'Location Searched', icon: '🔍' },
  LOCATION_REACHED:  { color: '#10B981', label: 'Reached Destination', icon: '✅' },
  TRAVEL_PLAN:       { color: '#6366F1', label: 'Travel Plan', icon: '🗺️' },
  CALL_MADE:         { color: '#3B82F6', label: 'Call Made', icon: '📞' },
  CALL_RECORDING:    { color: '#8B5CF6', label: 'Call Recording', icon: '🎙️' },
  NOTE_ADDED:        { color: '#64748B', label: 'Note Added', icon: '📝' },
  VOICE_INSTRUCTION: { color: '#14B8A6', label: 'Voice Note', icon: '🎤' },
  ATTACHMENT_ADDED:  { color: '#EC4899', label: 'Attachment', icon: '📎' },
};

function haversine(la1: number, lo1: number, la2: number, lo2: number) {
  const R = 6371;
  const dLa = (la2 - la1) * Math.PI / 180;
  const dLo = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDate(iso: string) {
  const d = new Date(iso), now = new Date();
  const y = now.toDateString(), y1 = new Date(now.setDate(now.getDate()-1)).toDateString();
  if (d.toDateString() === y) return 'Today';
  if (d.toDateString() === y1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function groupByDate(items: any[]) {
  const groups: { label: string; data: any[] }[] = [];
  const seen: Record<string, number> = {};
  items.forEach(item => {
    const label = fmtDate(item.created_at);
    if (seen[label] === undefined) { seen[label] = groups.length; groups.push({ label, data: [] }); }
    groups[seen[label]].data.push(item);
  });
  return groups;
}

export default function AdminEmployeeDetailScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);

  const { profile, role } = route.params || {};
  const isField = role === 'Field';

  const tabs = isField ? ['Map', 'Clients', 'Call Log', 'Other Records', 'Leads'] : ['Clients', 'Call Log', 'Other Records', 'Leads'];
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [latestLoc, setLatestLoc] = useState<any>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(profile?.is_enabled ?? true);
  const [stats, setStats] = useState({ total: 0, wins: 0, lost: 0, km: '0' });

  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  async function playRecording(uri: string) {
    if (playingUri === uri) {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setPlayingUri(null);
      return;
    }
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setPlaybackLoading(true);
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, null, true);
      soundRef.current = sound;
      setPlayingUri(uri);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) setPlayingUri(null);
      });
    } catch (e) {
      Alert.alert('Error', 'Could not play audio');
      setPlayingUri(null);
    } finally {
      setPlaybackLoading(false);
    }
  }

  const deleteOtherRecord = (item: any) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this record?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              if (isMounted.current) setLoading(true);
              if (item.media_url && item.media_url.includes('client-attachments/')) {
                const fileName = item.media_url.split('client-attachments/')[1];
                if (fileName) {
                  await supabase.storage.from('client-attachments').remove([fileName]);
                }
              }
              await supabase.from('interactions').update({ media_url: 'DELETED' }).eq('id', item.id);
              fetchData(false);
            } catch (err) {
              Alert.alert('Error', 'Could not delete record.');
            } finally {
              if (isMounted.current) setLoading(false);
            }
        }}
      ]
    );
  };
  // Leads state
  const [leads, setLeads] = useState<any[]>([]);
  const [fetchingApplicants, setFetchingApplicants] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    fetchData();

    // Failsafe for loading
    const timeoutId = setTimeout(() => {
      if (isMounted.current && loading) {
        console.warn('Failsafe triggered in AdminEmployeeDetailScreen');
        setLoading(false);
      }
    }, 5000);

    const timer = setInterval(() => { if (isMounted.current && isField) fetchData(false); }, 180000);

    let realtimeCh: ReturnType<typeof supabase.channel> | null = null;
    if (isField && profile?.id) {
      realtimeCh = supabase
        .channel(`emp_loc_detail_${profile.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_locations', filter: `user_id=eq.${profile.id}` },
          () => { if (isMounted.current) fetchData(false); }
        )
        .subscribe();
    }

    return () => {
      isMounted.current = false;
      clearTimeout(timeoutId);
      clearInterval(timer);
      if (realtimeCh) supabase.removeChannel(realtimeCh);
    };
  }, [profile?.id]);

  async function fetchData(showLoading = true) {
    if (showLoading && isMounted.current) setLoading(true);
    try {
      const pid = profile.id;
      const [cRes, tRes, lRes] = await Promise.all([
        supabase.from('clients').select('*').eq('user_id', pid).eq('is_deleted', false).order('created_at', { ascending: false }),
        supabase.from('interactions').select('*, clients(id, name)').eq('user_id', pid).order('created_at', { ascending: false }).limit(80),
        supabase.from('lead_projects').select('*, lead_applicants(count)').eq('created_by', pid).order('created_at', { ascending: false }),
      ]);

      let latest: any = null;
      let kmVal = '0';

      if (isField) {
        const { data: lLatest } = await supabase.from('employee_locations')
          .select('*').eq('user_id', pid).order('updated_at', { ascending: false }).limit(1).maybeSingle();
        latest = lLatest;

        const todayStr = new Date(); todayStr.setHours(0, 0, 0, 0);
        const { data: lHistory } = await supabase.from('employee_locations')
          .select('*').eq('user_id', pid).gte('updated_at', todayStr.toISOString()).order('updated_at', { ascending: true });

        const locs = lHistory || [];
        if (locs.length > 1) {
          let total = 0;
          for (let i = 1; i < locs.length; i++) {
            total += haversine(Number(locs[i - 1].latitude), Number(locs[i - 1].longitude), Number(locs[i].latitude), Number(locs[i].longitude));
          }
          kmVal = (Math.round(total * 10) / 10).toString();
        }
      }

      if (isMounted.current) {
        const cl = cRes.data || [];
        setClients(cl);
        
        const rawTimeline = tRes.data || [];
        const normalizedTimeline = rawTimeline.map((t: any) => {
          if (t.type === 'CALL_RECORDING' && !t.client_id) {
            return { ...t, type: 'OTHER_RECORDING' };
          }
          return t;
        });
        setTimeline(normalizedTimeline);
        
        setLeads(lRes.data || []);
        setLatestLoc(latest);
        setStats({
          total: cl.length,
          wins: cl.filter((c: any) => c.status === 'Converted').length,
          lost: cl.filter((c: any) => c.status === 'Lost').length,
          km: kmVal,
        });
        if (latest) reverseGeocode(latest.latitude, latest.longitude);
      }
    } catch (e) {
    } finally {
      if (isMounted.current) { setLoading(false); setRefreshing(false); }
    }
  }

  async function reverseGeocode(lat: any, lon: any) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, { headers: { 'User-Agent': 'SF/1.0' } });
      const d = await res.json();
      if (d?.display_name && isMounted.current) setAddress(d.display_name.split(',').slice(0, 3).join(', '));
    } catch { }
  }

  const isLive = latestLoc && (Date.now() - new Date(latestLoc.updated_at.replace(' ', 'T')).getTime() < 480000); // 8 min — slightly above 5-min heartbeat

  const mapHtml = latestLoc ? `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>body{margin:0;padding:0}#map{height:100vh;width:100vw}.leaflet-control-attribution{display:none!important}</style></head><body><div id="map"></div><script>var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${latestLoc.latitude},${latestLoc.longitude}],15);L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:20}).addTo(map);L.marker([${latestLoc.latitude},${latestLoc.longitude}]).addTo(map);</script></body></html>` : '';

  // ── MAP TAB ─────────────────────────────────────────────────────────────────
  function renderMapTab() {
    return (
      <View style={{ padding: spacing.lg, paddingBottom: 60 }}>
        {latestLoc ? (
          <View style={[styles.mapContainer, { borderColor: colors.border }]}>
            <WebView
              key={`map_${latestLoc.latitude}_${latestLoc.longitude}`}
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={{ flex: 1 }}
              scrollEnabled={false}
              androidHardwareAccelerationDisabled={true}
            />
          </View>
        ) : (
          <View style={[styles.mapContainer, styles.emptyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <IconMap size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No live location yet</Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, marginTop: 15 }]}>
          <View style={styles.cardRow}>
            <IconPin color={colors.warning} size={18} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Live Status</Text>
          </View>
          <Text style={[styles.addressText, { color: colors.textSecondary }]}>{address || 'Locating worker...'}</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.kmRow}>
            <View style={styles.kmBox}>
              <Text style={[styles.kmVal, { color: colors.warning }]}>{stats.km}</Text>
              <Text style={styles.kmLab}>KM Today</Text>
            </View>
            <View style={styles.kmBox}>
              <Text style={[styles.kmVal, { color: isLive ? colors.success : colors.danger }]}>{isLive ? 'Active' : 'Away'}</Text>
              <Text style={styles.kmLab}>Status</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: colors.accent }]}
            onPress={async () => {
              if (latestLoc) {
                try {
                  await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latestLoc.latitude},${latestLoc.longitude}`);
                } catch (err) {
                  Alert.alert('Error', 'Could not open Google Maps.');
                }
              }
            }}
          >
            <Text style={styles.navBtnText}>Navigate in Google Maps</Text>
          </TouchableOpacity>
        </View>

        {/* Search History from interactions */}
        {(() => {
          const locItems = timeline.filter(t => t.type === 'LOCATION_SEARCHED' || t.type === 'LOCATION_REACHED');
          if (locItems.length === 0) return null;
          return (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 15, marginBottom: 10 }}>Search History</Text>
              {locItems.map(item => {
                const isReached = item.type === 'LOCATION_REACHED';
                const clr = isReached ? '#10B981' : '#F59E0B';
                return (
                  <View key={item.id} style={[styles.historyItem, { backgroundColor: colors.bgCard, borderColor: colors.border, borderLeftColor: clr }]}>
                    <View style={[styles.historyDot, { backgroundColor: clr }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: clr, fontSize: 10, fontWeight: '800', marginBottom: 3 }}>{isReached ? '✅ REACHED' : '🔍 SEARCHED'}</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{item.content || ''}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 3 }}>{fmtClock(item.created_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })()}
      </View>
    );
  }

  // ── CLIENTS TAB ─────────────────────────────────────────────────────────────
  function renderClientsTab() {
    if (clients.length === 0) {
      return (
        <View style={styles.emptyState}>
          <IconPeopleFilled size={52} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: 14 }]}>No clients assigned yet</Text>
        </View>
      );
    }
    return (
      <View style={{ padding: spacing.lg, paddingBottom: 60 }}>
        {clients.map(item => {
          const sColor = item.status === 'Converted' ? colors.success : item.status === 'Lost' ? colors.danger : colors.warning;
          const lColor = item.lead_type === 'Hot' ? '#EF4444' : item.lead_type === 'Warm' ? '#F59E0B' : '#64748B';
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.clientCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => navigation.navigate('ClientDetail', { client: item })}
              activeOpacity={0.8}
            >
              <View style={[styles.clientAvatar, { backgroundColor: sColor + '22' }]}>
                <Text style={[styles.clientAvatarText, { color: sColor }]}>{(item.name || 'C')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.clientName, { color: colors.textPrimary }]}>{item.name}</Text>
                {!!item.phone && <Text style={[styles.clientSub, { color: colors.textMuted }]}>{item.phone}</Text>}
                {!!item.project_name && <Text style={[styles.clientSub, { color: colors.textSecondary }]}>{item.project_name}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <View style={[styles.badge, { backgroundColor: sColor + '22' }]}>
                  <Text style={[styles.badgeText, { color: sColor }]}>{item.status}</Text>
                </View>
                {!!item.lead_type && (
                  <View style={[styles.badge, { backgroundColor: lColor + '22' }]}>
                    <Text style={[styles.badgeText, { color: lColor }]}>{item.lead_type}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }


  function renderCallLogTab() {
    const calls = timeline.filter(t => t.type === 'CALL_MADE' || t.type === 'CALL_RECORDING');
    const otherCalls = timeline.filter(t => t.type === 'OTHER_RECORDING');
    if (calls.length === 0 && otherCalls.length === 0) {
      return (
        <View style={styles.emptyState}>
          <IconCall size={52} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: 14 }]}>No calls logged yet</Text>
        </View>
      );
    }
    const groups = groupByDate(calls);
    return (
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 60 }}>
        {groups.map(group => (
          <View key={group.label}>
            <View style={styles.dateHeader}>
              <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dateLabel, { color: colors.textMuted }]}>{group.label}</Text>
              <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
            </View>
            {group.data.map(item => {
              const isRec = item.type === 'CALL_RECORDING';
              const clr = isRec ? colors.danger : colors.success;
              const clientName = (item as any).clients?.name;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.logCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    const fullClient = clients.find(c => c.id === item.client_id);
                    if (fullClient) {
                      navigation.navigate('ClientDetail', { client: fullClient });
                    }
                  }}
                >
                  <View style={[styles.logAvatar, { backgroundColor: clr }]}>
                    <Text style={styles.logAvatarText}>{isRec ? '🎙' : '📞'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {!!clientName && (
                      <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '700', marginBottom: 2 }}>
                        👤 {clientName}
                      </Text>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14, flex: 1, marginRight: 8 }}>{item.content || (isRec ? 'Recording' : 'Call Made')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8, flexWrap: 'wrap' }}>
                      <View style={[styles.typeBadge, { backgroundColor: clr + '22', borderWidth: 1, borderColor: clr + '44' }]}>
                        <Text style={[styles.typeBadgeText, { color: clr }]}>{isRec ? '🎙 Recording' : '📞 Call Made'}</Text>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{fmtDate(item.created_at)} • {fmtClock(item.created_at)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

      </View>
    );
  }

  function renderOtherRecordsTab() {
    const otherCalls = timeline.filter(t => t.type === 'OTHER_RECORDING');
    if (otherCalls.length === 0) {
      return (
        <View style={styles.emptyState}>
          <IconMic size={52} color={colors.warning + '88'} />
          <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: 14 }]}>No other records found</Text>
        </View>
      );
    }
    const groups = groupByDate(otherCalls);
    return (
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 60 }}>
        {groups.map(group => (
          <View key={group.label}>
            <View style={styles.dateHeader}>
              <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dateLabel, { color: colors.textMuted }]}>{group.label}</Text>
              <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
            </View>
            {group.data.map((item: any) => {
              const phone = item.content?.replace(/📞\s*Other Recording\s*[—-]\s*/, '') || item.content || 'Unknown Number';
              const isPlaying = playingUri === item.media_url;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.logCard, { backgroundColor: colors.bgCard, borderColor: colors.warning + '55', borderLeftWidth: 3 }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    const fullClient = clients.find(c => c.id === item.client_id);
                    if (fullClient) {
                      navigation.navigate('ClientDetail', { client: fullClient });
                    }
                  }}
                >
                  <View style={[styles.logAvatar, { backgroundColor: colors.warning }]}>
                    <IconMic size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14, flex: 1, marginRight: 8 }}>{phone}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8, flexWrap: 'wrap' }}>
                      <View style={[styles.typeBadge, { backgroundColor: colors.warning + '22', borderWidth: 1, borderColor: colors.warning + '44' }]}>
                        <Text style={[styles.typeBadgeText, { color: colors.warning }]}>🎙 Other Recording</Text>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{fmtDate(item.created_at)} • {fmtClock(item.created_at)}</Text>
                    </View>
                  </View>
                  {item.media_url === 'DELETED' ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }}>
                      <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 12 }}>Deleted File</Text>
                    </View>
                  ) : item.media_url ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => deleteOtherRecord(item)}
                        style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: colors.bgPanel, borderWidth: 1, borderColor: colors.danger + '55',
                          alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        <IconTrash size={16} color={colors.danger} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => playRecording(item.media_url)}
                        disabled={playbackLoading && playingUri !== item.media_url}
                        style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: isPlaying ? colors.danger : colors.accent,
                          alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        {playbackLoading && playingUri === item.media_url ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : isPlaying ? (
                          <IconStop size={16} color="#fff" />
                        ) : (
                          <IconPlay size={16} color="#fff" />
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  }

  // ── LEADS TAB ───────────────────────────────────────────────────────────────

  function renderLeadsTab() {
    if (leads.length === 0) {
      return (
        <View style={styles.emptyState}>
          <IconPeopleFilled size={52} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: 14 }]}>No lead projects created</Text>
        </View>
      );
    }
    return (
      <View style={{ padding: spacing.lg, paddingBottom: 60 }}>
        {leads.map(item => {
          const applicantCount = item.lead_applicants?.[0]?.count || 0;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.clientCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => navigation.navigate('LeadProfileDetail', { project: item })}
              activeOpacity={0.8}
            >
              <View style={[styles.clientAvatar, { backgroundColor: colors.accent + '22' }]}>
                <Text style={[styles.clientAvatarText, { color: colors.accent }]}>P</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.clientName, { color: colors.textPrimary }]}>{item.project_name}</Text>
                <Text style={[styles.clientSub, { color: colors.textMuted }]}>
                  {applicantCount} {applicantCount === 1 ? 'Applicant' : 'Applicants'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                <Text style={{ color: colors.accent, fontSize: 18 }}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // ── MAIN RENDER ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <IconChevronBack color={colors.textPrimary} size={28} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{profile.username || 'Agent'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <View style={[styles.statusDot, { backgroundColor: isLive ? colors.success : colors.textMuted }]} />
            <Text style={[styles.headerSub, { color: isLive ? colors.success : colors.textMuted }]}>
              {isLive ? 'Active Now' : latestLoc ? `Seen ${formatDistanceToNow(new Date(latestLoc.updated_at))} ago` : 'Offline'}
            </Text>
          </View>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={v => { setIsEnabled(v); supabase.from('profiles').update({ is_enabled: v }).eq('id', profile.id); }}
          thumbColor="#fff"
          trackColor={{ false: colors.border, true: colors.success }}
        />
      </View>

      {/* Stats Row */}
      <View style={[styles.statsRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: colors.textPrimary }]}>{stats.total}</Text>
          <Text style={styles.statLab}>CLIENTS</Text>
        </View>
        <View style={[styles.sep, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: colors.success }]}>{stats.wins}</Text>
          <Text style={styles.statLab}>WINS</Text>
        </View>
        <View style={[styles.sep, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: colors.danger }]}>{stats.lost}</Text>
          <Text style={styles.statLab}>LOST</Text>
        </View>
        {isField && (
          <>
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statVal, { color: colors.warning }]}>{stats.km}</Text>
              <Text style={styles.statLab}>KM</Text>
            </View>
          </>
        )}
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {tabs.map(tab => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, active && { backgroundColor: colors.accent }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: active ? '#fff' : colors.textMuted }]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content — Fixed content area that scrolls independently */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(false); }} tintColor={colors.accent} />}
          >
            {activeTab === 'Map' && renderMapTab()}
            {activeTab === 'Clients' && renderClientsTab()}
            {activeTab === 'Call Log' && renderCallLogTab()}
            {activeTab === 'Other Records' && renderOtherRecordsTab()}
            {activeTab === 'Leads' && renderLeadsTab()}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12 },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  headerSub: { fontSize: 13, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statsRow: { flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: 12, padding: 14, borderRadius: radius.xl, borderWidth: 1, alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: 'bold' },
  statLab: { fontSize: 9, fontWeight: '800', color: '#888', textTransform: 'uppercase', marginTop: 2 },
  sep: { width: 1, height: 30 },
  tabBar: { flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: 10, borderRadius: radius.xl, borderWidth: 1, padding: 5, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  tabText: { fontSize: 13, fontWeight: '700' },
  // Map tab
  mapContainer: { height: 240, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1 },
  card: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  addressText: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
  divider: { height: 1, marginBottom: 14 },
  kmRow: { flexDirection: 'row', marginBottom: 18 },
  kmBox: { flex: 1, alignItems: 'center' },
  kmVal: { fontSize: 22, fontWeight: 'bold' },
  kmLab: { fontSize: 10, fontWeight: '700', color: '#888', marginTop: 3 },
  navBtn: { height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  navBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  emptyCard: { height: 200, borderRadius: radius.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // Clients tab
  clientCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.xl, borderWidth: 1, marginBottom: 10 },
  clientAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  clientAvatarText: { fontSize: 20, fontWeight: 'bold' },
  clientName: { fontSize: 16, fontWeight: '700' },
  clientSub: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  // Timeline tab
  timelineItem: { borderRadius: radius.lg, borderWidth: 1, borderLeftWidth: 4, padding: 14, marginBottom: 10 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  timelineContent: { fontSize: 13, fontWeight: '500', lineHeight: 19, marginBottom: 4 },
  timelineTime: { fontSize: 11 },
  // Shared
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyText: { fontSize: 15, fontWeight: '600' },
  // Date group headers (Timeline & Call Log)
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  dateLine: { flex: 1, height: 1 },
  dateLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  // Search history (Map tab)
  historyItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 10, borderWidth: 1, borderLeftWidth: 4, padding: 12, marginBottom: 8 },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  // Call Log tab
  logCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  logAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  logAvatarText: { fontSize: 18 },
});
