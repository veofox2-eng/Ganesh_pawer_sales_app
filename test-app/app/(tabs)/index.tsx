import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from '@/lib/BackgroundLocation';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function FieldDashboard() {
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setLoading(false);
  };

  const toggleTracking = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to start tracking.');
      return;
    }

    if (isTracking) {
      await stopBackgroundLocationTracking();
      setIsTracking(false);
    } else {
      const success = await startBackgroundLocationTracking();
      if (success) {
        setIsTracking(true);
      } else {
        Alert.alert('Permission Denied', 'Please enable location permissions in settings.');
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#f59e0b', dark: '#1D3D47' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#ffffff33"
          name="location.fill"
          style={styles.headerIcon}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Field Flow</ThemedText>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">Employee Status</ThemedText>
        <ThemedText style={styles.statusText}>
          {user ? `Logged in as: ${user.email}` : 'Not logged in'}
        </ThemedText>
        
        <View style={styles.trackingSection}>
          <View style={[styles.indicator, { backgroundColor: isTracking ? '#22c55e' : '#ef4444' }]} />
          <ThemedText type="defaultSemiBold">
            {isTracking ? 'Location Tracking Active' : 'Tracking Offline'}
          </ThemedText>
        </View>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: isTracking ? '#ef4444' : '#f59e0b' }]}
          onPress={toggleTracking}
        >
          <ThemedText style={styles.buttonText}>
            {isTracking ? 'Stop Tracking' : 'Start My Shift'}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Field Tasks</ThemedText>
        <ThemedText>
          Your assigned tasks will appear here. ensure tracking is active during working hours.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 20,
  },
  headerIcon: {
    color: '#ffffff',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  card: {
    margin: 20,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    gap: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#8b949e',
  },
  trackingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  stepContainer: {
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
});

