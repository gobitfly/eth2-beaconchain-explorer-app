import { Injectable } from '@angular/core'
import { Platform } from '@ionic/angular'
import { ApiService } from 'src/app/services/api.service'
import { StorageService } from 'src/app/services/storage.service'
import { AlertService } from '../services/alert.service'
import ClientUpdateUtils, { Clients } from '../utils/ClientUpdateUtils'
import FirebaseUtils from '../utils/FirebaseUtils'
import { V2SubscribedClients } from '../requests/v2-notifications'

@Injectable({
	providedIn: 'root',
})
export class NotificationBase {
	notifyTogglesMap = new Map<string, boolean>()
	clientUpdatesTogglesMap = new Map<string, boolean>() // identifier = client key

	settingsChanged = false

	constructor(
		protected api: ApiService,
		protected storage: StorageService,
		protected firebaseUtils: FirebaseUtils,
		protected platform: Platform,
		protected alerts: AlertService,
		protected clientUpdate: ClientUpdateUtils
	) {}

	async setClientToggleState(clientKey: string, state: boolean) {
		this.clientUpdatesTogglesMap.set(clientKey, state)
		this.settingsChanged = true
		if (state) {
			await this.clientUpdate.setClient(clientKey, clientKey)
			this.clientUpdate.checkClientUpdate(clientKey)
		} else {
			await this.clientUpdate.setClient(clientKey, 'null')
		}
	}

	getClientToggleState(clientKey: string): boolean {
		const toggle = this.clientUpdatesTogglesMap.get(clientKey)
		if (toggle == undefined) {
			console.log('Could not return toggle state for client', clientKey)
			return false
		}
		return toggle
	}

	clientUpdateOnToggle(clientKey: string) {
		this.settingsChanged = true
		if (this.getClientToggleState(clientKey)) {
			//this.sync.changeClient(clientKey, clientKey)
		} else {
			//this.sync.changeClient(clientKey, 'null')
			this.api.deleteAllHardStorageCacheKeyContains(clientKey)
		}
	}

	remoteNotifyLoadedOnce = false
	async updateClientsFromRemote(force: boolean) {
		if (!(await this.storage.isLoggedIn())) return
		const result = await this.api.execute2(new V2SubscribedClients().withAllowedCacheResponse(!force))
		if (result.error) {
			console.warn('Failed to load subscribed clients', result.error)
			return result
		}

		Clients.forEach((client) => {
			const found = result.data.find((remoteClient) => remoteClient.client_name == client.key) ? true : false
			this.setClientToggleState(client.key, found)
		})
		this.settingsChanged = false

		return result
	}

	disableToggleLock() {
		setTimeout(() => {
			this.settingsChanged = false
		}, 300)
	}
}
