package `in`.beaconcha.mobile.utils

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import org.json.JSONObject

class StorageBridge(val context: Context) {

    private val storage = context.getCapacitorPrefs()

    fun getUserSelectedCurrency(): Currency? {
        val data = getJSONObject(PREFERED_UNIT) ?: return null
        try {
            return Currency(
                    data.getString("prefered"),
                    data.getString("coinbaseSpot"),
                    data.getString("symbol"),
                    data.getInt("rounding"),
            )
        } catch(e: Exception) { return null }
    }

    fun getNetwork(): Network {
        return try {
            val data = getJSONObject(NETWORK)!!
            Gson().fromJson(data.toString(), Network::class.java)
        } catch (e: Exception) {
            Log.w(LOGTAG, "Can not load network settings, falling back to default", e)
            Network("main", "https", "beaconcha.in", "", "/api/", "v1")
        }
    }

    fun getUserValidators(): String? {
        var erg = ""
        val json = getJSONObject("validators_" + getNetwork().key) ?: return null

        val data = json.getJSONArray("value")
        for (i in 0 until data.length()) {
            erg += data.getJSONArray(i).getJSONObject(1).getLong("index")
            if (i != data.length() - 1) erg += ","
        }

        return erg
    }

    private fun getJSONObject(key: String): JSONObject? {
        val data = storage.getString(key, null) ?: return null
        return JSONObject(data)
    }

    companion object {
        const val CAPACITOR_STORAGE = "CapacitorStorage"

        const val PREFERED_UNIT = "prefered_unit"
        const val NETWORK = "network_preferences"

        const val LOGTAG = "StorageBridge"
    }
}

data class Currency(val name: String, val coinbaseSpot: String, val symbol: String, val rounding: Int)

data class Network(
        @SerializedName("key") val key: String,
        @SerializedName("protocol") val protocol: String,
        @SerializedName("host") val host: String,
        @SerializedName("net") val net: String,
        @SerializedName("endpoint") val endpoint: String,
        @SerializedName("version") val version: String
)

private fun Context.getCapacitorPrefs() = this.getSharedPreferences(StorageBridge.CAPACITOR_STORAGE, Context.MODE_PRIVATE)