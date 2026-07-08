package com.foxeditz.salesflow

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.TelephonyManager

class CallReceiver : BroadcastReceiver() {

    companion object {
        // Shared state — persists for the lifetime of the process
        @Volatile var lastState  = TelephonyManager.CALL_STATE_IDLE
        @Volatile var savedPhone = ""
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {

            // ── Outgoing call started ─────────────────────────────────────
            "android.intent.action.NEW_OUTGOING_CALL" -> {
                // Available on all Android versions; deprecated in API 29 but
                // still delivered reliably. Store the outgoing number so we
                // can use it when OFFHOOK fires.
                savedPhone = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER) ?: ""
            }

            // ── Incoming / state change ───────────────────────────────────
            "android.intent.action.PHONE_STATE" -> {
                val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
                val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: ""

                val newState = when (stateStr) {
                    TelephonyManager.EXTRA_STATE_RINGING  -> TelephonyManager.CALL_STATE_RINGING
                    TelephonyManager.EXTRA_STATE_OFFHOOK  -> TelephonyManager.CALL_STATE_OFFHOOK
                    TelephonyManager.EXTRA_STATE_IDLE     -> TelephonyManager.CALL_STATE_IDLE
                    else -> return
                }

                handleStateChange(context, newState, incomingNumber)
            }
        }
    }

    private fun handleStateChange(context: Context, newState: Int, number: String) {
        if (lastState == newState) return

        when (newState) {
            // Incoming ringing — capture the caller's number
            TelephonyManager.CALL_STATE_RINGING -> {
                savedPhone = number
            }

            // Call answered / dialling started
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                // If savedPhone is still empty here it means the call is outgoing
                // and NEW_OUTGOING_CALL hasn't fired yet on this device, so fall
                // back to the number parameter (empty string is fine — the
                // recording will still be uploaded, just without a phone match).
                val phone = savedPhone.ifEmpty { number }
                val intent = Intent(context, CallRecordingService::class.java).apply {
                    action = CallRecordingService.ACTION_START
                    putExtra(CallRecordingService.EXTRA_PHONE, phone)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            }

            // Call ended
            TelephonyManager.CALL_STATE_IDLE -> {
                val intent = Intent(context, CallRecordingService::class.java).apply {
                    action = CallRecordingService.ACTION_STOP
                }
                context.startService(intent)
                savedPhone = ""
            }
        }

        lastState = newState
    }
}
