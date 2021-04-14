package `in`.beaconcha.mobile.api.models

import `in`.beaconcha.mobile.utils.round
import com.google.gson.annotations.SerializedName
import java.math.BigInteger

enum class State {
    ONLINE, OFFLINE, SLASHED
}

data class WidgetData(
        @SerializedName("efficiency") val efficiencies: ArrayList<Efficiency>? = null,
        @SerializedName("validator") val validators: ArrayList<Validator>? = null,
        @SerializedName("epoch") val epoch: Long = 0,
) {

    val balance: BigInteger by lazy {
        validators?.sumOf { it.balance } ?: 0.toBigInteger()
    }

    val effectiveBalance: BigInteger by lazy {
        validators?.sumOf { it.effectiveBalance } ?: 0.toBigInteger()
    }

    val performance1d: BigInteger by lazy {
        validators?.sumOf { it.performance1d } ?: 0.toBigInteger()
    }

    val performance7d: BigInteger by lazy {
        validators?.sumOf { it.performance7d } ?: 0.toBigInteger()
    }

    val efficiency: Double by lazy {
        efficiencies?.run {
            (sumOf { 1 / it.efficiency * 100 } / size).round(1)
        } ?: 0.0
    }

    val apr: Double by lazy {
        (performance7d.toBigDecimal().multiply(5214.toBigDecimal()).divide(effectiveBalance.toBigDecimal())).toDouble().round(1)
    }

    val status: State by lazy {
        var erg = State.ONLINE
        validators?.forEach {
            if (it.slashed) erg = State.SLASHED
            if (it.lastattestationslot < ((epoch - 2) * 32).toBigInteger()) erg = State.OFFLINE
        }
        erg
    }
}

data class Efficiency(
        @SerializedName("attestation_efficiency") val efficiency: Double = 0.0,
        @SerializedName("pubkey") val pubkey: String = "",
        @SerializedName("validatorindex") val index: Int = -1,
)

data class Validator(
        @SerializedName("balance") val balance: BigInteger = 0.toBigInteger(),
        @SerializedName("effectivebalance") val effectiveBalance: BigInteger = 0.toBigInteger(),
        @SerializedName("performance1d") val performance1d: BigInteger = 0.toBigInteger(),
        @SerializedName("performance31d") val performance31d: BigInteger = 0.toBigInteger(),
        @SerializedName("performance7d") val performance7d: BigInteger = 0.toBigInteger(),
        @SerializedName("pubkey") val pubkey: String = "",
        @SerializedName("validatorindex") val index: Int = -1,
        @SerializedName("slashed") val slashed: Boolean = false,
        @SerializedName("lastattestationslot") val lastattestationslot: BigInteger = 0.toBigInteger(),
)

