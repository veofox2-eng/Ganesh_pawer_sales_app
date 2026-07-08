import { useEffect, useRef } from 'react';
import { NativeEventEmitter, NativeModules, Platform, ToastAndroid, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { base64ToUint8Array, ensureFileUri, formatPhone } from '../lib/Utils';

const { CallRecordingModule } = NativeModules;

const SUPABASE_URL = 'https://korgtxyzpznaondfiytk.supabase.co/storage/v1/object/public/client-attachments/';

/**
 * useCallRecorder
 *
 * Registers a listener for the native `onRecordingComplete` event emitted by
 * CallRecordingModule.kt after every call. When fired it:
 *  1. Finds the matching client in Supabase by phone number
 *  2. Uploads the recording file to Supabase Storage
 *  3. Creates an interaction row (type = CALL_RECORDING) on that client
 *  4. Shows a toast so the user knows it worked
 *
 * Mount this once at App root level.
 */
const uploadingFiles = new Set<string>();

export function useCallRecorder(profile?: any) {
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !CallRecordingModule) return;

    const emitter = new NativeEventEmitter(CallRecordingModule);

    // Sync any recordings that happened while app was dead
    if (CallRecordingModule.syncPendingRecordings) {
      CallRecordingModule.syncPendingRecordings();
    }

    const subscription = emitter.addListener(
      'onRecordingComplete',
      async (event: { filePath: string; phoneNumber: string; clientId?: string }) => {
        const { filePath, phoneNumber, clientId } = event;
        ToastAndroid.show(`JS Received Recording Event for ${phoneNumber}`, ToastAndroid.SHORT);

        if (!filePath) {
          console.log('[CallRecorder] No file path received, skipping upload');
          return;
        }

        const currentProfile = profileRef.current;
        if (currentProfile?.feature_flags?.background?.auto_call_record === false) {
          console.log('[CallRecorder] auto_call_record disabled for this user. Discarding recording.');
          try {
             await FileSystem.deleteAsync(ensureFileUri(filePath), { idempotent: true });
          } catch(e) {}
          return;
        }

        if (uploadingFiles.has(filePath)) {
          console.log('[CallRecorder] Already processing this file, skipping duplicate event:', filePath);
          return;
        }
        uploadingFiles.add(filePath);

        console.log('[CallRecorder] Recording complete:', filePath, 'Phone:', phoneNumber);

        try {
          // ── 1. Find matching client by phone number or ID ───────────────
          let client = null;
          const { data: { user } } = await supabase.auth.getUser();
          
          if (clientId && clientId.trim() !== '') {
            client = await findClientById(clientId);
          } else if (phoneNumber && user) {
            client = await findClientByPhone(phoneNumber, user.id);
          }

          if (!client) {
            console.log('[CallRecorder] No matching client — saving as Other Recording for:', phoneNumber);
            // Upload to a dedicated folder so it doesn't pollute client storage
            const uploadedUrl = await uploadRecording(filePath, 'other_recordings', phoneNumber);
            if (uploadedUrl) {
              const { error: otherErr } = await supabase.from('interactions').insert({
                client_id: null,
                user_id: user?.id,
                type: 'CALL_RECORDING',
                content: `📞 Other Recording — ${phoneNumber}`,
                media_url: uploadedUrl,
                author: 'System',
              });
              
              if (otherErr) {
                console.error('[CallRecorder] Failed to insert Other Recording:', otherErr);
                Alert.alert('Database Error', `Failed to save other recording: ${otherErr.message}`);
                return;
              }

              const { DeviceEventEmitter } = require('react-native');
              DeviceEventEmitter.emit('RECORDING_SYNCED', { clientId: null });
            }
            return;
          }

          // ── 2. Upload recording to Supabase Storage ──────────────────────
          const uploadedUrl = await uploadRecording(filePath, client.id, phoneNumber);
          if (!uploadedUrl) {
            Alert.alert('Upload Failed', 'Failed to upload the recording file to the server. The file might be corrupted or empty.');
            return;
          }

          // ── 3. Create interaction row ────────────────────────────────────

          const { error: dbError } = await supabase.from('interactions').insert({
            client_id: client.id,
            user_id: user?.id,
            type: 'CALL_RECORDING',
            content: `📞 Call Recording — ${formatPhone(phoneNumber)}`,
            media_url: uploadedUrl,
            author: 'System',
          });

          if (dbError) {
            console.error('[CallRecorder] Failed to insert interaction:', dbError);
            Alert.alert('Database Error', `Failed to link recording to client: ${dbError.message}`);
            return;
          }

          console.log('[CallRecorder] ✅ Recording saved for', client.name);

          // ── 4. Global Event for UI refresh ──────────────────────────────
          const { DeviceEventEmitter } = require('react-native');
          DeviceEventEmitter.emit('RECORDING_SYNCED', { clientId: client.id });

          // ── 5. Toast notification ────────────────────────────────────────
          ToastAndroid.showWithGravity(
            `📞 Recording saved for ${client.name}`,
            ToastAndroid.LONG,
            ToastAndroid.BOTTOM
          );
        } catch (err: any) {
          console.error('[CallRecorder] Error processing recording:', err);
          Alert.alert('Processing Error', `An error occurred while processing the recording: ${err.message}`);
        }
      }
    );

    return () => subscription.remove();
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function findClientById(id: string) {
  if (!id) return null;
  const { data } = await supabase.from('clients').select('id, name, phone').eq('id', id).maybeSingle();
  return data ?? null;
}

async function findClientByPhone(phoneNumber: string, userId: string) {
  if (!phoneNumber || !userId) return null;

  // Normalise: strip everything except digits, take last 7
  const digits = phoneNumber.replace(/\D/g, '');
  const last7  = digits.slice(-7);

  if (last7.length < 7) return null;

  // Search Supabase clients table with ilike on the phone column
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, phone')
    .eq('user_id', userId)
    .ilike('phone', `%${last7}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[CallRecorder] Supabase client lookup error:', error);
    return null;
  }

  return data ?? null;
}

async function uploadRecording(
  filePath: string,
  clientId: string,
  phoneNumber: string
): Promise<string | null> {
  try {
    // Ensure path has file:// prefix for Android absolute paths
    const uri = ensureFileUri(filePath);
    
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      console.log('[CallRecorder] File does not exist:', uri);
      Alert.alert('Recording Failed', 'Audio file was not created by the OS. The microphone may be blocked.');
      return null;
    }

    const dotIdx = filePath.lastIndexOf('.');
    const ext      = dotIdx !== -1 ? filePath.substring(dotIdx + 1).toLowerCase() : 'm4a';
    const fileName = `${clientId}/${Date.now()}_call_${phoneNumber.replace(/\D/g, '')}.${ext}`;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('[CallRecorder] No active session, upload rejected.');
      Alert.alert('Upload Failed', 'User is not logged in.');
      return null;
    }

    // Direct binary upload to bypass JS memory limits (fixes memory crashes for long calls)
    const uploadUrl = `https://korgtxyzpznaondfiytk.supabase.co/storage/v1/object/client-attachments/${fileName}`;
    const response = await FileSystem.uploadAsync(uploadUrl, uri, {
      httpMethod: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': `audio/${ext}`,
      },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });

    if (response.status !== 200 && response.status !== 201) {
      console.error('[CallRecorder] Supabase upload failed. Status:', response.status, response.body);
      Alert.alert('Storage Error', `Upload failed with HTTP ${response.status}`);
      return null;
    }

    const publicUrl = SUPABASE_URL + fileName;
    console.log('[CallRecorder] Uploaded to:', publicUrl);

    // Clean up local file after successful upload
    await FileSystem.deleteAsync(uri, { idempotent: true });

    return publicUrl;
  } catch (err: any) {
    console.error('[CallRecorder] uploadRecording error:', err);
    Alert.alert('Upload Exception', `An error occurred during upload: ${err.message}`);
    return null;
  }
}

