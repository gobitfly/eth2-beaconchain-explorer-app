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

import { NgModule, Pipe, PipeTransform } from '@angular/core'

import { McurrencyPipe } from './mcurrency.pipe'
import { ValuestylePipe } from './valuestyle.pipe'
import { PercentageabsPipe } from './percentageabs.pipe'
import { FadeinpipePipe, FadeoutpipePipe } from './fadeoutpipe.pipe'
import { TimeagoModule, TimeagoFormatter } from 'ngx-timeago'
import { CustomTimeAgoFormatter } from '@utils/CustomTimeAgoFormatter'
import { DelegatorPipe } from './delegater.pipi'
import { ShorterTimeAgo } from './shortertimeago.pipe'
import { CountdownPipe } from './countdown'

@Pipe({
	name: 'subSecondsToTime',
	standalone: false,
})
export class SubSecondsToTime implements PipeTransform {
	transform(ts: number): string {
		if (ts > 1000 * 60 * 60 * 24) {
			return 'Full History'
		}

		const seconds = Math.floor(ts)
		const minutes = Math.floor(seconds / 60)
		const hours = Math.floor(minutes / 60)
		const days = Math.floor(hours / 24)

		if (days > 0) {
			return days > 1 ? `${days} days` : '1 day'
		} else if (hours > 0) {
			return hours > 1 ? `${hours} hours` : '1 hour'
		} else if (minutes > 0) {
			return minutes > 1 ? `${minutes} minutes` : '1 minute'
		} else {
			return seconds > 1 ? `${seconds} seconds` : '1 second'
		}
	}
}

@NgModule({
	imports: [TimeagoModule.forRoot({ formatter: { provide: TimeagoFormatter, useClass: CustomTimeAgoFormatter } })],
	declarations: [
		McurrencyPipe,
		ValuestylePipe,
		PercentageabsPipe,
		FadeoutpipePipe,
		CountdownPipe,
		FadeinpipePipe,
		DelegatorPipe,
		ShorterTimeAgo,
		SubSecondsToTime,
	],
	exports: [
		McurrencyPipe,
		ValuestylePipe,
		PercentageabsPipe,
		FadeoutpipePipe,
		FadeinpipePipe,
		DelegatorPipe,
		TimeagoModule,
		ShorterTimeAgo,
		SubSecondsToTime,
		CountdownPipe,
	],
})
export class PipesModule {}
