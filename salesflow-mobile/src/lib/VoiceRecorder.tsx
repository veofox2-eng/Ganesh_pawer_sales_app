import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { IconMic, IconStop, IconPlay, IconTrash, IconCloudUpload } from './Icons';
import { base64ToUint8Array, ensureFileUri } from './Utils';

const SUPABASE_STORAGE_URL = 'https://korgtxyzpznaondfiytk.supabase.co/storage/v1/object/public/client-attachments/';

interface VoiceRecorderProps {
  onUpload: (url: string) => void;
  folder?: string;
  label?: string;
  existingUrl?: string;
}

export default function VoiceRecorder({ onUpload, folder = 'general', label = 'Voice Note', existingUrl }: VoiceRecorderProps) {
  const { colors } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(existingUrl || null);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopAudio();
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [recording]);

  useEffect(() => {
    setRecordedUrl(existingUrl || null);
  }, [existingUrl]);

  async function stopAudio() {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
      setPlayingUri(null);
    }
  }

  async function playRecording(uri: string) {
    if (playingUri === uri) {
      await stopAudio();
      return;
    }
    await stopAudio();
    setPlaybackLoading(true);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        null,
        true
      );
      soundRef.current = sound;
      setPlayingUri(uri);
      
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setPlayingUri(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (e: any) {
      Alert.alert('Playback Error', 'Could not play this recording. ' + e.message);
    }
    setPlaybackLoading(false);
  }

  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone permission required');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (e) {
      Alert.alert('Error', 'Could not start recording: ' + (e as any).message);
    }
  }

  async function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        setLocalUri(uri);
        // Wait for file flush
        setTimeout(() => {
          uploadAudio(uri);
        }, 500);
      }
    } catch (e) {
      console.log('Stop error:', e);
    }
    setRecording(null);
  }

  async function uploadAudio(uri: string) {
    setUploading(true);
    try {
      const ext = 'm4a';
      // Added prefix to identify recordings from this fix
      const filename = `${folder}/v32_${Date.now()}.${ext}`;
      const fileUri = ensureFileUri(uri);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const uploadUrl = `https://korgtxyzpznaondfiytk.supabase.co/storage/v1/object/client-attachments/${filename}`;
      const response = await FileSystem.uploadAsync(uploadUrl, fileUri, {
        httpMethod: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'audio/mp4' },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });

      if (response.status === 200 || response.status === 201) {
        const url = SUPABASE_STORAGE_URL + filename;
        setRecordedUrl(url);
        onUpload(url);
      } else {
        Alert.alert('Upload failed', `Status: ${response.status}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setUploading(false);
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.recorderBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        <View style={styles.row}>
          {recordedUrl ? (
            <View style={styles.recordingIndicator}>
              <TouchableOpacity 
                onPress={() => playRecording(recordedUrl)}
                style={[
                  styles.playActionBtn, 
                  { backgroundColor: playingUri === recordedUrl ? colors.dangerLight : colors.accentLight }
                ]}
                disabled={playbackLoading}
              >
                {playbackLoading && playingUri === recordedUrl ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : playingUri === recordedUrl ? (
                  <IconStop size={20} color={colors.danger} />
                ) : (
                  <IconPlay size={20} color={colors.accent} />
                )}
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.successLight, padding: 8, borderRadius: 8, flex: 1 }}>
                <Text style={{ color: colors.success, fontWeight: 'bold', fontSize: 13 }} numberOfLines={1}>Saved Successfully</Text>
              </View>
              <TouchableOpacity 
                onPress={async () => {
                  await stopAudio();
                  setRecordedUrl(null);
                  setLocalUri(null);
                }} 
                style={[styles.actionBtn, { backgroundColor: colors.dangerLight }]}
              >
                <IconTrash size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ) : localUri ? (
            <View style={{ width: '100%' }}>
              <View style={[styles.recordingIndicator, { marginBottom: 12 }]}>
                 <TouchableOpacity 
                   onPress={() => playRecording(localUri)}
                   style={[styles.playActionBtn, { backgroundColor: colors.accentLight }]}
                 >
                   {playingUri === localUri ? <IconStop size={20} color={colors.danger} /> : <IconPlay size={20} color={colors.accent} />}
                 </TouchableOpacity>
                 <Text style={{ color: colors.textPrimary, flex: 1 }}>Recording Ready</Text>
                 <TouchableOpacity onPress={() => setLocalUri(null)} style={{ padding: 8 }}>
                    <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>DISCARD</Text>
                 </TouchableOpacity>
              </View>
              <TouchableOpacity 
                onPress={() => uploadAudio(localUri)} 
                style={[styles.recordBtn, { backgroundColor: colors.accent, width: '100%', justifyContent: 'center' }]}
                disabled={uploading}
              >
                {uploading ? <ActivityIndicator color="#fff" /> : <IconCloudUpload size={20} color="#fff" />}
                <Text style={styles.recordBtnText}>{uploading ? 'Saving...' : 'Save Note'}</Text>
              </TouchableOpacity>
            </View>
          ) : isRecording ? (
            <View style={styles.recordingIndicator}>
              <View style={[styles.redDot, { backgroundColor: colors.danger }]} />
              <Text style={[styles.timer, { color: colors.textPrimary }]}>{formatTime(recordingTime)}</Text>
              <TouchableOpacity onPress={stopRecording} style={[styles.actionBtn, { backgroundColor: colors.danger }]}>
                <IconStop size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              onPress={startRecording} 
              style={[styles.recordBtn, { backgroundColor: colors.accent }]}
              disabled={uploading}
            >
              {uploading ? <ActivityIndicator color="#fff" /> : <IconMic size={24} color="#fff" />}
              <Text style={styles.recordBtnText}>Start Recording</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  recorderBox: {
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  label: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 10,
  },
  recordBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timer: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 50,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
