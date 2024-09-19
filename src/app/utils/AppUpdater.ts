// Copyright (C) 2024 Bitfly GmbH
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
// along with Beaconchain Dashboard.  If not, see <https://www.gnu.org/licenses/>.

import { Injectable } from "@angular/core"
import { CapacitorUpdater, DownloadOptions } from "@capgo/capacitor-updater"
import { ApiService } from "../services/api.service"
import { V2LatestAppBundle } from "../requests/v2-general"
import { AlertService } from "../services/alert.service"
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update'
import { App } from "@capacitor/app"
import versionInfo from '../../version.json'
import { Capacitor } from "@capacitor/core"

@Injectable({
	providedIn: 'root',
})
export class AppUpdater {
	private loading: HTMLIonLoadingElement

	constructor(
		private api: ApiService,
		private alert: AlertService
	) { }

	async check() {
		const currentBundle = this.getCurrentBundleCode()
		const currentNative = await this.getCurrentNativeVersionCode()
		console.log('Current App Version', versionInfo.buildNumber, currentNative)

		if (!Capacitor.isNativePlatform()) {
			console.info('non native, skipping updates')
			return false
		}

		const [hasNativeUpdate, latest] = await Promise.all([
			this.updateNative(),
			this.api.execute2(new V2LatestAppBundle(currentBundle, currentNative))
		])

		// Does it make sense to have a minimal api here so checking for updates still works even if
		// an update breaks the api service?
		// on the other hand needs api key, cloudflare handling and network specific handling as well...

		if (!hasNativeUpdate) {
			if (latest.error) {
				console.warn('Failed to check for updates', latest.error)
				return
			}

			if (latest.data.has_native_update_available) {
				console.warn('new native is available on server but not yet on system app store, ignoring for now')
				return
			}

			if (latest.data.bundle_url) {
				await this.updateBundle(latest.data.bundle_url)
			}
		}
	}

	private async updateNative(): Promise<boolean> {
		if (!Capacitor.isNativePlatform()) return false
		const result = await AppUpdate.getAppUpdateInfo()
		if (result.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
			return false
		}
		if (result.immediateUpdateAllowed) {
			await AppUpdate.performImmediateUpdate()
		} else {
			await this.alert.confirmDialog('Update available', 'An update is available, would you like to update the app?', 'Update', async () => {
				await AppUpdate.openAppStore()
			})
		}
		return true
	}

	async updateBundle(bundleURL: string) {
		this.loading = await this.alert.presentLoading('Updating...')
		this.loading.present()

		await CapacitorUpdater.addListener('download', (event) => {
			this.loading.message = 'Updating ' + event.percent + '%'
		})

		await  CapacitorUpdater.addListener('downloadComplete', () => {
			this.loading.message = 'Processing Update...'
		})

		await  CapacitorUpdater.addListener('updateFailed', () => {
			this.loading.dismiss()
			this.alert.showInfo('Update failed', 'Could not update the app, please try again later')
		})

		await CapacitorUpdater.addListener('downloadFailed', () => {
			this.loading.dismiss()
			this.alert.showInfo('Download failed', 'Could not download the update, please try again later')
		})
		
		try {
			const version = await CapacitorUpdater.download({
				url: bundleURL,
				version: versionInfo.formattedVersion, // even though this is the current version, this just needs to be present for reasons
			} as DownloadOptions)
			await CapacitorUpdater.set(version)
		} catch (e) {
			console.warn('could not update bundle', e)
			this.loading.dismiss()
		}
	}

	getCurrentBundleCode() {
		return versionInfo.buildNumber
	}

	async getCurrentNativeVersionCode() {
		try {
			return parseInt((await App.getInfo()).build)
		} catch (e) {
			console.warn('could not get native version code', e)
			return 0
		}
	}

	/**
	 * Use to display the current app version to the user
	 * @returns current formatted bundle version + native versionCode in parentheses
	 */
	async getFormattedCurrentVersion() {
		let nativeVersion = (await this.getCurrentNativeVersionCode()).toString()
		if (!Capacitor.isNativePlatform()) {
			nativeVersion = 'dev'
		}

		return versionInfo.formattedVersion + ' (' + nativeVersion + ')'
	}
}