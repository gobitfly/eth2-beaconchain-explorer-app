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

import { ModalController, Platform } from '@ionic/angular'
import ThemeUtils from './utils/ThemeUtils'
import { SplashScreen } from '@capacitor/splash-screen'
import { StorageService } from './services/storage.service'
import BigNumber from 'bignumber.js'
import V2Migrator from './utils/V2Migrator'
import { App } from '@capacitor/app'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { AppUpdater } from './utils/AppUpdater'
import { environment } from 'src/environments/environment'
import { findConfigForKey } from './utils/NetworkData'
import { ApiService } from './services/api.service'
import { Toast } from '@capacitor/toast'

@Component({
	selector: 'app-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
})
export class AppComponent {
	static PREVENT_BACK_PRESS = false

	constructor(
		private platform: Platform,
		private theme: ThemeUtils,
		private modalController: ModalController,
		private storage: StorageService,
		private v2Migrator: V2Migrator,
		private appUpdater: AppUpdater,
		private api: ApiService
	) {
		this.initializeApp()
	}

	async initializeApp() {
		BigNumber.config({ DECIMAL_PLACES: 25 })
		await this.platform.ready()
		await CapacitorUpdater.notifyAppReady() // call as soon as possible otherwise will rollback to last working bundle

		try {
			await this.appUpdater.checkForNewNative()
			this.appUpdater.check() // do not wait
		} catch (e) {
			console.error('Failed to check for updates', e)
		}

		try {
			await this.storage.migrateToCapacitor3()
			if (environment.debug_set_default_network.length > 0) {
				const completed = await this.storage.getBooleanSetting('debug_change_network', false)
				if (!completed) {
					this.storage.setBooleanSetting('debug_change_network', true)
					const newConfig = findConfigForKey(environment.debug_set_default_network)

					await this.storage.setNetworkPreferences(newConfig)
					await this.api.initialize()
					Toast.show({
						text: `Beta: Network changed to ${newConfig.name} v2`,
						duration: 'long',
					})
				}
			}
			await this.v2Migrator.migrate()

			this.theme.init(() => {
				SplashScreen.hide()
			}) // just initialize the theme service

			this.setAndroidBackButtonBehavior()
		} catch (e) {
			console.error('Failed to initialize app', e)
		}
	}

	ngAfterViewInit() {
		// Set up a mutation observer
		const observer = new MutationObserver((mutationsList) => {
			mutationsList.forEach((mutation) => {
				if (mutation.addedNodes.length > 0) {
					this.cleanUpPopoverContainers()
				}
			})
		})

		// Start observing the entire body for any DOM changes
		observer.observe(document.body, { childList: true, subtree: true })
	}

	cleanUpPopoverContainers() {
		// Fix ionic bug of popover-viewport inside popover-viewport
		const popoverContainers = document.querySelectorAll('.popover-viewport')

		popoverContainers.forEach((popover) => {
			const viewPort1 = popover?.querySelector('.popover-viewport')
			viewPort1?.remove()
		})
	}

	private setAndroidBackButtonBehavior(): void {
		if (this.platform.is('android')) {
			this.platform.backButton.subscribe(async () => {
				const isModalOpened = await this.modalController.getTop()
				if (window.location.pathname.startsWith('/tabs') && !isModalOpened && !AppComponent.PREVENT_BACK_PRESS) {
					App.exitApp()
				}
			})
		}
	}
}
