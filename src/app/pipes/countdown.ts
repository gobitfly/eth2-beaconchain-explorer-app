// Copyright (C) 2024 Bitfly GmbH
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
import { Pipe, PipeTransform, NgZone, ChangeDetectorRef, OnDestroy } from '@angular/core'
import { defaultFormattter } from './shortertimeago.pipe' // Import your shortertimeago pipe

@Pipe({
	name: 'countdown',
	pure: false,
	standalone: false,
})
export class CountdownPipe implements PipeTransform, OnDestroy {
	private timer: ReturnType<typeof setInterval> | null = null

	constructor(
		private changeDetector: ChangeDetectorRef,
		private ngZone: NgZone
	) {}

	transform(timestamp: number): string {
		this.clearTimer()

		const update = () => {
			// Use the shortertimeago pipe for formatting
			const result = defaultFormattter(Math.ceil(timestamp / 1000) * 1000 + 300) // 300ms buffer for better transition feel

			if (result.value == 0) {
				this.clearTimer()
				return 'in 1s'
			}

			const space = result.unit == 's' ? '' : ' '
			const prefix = result.suffix != 'ago' ? 'in ' : ''
			const postfix = result.suffix == 'ago' ? 'ago' : ''
			const formattedTime = prefix + result.value + space + result.unit + ' ' + postfix
			// Trigger change detection
			this.changeDetector.markForCheck()

			return formattedTime
		}

		this.ngZone.runOutsideAngular(() => {
			this.timer = setInterval(() => {
				this.ngZone.run(() => update())
			}, 1000)
		})

		return update()
	}

	private clearTimer() {
		if (this.timer) {
			clearInterval(this.timer)
			this.timer = null
		}
	}

	ngOnDestroy() {
		this.clearTimer()
	}
}
