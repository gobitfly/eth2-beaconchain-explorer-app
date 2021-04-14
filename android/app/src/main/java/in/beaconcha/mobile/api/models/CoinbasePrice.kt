package `in`.beaconcha.mobile.api.models

import com.google.gson.annotations.SerializedName
import java.math.BigDecimal

class CoinbasePrice(
        @SerializedName("base") val base: String = "",
        @SerializedName("currency") val currency: String = "",
        @SerializedName("amount") val amount: BigDecimal = 0.0.toBigDecimal()
)