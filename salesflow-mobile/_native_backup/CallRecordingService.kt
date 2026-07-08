package com.foxeditz.salesflow

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
                phoneNumber = intent.getStringExtra(EXTRA_PHONE) ?: ""
                clientId = intent.getStringExtra(EXTRA_CLIENT_ID) ?: ""
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
            val dir = File(getExternalFilesDir(null), "recordings")
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

            recording = true
        } catch (e: Exception) {
            e.printStackTrace()
            stopSelf()
        }
    }

    private fun finishRecording() {
        if (!recording) return
        try {
            recorder?.apply {
                stop()
                release()
            }
            recorder  = null
            recording = false

            // Notify the React Native layer
            val broadcast = Intent(BROADCAST_DONE).apply {
                putExtra("filePath",    outputFile)
                putExtra("phoneNumber", phoneNumber)
                putExtra("clientId",    clientId)
                setPackage(packageName)          // restrict to this app only
            }
            sendBroadcast(broadcast)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onDestroy() {
        finishRecording()
        super.onDestroy()
    }
}
