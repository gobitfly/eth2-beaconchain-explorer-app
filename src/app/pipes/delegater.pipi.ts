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
import { ProcessedStats } from '../controllers/MachineController'

@Pipe({
	name: 'delegate',
	standalone: false,
})
export class DelegatorPipe implements PipeTransform {
	// TODO: improve this typing, unknown not working when used with async pipe in template, investigate
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	transform(data: ProcessedStats | string, delegateMethod: (any: ProcessedStats | string) => any) {
		return delegateMethod(data)
	}
}
