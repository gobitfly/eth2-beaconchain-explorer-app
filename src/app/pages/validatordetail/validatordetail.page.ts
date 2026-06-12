/*
 *  // Copyright (C) 2020 - 2021 bitfly explorer GmbH
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
import { ValidatorUtils, Validator, getDisplayName, SAVED } from '../../utils/ValidatorUtils'
import { ModalController } from '@ionic/angular'
import OverviewController, { OverviewData } from '../../controllers/OverviewController'
import { fromEvent, Subscription } from 'rxjs'
import { MerchantUtils } from 'src/app/utils/MerchantUtils'
import { UnitconvService } from 'src/app/services/unitconv.service'
import { ApiService } from 'src/app/services/api.service'

@Component({
	selector: 'app-validatordetail',
	templateUrl: './validatordetail.page.html',
	styleUrls: ['./validatordetail.page.scss'],
})
export class ValidatordetailPage implements OnInit {
	@Input() item: Validator
	name: string

	data: OverviewData

	tagged = false

	currentY = 0

	private backbuttonSubscription: Subscription

	scrolling = false

	constructor(
		private validatorUtils: ValidatorUtils,
		private modalCtrl: ModalController,
		private merchant: MerchantUtils,
		private unit: UnitconvService,
		private api: ApiService
	) {}

	setInput(validator: Validator) {
		this.item = validator
	}

	ngOnInit() {
		const event = fromEvent(document, 'backbutton')
		this.backbuttonSubscription = event.subscribe(() => {
			this.modalCtrl.dismiss()
		})
		this.updateDetails(this.item)
		this.tagged = this.item.storage == SAVED
	}

	ngOnChanges() {
		this.updateDetails(this.item)
	}

	onScroll($event) {
		this.currentY = $event.detail.currentY
	}

	onScrollStarted() {
		this.scrolling = true
	}

	onScrollEnded() {
		this.scrolling = false
	}

	ngOnDestroy() {
		this.backbuttonSubscription.unsubscribe()
	}

	closeModal() {
		this.modalCtrl.dismiss()
	}

	async updateDetails(item: Validator) {
		this.name = getDisplayName(item)

		const epoch = await this.validatorUtils.getRemoteCurrentEpoch()
		const overviewController = new OverviewController(null, await this.merchant.getCurrentPlanMaxValidator(), this.unit)
		this.data = overviewController.processDetail([item], epoch, this.api.getNetwork())
	}

	tag() {
		this.validatorUtils.convertToValidatorModelAndSaveValidatorLocal(false, this.item.data)
		this.tagged = true
	}

	untag() {
		this.validatorUtils.deleteValidatorLocal(this.item.data)
		this.tagged = false
	}
}
