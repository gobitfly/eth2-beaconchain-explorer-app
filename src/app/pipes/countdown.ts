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
// along with Beaconchain Dashboard.  If not, see <https://www.gnu.org/licenses/>.import { Pipe, PipeTransform } from '@angular/core';
import { timer, Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { defaultFormattter } from './shortertimeago.pipe'
import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
	name: 'countdown',
	pure: true,
	standalone: false,
})
export class CountdownPipe implements PipeTransform {
	transform(timestamp: number): Observable<string> {
		// Create an observable that fires every 1000ms (1 second)
		return timer(0, 1000).pipe(
			map(() => {
				// Calculate the countdown string on each tick
				const result = defaultFormattter(Math.ceil(timestamp / 1000) * 1000)
				if (result.value === 0) {
					return 'in 1s'
				}
				const space = result.unit === 's' ? '' : ' '
				const prefix = result.suffix !== 'ago' ? 'in ' : ''
				const postfix = result.suffix === 'ago' ? 'ago' : ''
				return `${prefix}${result.value}${space}${result.unit} ${postfix}`
			})
		)
	}
}
