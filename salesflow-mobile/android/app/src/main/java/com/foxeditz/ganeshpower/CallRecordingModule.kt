package com.foxeditz.ganeshpower

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
import android.provider.Settings
import android.net.Uri
import android.content.ComponentName

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

                // Immediately remove this specific entry from SharedPreferences so that
                // syncPendingRecordings() doesn't process it a second time.
                // Using commit() (synchronous) to guarantee the write completes before
                // JS processes the event.
                val prefs = reactContext.getSharedPreferences("CallRecordings", Context.MODE_PRIVATE)
                val pendingSet = prefs.getStringSet("pending_uploads", null)?.toMutableSet()
                if (pendingSet != null) {
                    pendingSet.removeAll { it.startsWith(filePath) }
                    prefs.edit().putStringSet("pending_uploads", pendingSet).commit()
                }

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
    fun checkAccessibilityEnabled(promise: Promise) {
        promise.resolve(CallAccessibilityService.isServiceActive)
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun startRecording(phoneNumber: String, clientId: String) {
        val intent = Intent(reactContext, CallRecordingService::class.java).apply {
            action = CallRecordingService.ACTION_START
            putExtra(CallRecordingService.EXTRA_PHONE, phoneNumber)
            putExtra(CallRecordingService.EXTRA_CLIENT_ID, clientId)
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            android.widget.Toast.makeText(reactContext, "Failed to start native recording service: ${e.message}", android.widget.Toast.LENGTH_LONG).show()
        }
    }

    @ReactMethod
    fun stopRecording() {
        val intent = Intent(reactContext, CallRecordingService::class.java).apply {
            action = CallRecordingService.ACTION_STOP
        }
        try {
            reactContext.startService(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun clearActiveContext() {
        // Called after every app-initiated call ends to prevent personal calls
        // from being recorded under the last client's context.
        val prefs = reactContext.getSharedPreferences("CallRecordings", Context.MODE_PRIVATE)
        prefs.edit()
            .remove("active_phone")
            .remove("active_client")
            .commit() // synchronous clear
    }

    @ReactMethod
    fun setPendingCallContext(phoneNumber: String, clientId: String) {
        val prefs = reactContext.getSharedPreferences("CallRecordings", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("active_phone", phoneNumber)
            .putString("active_client", clientId)
            .apply()
    }

    @ReactMethod
    fun requestSpecialPermissions() {
        // 1. Display over other apps (Draw over overlays)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(reactContext)) {
                try {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${reactContext.packageName}")
                    )
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactContext.startActivity(intent)
                    return // Stop here to let user handle this first
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        // 2. Auto-start (Xiaomi, POCO, Redmi, etc)
        val manufacturer = Build.MANUFACTURER.toLowerCase()
        if (manufacturer.contains("xiaomi") || manufacturer.contains("poco") || manufacturer.contains("redmi") || manufacturer.contains("oppo") || manufacturer.contains("vivo") || manufacturer.contains("letv") || manufacturer.contains("honor")) {
            val prefs = reactContext.getSharedPreferences("AppPermissions", Context.MODE_PRIVATE)
            val askedAutoStart = prefs.getBoolean("asked_autostart", false)
            
            if (!askedAutoStart) {
                openAutoStartSettings()
                prefs.edit().putBoolean("asked_autostart", true).apply()
            }
        }
    }

    @ReactMethod
    fun openAutoStartSettings() {
        try {
            val intents = arrayOf(
                Intent().setComponent(ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")),
                Intent().setComponent(ComponentName("com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity")),
                Intent().setComponent(ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")),
                Intent().setComponent(ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")),
                Intent().setComponent(ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")),
                Intent().setComponent(ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity")),
                Intent().setComponent(ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")),
                Intent().setComponent(ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity")),
                Intent().setComponent(ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager")),
                Intent().setComponent(ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")),
                Intent().setComponent(ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.entry.FunctionActivity")),
                Intent().setComponent(ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"))
            )

            var success = false
            for (intent in intents) {
                if (reactContext.packageManager.resolveActivity(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY) != null) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactContext.startActivity(intent)
                    success = true
                    break
                }
            }

            if (!success) {
                // Fallback to App Info
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                intent.data = Uri.parse("package:${reactContext.packageName}")
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(intent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            try {
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                intent.data = Uri.parse("package:${reactContext.packageName}")
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(intent)
            } catch (ex: Exception) {
                ex.printStackTrace()
            }
        }
    }

    @ReactMethod
    fun syncPendingRecordings() {
        val prefs = reactContext.getSharedPreferences("CallRecordings", Context.MODE_PRIVATE)
        val pendingSet = prefs.getStringSet("pending_uploads", null)
        
        if (pendingSet != null && pendingSet.isNotEmpty()) {
            android.widget.Toast.makeText(reactContext, "Found ${pendingSet.size} pending recordings to sync.", android.widget.Toast.LENGTH_SHORT).show()
            for (item in pendingSet) {
                val parts = item.split("|")
                if (parts.size >= 3) {
                    val params: WritableMap = Arguments.createMap().apply {
                        putString("filePath",    parts[0])
                        putString("phoneNumber", parts[1])
                        putString("clientId",    parts[2])
                    }
                    sendJsEvent("onRecordingComplete", params)
                }
            }
            // Clear them so we don't upload twice
            prefs.edit().remove("pending_uploads").commit()
        } else {
            android.widget.Toast.makeText(reactContext, "No pending recordings found in native storage.", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    // Required by RN event emitter
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    // ────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────

    private fun sendJsEvent(eventName: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun launchApp() {
        try {
            val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(reactContext.packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or 
                                    Intent.FLAG_ACTIVITY_SINGLE_TOP or 
                                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                
                // Wake up screen logic
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                    val activity = currentActivity
                    if (activity != null) {
                        activity.setShowWhenLocked(true)
                        activity.setTurnScreenOn(true)
                    }
                }
                
                reactContext.startActivity(launchIntent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onCatalystInstanceDestroy() {
        broadcastReceiver?.let {
            try { reactContext.unregisterReceiver(it) } catch (_: Exception) {}
        }
        super.onCatalystInstanceDestroy()
    }
}
