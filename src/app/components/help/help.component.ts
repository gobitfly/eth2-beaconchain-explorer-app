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
import { Browser } from '@capacitor/browser'
import { ApiService } from 'src/app/services/api.service'

@Component({
	selector: 'app-help',
	templateUrl: './help.component.html',
	styleUrls: ['./help.component.scss'],
	standalone: false,
})
export class HelpComponent implements OnInit {
	@Input() onlyGuides: boolean
	isAlreadyLoggedIn = false

	isGnosis: boolean

	private ethereumNetworkKey: string

	constructor(
		private oauthUtils: OAuthUtils,
		private storage: StorageService,
		private router: Router,
		public api: ApiService
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

	async openBrowser(link: string) {
		await Browser.open({ url: link, toolbarColor: '#2f2e42' })
	}

	async login() {
		await this.oauthUtils.login()
		const loggedIn = await this.storage.isLoggedIn()

		if (loggedIn) {
			this.isAlreadyLoggedIn = true
			const hasValidators = !!(await this.storage.getDashboardID())
			if (!hasValidators) this.router.navigate(['/tabs/validators'])
		}
	}
}
