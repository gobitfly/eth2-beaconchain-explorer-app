// Copyright (C) 2021 bitfly explorer GmbH
// Copyright (C) 2021 bitfly explorer GmbH
//
// This file is part of Beaconchain Dashboard.
//
// Beaconchain Dashboard is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Beaconchain Dashboard is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Beaconchain Dashboard.  If not, see <http://www.gnu.org/licenses/>.

import { ApiService } from '../services/api.service'
import { Injectable } from '@angular/core'
import { StorageService } from '../services/storage.service'
import { MigrateV1AuthToV2 } from '../requests/v2-auth'
import * as StorageTypes from '../models/StorageTypes'

const SETTING_MIGRATION_COMPLETED = 'migration_completed'

@Injectable({
	providedIn: 'root',
})
export default class V2Migrator {
	constructor(private api: ApiService, private storage: StorageService) {}

	async switchToV2(useV2: boolean) {
		await this.storage.setV2(useV2)
		await this.api.loadNetworkConfig()
	}

	async migrate() {
		// todo update in progress dialog?

		if (!(await this.storage.isV2())) {
			return // v2 api usage need to be enabled to start migration
		}

		if (await this.storage.getBooleanSetting(SETTING_MIGRATION_COMPLETED, false)) {
			return // migration already completed (non user accs)
		}

		if ((await this.storage.getAuthUserv2()).Session) {
			return // already migrated (user accs)
			// weird, migration not done but v2 session? todo
		}

		if ((await this.storage.getAuthUser()).accessToken) {
			// user has v1 access token, migrate session
			const sessionMigrated = await this.v1SessionToV2()
			if (!sessionMigrated) {
				console.error('session could not be migrated to v2')
				return // todo?
			}
		} else {
			// todo migrate non user acc users to v2
			// Free validator limit changed from 100 to 20(? reconfirm to be sure) so we need to check if user has more than 20 validators
			// and provide a ui for them to select which 20 validators they want to keep
		}

		// clear api cache
		// dialog: reload everything, maybe just app restart?

		this.storage.setBooleanSetting(SETTING_MIGRATION_COMPLETED, true)
	}

	isMigrationCompleted() {
		return this.storage.getBooleanSetting(SETTING_MIGRATION_COMPLETED, false)
	}

	private async v1SessionToV2() {
		const user = await this.storage.getAuthUser()
		if (!user || !user.refreshToken) {
			console.warn('No refreshtoken, cannot refresh token')
			return false
		}

		const loginRequest = new MigrateV1AuthToV2(user.refreshToken, await this.storage.getDeviceID(), await this.storage.getDeviceName())
		const response = await this.api.execute(loginRequest)
		const result = loginRequest.parse(response)
		console.log('eq exchange', response, result) // todo remove

		if (result.length != 1) {
			console.warn('Invalid response', response)
			return false
		}

		if (!result[0].session) {
			console.warn('No session found', response)
			return false
		}

		await this.storage.setAuthUserv2({
			Session: result[0].session,
		} as StorageTypes.AuthUserv2)
		await this.api.initialize()

		return true
	}
}
