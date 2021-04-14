package `in`.beaconcha.mobile.api.models

import com.google.gson.annotations.SerializedName

class CoinbaseResponse<T>(
        @SerializedName("data") val data: T? = null
)