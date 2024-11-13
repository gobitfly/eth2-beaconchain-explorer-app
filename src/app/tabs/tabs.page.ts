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

import { Component } from '@angular/core'
import FirebaseUtils, { pushLastTokenUpstream } from '../utils/FirebaseUtils'
import V2Migrator from '../utils/V2Migrator'
import { ApiService } from '../services/api.service'
import { StorageService } from '../services/storage.service'

@Component({
	selector: 'app-tabs',
	templateUrl: 'tabs.page.html',
	styleUrls: ['tabs.page.scss'],
})
export class TabsPage {
	constructor(
		private firebaseUtils: FirebaseUtils,
		private v2Migrator: V2Migrator,
		private storage: StorageService,
		private api: ApiService
	) {}

	ionViewDidEnter() {
		setTimeout(() => this.preload(), 500)
	}

	private preload() {
		setTimeout(() => {
			this.v2Migrator.showDeprecationNotice()
		}, 500)

		// lazy initiating firebase token exchange
		this.firebaseUtils.registerPush() // just initialize the firebaseutils service

		// lazy sync & notification token update
		setTimeout(() => {
			pushLastTokenUpstream(this.storage, this.api, false)
			// await this.sync.mightSyncUpAndSyncDelete()
			// await this.sync.syncAllSettings()
		}, 5000)
	}
}
