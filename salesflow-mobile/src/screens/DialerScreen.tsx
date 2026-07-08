import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { IconCall, IconCloseCircle, IconChevronBack } from '../lib/Icons';
import { useCallTracking } from '../hooks/useCallTracking';

const { width } = Dimensions.get('window');
const PAD_SIZE = Math.min(width * 0.22, 85); // Dynamically scale keypad

export default function DialerScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const { startCall } = useCallTracking((callDetails) => {
    console.log('Returned from call', callDetails);
  });

  const handlePress = (val: string) => {
    if (phoneNumber.length < 15) {
      setPhoneNumber(prev => prev + val);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleCall = async () => {
    if (phoneNumber.length < 3) return;
    await startCall('', 'Unknown Client', phoneNumber);
  };

  const dialPad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

  // Dynamic styling based on theme
  const keypadBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const keypadBorder = isDark ? '#2C2C2E' : '#E5E5EA';
  
  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
        >
          <IconChevronBack size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Keypad</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* DISPLAY AREA */}
      <View style={styles.displayContainer}>
        <Text 
          style={[
            styles.numberDisplay, 
            { color: colors.textPrimary },
            phoneNumber.length > 10 && { fontSize: 36 } // Auto shrink text
          ]} 
          numberOfLines={1} 
          adjustsFontSizeToFit
        >
          {phoneNumber || ' '}
        </Text>
      </View>

      {/* DIAL PAD */}
      <View style={styles.padContainer}>
        {dialPad.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map(key => (
              <TouchableOpacity
                key={key}
                activeOpacity={0.6}
                style={[
                  styles.keyButton, 
                  { backgroundColor: keypadBg, borderColor: keypadBorder }
                ]}
                onPress={() => handlePress(key)}
              >
                <Text style={[styles.keyText, { color: colors.textPrimary }]}>{key}</Text>
                {/* Optional sub-text for letters (ABC, DEF) could go here */}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* BOTTOM ACTION ROW */}
        <View style={styles.row}>
          <View style={styles.emptyKey} />
          
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.callButton, 
              { backgroundColor: '#34C759' } // Vibrant Green
            ]}
            onPress={handleCall}
            disabled={!phoneNumber}
          >
            <IconCall size={34} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.backspaceButton}
            onPress={handleBackspace}
            onLongPress={() => setPhoneNumber('')}
            disabled={!phoneNumber}
            activeOpacity={0.5}
          >
            {phoneNumber ? <IconCloseCircle size={32} color={colors.textMuted} /> : null}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  header: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center', justifyContent: 'center'
  },
  headerTitle: { 
    fontSize: 17, 
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  displayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 50,
    paddingHorizontal: 30,
  },
  numberDisplay: {
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  padContainer: {
    paddingHorizontal: 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 50,
    gap: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keyButton: {
    width: PAD_SIZE,
    height: PAD_SIZE,
    borderRadius: PAD_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Premium soft shadows
    elevation: 3,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 8,
  },
  keyText: {
    fontSize: 32,
    fontWeight: '400',
  },
  callButton: {
    width: PAD_SIZE,
    height: PAD_SIZE,
    borderRadius: PAD_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#34C759', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.4, 
    shadowRadius: 12,
  },
  emptyKey: {
    width: PAD_SIZE,
    height: PAD_SIZE,
  },
  backspaceButton: {
    width: PAD_SIZE,
    height: PAD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
