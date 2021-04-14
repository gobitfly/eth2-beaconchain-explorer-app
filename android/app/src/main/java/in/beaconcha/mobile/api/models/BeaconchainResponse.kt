package `in`.beaconcha.mobile.api.models

import com.google.gson.annotations.SerializedName

class BeaconchainResponse<T>(
        @SerializedName("status") val status: String = "",
        @SerializedName("data") val data: T? = null
)