package `in`.beaconcha.mobile.widget

import `in`.beaconcha.mobile.R
import `in`.beaconcha.mobile.api.models.WidgetData
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class WidgetProviderSquare : WidgetProvider(R.layout.widget_square) {

    override fun updateViews(context: Context, views: RemoteViews, data: WidgetData) {
        val currentSelection = getSquareSelection(context)

        views.setTextViewText(R.id.txt_description, currentSelection.descriptionText)
        views.setOnClickPendingIntent(R.id.btnSwitch, getPendingSelfIntent(context, ACTION_SWITCH_SELECTION))
        views.setTextViewText(R.id.txt_value, data.getCurrentData(currentSelection, context))

        if (currentSelection.currencyPair) {
            views.setOnClickPendingIntent(R.id.currenyPair, getPendingSelfIntent(context, ACTION_SWITCH_PRICE))
        }
    }

    override fun onReceive(context: Context?, intent: Intent) {
        super.onReceive(context, intent)
        if (context == null) return

        if (ACTION_SWITCH_SELECTION == intent.action) {
            saveSquareSelection(context, getNextSquareSelection(context))
            onUpdate(context)
        }
    }

    companion object {
        private const val ACTION_SWITCH_SELECTION = "in.beaconcha.mobile.SWITCHSELECTION"
    }
}