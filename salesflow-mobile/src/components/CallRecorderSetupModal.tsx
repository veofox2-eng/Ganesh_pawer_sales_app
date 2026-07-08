import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { IconClose, IconNote, IconCheckmarkDone } from '../lib/Icons';
import { useTheme } from '../context/ThemeContext';
import * as IntentLauncher from 'expo-intent-launcher';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function CallRecorderSetupModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  
  const handleOpenSettings = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Android Only', 'Call recording accessibility is only available on Android devices.');
      return;
    }
    
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.ACCESSIBILITY_SETTINGS);
    } catch (e) {
      console.log('Failed to open accessibility settings', e);
      Alert.alert('Settings', 'Could not open accessibility settings automatically. Please open your device Settings -> Accessibility manually.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.bgPanel }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Auto Call Recorder Setup</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <IconClose size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 30 }}>
            <Text style={[styles.introText, { color: colors.textSecondary }]}>
              To seamlessly record your client calls, your 3rd-party Call Recorder App needs special permissions to capture audio on newer Android versions.
            </Text>
            
            <View style={styles.stepContainer}>
              <View style={[styles.stepCircle, { backgroundColor: colors.accentLight }]}>
                <Text style={[styles.stepNumber, { color: colors.accent }]}>1</Text>
              </View>
              <View style={styles.stepTextContent}>
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Grant System Permissions</Text>
                <Text style={[styles.stepDesc, { color: colors.textMuted }]}>
                  When you first use call features, a system permission popup will appear. Tap "Allow" to enable the recording engine.
                </Text>
              </View>
            </View>

            <View style={styles.stepContainer}>
              <View style={[styles.stepCircle, { backgroundColor: colors.accentLight }]}>
                <Text style={[styles.stepNumber, { color: colors.accent }]}>2</Text>
              </View>
              <View style={styles.stepTextContent}>
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Open Accessibility Settings</Text>
                <Text style={[styles.stepDesc, { color: colors.textMuted }]}>
                  Tap the button below to open your phone's Accessibility Settings page.
                </Text>
              </View>
            </View>

            <View style={styles.stepContainer}>
              <View style={[styles.stepCircle, { backgroundColor: colors.accentLight }]}>
                <Text style={[styles.stepNumber, { color: colors.accent }]}>3</Text>
              </View>
              <View style={styles.stepTextContent}>
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Enable Voice Clarity</Text>
                <Text style={[styles.stepDesc, { color: colors.textMuted }]}>
                  Under "Downloaded Apps" or "Accessibility Menu", ensure the SalesFlow service is toggled ON to capture high-quality audio.
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
              onPress={handleOpenSettings}
            >
              <Text style={styles.primaryBtnText}>Open Accessibility Settings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.secondaryBtn, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>I've Already Done This</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 24,
  },
  introText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    marginTop: 2,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  stepTextContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  primaryBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
