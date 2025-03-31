// Copyright (C) 2024 bitfly explorer GmbH
//
// This file is part of Beaconchain Dashboard.
//
// Beaconchain Dashboard is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Beaconchain Dashboard is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Beaconchain Dashboard.  If not, see <https://www.gnu.org/licenses/>.

import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
	name: 'shortertimeago',
	standalone: false,
})
export class ShorterTimeAgo implements PipeTransform {
	transform(ts: number): string {
		const result = defaultFormattter(ts)
		return result.value + '' + result.unit + ' ' + result.suffix
	}
}

export type Unit = 's' | 'min' | 'h' | 'd' | 'w' | 'm' | 'y'
export type Suffix = 'ago' | 'from now'

export type StringOrFn = ((value: number, millisDelta: number) => string) | string

export type NumberArray = [string, string, string, string, string, string, string, string, string, string]

export const MINUTE = 60
export const HOUR = MINUTE * 60
export const DAY = HOUR * 24
export const WEEK = DAY * 7
export const MONTH = DAY * 30
export const YEAR = DAY * 365

export const defaultFormattter = function (then: number): { value: number; unit: Unit; suffix: Suffix } {
	const now = Date.now()
	const seconds = Math.round(Math.abs(now - then) / 1000)
	const suffix: Suffix = then < now ? 'ago' : 'from now'

	const [value, unit]: [number, Unit] =
		seconds < MINUTE
			? [Math.round(seconds), 's']
			: seconds < HOUR
				? [Math.round(seconds / MINUTE), 'min']
				: seconds < DAY
					? [Math.round(seconds / HOUR), 'h']
					: seconds < WEEK
						? [Math.round(seconds / DAY), 'd']
						: seconds < MONTH
							? [Math.round(seconds / WEEK), 'w']
							: seconds < YEAR
								? [Math.round(seconds / MONTH), 'm']
								: [Math.round(seconds / YEAR), 'y']

	return { value, unit, suffix }
}
