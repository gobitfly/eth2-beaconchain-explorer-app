package `in`.beaconcha.mobile.widget

import android.content.Context
import android.util.Log
import androidx.work.*
import java.util.concurrent.TimeUnit

class WidgetService {

    fun run(context: Context) {
        // TODO: Only start if user is premium and has widgets (can we get this info?)

        val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

        val work =
                PeriodicWorkRequestBuilder<UpdateWidgetWork>(INTERVAL_SECONDS, TimeUnit.SECONDS)
                        .setConstraints(constraints)
                        .addTag(TAG)
                        .build()

        val workManager = WorkManager.getInstance(context)
        workManager.enqueueUniquePeriodicWork(TAG, ExistingPeriodicWorkPolicy.KEEP, work) // TODO: KEEP
    }

    companion object {
        const val INTERVAL_SECONDS = 15 * 60L
        const val TAG = "widget_service"
    }
}