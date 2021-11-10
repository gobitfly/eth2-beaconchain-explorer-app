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

import { Injectable } from '@angular/core';
import Unit, { convertDisplayable, MAPPING } from '../utils/EthereumUnits';
import { StorageService } from './storage.service';
import BigNumber from "bignumber.js";
import { ApiService } from './api.service';
import { CoinbaseExchangeRequest, CoinbaseExchangeResponse } from '../requests/requests';

interface UnitStorage {
  prefered: ("ETHER" | "FINNEY" | "EURO" | "DOLLAR")
}

const STORAGE_KEY = "prefered_unit"

@Injectable({
  providedIn: 'root'
})
export class UnitconvService {

  pref: string = "ETHER"
  lastPrice: BigNumber

  constructor(private storage: StorageService, private api: ApiService) {
    this.storage.getObject(STORAGE_KEY).then(
      (unitPref) => this.init(unitPref)
    )
  }

  private async getExchangeRate(unitPair: string): Promise<CoinbaseExchangeResponse> {
    if (unitPair == "ETH-BTC") return this.getExchangeRateBitcoin()

    const req = new CoinbaseExchangeRequest(unitPair)
    const response = await this.api.execute(req).catch((error) => { return null })
    const temp = req.parse(response)
    if(temp.length <= 0) return null
    return temp[0]
  }

  // Special bitcoin case since coinbase doesn't have an ETH_BTC spot price api endpoint
  private async getExchangeRateBitcoin(): Promise<CoinbaseExchangeResponse> {
    const reqEthUsd = new CoinbaseExchangeRequest("ETH-USD")
    const reqBtcUsd = new CoinbaseExchangeRequest("BTC-USD")

    const responseEthUsdPromise = this.api.execute(reqEthUsd)
    const responseBtcUsdPromise = this.api.execute(reqBtcUsd)
    
    const responseEthUsd = reqEthUsd.parse(await responseEthUsdPromise)
    const responseBtcUsd = reqBtcUsd.parse(await responseBtcUsdPromise)
    if(responseEthUsd.length <= 0 || responseBtcUsd.length <= 0) return null

    const rate = new BigNumber(responseEthUsd[0].amount)
      .dividedBy(new BigNumber(responseBtcUsd[0].amount))

    return {
      base: "ETH",
      currency: "BTC",
      amount: rate.toString()
    } as CoinbaseExchangeResponse
  }

  async init(unitPref) {
    const temp = this.getPref(unitPref)

    this.pref = temp

    const unit: Unit = this.getCurrentPrefAsUnit()

    const lastUpdatedPrice = await this.storage.getObject("last_price_" + this.pref)

    if (lastUpdatedPrice && lastUpdatedPrice.lastPrice) {
      const price = new BigNumber(lastUpdatedPrice.lastPrice)
      this.lastPrice = price
    } else {
      this.lastPrice = unit.value
    }

    if (! (await this.storage.getBooleanSetting("UPDATED_CURRENCY_INTEROP", false))) {
      this.storage.setBooleanSetting("UPDATED_CURRENCY_INTEROP", true)
      this.save()
    }

    this.updatePriceData()
  }

  private getCurrentPrefAsUnit() {
    const unitStored: Unit = MAPPING.get(this.pref)
    return unitStored ? unitStored : Unit.ETHER
  }

  async updatePriceData() {
    console.log("updatePriceData currency")
    const unit: Unit = this.getCurrentPrefAsUnit()
    if (unit.coinbaseSpot) {
      const exchangeRate = await this.getExchangeRate(unit.coinbaseSpot)
      const bigNumAmount = exchangeRate ? new BigNumber(exchangeRate.amount) : null
      if (bigNumAmount && bigNumAmount.isGreaterThan(0)) {
        unit.value = bigNumAmount
        this.lastPrice = bigNumAmount
        this.triggerPropertyChange()
        this.storage.setObject("last_price_" + this.pref, { lastPrice: bigNumAmount })
      } else {
        // Handles the case if we get no price data atm
        // Currently we fall back to ether being the default unit (since price is 1:1)
        // (TODO: we could do this for all eth subunits fe. finney)
        this.lastPrice = unit.value
        this.pref = "ETHER"
      }
    }
  }

  private triggeredChange = false
  private triggerPropertyChange() {
    this.triggeredChange = true

    const temp = this.pref
    this.pref = "ETHER"
    this.pref = "FINNEY"

    setTimeout(() => {
      this.pref = temp
      this.triggeredChange = false
    }, 450)
  }

  private getPref(unitPref) {
    if (unitPref) {
      return unitPref.prefered
    }
    return "ETHER"
  }

  convertToPref(value: BigNumber, from) {
    return this.convert(value, from, this.pref)
  }

  convert(value: BigNumber, from, to) {
    if (!value || !from || !to) return value

    const tempValue = value instanceof BigNumber ? value : new BigNumber(value)
    return convertDisplayable(tempValue, MAPPING.get(from), MAPPING.get(to))
  }

  save() {
    if (this.triggeredChange) return
    const unit = this.getCurrentPrefAsUnit()
    this.storage.setObject(STORAGE_KEY, { prefered: this.pref, coinbaseSpot: unit.coinbaseSpot, symbol: unit.display, rounding: unit.rounding })
  }
}
