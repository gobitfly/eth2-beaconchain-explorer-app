package `in`.beaconcha.mobile.widget

import `in`.beaconcha.mobile.MainActivity
import `in`.beaconcha.mobile.R
import `in`.beaconcha.mobile.api.WebAPIParser
import `in`.beaconcha.mobile.api.models.CoinbasePrice
import `in`.beaconcha.mobile.api.models.State
import `in`.beaconcha.mobile.api.models.WidgetData
import `in`.beaconcha.mobile.utils.StorageBridge
import `in`.beaconcha.mobile.utils.getWidgetPrefs
import `in`.beaconcha.mobile.utils.round
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import java.math.BigInteger

enum class Selection(val descriptionText: String, val currencyPair: Boolean = false) {
    LAST_24H("Last 24h", true),
    LAST_7D("Last 7d", true),
    APR("APR"),
    EFFECTIVENESS("Effectiveness");
}

abstract class WidgetProvider(val layout: Int) : AppWidgetProvider() {

    private val apiParser = WebAPIParser()
    override fun onEnabled(context: Context?) {
        super.onEnabled(context)
    }

    override fun onUpdate(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetIds: IntArray
    ) {
        appWidgetIds.forEach { appWidgetId ->
            val pendingIntent: PendingIntent = Intent(context, MainActivity::class.java)
                    .let { intent ->
                        PendingIntent.getActivity(context, 0, intent, 0)
                    }

            val views = RemoteViews(
                    context.packageName,
                    layout
            )
            views.setOnClickPendingIntent(R.id.widget, pendingIntent)

            val data = getWidgetData(context) ?: return
            updateViews(context, views, data)

            views.setImageViewResource(R.id.img_state, getStateImage(data))

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        // TODO: should we also start the service here, since we need to
        // start a service once a widget is placed
    }

    private fun getStateImage(data: WidgetData): Int {
        if (data.status == State.OFFLINE || data.status == State.SLASHED) return R.drawable.ic_alert_circle_outline
        return R.drawable.ic_notification
    }

    protected fun getPendingSelfIntent(context: Context, action: String): PendingIntent? {
        val intent = Intent(context, javaClass)
        intent.action = action
        return PendingIntent.getBroadcast(context, 0, intent, 0)
    }

    abstract fun updateViews(context: Context, views: RemoteViews, data: WidgetData)

    /**
     * A general technique for calling the onUpdate method,
     * requiring only the context parameter.
     *
     * @author John Bentley, based on Android-er code.
     * @see [
     * Android-er > 2010-10-19 > Update Widget in onReceive
    ](http://android-er.blogspot.com
    .au/2010/10/update-widget-in-onreceive-method.html) */
    protected fun onUpdate(context: Context) {
        val appWidgetManager = AppWidgetManager.getInstance(context)

        // Uses getClass().getName() rather than MyWidget.class.getName() for
        // portability into any App Widget Provider Class
        val thisAppWidgetComponentName = ComponentName(context.packageName, javaClass.name)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(
                thisAppWidgetComponentName)
        onUpdate(context, appWidgetManager, appWidgetIds)
    }

    @SuppressLint("ApplySharedPref")
    override fun onReceive(context: Context?, intent: Intent) {
        super.onReceive(context, intent)
        if (context == null) return

        if (ACTION_SWITCH_PRICE == intent.action) {
            val displayInEth = context.getWidgetPrefs().getBoolean(PREF_DISPLAY_INETH, true)
            context.getWidgetPrefs().edit().putBoolean(PREF_DISPLAY_INETH, !displayInEth).commit()
            onUpdate(context)
        }

        if (UPDATE_EVENT == intent.action) {
            onUpdate(context)
        }
    }

    private fun getPriceData(context: Context): CoinbasePrice? {
        val json = context.getWidgetPrefs().getString(PRICE_DATA, null) ?: return null
        return try {
            apiParser.parseCoinbasePriceResponse(json)
        } catch (e: Exception) {
            null
        }
    }

    private fun getWidgetData(context: Context): WidgetData? {
        val json = context.getWidgetPrefs().getString(WIDGET_DATA, null) ?: return null
        return try {
            apiParser.parseWidgetResponse(json)
        } catch (e: Exception) {
            null
        }
    }

    fun WidgetData.getCurrentData(currentSelection: Selection, context: Context): String {
        return when (currentSelection) {
            Selection.LAST_24H -> displayPriceData(performance1d, context)
            Selection.LAST_7D -> displayPriceData(performance7d, context)
            Selection.APR -> "${apr}%"
            Selection.EFFECTIVENESS -> "${efficiency}%"
        }
    }

    private fun displayPriceData(value: BigInteger, context: Context): String {
        val displayInEth = context.getWidgetPrefs().getBoolean(PREF_DISPLAY_INETH, true)
        val ethValue = value.toBigDecimal().divide(1000000000.toBigDecimal())
        val price = getPriceData(context)

        val storage = StorageBridge(context)
        val currency = storage.getUserSelectedCurrency()

        return if (displayInEth || price == null || currency == null) {
            "${ethValue.toDouble().round(4)} Ξ"
        } else {
            "${ethValue.multiply(price.amount).toDouble().round(currency.rounding)} ${currency.symbol}"
        }
    }

    protected fun getSquareSelection(context: Context): Selection {
        val savedInt = context.getWidgetPrefs().getInt(PREF_SELECTION, 0)
        return getSquareSelection(savedInt)
    }

    private fun getSquareSelection(index: Int): Selection {
        if (index >= Selection.values().size || index < 0) return Selection.LAST_24H
        return Selection.values()[index]
    }

    protected fun getNextSquareSelection(context: Context): Selection {
        val savedInt = (context.getWidgetPrefs().getInt(PREF_SELECTION, 0) + 1) % Selection.values().size
        return getSquareSelection(savedInt)
    }

    @SuppressLint("ApplySharedPref")
    protected fun saveSquareSelection(context: Context, selection: Selection) {
        context.getWidgetPrefs().edit().putInt(PREF_SELECTION, selection.ordinal).commit()
    }

    companion object {

        const val PREF = "widget"
        private const val PREF_SELECTION = "selected"
        const val UPDATE_EVENT = "update_data"
        const val WIDGET_DATA = "data"
        const val PRICE_DATA = "price_data"

        private const val PREF_DISPLAY_INETH = "widget_display_ineth"

        const val ACTION_SWITCH_PRICE = "in.beaconcha.mobile.SWITCHPRICE"
    }
}

