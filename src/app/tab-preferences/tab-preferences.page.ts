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

import { Component } from '@angular/core'
import { ApiService } from '../services/api.service'
import { StorageService } from '../services/storage.service'
import { UnitconvService } from '../services/unitconv.service'
import { OAuthUtils } from '../utils/OAuthUtils'
import ClientUpdateUtils from '../utils/ClientUpdateUtils'
import ThemeUtils from '../utils/ThemeUtils'
import { findConfigForKey } from '../utils/NetworkData'
import { ModalController } from '@ionic/angular'
import { HelppagePage } from '../pages/helppage/helppage.page'
import { ValidatorUtils } from '../utils/ValidatorUtils'
import Unit, { MAPPING } from '../utils/EthereumUnits'
import { AlertController } from '@ionic/angular'

import FirebaseUtils from '../utils/FirebaseUtils'
import { Platform } from '@ionic/angular'
import { AlertService } from '../services/alert.service'
import { SyncService } from '../services/sync.service'
import { LicencesPage } from '../pages/licences/licences.page'
import { SubscribePage } from '../pages/subscribe/subscribe.page'
import { MerchantUtils, PRODUCT_STANDARD } from '../utils/MerchantUtils'
import { NotificationBase } from './notification-base'
import { Router } from '@angular/router'

import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Toast } from '@capacitor/toast'
import { MergeChecklistPage } from '../pages/merge-checklist/merge-checklist.page'
import { ClientsPage } from '../pages/clients/clients.page'
import FlavorUtils from '../utils/FlavorUtils'
import { Capacitor } from '@capacitor/core'
import { trigger, style, animate, transition } from '@angular/animations'
@Component({
	selector: 'app-tab3',
	templateUrl: 'tab-preferences.page.html',
	styleUrls: ['tab-preferences.page.scss'],
	animations: [trigger('fadeIn', [transition(':enter', [style({ opacity: 0 }), animate('300ms 100ms', style({ opacity: 1 }))])])],
})
export class Tab3Page {
	darkMode: boolean

	network = 'main'

	allTestNetworks: string[][]

	authUser

	updateChannel: string

	allCurrencies

	appVersion: string

	debug = false

	snowing: boolean

	themeColor: string
	currentPlan: string

	premiumLabel = ''

	protected package = ''

	constructor(
		protected api: ApiService,
		protected oauth: OAuthUtils,
		public theme: ThemeUtils,
		public unit: UnitconvService,
		protected storage: StorageService,
		protected updateUtils: ClientUpdateUtils,
		protected validatorUtils: ValidatorUtils,
		protected modalController: ModalController,
		protected alertController: AlertController,
		protected firebaseUtils: FirebaseUtils,
		public platform: Platform,
		protected alerts: AlertService,
		protected sync: SyncService,
		protected merchant: MerchantUtils,
		public notificationBase: NotificationBase,
		private router: Router,
		private flavor: FlavorUtils
	) {}

	ngOnInit() {
		this.theme.isDarkThemed().then((result) => (this.darkMode = result))

		this.theme.getThemeColor().then((result) => (this.themeColor = result))

		this.updateUtils.getClient('ROCKETPOOL').then((result) => {
			this.notificationBase.setClientToggleState('ROCKETPOOL', result && result.toUpperCase() == 'ROCKETPOOL')
		})
		this.updateUtils.getClient('MEV-BOOST').then((result) => {
			this.notificationBase.setClientToggleState('MEV-BOOST', result && result.toUpperCase() == 'MEV-BOOST')
		})
		this.updateUtils.getUpdateChannel().then((result) => (this.updateChannel = result))

		this.theme.isWinterEnabled().then((result) => (this.snowing = result))

		this.allCurrencies = this.getAllCurrencies()
		this.api.getAllTestNetNames().then((result) => {
			this.allTestNetworks = result
		})

		if (Capacitor.isNativePlatform()) {
			App.getInfo().then((result) => {
				this.appVersion = result.version
			})
		} else {
			this.appVersion = 'dev'
		}

		this.flavor.isBetaFlavor().then((result) => {
			if (result) {
				this.package = 'INTERNAL BETA'
			}
		})

		this.flavor.isNoGoogleFlavor().then((result) => {
			if (result) {
				this.package = 'Googleless Edition'
			}
		})

		this.merchant.getCurrentPlanConfirmed().then((result) => {
			this.currentPlan = result
			if (this.currentPlan != PRODUCT_STANDARD) {
				this.premiumLabel = ' - ' + this.api.capitalize(this.currentPlan)
			}
		})
		this.notificationBase.disableToggleLock()

		this.updateUtils.convertOldToNewClientSettings()
	}

	async goToNotificationPage() {
		await this.sync.syncAllSettings(true)
		this.router.navigate(['/notifications'])
	}

	async openClientsPage(identifier: string) {
		const modal = await this.modalController.create({
			component: ClientsPage,
			cssClass: 'my-custom-class',
			componentProps: {
				clientIdentifier: identifier,
			},
		})

		return await modal.present()
	}

	themeColorLock = false
	changeThemeColor() {
		this.themeColorLock = true
		this.theme.undoColor()
		setTimeout(() => {
			this.theme.toggle(this.darkMode, true, this.themeColor)
			this.themeColorLock = false
		}, 250)
	}

	widgetSetupInfo() {
		if (this.currentPlan == 'standard' || this.currentPlan == 'plankton') {
			this.openUpgrades()
			return
		}

		let tutorialText = 'MISSINGNO'
		if (this.platform.is('ios')) {
			tutorialText =
				'1. Go to your homescreen<br/>' +
				'2. Hold down on an empty space<br/>' +
				'3. On the top right corner, click the + symbol<br/>' +
				'4. Scroll down and select Beaconchain Dashboard and chose your widget<br/>' +
				'<br/>You can configure your widget by holding down on the widget.<br/><br/>' +
				'Widgets are only available on iOS 14 or newer<br/><br/>' +
				'If you just purchased a premium package and the widget does not show any data, try deleting it and adding the widget again.'
		} else {
			tutorialText =
				'1. Go to your homescreen<br/>' +
				'2. Hold down on an empty space<br/>' +
				"3. Click on 'Widgets'<br/>" +
				'4. Scroll down and select Beaconchain Dashboard and chose your widget<br/><br/>' +
				'If you just purchased a premium package and the widget does not show any data, try deleting it and adding the widget again.'
		}

		this.alerts.showInfo('Widget Setup', tutorialText, 'bigger-alert')
	}

	ionViewWillEnter() {
		this.storage.getAuthUser().then((result) => (this.authUser = result))
		this.debug = this.api.debug
		this.network = this.api.getNetworkName()
	}

	private getAllCurrencies() {
		const erg = []
		MAPPING.forEach((value: Unit, key) => {
			if (value.settingName) {
				erg.push([[value.settingName], [key]])
			}
		})
		return erg
	}

	darkModeToggle() {
		this.theme.toggle(this.darkMode)
	}

	overrideDisplayCurrency = null
	private changeCurrencyLocked = false
	changeCurrency() {
		if (this.changeCurrencyLocked) return
		this.changeCurrencyLocked = true

		this.overrideDisplayCurrency = this.unit.pref

		this.unit.updatePriceData()
		this.unit.save()

		setTimeout(() => {
			this.changeCurrencyLocked = false
			this.overrideDisplayCurrency = null
		}, 2500)
	}

	openOAuth() {
		this.oauth.login().then((success) => {
			if (success) {
				this.storage.getAuthUser().then((result) => (this.authUser = result))
			}
		})
	}

	rateApp() {
		if (this.platform.is('android')) {
			window.open('market://details?id=in.beaconcha.mobile', '_system', 'location=yes')
		} else {
			window.open('itms-apps://itunes.apple.com/app/id1541822121', '_system', 'location=yes')
		}
	}

	changeUpdateChannel() {
		this.updateUtils.setUpdateChannel(this.updateChannel)
		this.updateUtils.checkAllUpdates()
	}

	async openBrowser(link, native = false) {
		if (native) {
			window.open(link, '_system', 'location=yes')
		} else {
			await Browser.open({ url: link, toolbarColor: '#2f2e42' })
		}
	}

	logout() {
		this.alerts.confirmDialog('Confirm logout', 'Notifications will stop working if you sign out. Continue?', 'Logout', () => {
			this.confirmLogout()
		})
	}

	count = 0
	notAnEasterEgg() {
		this.count++
		if (this.count % 3 != 0) return
		const random = Math.floor(Math.random() * 2)
		switch (random) {
			case 0: {
				const currentSnow = this.theme.snow()
				setTimeout(() => {
					this.theme.stopSnow(currentSnow)
				}, 45000)
				break
			}
			case 1:
				this.theme.silvesterFireworks()
				break
		}
	}

	confirmLogout() {
		this.storage.removeAuthUser()
		this.authUser = null
		Toast.show({
			text: 'Logged out',
		})
	}

	async changeNetwork() {
		const newConfig = findConfigForKey(this.network)
		await this.storage.clearCache()
		await this.api.clearCache()
		await this.validatorUtils.clearCache()

		await this.storage.setNetworkPreferences(newConfig)
		await this.api.initialize()
		await this.notificationBase.loadAllToggles()
		this.validatorUtils.notifyListeners()
	}

	async openIconCredit() {
		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'App Icon Credit',
			message:
				'Satellite dish by Font Awesome.<br/>Licensed under the Creative Commons Attribution 4.0 International.<br/><a href="https://fontawesome.com/license">https://fontawesome.com/license</a>',
			buttons: ['OK'],
		})

		await alert.present()
	}

	async partialStake() {
		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'Define stake share',
			message:
				'If you own partial amounts of a validator, you can define your share on a per validator basis. To do that, go to the validators tab, select your validators by holding down and set the stake share.',
			buttons: ['OK'],
		})

		await alert.present()
	}

	async openUpgrades() {
		const modal = await this.modalController.create({
			component: SubscribePage,
			cssClass: 'my-custom-class',
		})
		return await modal.present()
	}

	async openFAQ() {
		const modal = await this.modalController.create({
			component: HelppagePage,
			cssClass: 'my-custom-class',
		})
		return await modal.present()
	}

	async openOpenSource() {
		const modal = await this.modalController.create({
			component: LicencesPage,
			cssClass: 'my-custom-class',
		})
		return await modal.present()
	}

	ionViewDidLeave() {
		this.sync.syncAllSettings()
	}

	manageSubs() {
		this.merchant.manageSubscriptions()
	}

	toggleSnow() {
		this.theme.toggleWinter(this.snowing)
	}

	async openMergeChecklist() {
		const modal = await this.modalController.create({
			component: MergeChecklistPage,
			cssClass: 'my-custom-class',
			componentProps: {
				fromSettings: true,
			},
		})

		return await modal.present()
	}

	versionClickCount = 0
	openLogSessionDialog() {
		this.versionClickCount++
		if (this.versionClickCount % 3 != 0) return
		this.openLogSessionDialogReally()
	}

	async openLogSessionDialogReally() {
		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'Logs Viewer',
			message: 'For which session would you like to see logs?',
			buttons: [
				{
					text: 'Current Session',
					handler: () => {
						this.storage.openLogSession(this.modalController, 0)
					},
				},
				{
					text: 'Last Session',
					handler: () => {
						this.storage.openLogSession(this.modalController, 1)
					},
				},
				{
					text: 'Last Last Session',
					handler: () => {
						this.storage.openLogSession(this.modalController, 2)
					},
				},
				{
					text: 'Cancel',
				},
			],
		})

		await alert.present()
	}
}
