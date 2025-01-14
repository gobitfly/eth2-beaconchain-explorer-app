/*
 *  // Copyright (C) 2020 - 2024 bitfly explorer GmbH
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

import BigNumber from 'bignumber.js'

/**
 * Add new currencies:
 * 1) define them as Unit like the others. To be displayed in the settings panel, define a settingsName
 * 2) add them to the MAPPING const (needed for mcurrency pipe or if intended to be used in settings)
 */

export default class Unit {
	public static WEI = new Unit('Wei', new BigNumber('1000000000000000000'))
	public static GWEI = new Unit('Gwei', new BigNumber('1000000000'))
	public static SZABO = new Unit('Szabo', new BigNumber('1000000'))
	public static FINNEY = new Unit('Finney', new BigNumber('1000'), 2, null, 'Finney')

	public static ETHER = new Unit('ETH', new BigNumber('1'), 5, 'XXX-ETH', 'Ether')
	public static KETHER = new Unit('KETH', new BigNumber('0.001'))
	public static RPL = new Unit('RPL', new BigNumber('1'), 2) // RPL TO ETH
	public static RPL_NAKED = new Unit('RPL', new BigNumber('1'), 2)
	public static NO_CURRENCY = new Unit('', new BigNumber('1'), 0)
	public static RETH = new Unit('RETH', new BigNumber('1'), 2)
	public static DAI_GNO_HELPER = new Unit('dummy', new BigNumber(1), 5, 'DAI-GNO')

	public static XDAI = new Unit('DAI', new BigNumber('1'), 4, 'XXX-DAI', 'xDAI')
	public static GNO = new Unit('GNO', new BigNumber('0.03125'), 5, 'XXX-GNO', 'GNO')
	// public static MGNO = new Unit('mGNO', new BigNumber('1'), 5, 'XXX-GNO', 'mGNO')

	public static USDETH = new Unit('$', new BigNumber('1'), 2, 'XXX-USD', 'Dollar')
	public static EURETH = new Unit('€', new BigNumber('1'), 2, 'XXX-EUR', 'Euro')
	public static RUBETH = new Unit('₽', new BigNumber('1'), 2, 'XXX-RUB', 'Rubel')
	public static JPYETH = new Unit('¥', new BigNumber('1'), 0, 'XXX-JPY', 'Yen')
	public static GBPETH = new Unit('£', new BigNumber('1'), 2, 'XXX-GBP', 'Pound')
	public static AUDETH = new Unit('A$', new BigNumber('1'), 2, 'XXX-AUD', 'Australian Dollar')
	public static CADETH = new Unit('C$', new BigNumber('1'), 2, 'XXX-CAD', 'Canadian Dollar')
	public static CHFETH = new Unit('CHF', new BigNumber('1'), 2, 'XXX-CHF', 'Swiss Franc')
	public static MXNETH = new Unit('MXN', new BigNumber('1'), 2, 'XXX-MXN', 'Mexican Peso')
	public static ZARETH = new Unit('R', new BigNumber('1'), 2, 'XXX-ZAR', 'South African Rand')
	public static CNYETH = new Unit('元', new BigNumber('1'), 2, 'XXX-CNY', 'Renminbi')
	public static HKDETH = new Unit('HK$', new BigNumber('1'), 2, 'XXX-HKD', 'Hong Kong Dollar')
	public static NZDETH = new Unit('NZ$', new BigNumber('1'), 2, 'XXX-NZD', 'New Zealand Dollar')
	public static BTCETH = new Unit('₿', new BigNumber('1'), 6, 'XXX-BTC', 'Bitcoin')

	private constructor(symbol: string, value: BigNumber, rounding = 2, coinbaseSpot: string = null, settingsName: string = null) {
		this.display = symbol
		this.value = value
		this.rounding = rounding
		this.coinbaseSpot = coinbaseSpot
		this.settingName = settingsName
	}

	public toString(): string {
		return (
			this.value.toString() +
			' ' +
			this.display +
			' (rounding: ' +
			this.rounding +
			', coinbaseSpot: ' +
			this.coinbaseSpot +
			', settingName: ' +
			this.settingName +
			')'
		)
	}

	readonly display: string
	value: BigNumber
	readonly rounding: number
	coinbaseSpot: string
	readonly settingName: string
}

// argh ( TODO )
// List containing mappings for use with mcurrency pipe
// key is also used in preferences page for storing user selected currency
export const MAPPING = new Map([
	['ETHER', Unit.ETHER],
	['FINNEY', Unit.FINNEY],
	['EURO', Unit.EURETH],
	['DOLLAR', Unit.USDETH],
	['WEI', Unit.WEI],
	['GWEI', Unit.GWEI],
	['SZABO', Unit.SZABO],
	['RPL', Unit.RPL],
	['RPL_NAKED', Unit.RPL_NAKED],
	['NO_CURRENCY', Unit.NO_CURRENCY],
	['RETH', Unit.RETH],
	['GNO', Unit.GNO],
	// ['mGNO', Unit.MGNO],
	['xDAI', Unit.XDAI],

	['RUBLE', Unit.RUBETH],
	['YEN', Unit.JPYETH],
	['POUND', Unit.GBPETH],
	['AUD', Unit.AUDETH],
	['CAD', Unit.CADETH],
	['CHF', Unit.CHFETH],
	['MXN', Unit.MXNETH],
	['ZAR', Unit.ZARETH],
	['HKD', Unit.HKDETH],
	['CNY', Unit.CNYETH],
	['NZD', Unit.NZDETH],
	['BTC', Unit.BTCETH],
])

export function convertEthUnits(value: BigNumber, from: Unit, to: Unit, enforceDecimalPlaces = true): BigNumber {
	let temp = value.multipliedBy(to.value).dividedBy(from.value)

	if (enforceDecimalPlaces) temp = temp.decimalPlaces(to.rounding)

	return temp
}

export function convertDisplayable(value: BigNumber, from: Unit, to: Unit): string {
	return convertEthUnits(value, from, to).toFormat() + ' ' + to.display
}
