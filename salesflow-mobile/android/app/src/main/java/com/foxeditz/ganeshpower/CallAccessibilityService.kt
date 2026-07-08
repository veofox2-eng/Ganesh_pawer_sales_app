package com.foxeditz.ganeshpower

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class CallAccessibilityService : AccessibilityService() {
    companion object {
        const val TAG = "SalesFlowAccessibility"
        // A simple flag to check if the service is currently bound and running
        @Volatile
        var isServiceActive = false
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isServiceActive = true
        Log.d(TAG, "SalesFlow Accessibility Service Connected. Audio capture elevated.")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We do not need to actively process events. 
        // Just having an active Accessibility Service running on the device 
        // grants our app the ability to capture the downlink audio stream
        // via MediaRecorder.AudioSource.VOICE_RECOGNITION on Android 10-13.
    }

    override fun onInterrupt() {
        Log.d(TAG, "SalesFlow Accessibility Service Interrupted.")
    }

    override fun onUnbind(intent: Intent?): Boolean {
        isServiceActive = false
        Log.d(TAG, "SalesFlow Accessibility Service Unbound.")
        return super.onUnbind(intent)
    }
}
