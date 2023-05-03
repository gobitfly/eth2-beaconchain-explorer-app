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

const POSITIVE = 'positive-value'
const WARNING = 'warn-value'
const NEGATIVE = 'negative-value'

@Pipe({
	name: 'valuestyle',
})
export class ValuestylePipe implements PipeTransform {
	transform(tempvalue: number | string | BigNumber, ...args: (number | BigNumber)[]): string {
		const value = tempvalue instanceof BigNumber ? tempvalue : new BigNumber(tempvalue)
		const firstDrop = args[0] instanceof BigNumber ? args[0] : new BigNumber(args[0])

		if (args.length == 2) {
			const secondDrop = args[1] instanceof BigNumber ? args[1] : new BigNumber(args[1])
			if (value.isGreaterThanOrEqualTo(firstDrop)) return POSITIVE
			else if (value.isGreaterThanOrEqualTo(secondDrop)) return WARNING
			else return NEGATIVE
		} else if (args.length == 3) {
			if (args[2] == -1) {
				// between
				const secondDrop = args[1] instanceof BigNumber ? args[1] : new BigNumber(args[1])
				if (value.isLessThanOrEqualTo(firstDrop)) return NEGATIVE
				if (value.isGreaterThanOrEqualTo(secondDrop)) return NEGATIVE
				return POSITIVE
			}
		}

		if (value.isGreaterThanOrEqualTo(firstDrop)) return POSITIVE
		else return NEGATIVE
	}
}
