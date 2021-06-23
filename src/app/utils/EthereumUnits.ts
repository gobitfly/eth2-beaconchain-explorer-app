/* 
 *  // Copyright (C) 2020 - 2021 Bitfly GmbH
 *  // Manuel Caspari (manuel@bitfly.at)
 *  // 
 *  // This file is part of Beaconchain Dashboard.
 *  // 
 *  // Beaconchain Dashboard is free software: you can redistribute it and/or modify
 *  // it under the terms of the GNU General Public License as published by
 *  // the Free Software Foundation, either version 3 of the License, or
 *  // (at your option) any later version.
 *  // 
 *  // Beaconchain Dashboard is distributed in the hope that it will be useful,
 *  // but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  // GNU General Public License for more details.
 *  // 
 *  // You should have received a copy of the GNU General Public License
 *  // along with Beaconchain Dashboard.  If not, see <http://www.gnu.org/licenses/>.
 */

import BigNumber from "bignumber.js";

/**
 * Add new currencies:
 * 1) define them as Unit like the others. To be displayed in the settings panel, define a settingsName
 * 2) add them to the MAPPING const (needed for mcurrency pipe or if intended to be used in settings)
 */

export default class Unit {

    public static WEI = new Unit("Wei", new BigNumber("1000000000000000000"))
    public static GWEI = new Unit("Gwei", new BigNumber("1000000000"))
    public static SZABO = new Unit("Szabo", new BigNumber("1000000"))
    public static FINNEY = new Unit("Finney", new BigNumber("1000"), 2, null, "Finney")
    public static ETHER = new Unit("Ether", new BigNumber("1"), 5, null, "Ether")
    public static KETHER = new Unit("Kether", new BigNumber("0.001"))

    public static USDETH = new Unit("$", new BigNumber("388.43"), 2, "ETH-USD", "Dollar")
    public static EURETH = new Unit("€", new BigNumber("329.22"), 2, "ETH-EUR", "Euro")
    public static RUBETH = new Unit("₽", new BigNumber("38093"), 2, "ETH-RUB", "Rubel")
    public static JPYETH = new Unit("¥", new BigNumber("38093"), 0, "ETH-JPY", "Yen")
    public static GBPETH = new Unit("£", new BigNumber("368.5"), 2, "ETH-GBP", "Pound")
    public static AUDETH = new Unit("A$", new BigNumber("683.65"), 2, "ETH-AUD", "Australian Dollar")
    public static CADETH = new Unit("C$", new BigNumber("651.02"), 2, "ETH-CAD", "Canadian Dollar")
    public static CHFETH = new Unit("CHF", new BigNumber("455.55"), 2, "ETH-CHF", "Swiss Franc")
    public static MXNETH = new Unit("MXN", new BigNumber("455.55"), 2, "ETH-MXN", "Mexican Peso")
    public static ZARETH = new Unit("R", new BigNumber("455.55"), 2, "ETH-ZAR", "South African Rand")
    public static CNYETH = new Unit("元", new BigNumber("455.55"), 2, "ETH-CNY", "Renminbi")
    public static HKDETH = new Unit("HK$", new BigNumber("455.55"), 2, "ETH-HKD", "Hong Kong Dollar")
    public static NZDETH = new Unit("NZ$", new BigNumber("455.55"), 2, "ETH-NZD", "New Zealand Dollar")
    public static BTCETH = new Unit("₿", new BigNumber("455.55"), 6, "ETH-BTC", "Bitcoin") // coinbase endpoit: invalid currency :/ workaroung in unit converter


    private constructor(symbol: string, value: BigNumber, rounding: number = 2, coinbaseSpot = null, settingsName = null) {
        this.display = symbol
        this.value = value
        this.rounding = rounding
        this.coinbaseSpot = coinbaseSpot
        this.settingName = settingsName
    }

    readonly display: string
    value: BigNumber
    readonly rounding: number
    readonly coinbaseSpot: string
    readonly settingName: string
}

// argh ( TODO )
// List containing mappings for use with mcurrency pipe
// key is also used in preferences page for storing user selected currency
export const MAPPING = new Map([
    ["ETHER", Unit.ETHER],
    ["FINNEY", Unit.FINNEY],
    ["EURO", Unit.EURETH],
    ["DOLLAR", Unit.USDETH],
    ["WEI", Unit.WEI],
    ["GWEI", Unit.GWEI],
    ["SZABO", Unit.SZABO],

    ["RUBLE", Unit.RUBETH],
    ["YEN", Unit.JPYETH],
    ["POUND", Unit.GBPETH],
    ["AUD", Unit.AUDETH],
    ["CAD", Unit.CADETH],
    ["CHF", Unit.CHFETH],
    ["MXN", Unit.MXNETH],
    ["ZAR", Unit.ZARETH],
    ["HKD", Unit.HKDETH],
    ["CNY", Unit.CNYETH],
    ["NZD", Unit.NZDETH],
    
    
    ["BTC", Unit.BTCETH],
])

export function convertEthUnits(value: BigNumber, from: Unit, to: Unit): BigNumber {
    return value.multipliedBy(to.value).dividedBy(from.value).decimalPlaces(to.rounding)
}

export function convertDisplayable(value: BigNumber, from: Unit, to: Unit): string {
    return convertEthUnits(value, from, to).toFormat() + " " + to.display
}
