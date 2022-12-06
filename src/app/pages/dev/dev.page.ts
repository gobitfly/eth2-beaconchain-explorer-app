import { Component, OnInit } from '@angular/core'
import { DEBUG_SETTING_OVERRIDE_PACKAGE } from 'src/app/services/storage.service'
import { CURRENT_TOKENKEY } from 'src/app/utils/FirebaseUtils'
import { Tab3Page } from 'src/app/tab-preferences/tab-preferences.page'
import { Toast } from '@capacitor/toast'
import { Clients } from '../../utils/ClientUpdateUtils'
import { DevModeEnabled } from 'src/app/services/api.service'

@Component({
	selector: 'app-dev',
	templateUrl: './dev.page.html',
	styleUrls: ['./dev.page.scss'],
})
export class DevPage extends Tab3Page implements OnInit {
	packageOverride = 'default'
	firebaseToken = ''
	notificationConsent = false

	ngOnInit() {
		this.notificationBase.disableToggleLock()
		this.storage.getSetting(DEBUG_SETTING_OVERRIDE_PACKAGE, 'default').then((result) => {
			this.packageOverride = result as string
		})

		this.storage.getItem(CURRENT_TOKENKEY).then((result) => {
			this.firebaseToken = result
		})

		this.firebaseUtils.hasNotificationConsent().then((result) => (this.notificationConsent = result))
	}

	// --- Development methods ---

	forceTokenRefresh() {
		this.api.refreshToken()
		Toast.show({
			text: 'Token refreshed',
		})
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
	}

	triggerNotificationConsent() {
		this.firebaseUtils.registerPush(true)
	}

	toggleTest = false
	toggleTestChange() {
		if (this.notificationBase.lockedToggle) {
			this.notificationBase.lockedToggle = false
			return
		}
		setTimeout(
			() =>
				this.notificationBase.changeToggleSafely(() => {
					this.toggleTest = false
				}),
			500
		)
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

	async restoreAuthUser() {
		await this.storage.restoreAuthUser()
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
}
