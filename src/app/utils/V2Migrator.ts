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
import { ValidatorUtils } from './ValidatorUtils'
import { DashboardUtils } from './DashboardUtils'
import { AlertService } from '../services/alert.service'
import { MerchantUtils } from './MerchantUtils'

const SETTING_MIGRATION_COMPLETED = 'migration_completed'

@Injectable({
	providedIn: 'root',
})
export default class V2Migrator {
	constructor(
		private api: ApiService,
		private storage: StorageService,
		private validatorUtils: ValidatorUtils,
		private dashboardUtils: DashboardUtils,
		private alert: AlertService,
		private merchant: MerchantUtils
	) { }

	async switchToV2(useV2: boolean) {
		await this.storage.setV2(useV2)
		await this.api.loadNetworkConfig()
	}

	async showDeprecationNotice() {
		const deprecationNoiceKey = 'deprecation_info_seen'
		if (await this.storage.getBooleanSetting(deprecationNoiceKey, false)) {
			return
		}
		this.storage.setBooleanSetting(deprecationNoiceKey, true)

		let deprecationList = ''
		const stakeShareUser = await this.validatorUtils.wasStakeShareUser()
		const gnosisUser = await this.validatorUtils.wasGnosisUser()

		if (!stakeShareUser && !gnosisUser) {
			return
		}

		if (stakeShareUser) {
			deprecationList += `<br/><br/>- Stake Share, the partial validator ownership feature, has been removed. 
			We value your privacy and specifically made this app without any trackers, but this also means that we have no insight into how much this feature was actually used. 
			We rely on your feedback, so please let us know if you miss this feature and whether we should spend our resources on bringing it back.`
		}

		if (gnosisUser) {
			deprecationList += `<br/><br/>- Gnosis Chain support has been <strong>temporarily</strong> removed. 
			As beaconcha.in v2 is such a big overhaul to our entire infrastructure, we had to make some tough decisions on what to include in this first release.
			We know that this is a big inconvenience for some of you and we are hard at work to bring back support within the next couple of weeks and months.`
		}

		this.alert.showInfo(
			'Deprecation Notice',
			`Thank you for using Beaconchain Dashboard, we hope you enjoy the update!<br/><br/>
			Unfortunately, some features of the old app version did not make it to the new version:` + deprecationList
		)
	}

	async migrate() {
		if (await this.storage.getBooleanSetting(SETTING_MIGRATION_COMPLETED, false)) {
			return
		}

		let v1UserFound = false
		let v1DashboardsFound = false

		// Pre-Stage 1: check if we have local v1 dashboards
		const localValidatorIndex = await this.validatorUtils.getMyLocalValidators()
		if (localValidatorIndex.length > 0) {
			console.log('migrator, found local validators', localValidatorIndex)
			v1DashboardsFound = true
		}

		// Pre-Stage 2: check if we have a v1 user session
		const v1User = await this.storage.getAuthUser()
		if (v1User && v1User.accessToken) {
			v1UserFound = true
		}

		// early exit, nothing to migrate
		if (!v1DashboardsFound && !v1UserFound) {
			console.info('migrator, nothing to migrate')
			await this.switchToV2(true)
			await this.storage.setBooleanSetting(SETTING_MIGRATION_COMPLETED, true)
			return
		}

		// ----- Actual migration -----

		let userHasBeenLoggedOut = false
		let notAllValidatorsMigrated = false

		const loading = await this.alert.presentLoading('Updating app...')
		loading.present()

		// -- Happens on v1 api --

		// Stage 1: Start at v1 api, check if user is present, try to refresh token and switch to v2
		// or just switch to v2
		if (!(await this.storage.isV2())) {
			console.log('migrator, not on v2 api, running v1 checks')
			if (v1UserFound) {
				console.log('migrator, v1 user found, refreshing token')
				const result = await this.api.refreshToken()
				if (!result) {
					console.warn('migrator, could refresh v1 session, logging user out', result)
					userHasBeenLoggedOut = true
				}
			}
		}
		
		// -- Happens on v2 api --
		await this.switchToV2(true)
		console.log("migrator, switched to v2 api")

		// Stage 2: migrate v1 user session to v2 user session
		if (v1UserFound && !(await this.storage.getAuthUserv2()).Session) {
			console.log('migrator, unmigrated v1 session found, migrating to v2')
			const sessionMigrated = await this.v1SessionToV2()
			if (!sessionMigrated) {
				console.warn('migrator, could not migrate v1 session to v2, logging user out')
				userHasBeenLoggedOut = true
			}
		}
		this.storage.setAuthUser(null)

		// Stage 3: migrate v1 dashboards to v2 dashboards
		if (v1DashboardsFound) {
			console.log('migrator, v1 dashboards found, migrating to v2')
			// init dashboards: load dashboards or create a default one if not present
			await this.dashboardUtils.initDashboard()

			// adds v1 validators to v2 dashboard
			// note: if user has more validators than free limit, we add the first 20 validators
			// todo: do I need to truncate or does the api? todo: correctly set notAllValidatorsMigrated
			const ok = await this.dashboardUtils.addValidators(localValidatorIndex, 0)
			if (ok) {
				console.warn("migrator, not all validators or none could be migrated")
				notAllValidatorsMigrated = true
			}
		}

		loading.dismiss()

		let additional = ''
		if (userHasBeenLoggedOut || notAllValidatorsMigrated) {
			additional += '<br/><br/>Some data could not be migrated:'
		}
		if (userHasBeenLoggedOut) {
			additional += '<br/><br/>- You have been logged.'
		}
		if (notAllValidatorsMigrated) {
			additional += `<br/><br/>- We couldn't take all your validators with us. You'll find a full backup of your validators in the new 'Manage Dashboards' section.`
		}

		this.alert.noChoiceDialog('Completed', 'The app will restart itself.' + additional, () => {
			this.merchant.restartApp()
		})

		console.info('migrator, migration completed')
		this.storage.setBooleanSetting(SETTING_MIGRATION_COMPLETED, true)
	}

	isMigrationCompleted() {
		return this.storage.getBooleanSetting(SETTING_MIGRATION_COMPLETED, false)
	}

	private async v1SessionToV2() {
		const user = await this.storage.getAuthUser()
		if (!user || !user.refreshToken) {
			console.warn('migrator, no refreshtoken, cannot refresh token')
			return false
		}

		await this.api.getLatestState(true) // get csrf token

		const loginRequest = new MigrateV1AuthToV2(user.refreshToken, await this.storage.getDeviceID(), await this.storage.getDeviceName())
		const response = await this.api.execute(loginRequest)
		const result = loginRequest.parse(response)
		console.log('migrator, v1SessionToV2 eq exchange', response, result) // todo remove

		if (result.length != 1) {
			console.warn('migrator, invalid response', response)
			return false
		}

		if (!result[0].session) {
			console.warn('migrator, no session found', response)
			return false
		}

		await this.storage.setAuthUserv2({
			Session: result[0].session,
		} as StorageTypes.AuthUserv2)
		await this.api.initialize()
		console.info("migrator, v1 session successfully migrated to v2")

		return true
	}
}
