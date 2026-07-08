import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  TextInput, ScrollView, Keyboard, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import TrackingMap from '../components/TrackingMap';
import { spacing, radius } from '../theme';
import { IconMap, IconPin, IconSearch, IconChevronBack, IconCheckCircle, IconMenu } from '../lib/Icons';
import * as Location from 'expo-location';
import { startBackgroundLocationTracking } from '../lib/BackgroundLocation';
import { Linking } from 'react-native';
import { useSidebar } from '../context/SidebarContext';

interface Suggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  nearbyOnly?: boolean;
}

export default function FieldTrackingScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { openSidebar } = useSidebar();
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [watchSub, setWatchSub] = useState<any>(null);

  // Search States
  const [fromText, setFromText] = useState('My Location');
  const [toText, setToText] = useState('');
  const [fromCoords, setFromCoords] = useState<any>(null);
  const [toCoords, setToCoords] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeSearch, setActiveSearch] = useState<'from' | 'to' | null>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hasReached, setHasReached] = useState(false);

  const searchTimerRef = useRef<any>(null);
  const screenAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(screenAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Helper: Haversine distance in meters
  const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    fetchMyLocation();
    startWatchingLocation();

    // 1. Database Subscription (for local UI sync)
    const sub = supabase
      .channel('my_location')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'employee_locations',
        filter: `user_id=eq.${profile?.id}`
      }, (payload) => {
        if (payload.new) {
          const nl = payload.new as any;
          if (nl.latitude && nl.longitude) setLocation(nl);
        }
      })
      .subscribe();

    // 2. Presence Tracking (So Admin sees "Online")
    const presenceCh = supabase.channel('field-employee-presence', {
      config: { presence: { key: profile?.id || 'unknown' } },
    });
    presenceCh
      .on('presence', { event: 'sync' }, () => {
        console.log('[Presence] Employee synced');
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceCh.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(sub);
      supabase.removeChannel(presenceCh);
    };
  }, [profile?.id]);

  useEffect(() => {
    return () => {
      if (watchSub) watchSub.remove();
    };
  }, [watchSub]);

  async function startWatchingLocation() {
    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Foreground location permission is required.');
        return;
      }

      // BACKGROUND PERMISSION (Bug 2 Fix)
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        Alert.alert(
          'Background Access Required',
          'To share your location while the app is closed, please set Location Permission to "Allow all the time" in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: async () => {
              try {
                await Linking.openSettings();
              } catch (err) {
                Alert.alert('Error', 'Could not open settings.');
              }
            } }
          ]
        );
      }

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 5000 },
        (loc) => {
          if (!loc?.coords) return;
          const newLoc = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            updated_at: new Date().toISOString()
          };
          setLocation(newLoc);
          if (!fromCoords) setFromCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
          setLoading(false);
        }
      );
      setWatchSub(sub);
    } catch (err) {
      console.error('Error watching location:', err);
    }
  }

  /**
   * Bug 2 Fix: Search nearby first (viewbox biased), then optionally show all.
   * Uses Nominatim viewbox parameter centred on user's current GPS if available.
   */
  async function searchLocation(query: string, type: 'from' | 'to', forceGlobal = false) {
    if (type === 'from') setFromText(query); else setToText(query);
    setSuggestions([]);
    setShowAllResults(forceGlobal);

    if (!query || query.length < 3) return;
    setActiveSearch(type);

    // Debounce
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        // Current user position for bias
        const userLat = fromCoords?.lat || location?.latitude;
        const userLon = fromCoords?.lon || location?.longitude;

        let url: string;
        if (userLat && userLon && !forceGlobal) {
          // Tight delta for local accuracy (approx 20-30km)
          const delta = 0.3;
          const viewbox = `${userLon - delta},${userLat + delta},${userLon + delta},${userLat - delta}`;
          
          // Use bounded=1 to FORCE results within the nearby area, and addressdetails/namedetails for more local context
          url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=25&addressdetails=1&namedetails=1&lat=${userLat}&lon=${userLon}&viewbox=${viewbox}&bounded=1&countrycodes=in`;
        } else {
          // No position yet or forceGlobal – global search restricted to India by default for this app
          url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=25&addressdetails=1&namedetails=1&countrycodes=in`;
        }

        const res = await fetch(url, {
          headers: { 'User-Agent': 'SalesFlowCRM/1.0' }
        });
        const data = await res.json();
        const results: Suggestion[] = Array.isArray(data) ? data : [];
        setSuggestions(results);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  async function handleSelect(item: Suggestion) {
    if (!item?.lat || !item?.lon) return;
    const coords = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) };
    if (activeSearch === 'from') {
      setFromText(item.display_name);
      setFromCoords(coords);
    } else {
      setToText(item.display_name);
      setToCoords(coords);
      
      // Log search immediately for Admin to see
      try {
        await supabase.from('interactions').insert({
          client_id: null,
          user_id: profile?.id,
          type: 'LOCATION_SEARCHED',
          content: `Searched for: ${item.display_name}`,
          author: profile?.username || 'Agent',
          media_url: JSON.stringify({ lat: item.lat, lon: item.lon })
        });
      } catch (err) {
        console.error('Logging search failed:', err);
      }
    }
    setSuggestions([]);
    setActiveSearch(null);
    Keyboard.dismiss();
  }

  async function getDirections() {
    if (!fromCoords || !toCoords) return;
    setCalculating(true);
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${fromCoords.lon},${fromCoords.lat};${toCoords.lon},${toCoords.lat}?overview=full&geometries=geojson`
      );
      if (!res.ok) throw new Error('Routing service unavailable');
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
        setRouteData(coords);
        setHasReached(false); // Reset reach status for new route

        // Log the search action
        await supabase.from('interactions').insert({
          client_id: null,
          user_id: profile?.id,
          type: 'LOCATION_SEARCHED',
          content: `Searched for: ${toText}`,
          author: profile?.username || 'Agent',
          media_url: JSON.stringify({ lat: toCoords.lat, lon: toCoords.lon }) // Store target coords in media_url
        });

        await supabase.from('interactions').insert({
          client_id: null,
          user_id: profile?.id,
          type: 'TRAVEL_PLAN',
          content: `Planned route from ${fromText.split(',')[0]} to ${toText.split(',')[0]}. Distance: ${(data.routes[0].distance / 1000).toFixed(2)} km`,
          author: profile?.username || 'Agent'
        });
      } else {
        throw new Error('No route found for these locations');
      }
    } catch (e: any) {
      console.error('Routing error:', e);
      Alert.alert('Routing Error', e.message || 'Could not calculate directions. Please check your internet connection.');
    } finally {
      setCalculating(false);
    }
  }

  async function handleMarkReached() {
    if (!location || !toCoords) return;

    const dist = getDistanceMeters(
      location.latitude, 
      location.longitude, 
      parseFloat(toCoords.lat), 
      parseFloat(toCoords.lon)
    );

    if (dist > 100) {
      Alert.alert(
        "Destination Not Reached",
        "You have not reached the destination. Please click this option only after arriving at the location."
      );
      return;
    }

    try {
      const { error } = await supabase.from('interactions').insert({
        client_id: null,
        user_id: profile?.id,
        type: 'LOCATION_REACHED',
        content: `Successfully reached: ${toText}`,
        author: profile?.username || 'Agent',
        media_url: JSON.stringify({ lat: toCoords.lat, lon: toCoords.lon })
      });

      if (error) throw error;
      setHasReached(true);
      Alert.alert("Success", "Destination marked as reached!");
    } catch (err) {
      console.error('Reach error:', err);
      Alert.alert("Error", "Could not mark as reached. Please try again.");
    }
  }

  async function fetchMyLocation() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('employee_locations')
        .select('*')
        .eq('user_id', profile?.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && data.latitude && data.longitude) {
        setLocation(data);
        setFromCoords({ lat: data.latitude, lon: data.longitude });
      }
    } catch (err) {
      console.error('Error fetching location:', err);
    } finally {
      setLoading(false);
    }
  }

  const mapLocations = location ? [{
    ...location,
    profiles: { username: profile?.username || 'Me' }
  }] : [];

  const safeLat = (location && !isNaN(Number(location.latitude))) ? Number(location.latitude) : 11.6643;
  const safeLon = (location && !isNaN(Number(location.longitude))) ? Number(location.longitude) : 78.1460;

  const initialRegion = {
    latitude: safeLat,
    longitude: safeLon,
    latitudeDelta: location ? 0.01 : 0.5,
    longitudeDelta: location ? 0.01 : 0.5,
  };

  const activeQuery = activeSearch === 'from' ? fromText : toText;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary || colors.text, letterSpacing: -0.5 }}>Field Tracking</Text>
      </View>

      <Animated.View style={[styles.searchContainer, { zIndex: 20, opacity: screenAnim, transform: [{ translateY: screenAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}>
        {/* FROM input */}
        <View style={[styles.inputWrapper, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>FROM</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            value={fromText}
            onChangeText={(txt) => searchLocation(txt, 'from')}
            placeholder="Starting location..."
            placeholderTextColor={colors.textMuted}
            onFocus={() => setActiveSearch('from')}
          />
          <TouchableOpacity onPress={startWatchingLocation}>
            <IconPin size={18} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* TO input */}
        <View style={[styles.inputWrapper, { backgroundColor: colors.bgCard, borderColor: colors.border, marginTop: 8 }]}>
          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>TO</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            value={toText}
            onChangeText={(txt) => searchLocation(txt, 'to')}
            placeholder="Where to?"
            placeholderTextColor={colors.textMuted}
            onFocus={() => setActiveSearch('to')}
          />
          {searching && <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 4 }} />}
        </View>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <View style={[
            styles.suggestions,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
              top: activeSearch === 'from' ? 60 : 116
            }
          ]}>
            <Text style={[styles.suggestLabel, { color: colors.textMuted }]}>
              {showAllResults ? 'All Results' : '📍 Nearby Locations'}
            </Text>
            {suggestions.map((item, idx) => (
              <TouchableOpacity
                key={item.place_id || String(idx)}
                style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                onPress={() => handleSelect(item)}
              >
                <IconPin size={13} color={colors.accent} />
                <Text style={[styles.suggestionText, { color: colors.textPrimary }]} numberOfLines={2}>
                  {item.display_name}
                </Text>
              </TouchableOpacity>
            ))}
            {/* Show All button – repeats search without viewbox bias */}
            {!showAllResults && (
              <TouchableOpacity
                style={[styles.showAllBtn, { borderTopColor: colors.border }]}
                onPress={() => searchLocation(activeQuery, activeSearch!, true)}
              >
                <IconSearch size={14} color={colors.accent} />
                <Text style={[styles.showAllText, { color: colors.accent }]}>Show All Results</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.routeBtn, { backgroundColor: colors.accent }]}
            onPress={getDirections}
            disabled={calculating || !fromCoords || !toCoords}
          >
            {calculating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <IconMap size={18} color="#fff" />
                <Text style={styles.routeBtnText}>Show Directions</Text>
              </>
            )}
          </TouchableOpacity>

          {toCoords && !hasReached && (
            <TouchableOpacity 
              style={[styles.reachBtn, { backgroundColor: colors.success }]} 
              onPress={handleMarkReached}
            >
              <IconCheckCircle size={18} color="#fff" />
              <Text style={styles.routeBtnText}>Reached</Text>
            </TouchableOpacity>
          )}

          {hasReached && (
            <View style={[styles.reachBtn, { backgroundColor: colors.success + '40', borderWidth: 1, borderColor: colors.success }]}>
              <Text style={[styles.routeBtnText, { color: colors.success }]}>✓ Reached</Text>
            </View>
          )}

          {(routeData || toCoords) && (
            <TouchableOpacity
              style={[styles.clearBtn, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}
              onPress={() => { 
                setRouteData(null); 
                setToText(''); 
                setToCoords(null); 
                setHasReached(false);
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <View style={styles.mapContainer}>
        {loading && !location ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ color: colors.textMuted, marginTop: 12 }}>Initializing GPS...</Text>
          </View>
        ) : (
          <TrackingMap
            locations={mapLocations}
            initialRegion={initialRegion}
            colors={colors}
            routeData={routeData}
          />
        )}
      </View>

      {location && !routeData && (
        <Animated.View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accent + '22' }]}>
            <IconPin size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>Tracking Active</Text>
            <Text style={[styles.infoDesc, { color: colors.textMuted }]}>Real-time high-accuracy tracking is currently active.</Text>
          </View>
          <View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, alignSelf: 'center' }]} />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 20,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: radius.lg,
    paddingHorizontal: 12, height: 48,
  },
  inputLabel: { fontSize: 9, fontWeight: '800', width: 40 },
  input: { flex: 1, fontSize: 14, fontWeight: '600' },
  suggestions: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    zIndex: 30,
    maxHeight: 260,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  suggestLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4,
    textTransform: 'uppercase',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  showAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 12, borderTopWidth: 1,
  },
  showAllText: { fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  routeBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 44, borderRadius: radius.md,
  },
  reachBtn: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 44, borderRadius: radius.md,
  },
  routeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  clearBtn: {
    paddingHorizontal: 12, height: 44, borderRadius: radius.md,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  mapContainer: {
    flex: 1, overflow: 'hidden',
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    borderWidth: 1, borderColor: '#00000010',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: spacing.lg, marginBottom: spacing.lg,
    padding: spacing.md, borderRadius: radius.lg, borderWidth: 1,
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontSize: 15, fontWeight: '700' },
  infoDesc: { fontSize: 12, marginTop: 2 },
});
