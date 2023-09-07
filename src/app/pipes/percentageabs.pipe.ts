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

import { Pipe, PipeTransform } from '@angular/core'
import BigNumber from 'bignumber.js'

@Pipe({
	name: 'percentageabs',
})
export class PercentageabsPipe implements PipeTransform {
	/**
	 * Takes an absolute value (`value_`) and a relative percentage representation of it (`percentage_`  ) and returns a formatted string of one of those (based on `percentMode`).
	 *
	 * @param {number | BigNumber} value_ - The absolute value to be shown (used when `percentMode` is false).
	 * @param {number | BigNumber} percentage_ - The relative percentage representation for the value (used when `percentMode` is true)
	 * @param {boolean} percentMode - A flag indicating whether to use `value_` (false) or `percentage_` (true).
	 * @param {string} [prefix=''] - An optional prefix to prepend to the resulting string if the absolute value is shown.
	 * @returns {string} The formatted string.
	 */
	transform(value_: number | BigNumber, percentage_: number | BigNumber, percentMode: boolean, prefix = ''): string {
		if (percentMode) {
			const percentage = percentage_ instanceof BigNumber ? percentage_ : new BigNumber(percentage_)
			const percentageNumber = percentage.toNumber()
			if (percentageNumber <= 0.1) {
				return prefix + '0.1 %'
			}
			let decimalPlaces = 1
			if (percentageNumber < 1.0) {
				decimalPlaces = 3
			} else if (percentageNumber < 10.0) {
				decimalPlaces = 2
			}
			return prefix + percentage.decimalPlaces(decimalPlaces).toString() + ' %'
		} else {
			const value = value_ instanceof BigNumber ? value_ : new BigNumber(value_)
			return value.toFormat()
		}
	}
}
