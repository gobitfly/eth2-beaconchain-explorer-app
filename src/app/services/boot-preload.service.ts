/*
 *  // Copyright (C) 2020 - 2021 Bitfly GmbH
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

import { Injectable } from '@angular/core'
import { ValidatorUtils } from '../utils/ValidatorUtils'
import ClientUpdateUtils from '../utils/ClientUpdateUtils'
import { BlockUtils } from '../utils/BlockUtils'

@Injectable({
	providedIn: 'root',
})
export class BootPreloadService {
	constructor(private validatorUtils: ValidatorUtils, private clientUpdateUtils: ClientUpdateUtils, private blockUtils: BlockUtils) {}

	preload() {
		try {
			this.validatorUtils.getAllMyValidators()
			this.clientUpdateUtils.checkAllUpdates()
			this.blockUtils.getMyBlocks(0) // preload blocks
		} catch (e) {
			console.warn('can not preload', e)
		}
	}
}
