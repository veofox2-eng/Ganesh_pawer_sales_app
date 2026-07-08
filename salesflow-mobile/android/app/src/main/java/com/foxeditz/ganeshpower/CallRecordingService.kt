package com.foxeditz.ganeshpower

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class CallRecordingService : Service() {

    companion object {
        const val ACTION_START = "com.foxeditz.salesflow.ACTION_START"
        const val ACTION_STOP  = "com.foxeditz.salesflow.ACTION_STOP"
        const val EXTRA_PHONE  = "phoneNumber"
        const val EXTRA_CLIENT_ID = "clientId"
        const val BROADCAST_DONE = "com.foxeditz.salesflow.RECORDING_DONE"

        private const val CHANNEL_ID       = "SalesFlowRecordingChannel"
        private const val NOTIFICATION_ID  = 9001
    }

    private var recorder: MediaRecorder? = null
    private var outputFile: String = ""
    private var phoneNumber: String = ""
    private var clientId: String = ""
    private var recording: Boolean = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val prefs = getSharedPreferences("CallRecordings", Context.MODE_PRIVATE)
                val p = intent.getStringExtra(EXTRA_PHONE)
                val c = intent.getStringExtra(EXTRA_CLIENT_ID)
                
                if (!p.isNullOrEmpty()) {
                    phoneNumber = p
                    prefs.edit().putString("active_phone", p).apply()
                } else {
                    phoneNumber = prefs.getString("active_phone", "") ?: ""
                }
                
                if (!c.isNullOrEmpty()) {
                    clientId = c
                    prefs.edit().putString("active_client", c).apply()
                } else {
                    clientId = prefs.getString("active_client", "") ?: ""
                }
                
                showForegroundNotification()
                beginRecording()
            }
            ACTION_STOP -> {
                finishRecording()
                stopForeground(true)
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    // ────────────────────────────────────────────────
    // Foreground Notification
    // ────────────────────────────────────────────────

    private fun showForegroundNotification() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Call Recording",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "SalesFlow is recording this call"
                setSound(null, null)
            }
            manager.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("SalesFlow — Recording")
            .setContentText("Call is being recorded for your CRM")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    // ────────────────────────────────────────────────
    // Recording
    // ────────────────────────────────────────────────

    private fun beginRecording() {
        if (recording) return
        try {
            val dir = File(filesDir, "recordings")
            if (!dir.exists()) dir.mkdirs()

            val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
            val safePhone = phoneNumber.replace(Regex("[^0-9]"), "")
            val fileName  = "CALL_${safePhone}_${timestamp}.m4a"
            val file      = File(dir, fileName)
            outputFile    = file.absolutePath

            recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            try {
                recorder!!.apply {
                    val audioSource = MediaRecorder.AudioSource.VOICE_RECOGNITION
                    setAudioSource(audioSource)
                    setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                    setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                    setAudioSamplingRate(44100)
                    setAudioEncodingBitRate(128000)
                    setOutputFile(outputFile)
                    prepare()
                    start()
                }
                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    android.widget.Toast.makeText(this, "SalesFlow: Mic Started OK", android.widget.Toast.LENGTH_SHORT).show()
                }
            } catch (firstException: Exception) {
                firstException.printStackTrace()
                // Fallback: Use MIC as the safest fallback
                recorder?.reset()
                recorder!!.apply {
                    setAudioSource(MediaRecorder.AudioSource.MIC)
                    setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                    setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                    setAudioSamplingRate(44100)
                    setAudioEncodingBitRate(128000)
                    setOutputFile(outputFile)
                    prepare()
                    start()
                }
                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    android.widget.Toast.makeText(this, "SalesFlow: Recording Started (Fallback)", android.widget.Toast.LENGTH_SHORT).show()
                }
            }

            recording = true
        } catch (e: Exception) {
            e.printStackTrace()
            android.util.Log.e("SalesFlow", "Total failure starting MediaRecorder", e)
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                android.widget.Toast.makeText(this, "MediaRecorder failed to start", android.widget.Toast.LENGTH_LONG).show()
            }
            stopSelf()
        }
    }

    private fun finishRecording() {
        if (!recording) return
        recording = false
        
        try {
            recorder?.stop()
        } catch (e: Exception) {
            e.printStackTrace()
            android.util.Log.e("SalesFlow", "MediaRecorder.stop() failed", e)
        }
        
        try {
            recorder?.release()
        } catch (e: Exception) {
            e.printStackTrace()
        }
        
        recorder = null

        // Save to SharedPreferences so we don't lose it if JS is suspended
        val prefs = getSharedPreferences("CallRecordings", Context.MODE_PRIVATE)
        val pendingSet = prefs.getStringSet("pending_uploads", mutableSetOf())?.toMutableSet() ?: mutableSetOf()
        pendingSet.add("$outputFile|$phoneNumber|$clientId")
        prefs.edit()
            .putStringSet("pending_uploads", pendingSet)
            .remove("active_phone")
            .remove("active_client")
            .apply()

        // Notify the React Native layer
        val broadcast = Intent(BROADCAST_DONE).apply {
            putExtra("filePath",    outputFile)
            putExtra("phoneNumber", phoneNumber)
            putExtra("clientId",    clientId)
            setPackage(packageName)          // restrict to this app only
        }
        sendBroadcast(broadcast)
    }

    override fun onDestroy() {
        finishRecording()
        super.onDestroy()
    }
}
