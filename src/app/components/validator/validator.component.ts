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

import { Component, Input } from '@angular/core'
import * as blockies from 'ethereum-blockies'
import { getDisplayName, ValidatorState } from 'src/app/utils/ValidatorUtils'
import { UnitconvService } from '../../services/unitconv.service'
import { VDBManageValidatorsTableRow } from 'src/app/requests/types/validator_dashboard'

@Component({
	selector: 'app-validator',
	templateUrl: './validator.component.html',
	styleUrls: ['./validator.component.scss'],
})
export class ValidatorComponent {
	@Input() validator: VDBManageValidatorsTableRow
	@Input() first: boolean
	@Input() last: boolean
	@Input() selected: boolean

	name: string
	imgData: string

	state: string

	stateCss: string

	constructor(public unit: UnitconvService) {}

	ngOnChanges() {
		this.name = getDisplayName(this.validator)
		this.imgData = this.getBlockies()
		this.state = this.interpretState(this.validator)
		this.stateCss = this.interpretStateCss(this.validator)
	}

	private getBlockies() {
		// TODO: figure out why the first blockie image is always black
		blockies.create({ seed: this.validator.index + '' }).toDataURL()
		const dataurl = blockies.create({ seed: this.validator.index + '', size: 8, scale: 7 }).toDataURL()
		return dataurl
	}

	interpretState(item: VDBManageValidatorsTableRow) {
		switch (item.status) {
			case ValidatorState.ACTIVE_ONLINE:
				return 'Active'
			case ValidatorState.ACTIVE_OFFLINE:
				return 'Offline'
			case ValidatorState.SLASHED:
				return 'Slashed'
			case ValidatorState.EXITED:
				return 'Exited'
			case ValidatorState.PENDING:
				return 'Waiting for Activation'
			case ValidatorState.DEPOSITED:
				return 'Waiting for deposit processing'
			case ValidatorState.EXITING_ONLINE:
				return 'Exiting (Active)'
			case ValidatorState.EXITING_OFFLINE:
				return 'Exiting (Offline)'
			case ValidatorState.SLASHING_ONLINE:
				return 'Slashing (Active)'
			case ValidatorState.SLASHING_OFFLINE:
				return 'Slashing (Offline)'
			default:
				return 'Unknown'
		}
	}

	interpretStateCss(item: VDBManageValidatorsTableRow) {
		switch (item.status) {
			case ValidatorState.ACTIVE_ONLINE || ValidatorState.EXITING_ONLINE || ValidatorState.SLASHING_ONLINE:
				return 'online'
			case ValidatorState.ACTIVE_OFFLINE || ValidatorState.EXITING_OFFLINE || ValidatorState.SLASHING_OFFLINE:
				return 'offline'
			case ValidatorState.SLASHED:
				return 'slashed'
			case ValidatorState.EXITED:
				return 'exited'
			case ValidatorState.DEPOSITED:
				return 'waiting'
			case ValidatorState.PENDING:
				return 'waiting'
			default:
				return ''
		}
	}
}
