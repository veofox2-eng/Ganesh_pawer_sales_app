package com.foxeditz.salesflow

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class CallRecordingModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CallRecordingModule"

    private var broadcastReceiver: BroadcastReceiver? = null

    // ────────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────────

    override fun initialize() {
        super.initialize()
        registerBroadcastReceiver()
    }

    private fun registerBroadcastReceiver() {
        broadcastReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val filePath    = intent.getStringExtra("filePath")    ?: ""
                val phoneNumber = intent.getStringExtra("phoneNumber") ?: ""
                val clientId    = intent.getStringExtra("clientId")    ?: ""

                val params: WritableMap = Arguments.createMap().apply {
                    putString("filePath",    filePath)
                    putString("phoneNumber", phoneNumber)
                    putString("clientId",    clientId)
                }
                sendJsEvent("onRecordingComplete", params)
            }
        }

        val filter = IntentFilter(CallRecordingService.BROADCAST_DONE)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(
                broadcastReceiver, filter, Context.RECEIVER_NOT_EXPORTED
            )
        } else {
            reactContext.registerReceiver(broadcastReceiver, filter)
        }
    }

    // ────────────────────────────────────────────────
    // JS → Native methods
    // ────────────────────────────────────────────────

    @ReactMethod
    fun getStatus(promise: Promise) {
        promise.resolve("idle")
    }

    @ReactMethod
    fun startRecording(phoneNumber: String, clientId: String) {
        val intent = Intent(reactContext, CallRecordingService::class.java).apply {
            action = CallRecordingService.ACTION_START
            putExtra(CallRecordingService.EXTRA_PHONE, phoneNumber)
            putExtra(CallRecordingService.EXTRA_CLIENT_ID, clientId)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    @ReactMethod
    fun stopRecording() {
        val intent = Intent(reactContext, CallRecordingService::class.java).apply {
            action = CallRecordingService.ACTION_STOP
        }
        reactContext.startService(intent)
    }

    // Required by RN event emitter
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    // ────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────

    private fun sendJsEvent(eventName: String, params: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    override fun onCatalystInstanceDestroy() {
        broadcastReceiver?.let {
            try { reactContext.unregisterReceiver(it) } catch (_: Exception) {}
        }
        super.onCatalystInstanceDestroy()
    }
}
