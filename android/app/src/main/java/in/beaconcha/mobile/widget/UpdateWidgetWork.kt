package `in`.beaconcha.mobile.widget

import `in`.beaconcha.mobile.api.WebAPI
import `in`.beaconcha.mobile.utils.Currency
import `in`.beaconcha.mobile.utils.StorageBridge
import `in`.beaconcha.mobile.utils.getWidgetPrefs
import `in`.beaconcha.mobile.widget.WidgetProvider.Companion.PRICE_DATA
import `in`.beaconcha.mobile.widget.WidgetProvider.Companion.UPDATE_EVENT
import `in`.beaconcha.mobile.widget.WidgetProvider.Companion.WIDGET_DATA
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters

class UpdateWidgetWork(appContext: Context, workerParams: WorkerParameters) :
        Worker(appContext, workerParams) {

    @SuppressLint("ApplySharedPref")
    override fun doWork(): Result {
        try {
            val storage = StorageBridge(applicationContext)
            val api = WebAPI(storage.getNetwork())

            val validators = storage.getUserValidators()!!
            val currency = storage.getUserSelectedCurrency()

            val data = api.getWidgetJson(validators)

            applicationContext.getWidgetPrefs()?.apply {
                val price = if (currency != null && shouldUpdatePrice(currency)) {
                    api.getCoinbasePriceJson(currency.coinbaseSpot)
                } else null

                edit().apply {
                    putString(WIDGET_DATA, data)
                    if (price != null) {
                        putString(PRICE_DATA, price)
                        putLong(LAST_PRICE_UPDATE_KEY, System.currentTimeMillis())
                        putString(LAST_PRICE_PAIR, currency?.coinbaseSpot)
                    }
                }.commit()
            }

            sendWidgetBroadcast(UPDATE_EVENT, WidgetProviderLarge::class.java)
            sendWidgetBroadcast(UPDATE_EVENT, WidgetProviderSquare::class.java)
        } catch (e: Exception) {
            Log.w(LOGTAG, "Widget work can not be completed", e)
        }

        return Result.success()
    }

    private fun SharedPreferences.shouldUpdatePrice(currency: Currency): Boolean {
        val lastPriceUpdateTs = getLong(LAST_PRICE_UPDATE_KEY, 0)
        val lastPricePair = getString(LAST_PRICE_PAIR, null)
        return lastPriceUpdateTs + PRICE_UPDATE_INTERVALL < System.currentTimeMillis() || currency.coinbaseSpot != lastPricePair
    }

    private fun <T> sendWidgetBroadcast(action: String, clazz: Class<T>) {
        val intent = Intent(applicationContext, clazz)
        intent.action = action
        applicationContext.sendBroadcast(intent)
    }

    companion object {
        private const val PRICE_UPDATE_INTERVALL = 4 * 60 * 60 * 1000 // 4h
        private const val LAST_PRICE_UPDATE_KEY = "last_price_update"
        private const val LAST_PRICE_PAIR = "last_price_pair"

        private const val LOGTAG = "UpdateWidgetWork"
    }
}