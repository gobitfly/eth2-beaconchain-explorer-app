package `in`.beaconcha.mobile.api

import `in`.beaconcha.mobile.api.models.BeaconchainResponse
import `in`.beaconcha.mobile.api.models.CoinbasePrice
import `in`.beaconcha.mobile.api.models.CoinbaseResponse
import `in`.beaconcha.mobile.api.models.WidgetData
import `in`.beaconcha.mobile.utils.Network
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException

class WebAPI(network: Network) {

    private val client = OkHttpClient()

    private val beaconchainBase = network.protocol + "://" + network.net + network.host
    private val apiBase = beaconchainBase + network.endpoint + network.version

    @Throws(IOException::class)
    private fun get(url: String): String? {
        val request: Request = Request.Builder()
                .url(url)
                .build()
        client.newCall(request).execute().use { response -> return response.body?.string() }
    }

    @Throws(IOException::class)
    fun getWidgetJson(validators: String): String? {
        // TODO: replace constant string with apiBase
        return get(
                 apiBase
                        + ENDPOINT.replace(VALIDATOR_KEY, validators)
        )
    }

    @Throws(IOException::class)
    fun getCoinbasePriceJson(pair: String): String? {
        return get(COINBASE_ENPOINT.replace(CURRENCY_KEY, pair))
    }

    companion object {
        const val VALIDATOR_KEY = "{validators}"
        const val ENDPOINT = "validator/$VALIDATOR_KEY/widget" //http://213.229.37.18:16903/api/v1/validator

        const val CURRENCY_KEY = "{currency}"
        const val COINBASE_ENPOINT = "https://api.coinbase.com/v2/prices/$CURRENCY_KEY/spot"
    }
}

class WebAPIParser {
    @Throws(IOException::class)
    fun parseWidgetResponse(json: String): WidgetData? {
        val turnsType = object : TypeToken<BeaconchainResponse<WidgetData>>() {}.type
        val data = Gson().fromJson<BeaconchainResponse<WidgetData>>(json, turnsType)
        if (data?.status == "OK") return data.data
        return null
    }

    @Throws(IOException::class)
    fun parseCoinbasePriceResponse(json: String): CoinbasePrice? {
        val turnsType = object : TypeToken<CoinbaseResponse<CoinbasePrice>>() {}.type
        val data = Gson().fromJson<CoinbaseResponse<CoinbasePrice>>(json, turnsType)
        return data?.data
    }
}
