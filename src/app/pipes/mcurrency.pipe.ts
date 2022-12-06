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
import { UnitconvService } from '../services/unitconv.service'

@Pipe({
	name: 'mcurrency',
})
export class McurrencyPipe implements PipeTransform {
	constructor(private unit: UnitconvService) {}

	transform(value: BigNumber | number | string, ...args: unknown[]): BigNumber | string | number {
		const displayAble = args.length == 2
		return this.unit.convert(value, args[0] as string, args[1] as string, displayAble)
	}
}
