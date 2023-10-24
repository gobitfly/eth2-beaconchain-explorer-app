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

import { Injectable } from '@angular/core'
import Unit, { convertDisplayable, MAPPING, convertEthUnits } from '../utils/EthereumUnits'
import { StorageService } from './storage.service'
import BigNumber from 'bignumber.js'
import { ApiService } from './api.service'
import { CoinbaseExchangeRequest, CoinbaseExchangeResponse } from '../requests/requests'

const STORAGE_KEY_CONS = 'prefered_unit' // cons
const STORAGE_KEY_EXEC = 'prefered_unit_exec'
const STORAGE_KEY_RPL = 'prefered_unit_rocketpool'

export type RewardType = 'cons' | 'exec' | 'rpl'

@Injectable({
	providedIn: 'root',
})
export class UnitconvService {
	public pref: PreferredCurrency = {
		Cons: { value: 'ETHER', type: 'cons', unit: Unit.ETHER } as Currency,
		Exec: { value: 'ETHER', type: 'exec', unit: Unit.ETHER } as Currency,
		RPL: { value: 'ETHER', type: 'rpl', unit: Unit.RPL } as Currency,
	}
	public lastPrice: LastPrice
	private rplETHPrice: BigNumber = new BigNumber(1)

	/*
		Users can quickly toggle between native currency and fiat currency by clicking on the value.
		This variable holds the previous setting (native or fiat) for each currency type (cons, exec, rpl.
	*/
	static currencyPipe: CurrencyPipe = { Cons: null, Exec: null, RPL: null }

	constructor(private storage: StorageService, private api: ApiService) {
		this.init()
	}

	private async init() {
		await this.migrateToGnosisEra()

		this.lastPrice = {
			Cons: await this.getLastStoredPrice(this.pref.Cons),
			Exec: await this.getLastStoredPrice(this.pref.Exec),
		} as LastPrice

		this.pref.Cons = this.createCurrency(this.getPref(await this.loadStored(STORAGE_KEY_CONS), this.getNetworkDefaultCurrency('cons')), 'cons')
		this.pref.Exec = this.createCurrency(this.getPref(await this.loadStored(STORAGE_KEY_EXEC), this.getNetworkDefaultCurrency('exec')), 'exec')
		this.pref.RPL = this.createCurrency(this.getPref(await this.loadStored(STORAGE_KEY_RPL), this.getNetworkDefaultCurrency('rpl')), 'rpl')

		if (!(await this.storage.getBooleanSetting('UPDATED_CURRENCY_INTEROP', false))) {
			this.storage.setBooleanSetting('UPDATED_CURRENCY_INTEROP', true)
			this.save()
		}

		await this.updatePriceData()
	}

	public async networkSwitchReload() {
		await this.init()
	}

	public async changeCurrency(value: string) {
		UnitconvService.currencyPipe = { Cons: null, Exec: null, RPL: null }

		this.pref.Cons = this.createCurrency(value, 'cons')
		if (this.isDefaultCurrency(this.pref.Cons)) {
			this.pref.Exec = this.createCurrency(this.getNetworkDefaultCurrency(this.pref.Exec), 'exec')
		} else {
			this.pref.Exec = this.createCurrency(value, 'exec')
		}

		await this.updatePriceData()
	}

	public async getCurrentConsFiat() {
		return this.createCurrency(this.getPref(await this.loadStored(STORAGE_KEY_CONS), this.getNetworkDefaultCurrency('cons')), 'cons').value
	}

	private async loadStored(key: string): Promise<StoredPref> {
		const result = await this.storage.getObject(key)
		if (!result) return null
		return result as StoredPref
	}

	private createCurrency(value: string, type: RewardType): Currency {
		const result = new Currency(value, type)
		result.unit = this.getUnit(result)
		return result
	}

	private getPref(unitPref: StoredPref, defaultva: string): string {
		if (unitPref && unitPref.prefered) {
			return unitPref.prefered
		}
		return defaultva
	}

	private getUnit(currency: Currency): Unit {
		const result = Object.assign({}, MAPPING.get(currency.value))
		if (!result) {
			return Unit.ETHER
		}

		// Price
		let price = null
		if (this.lastPrice) {
			if (currency.type == 'cons' && this.lastPrice.Cons) {
				price = this.lastPrice.Cons
			} else if (currency.type == 'exec' && this.lastPrice.Exec) {
				price = this.lastPrice.Exec
			} else if (currency.type == 'rpl' && this.rplETHPrice && this.lastPrice.Cons) {
				price = this.getUpdatedRPLPrice()
			}
		}

		if (price && !this.isDefaultCurrency(currency) && currency.value != 'mGNO') {
			result.value = price
		}

		// Coinbase spot name (for api calls)
		if (result.coinbaseSpot) {
			const network = this.api.getNetwork()
			if (currency.type == 'cons') {
				result.coinbaseSpot = result.coinbaseSpot.replace('XXX', network.clCurrency.coinbaseSpot)
			} else if (currency.type == 'exec') {
				result.coinbaseSpot = result.coinbaseSpot.replace('XXX', network.elCurrency.coinbaseSpot)
			}
		}
		return result
	}

	public isDefaultCurrency(currency: Currency) {
		return currency.value == this.getNetworkDefaultCurrency(currency.type)
	}

	public getNetworkDefaultUnit(type: RewardType): Unit {
		return MAPPING.get(this.getNetworkDefaultCurrency(type))
	}

	public getNetworkDefaultCurrency(type: RewardType | Currency): string {
		if (typeof type == 'object') {
			type = type.type
		}

		const network = this.api.getNetwork()
		if (type == 'cons') {
			return network.clCurrency.internalName
		} else if (type == 'exec') {
			return network.elCurrency.internalName
		} else if (type == 'rpl') {
			return 'RPL'
		}

		return 'ETHER'
	}

	public getFiatCurrency(type: RewardType) {
		if (type == 'cons') {
			if (this.isDefaultCurrency(this.pref.Cons)) {
				return UnitconvService.currencyPipe.Cons
			} else {
				return this.pref.Cons.value
			}
		} else if (type == 'exec') {
			if (this.isDefaultCurrency(this.pref.Exec)) {
				return UnitconvService.currencyPipe.Exec
			} else {
				return this.pref.Exec.value
			}
		}
	}

	private async getLastStoredPrice(currency: Currency) {
		const lastUpdatedConsPrice = (await this.storage.getObject(this.getLastPriceKey(currency))) as LastPrice
		if (lastUpdatedConsPrice && lastUpdatedConsPrice.lastPrice) {
			const price = new BigNumber(lastUpdatedConsPrice.lastPrice)
			return price
		} else {
			return currency.unit.value
		}
	}

	private getLastPriceKey(currency: Currency): string {
		return 'last_price_' + currency.type + '_' + currency.value
	}

	public setRPLPrice(price: BigNumber) {
		const unitStored: Unit = this.pref.RPL.unit
		if (!unitStored) return
		unitStored.value = convertEthUnits(price, MAPPING.get('WEI'), Unit.ETHER)
		this.rplETHPrice = unitStored.value
		this.pref.RPL = this.createCurrency(this.pref.Cons.value, 'rpl')
	}

	private getUpdatedRPLPrice() {
		return this.rplETHPrice.multipliedBy(this.isDefaultCurrency(this.pref.Cons) ? new BigNumber(1) : this.lastPrice.Cons)
	}

	public getRPLPrice() {
		const unitStored: Unit = this.pref.RPL.unit
		if (!unitStored) return
		return unitStored.value
	}

	private triggerPropertyChange() {
		if (this.isDefaultCurrency(this.pref.Cons) || this.pref.Cons.value == 'mGNO') {
			if (this.pref.Cons.value == 'mGNO') {
				this.pref.Cons = this.createCurrency(this.pref.Cons.value, 'cons')
			} else {
				this.pref.Cons = this.createCurrency(this.getNetworkDefaultCurrency(this.pref.Cons), 'cons')
			}
			this.pref.Exec = this.createCurrency(this.getNetworkDefaultCurrency(this.pref.Cons), 'exec')
			this.pref.RPL = this.createCurrency(this.getNetworkDefaultCurrency(this.pref.RPL), 'rpl')
			return
		}

		this.pref.Cons = this.createCurrency(this.pref.Cons.value, 'cons')
		this.pref.Exec = this.createCurrency(this.pref.Exec.value, 'exec')
		this.pref.RPL = this.createCurrency(this.pref.RPL.value, 'rpl')
	}

	public convertToPref(value: BigNumber, from, type: RewardType) {
		if (type == 'cons') {
			return this.convert(value, from, this.pref.Cons)
		}
		if (type == 'exec') {
			return this.convert(value, from, this.pref.Exec)
		}
		throw new Error('Unsupported reward type')
	}

	public switchCurrencyPipe() {
		if (this.isDefaultCurrency(this.pref.Cons)) {
			if (UnitconvService.currencyPipe.Cons == null) return
			this.pref.Cons = this.createCurrency(UnitconvService.currencyPipe.Cons, 'cons')
		} else {
			UnitconvService.currencyPipe.Cons = this.pref.Cons.value
			this.pref.Cons = this.createCurrency(this.getNetworkDefaultCurrency('cons'), 'cons')
		}

		if (this.isDefaultCurrency(this.pref.Exec)) {
			if (UnitconvService.currencyPipe.Exec == null) return
			this.pref.Exec = this.createCurrency(UnitconvService.currencyPipe.Exec, 'exec')
		} else {
			UnitconvService.currencyPipe.Exec = this.pref.Exec.value
			this.pref.Exec = this.createCurrency(this.getNetworkDefaultCurrency('exec'), 'exec')
		}

		this.pref.RPL = this.createCurrency(this.pref.Cons.value, 'rpl')
	}

	public convert(value: BigNumber | number | string, from: string, to: Currency, displayable = true) {
		return this.convertBase(value, from, to.unit, displayable)
	}

	/**
	 * Does not support fiat currencies since exchange rate is not applied to units anymore
	 * (cons and exec could have different conversions so they cant use the same reference to unit)
	 */
	public convertNonFiat(value: BigNumber | number | string, from: string, to: string, displayable = true) {
		if (MAPPING.get(to).coinbaseSpot != null && to != 'ETH' && to != 'ETHER' && from != to) {
			console.warn('convertNonFiat does not support fiat currencies. Use convert instead', value.toString(), from, to, displayable)
		}
		return this.convertBase(value, from, MAPPING.get(to), displayable)
	}

	private convertBase(value: BigNumber | number | string, from: string, to: Unit, displayable = true) {
		if (!value || !from || !to) return value

		const tempValue = value instanceof BigNumber ? value : new BigNumber(value)
		if (displayable) {
			return convertDisplayable(tempValue, MAPPING.get(from), to)
		} else {
			return convertEthUnits(tempValue, MAPPING.get(from), to, false)
		}
	}

	public save() {
		this.storage.setObject(STORAGE_KEY_CONS, {
			prefered: this.getNetworkDefaultCurrency('cons') == this.pref.Cons.value ? null : this.pref.Cons.value,
			coinbaseSpot: this.pref.Cons.unit.coinbaseSpot,
			symbol: this.pref.Cons.unit.display,
			rounding: this.pref.Cons.unit.rounding,
		} as StoredPref)

		this.storage.setObject(STORAGE_KEY_EXEC, {
			prefered: this.getNetworkDefaultCurrency('exec') == this.pref.Exec.value ? null : this.pref.Exec.value,
			coinbaseSpot: this.pref.Exec.unit.coinbaseSpot,
			symbol: this.pref.Exec.unit.display,
			rounding: this.pref.Exec.unit.rounding,
		} as StoredPref)

		this.storage.setObject(STORAGE_KEY_RPL, {
			prefered: this.getNetworkDefaultCurrency('rpl') == this.pref.RPL.value ? null : this.pref.RPL.value,
			coinbaseSpot: this.pref.RPL.unit.coinbaseSpot,
			symbol: this.pref.RPL.unit.display,
			rounding: this.pref.RPL.unit.rounding,
		} as StoredPref)
	}

	private async migrateToGnosisEra() {
		const migratedToGnosis = await this.storage.getBooleanSetting('migrated_gnosis', false)
		if (!migratedToGnosis) {
			const oldCons = await this.loadStored(STORAGE_KEY_CONS)
			try {
				if (oldCons && oldCons.prefered == 'Ether') {
					oldCons.prefered = null
					await this.storage.setObject(STORAGE_KEY_CONS, oldCons)
				} else {
					await this.storage.setObject(STORAGE_KEY_EXEC, oldCons)
					await this.storage.setObject(STORAGE_KEY_RPL, oldCons)
				}
				this.storage.setBooleanSetting('migrated_gnosis', true)
			} catch (e) {
				console.warn('could not migrate to gnosis')
			}
		}
	}

	public isCurrency(obj: unknown): obj is Currency {
		return typeof obj == 'object' && obj != null && 'value' in obj && 'type' in obj
	}

	async updatePriceData() {
		const consPrice = await this.getPriceData(this.pref.Cons.unit)
		if (consPrice) {
			this.lastPrice.Cons = consPrice.multipliedBy(MAPPING.get(this.getNetworkDefaultCurrency(this.pref.Cons)).value)
			this.storage.setObject(this.getLastPriceKey(this.pref.Cons), { lastPrice: this.lastPrice.Cons } as LastPrice)
		} else {
			this.lastPrice.Cons = this.pref.Cons.unit.value
			if (this.pref.Cons.value != 'mGNO') {
				this.pref.Cons.value = this.getNetworkDefaultCurrency(this.pref.Cons)
			}
		}

		const execPrice = await this.getPriceData(this.pref.Exec.unit)
		if (execPrice) {
			this.lastPrice.Exec = execPrice.multipliedBy(MAPPING.get(this.getNetworkDefaultCurrency(this.pref.Exec)).value)
			this.storage.setObject(this.getLastPriceKey(this.pref.Exec), { lastPrice: this.lastPrice.Exec } as LastPrice)
		} else {
			this.lastPrice.Exec = this.pref.Exec.unit.value
			this.pref.Exec.value = this.getNetworkDefaultCurrency(this.pref.Exec)
		}

		this.triggerPropertyChange()
	}

	private async getPriceData(unit: Unit) {
		if (unit.coinbaseSpot) {
			const splitted = unit.coinbaseSpot.split('-')
			if (splitted.length == 2 && splitted[0] == splitted[1]) {
				return null
			}
			const exchangeRate = await this.getExchangeRate(unit.coinbaseSpot)
			const bigNumAmount = exchangeRate ? new BigNumber(exchangeRate.amount) : null
			if (bigNumAmount && bigNumAmount.isGreaterThan(0)) {
				unit.value = bigNumAmount
				return bigNumAmount
			} else {
				// Handles the case if we get no price data atm
				// Currently we fall back to the current networks default unit (since price is 1:1)
				// (TODO: we could do this for all eth subunits fe. finney)
				return null
			}
		}
		return null
	}

	private async getExchangeRate(unitPair: string): Promise<CoinbaseExchangeResponse> {
		const req = new CoinbaseExchangeRequest(unitPair)
		const response = await this.api.execute(req).catch((e) => {
			console.warn('error in response getExchangeRate', e)
			return null
		})
		const temp = req.parse(response)
		if (temp.length <= 0) return null
		console.log('requested exchange rate for ', unitPair, 'got', temp[0].amount, 'as response')
		return temp[0]
	}
}

interface LastPrice {
	lastPrice: BigNumber
}

interface LastPrice {
	Cons: BigNumber
	Exec: BigNumber
}

interface PreferredCurrency {
	Cons: Currency
	Exec: Currency
	RPL: Currency
}

export class Currency {
	value: string
	type: RewardType
	unit: Unit
	constructor(value: string, type: RewardType) {
		this.value = value
		this.type = type
	}

	public toString(): string {
		return this.value
	}
	public getCurrencyName(): string {
		return this.value.charAt(0) + this.value.toLocaleLowerCase().slice(1)
	}
}
interface CurrencyPipe {
	Cons: string
	Exec: string
	RPL: string
}

interface StoredPref {
	prefered: string | null
	coinbaseSpot: string
	symbol: string
	rounding: number
}
