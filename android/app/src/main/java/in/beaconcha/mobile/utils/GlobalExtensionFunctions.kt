package `in`.beaconcha.mobile.utils

import `in`.beaconcha.mobile.widget.WidgetProvider
import android.content.Context
import kotlin.math.pow
import kotlin.math.roundToInt

fun Double.round(decimals: Int = 2): Double {
    if (decimals <= 0) return this
    val pow = 10.0.pow(decimals)
    return (this * pow).roundToInt() / pow
}

fun Context.getWidgetPrefs() = this.getSharedPreferences(WidgetProvider.PREF, Context.MODE_PRIVATE)

