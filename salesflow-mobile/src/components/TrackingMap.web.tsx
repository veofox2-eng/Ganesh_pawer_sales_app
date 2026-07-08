import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconMap } from '../lib/Icons';
import { spacing } from '../theme';

interface TrackingMapProps {
  locations: any[];
  colors: any;
}

export default function TrackingMap({ locations, colors }: TrackingMapProps) {
  return (
    <View style={[styles.mapPlaceholder, { backgroundColor: colors.bgCard }]}>
      <IconMap size={48} color={colors.textMuted} />
      <Text style={[styles.mapPlaceholderText, { color: colors.textMuted }]}>
        Interactive Map is available on Mobile only
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
        ({locations.length} agents currently tracked)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mapPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl,
  },
  mapPlaceholderText: {
    fontSize: 16, fontWeight: '600', marginTop: 12, textAlign: 'center',
  },
});
