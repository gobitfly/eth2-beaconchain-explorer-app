package `in`.beaconcha.mobile.widget

import `in`.beaconcha.mobile.R
import `in`.beaconcha.mobile.api.models.WidgetData
import android.content.Context
import android.widget.RemoteViews

class WidgetProviderLarge : WidgetProvider(R.layout.widget_long) {

    override fun updateViews(context: Context, views: RemoteViews, data: WidgetData) {
        views.setTextViewText(R.id.txt_value, data.getCurrentData(Selection.LAST_24H, context))
        views.setTextViewText(R.id.txt_value2, data.getCurrentData(Selection.LAST_7D, context))
        views.setTextViewText(R.id.txt_value3, data.getCurrentData(Selection.EFFECTIVENESS, context))
        views.setTextViewText(R.id.txt_value4, data.getCurrentData(Selection.APR, context))

        views.setOnClickPendingIntent(R.id.currenyPair, getPendingSelfIntent(context, ACTION_SWITCH_PRICE))
        views.setOnClickPendingIntent(R.id.currenyPair2, getPendingSelfIntent(context, ACTION_SWITCH_PRICE))
    }
}