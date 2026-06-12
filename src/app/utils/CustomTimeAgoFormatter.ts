/*
 *  // Copyright (C) 2020 - 2021 bitfly explorer GmbH
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

import { TimeagoFormatter } from 'ngx-timeago'
import { Injectable } from '@angular/core'

export type Unit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
export type Suffix = 'ago' | 'from now'

export type StringOrFn = ((value: number, millisDelta: number) => string) | string

export type NumberArray = [string, string, string, string, string, string, string, string, string, string]

export const MINUTE = 60
export const HOUR = MINUTE * 60
export const DAY = HOUR * 24
export const WEEK = DAY * 7
export const MONTH = DAY * 30
export const YEAR = DAY * 365

const defaultFormattter = function (then: number): { value: number; unit: Unit; suffix: Suffix } {
	const now = Date.now()
	const seconds = Math.round(Math.abs(now - then) / 1000)
	const suffix: Suffix = then < now ? 'ago' : 'from now'

	const [value, unit]: [number, Unit] =
		seconds < MINUTE
			? [Math.round(seconds), 'second']
			: seconds < HOUR
			? [Math.round(seconds / MINUTE), 'minute']
			: seconds < DAY
			? [Math.round(seconds / HOUR), 'hour']
			: seconds < WEEK
			? [Math.round(seconds / DAY), 'day']
			: seconds < MONTH
			? [Math.round(seconds / WEEK), 'week']
			: seconds < YEAR
			? [Math.round(seconds / MONTH), 'month']
			: [Math.round(seconds / YEAR), 'year']

	return { value, unit, suffix }
}

@Injectable()
export class CustomTimeAgoFormatter extends TimeagoFormatter {
	format(then: number): string {
		const { suffix, value, unit } = defaultFormattter(then)
		return this.parse(value, unit, suffix)
	}

	private parse(value: number, unit: Unit, suffix: Suffix): string {
		if (value < 60 && unit == 'second') {
			return 'a few seconds ' + suffix
		}
		if (value !== 1) {
			unit += 's'
		}
		return value + ' ' + unit + ' ' + suffix
	}
}
