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

import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
	name: 'fadeoutpipe',
	standalone: false,
})
export class FadeoutpipePipe implements PipeTransform {
	transform(currentY: number, fullHide: number): number {
		if (currentY <= 0) return 1
		const opacity = 1 - currentY / fullHide
		if (opacity <= 0) return 0
		return opacity
	}
}

@Pipe({
	name: 'fadeinpipe',
	standalone: false,
})
export class FadeinpipePipe implements PipeTransform {
	transform(currentY: number, fullHide: number, offset = 0): number {
		currentY -= offset
		if (currentY <= 0) return 0
		const opacity = currentY / fullHide
		if (opacity >= 1) return 1
		return opacity
	}
}
