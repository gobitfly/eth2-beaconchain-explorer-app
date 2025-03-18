import { Injectable, signal, WritableSignal } from '@angular/core'
import { Platform } from '@ionic/angular'
import { ApiService } from '@services/api.service'
import { StorageService } from '@services/storage.service'
import { AlertService } from '@services/alert.service'
import ClientUpdateUtils, { Clients } from '@utils/ClientUpdateUtils'
import { V2ChangeSubscribedClient, V2SubscribedClients } from '@requests/v2-notifications'

@Injectable({
	providedIn: 'root',
})
export class NotificationBase {
	clientUpdatesTogglesMap = new Map<string, WritableSignal<boolean>>() // identifier = client key

	settingsChanged = false

	constructor(
		protected api: ApiService,
		protected storage: StorageService,
		protected platform: Platform,
		protected alerts: AlertService,
		protected clientUpdate: ClientUpdateUtils
	) {
		for (const client of Clients) {
			this.clientUpdatesTogglesMap.set(client.key, signal(false))
		}
	}

	async setClientToggleState(clientKey: string, state: boolean) {
		const current = this.clientUpdatesTogglesMap.get(clientKey)
		if (!current) {
			console.log('Could not set toggle state for client', clientKey)
			return
		}
		current.set(state)
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
		return toggle()
	}

	async clientUpdateOnToggle(clientKey: string) {
		this.settingsChanged = true

		if (!(await this.storage.isLoggedIn())) return
		const enabled = this.getClientToggleState(clientKey)
		const result = await this.setRemote(clientKey, enabled)
		if (result.error) {
			console.log('error changing client subscribed state', result.error)
		}
		this.api.clearSpecificCache(new V2SubscribedClients())
	}

	private async setRemote(clientKey: string, enabled: boolean) {
		const remoteID = Clients.find((c) => c.key == clientKey).remoteId
		const updateRequest = new V2ChangeSubscribedClient(remoteID, enabled)
		const result = await this.api.execute(updateRequest)
		return result
	}

	remoteNotifyLoadedOnce = false
	async updateClientsFromRemote(force: boolean) {
		if (!(await this.storage.isLoggedIn())) return
		const result = this.remoteInitClientIDs(force, (clientKey, exists) => this.setClientToggleState(clientKey, exists))
		this.settingsChanged = false
		return result
	}

	/**
	 * V2 API changed the the ethereum client ids to integer. We use this function to retrieve all remote client ids and
	 * update the local state based on the remote name. Essentially it uses(maps) the locally defined remote name to the remote id
	 * @param force
	 * @param callback
	 * @returns
	 */
	private async remoteInitClientIDs(force: boolean, callback: (clientKey: string, exists: boolean) => Promise<void> = null) {
		const result = await this.api.execute(new V2SubscribedClients().withAllowedCacheResponse(!force))
		if (result.error) {
			console.warn('Failed to load subscribed clients', result.error)
			return result
		}

		for (let i = 0; i < Clients.length; i++) {
			const client = Clients[i]
			const foundClient = result.data.clients.find((remoteClient) => remoteClient.name == client.remoteKey)
			const exists = foundClient?.is_subscribed ?? false
			Clients[i].remoteId = foundClient?.id

			if (callback) {
				await callback(client.key, exists)
			}
		}

		return result
	}

	async syncClientUpdates() {
		// only sync when logged in
		if (!(await this.storage.isLoggedIn())) {
			return
		}

		// first get remote ids
		const result = await this.remoteInitClientIDs(true)
		if (result.error || (result.data?.clients?.length ?? 0) == 0) {
			return
		}

		// sync up local enabled client updates to remote
		const promiseArray: Promise<string>[] = []
		for (let i = 0; i < Clients.length; i++) {
			promiseArray.push(this.storage.getItem(Clients[i].storageKey))
		}

		const results = await Promise.all(promiseArray)
		for (let i = 0; i < results.length; i++) {
			if (results[i] && results[i] != 'null') {
				const foundClient = result.data.clients.find((remoteClient) => remoteClient.name == Clients[i].remoteKey)
				const exists = foundClient?.is_subscribed ?? false
				if (!exists) {
					// only set if not already set on remote
					this.setRemote(Clients[i].key, true)
				}
			}
		}

		// sync down, applying remote to local
		this.updateClientsFromRemote(false)
	}

	disableToggleLock() {
		setTimeout(() => {
			this.settingsChanged = false
		}, 300)
	}
}
