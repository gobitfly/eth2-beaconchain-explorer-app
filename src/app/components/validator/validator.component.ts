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

import { Component, OnInit, Input } from '@angular/core'
import { ValidatorResponse } from 'src/app/requests/requests'
import * as blockies from 'ethereum-blockies'
import { ValidatorUtils, SAVED, getDisplayName, Validator, ValidatorState } from 'src/app/utils/ValidatorUtils'
import { UnitconvService } from '../../services/unitconv.service'
import { AlertService } from 'src/app/services/alert.service'
import BigNumber from 'bignumber.js'
import OverviewController from 'src/app/controllers/OverviewController'

@Component({
	selector: 'app-validator',
	templateUrl: './validator.component.html',
	styleUrls: ['./validator.component.scss'],
})
export class ValidatorComponent implements OnInit {
	fadeIn = 'fade-in'

	@Input() validator: Validator

	data: ValidatorResponse
	name: string
	imgData: string

	tagged: boolean

	state: string

	stateCss: string

	balance = null

	overviewController = new OverviewController()

	constructor(private validatorUtils: ValidatorUtils, public unit: UnitconvService, private alerts: AlertService) {}

	ngOnChanges() {
		this.data = this.validator.data
		this.balance = this.calculateBalanceShare(this.validator)

		this.name = getDisplayName(this.validator)
		this.imgData = this.getBlockies()
		this.tagged = this.validator.storage == SAVED
		this.state = this.interpretState(this.validator)
		this.stateCss = this.interpretStateCss(this.validator)
	}

	setInput(validator: Validator) {
		this.validator = validator
		this.data = validator.data
		this.balance = this.calculateBalanceShare(this.validator)
	}

	calculateBalanceShare(validator) {
		return this.overviewController.sumBigIntBalanceRP([validator], (cur) => new BigNumber(cur.data.balance))
	}

	ngOnInit() {
		setTimeout(() => {
			this.fadeIn = null
		}, 500)
	}

	tag(event) {
		event.stopPropagation()
		this.validatorUtils.convertToValidatorModelAndSaveValidatorLocal(false, this.data)
		this.tagged = true
	}

	untag(event) {
		event.stopPropagation()

		this.alerts.confirmDialog('Remove validator', 'Do you want to remove this validator?', 'Delete', () => {
			this.confirmUntag()
		})
	}

	private confirmUntag() {
		this.validatorUtils.deleteValidatorLocal(this.data)
		this.tagged = false
	}

	private getBlockies() {
		// TODO: figure out why the first blockie image is always black
		blockies.create({ seed: this.data.pubkey }).toDataURL()
		const dataurl = blockies.create({ seed: this.data.pubkey, size: 8, scale: 7 }).toDataURL()
		return dataurl
	}

	interpretState(item: Validator) {
		switch (item.state) {
			case ValidatorState.ACTIVE:
				return 'Active'
			case ValidatorState.OFFLINE:
				return 'Offline'
			case ValidatorState.SLASHED:
				return 'Slashed'
			case ValidatorState.EXITED:
				return 'Exited'
			case ValidatorState.WAITING:
				return 'Waiting for Activation'
			case ValidatorState.ELIGABLE:
				return 'Waiting for deposit processing'
			default:
				return 'Unknown'
		}
	}

	interpretStateCss(item: Validator) {
		switch (item.state) {
			case ValidatorState.ACTIVE:
				return 'online'
			case ValidatorState.OFFLINE:
				return 'offline'
			case ValidatorState.SLASHED:
				return 'slashed'
			case ValidatorState.EXITED:
				return 'exited'
			case ValidatorState.WAITING:
				return 'waiting'
			case ValidatorState.ELIGABLE:
				return 'waiting'
			default:
				return ''
		}
	}
}
