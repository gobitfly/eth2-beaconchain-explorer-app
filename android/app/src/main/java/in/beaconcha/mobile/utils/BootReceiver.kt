package `in`.beaconcha.mobile.utils

import `in`.beaconcha.mobile.widget.WidgetService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if(intent.action != Intent.ACTION_BOOT_COMPLETED) return

        Log.i(LOGTAG, "starting beaconcha.in widget service")
        WidgetService().run(context)
    }

    companion object {
        private const val LOGTAG = "BootReceiver"
    }
}
