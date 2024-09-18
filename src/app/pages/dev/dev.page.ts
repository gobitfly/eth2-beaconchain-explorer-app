import { Component, OnInit } from '@angular/core'
import { DEBUG_SETTING_OVERRIDE_PACKAGE } from 'src/app/services/storage.service'
import { CURRENT_TOKENKEY } from 'src/app/utils/FirebaseUtils'
import { Tab3Page } from 'src/app/tab-preferences/tab-preferences.page'
import { Toast } from '@capacitor/toast'
import { Clients } from '../../utils/ClientUpdateUtils'
import { DevModeEnabled } from 'src/app/services/storage.service'
import { V2Me, V2RegisterPushNotificationToken } from 'src/app/requests/v2-user'

@Component({
	selector: 'app-dev',
	templateUrl: './dev.page.html',
	styleUrls: ['./dev.page.scss'],
})
export class DevPage extends Tab3Page implements OnInit {
	packageOverride = 'default'
	firebaseToken = ''
	notificationConsent = false
	deviceID = ''
	usev2api = false
	allowHttp = false

	ngOnInit() {
		this.notificationBase.disableToggleLock()
		this.storage.getSetting(DEBUG_SETTING_OVERRIDE_PACKAGE, 'default').then((result) => {
			this.packageOverride = result as string
		})

		this.storage.getItem(CURRENT_TOKENKEY).then((result) => {
			this.firebaseToken = result
		})

		this.storage.getDeviceID().then((result) => {
			this.deviceID = result
		})

		this.storage.isV2().then((result) => {
			this.usev2api = result
		})

		this.firebaseUtils.hasNotificationConsent().then((result) => (this.notificationConsent = result))

		this.storage.getAuthUserv2().then((result) => {
			console.log('v2 auth', result)
		})

		this.storage.isHttpAllowed().then((result) => {
			this.allowHttp = result
		})
	}

	toastTest() {
		Toast.show({
			text: 'Test toast',
		})
	}

	// --- Development methods ---

	async forceTokenRefresh() {
		const result = await this.api.refreshToken()
		if (result) {
			Toast.show({
				text: 'Token refreshed',
			})
		} else {
			Toast.show({
				text: 'Token refresh failed :(',
			})
		}
	}

	clearApiCache() {
		this.api.clearCache()
		this.alerts.confirmDialog('Restart', 'API requests cache cleared, restart?', 'OK', () => {
			this.restartApp()
		})
	}

	// Enables testing of client update messages
	// Once this method is called, every subscribed client will report a new version
	outdateLastClosedForClients() {
		Clients.forEach((client) => {
			this.updateUtils.dismissRelease(client.key, '0')
		})

		this.updateUtils.checkAllUpdates()
	}

	clearSyncQueue() {
		this.sync.developDeleteQueue()
		Toast.show({
			text: 'Queue cleared',
		})
	}

	forceSync() {
		this.sync.fullSync()
	}

	updateFirebaseToken() {
		this.firebaseUtils.pushLastTokenUpstream(true)
	}

	permanentDevMode() {
		this.storage.setObject('dev_mode', { enabled: true } as DevModeEnabled)
		Toast.show({
			text: 'Permanent dev mode enabled',
		})
	}

	triggerToggleTest() {
		this.toggleTest = true
		this.alerts.showInfo('Success', 'Toggle test is successfull if this alert only appears once and DOES NOT return to disabled')
	}

	triggerNotificationConsent() {
		this.firebaseUtils.registerPush(true)
	}

	toggleTest = false
	toggleTestChange() {
		setTimeout(() => (this.toggleTest = false), 500)
		setTimeout(
			() => this.alerts.showInfo('Success', 'Toggle test was successful if this alert only appears once and toggle returns to disabled'),
			650
		)
	}

	confetti() {
		this.theme.silvesterFireworks()
	}

	resetLastFirebaseToken() {
		this.storage.setItem('last_firebase_token', null)
		this.alerts.confirmDialog('Restart', 'API requests cache cleared, restart?', 'OK', () => {
			this.restartApp()
		})
	}

	restartApp() {
		this.merchant.restartApp()
	}

	clearStorage() {
		this.alerts.confirmDialog('Clear Storage', 'All app data will be removed, continue?', 'OK', () => {
			this.storage.clear()
			Toast.show({
				text: 'Storage cleared',
			})
		})
	}

	changePackage() {
		this.storage.setSetting(DEBUG_SETTING_OVERRIDE_PACKAGE, this.packageOverride)
		this.alerts.confirmDialog('Restart', 'Requires restart to take affect, restart?', 'OK', () => {
			this.restartApp()
		})
	}

	// @deprecated replaced by changeSession
	async changeAccessToken() {
		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'Access Token',
			inputs: [
				{
					name: 'token',
					type: 'text',
					placeholder: 'Access token',
				},
				{
					name: 'refreshtoken',
					type: 'text',
					placeholder: 'Refresh token',
				},
				{
					name: 'expires',
					type: 'number',
					placeholder: 'Expires in',
				},
			],
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel',
					cssClass: 'secondary',
					handler: () => {
						return
					},
				},
				{
					text: 'Ok',
					handler: (alertData) => {
						this.storage.setAuthUser({
							accessToken: alertData.token,
							refreshToken: alertData.refreshtoken,
							expiresIn: alertData.expires,
						})
					},
				},
			],
		})

		await alert.present()
	}

	async changeSession() {
		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'Session ID',
			inputs: [
				{
					name: 'session',
					type: 'text',
					placeholder: 'Session ID',
				},
			],
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel',
					cssClass: 'secondary',
					handler: () => {
						return
					},
				},
				{
					text: 'Ok',
					handler: async (alertData) => {
						await this.storage.setAuthUserv2({
							Session: alertData.session,
						})
						this.api.invalidateAllCache()
						await this.oauth.postLogin()
						this.dashboardUtils.dashboardAwareListener.notifyAll()
						alert.dismiss()
					},
				},
			],
		})

		await alert.present()
	}

	async restoreAuthUser() {
		await this.storage.restoreAuthUser()
		await this.oauth.postLogin()
		this.alerts.confirmDialog('Success', 'Restart app with restored user?', 'OK', () => {
			this.restartApp()
		})
	}

	async backupAuthUser() {
		await this.storage.backupAuthUser()
		console.log('backup success')
		Toast.show({
			text: 'Backup successful',
		})
	}

	openLogSession(offset: number) {
		this.storage.openLogSession(this.modalController, offset)
	}

	async migrateV2() {
		await this.storage.setDashboardID(null)
		await this.validatorUtils.debugSetMyLocalValidators('holesky', [99, 98, 97, 96, 95])

		await this.storage.setBooleanSetting('migration_completed', false) // reset
		await this.v2migrator.switchToV2(false)

		this.merchant.restartApp()
		//this.v2migrator.migrate()
	}

	async localBundleUpdate() {
		const bundleURL = await this.storage.getItem('dev_bundle_url')
		const alert = await this.alertController.create({
			cssClass: 'my-custom-class',
			header: 'Bundle URL',
			inputs: [
				{
					name: 'url',
					type: 'text',
					placeholder: 'Bundle URL',
					value: bundleURL,
				},
			],
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel',
					cssClass: 'secondary',
					handler: () => {
						return
					},
				},
				{
					text: 'Ok',
					handler: async (alertData) => {
						await this.storage.setItem('dev_bundle_url', alertData.url)
						await this.appUpdater.updateBundle(alertData.url)
					},
				},
			],
		})

		await alert.present()
	}

	changeToV2Api() {
		console.log('use v2 api', this.usev2api)
		this.v2migrator.switchToV2(this.usev2api)
	}

	async getMyDashboards() {
		const result = await this.api.execute2(new V2Me())
		console.log('v2 dashboards', result)
	}

	async registerV2Push() {
		//const lastToken = await this.storage.getItem('last_firebase_token')
		const deviceID = await this.storage.getDeviceID()
		const result = this.api.execute2(new V2RegisterPushNotificationToken('hallo', deviceID)) 
		console.log('v2 register push', result)
	}

	changeAllowHttp() {
		this.storage.setHttpAllowed(this.allowHttp)
	}
}
