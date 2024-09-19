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
		private appUpdater: AppUpdater
	) {
		this.initializeApp()
	}

	async initializeApp() {
		BigNumber.config({ DECIMAL_PLACES: 25 })
		await this.platform.ready()
		CapacitorUpdater.notifyAppReady() // call as soon as possible otherwise will rollback to last working bundle

		await this.appUpdater.check() // should we continue without waiting? do try catch above rest so updater will not be affected by errors
		await this.storage.migrateToCapacitor3()
		await this.v2Migrator.migrate()

		this.theme.init(() => {
			SplashScreen.hide()
		}) // just initialize the theme service

		this.setAndroidBackButtonBehavior()
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
