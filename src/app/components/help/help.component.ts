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

import { Component, OnInit, Input } from '@angular/core'
import { Router } from '@angular/router'
import { StorageService } from 'src/app/services/storage.service'
import { OAuthUtils } from 'src/app/utils/OAuthUtils'
import { ValidatorUtils } from 'src/app/utils/ValidatorUtils'

import { Browser } from '@capacitor/browser'
import { ApiService } from 'src/app/services/api.service'
import { changeNetwork } from 'src/app/tab-preferences/tab-preferences.page'
import { UnitconvService } from 'src/app/services/unitconv.service'
import { NotificationBase } from 'src/app/tab-preferences/notification-base'
import ThemeUtils from 'src/app/utils/ThemeUtils'
import { AlertService } from 'src/app/services/alert.service'
import { MerchantUtils } from 'src/app/utils/MerchantUtils'

@Component({
	selector: 'app-help',
	templateUrl: './help.component.html',
	styleUrls: ['./help.component.scss'],
})
export class HelpComponent implements OnInit {
	@Input() onlyGuides: boolean
	isAlreadyLoggedIn = false

	isGnosis: boolean

	private ethereumNetworkKey: string

	constructor(
		private oauthUtils: OAuthUtils,
		private validator: ValidatorUtils,
		private storage: StorageService,
		private router: Router,
		public api: ApiService,
		private validatorUtils: ValidatorUtils,
		private unit: UnitconvService,
		private notificationBase: NotificationBase,
		private theme: ThemeUtils,
		private alert: AlertService,
		private merchant: MerchantUtils
	) {}

	ngOnInit() {
		this.storage.isLoggedIn().then((result) => {
			this.isAlreadyLoggedIn = result
		})
		this.isGnosis = this.api.isGnosis()
		this.ethereumNetworkKey = this.api.getNetwork().key
		if (this.ethereumNetworkKey == 'gnosis') {
			this.ethereumNetworkKey = 'main'
		}
	}

	async openBrowser(link) {
		await Browser.open({ url: link, toolbarColor: '#2f2e42' })
	}

	async login() {
		await this.oauthUtils.login()
		const loggedIn = await this.storage.isLoggedIn()

		if (loggedIn) {
			this.isAlreadyLoggedIn = true
			const hasValidators = await this.validator.hasLocalValdiators()
			if (!hasValidators) this.router.navigate(['/tabs/validators'])
		}
	}

	async switchNetwork() {
		await changeNetwork(
			this.api.isGnosis() ? this.ethereumNetworkKey : 'gnosis',
			this.storage,
			this.api,
			this.validatorUtils,
			this.unit,
			this.notificationBase,
			this.theme,
			this.alert,
			this.merchant,
			true
		)
		this.isGnosis = this.api.isGnosis()
	}
}
