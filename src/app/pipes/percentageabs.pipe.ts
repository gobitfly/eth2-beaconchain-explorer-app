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
	transform(value_: number | BigNumber, percentage_: number | BigNumber, percentMode: boolean, preablePrct = ''): string {
		if (percentMode) {
			const percentage = percentage_ instanceof BigNumber ? percentage_ : new BigNumber(percentage_)
			if (percentage.toNumber() <= 0.1) {
				return preablePrct + '0.1 %'
			} else {
				return preablePrct + percentage.decimalPlaces(1).toString() + ' %'
			}
		} else {
			const value = value_ instanceof BigNumber ? value_ : new BigNumber(value_)
			return value.toFormat()
		}
	}
}
