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

import BigNumber from 'bignumber.js'

export function sumBigInt<T>(validators: T[], field: (cur: T) => BigNumber) {
	let sum = new BigNumber('0')

	validators.forEach((cur) => {
		const value = field(cur)
		if (value) {
			sum = sum.plus(value)
		}
	})
	return sum
}

export function findHighest<T>(
	validators: T[],
	field: (cur: T) => number
): number {
	var highest = Number.MIN_SAFE_INTEGER
	validators.forEach((cur) => {
		const resolvedField = field(cur)
		if (resolvedField > highest) highest = resolvedField
	})
	return highest
}

export function findLowest<T>(
	validators: T[],
	field: (cur: T) => number
): number {
	var lowest = Number.MAX_SAFE_INTEGER
	validators.forEach((cur) => {
		const resolvedField = field(cur)
		if (resolvedField < lowest) lowest = resolvedField
	})
	return lowest
}

export default class {}
