import { Injectable, OnInit } from '@angular/core'
import { Platform } from '@ionic/angular'
import { ApiService } from 'src/app/services/api.service'
import { CPU_THRESHOLD, HDD_THRESHOLD, RAM_THRESHOLD, SETTING_NOTIFY, StorageService } from 'src/app/services/storage.service'
import { GetMobileSettingsRequest, MobileSettingsResponse, NotificationGetRequest } from '../requests/requests'
import { AlertService, SETTINGS_PAGE } from '../services/alert.service'
import { SyncService } from '../services/sync.service'
import ClientUpdateUtils, { Clients } from '../utils/ClientUpdateUtils'
import FirebaseUtils from '../utils/FirebaseUtils'

@Injectable({
	providedIn: 'root',
})
export class NotificationBase implements OnInit {
	notifyInitialized = false

	notify = false

	storageThreshold = 90
	cpuThreshold = 60
	memoryThreshold = 80

	maxCollateralThreshold = 100
	minCollateralThreshold = 0

	activeSubscriptionsPerEventMap = new Map<string, number>() // map storing the count of subscribed validators per event
	notifyTogglesMap = new Map<string, boolean>()
	clientUpdatesTogglesMap = new Map<string, boolean>() // identifier = client key

	settingsChanged = false

	constructor(
		protected api: ApiService,
		protected storage: StorageService,
		protected firebaseUtils: FirebaseUtils,
		protected platform: Platform,
		protected alerts: AlertService,
		public sync: SyncService, // If you have to use this, be cautios: This is not always available. We don't know why yet but will research this via BIDS-1117
		protected clientUpdate: ClientUpdateUtils
	) {}

	ngOnInit() {
		this.notifyInitialized = false
	}

	async setClientToggleState(clientKey: string, state: boolean) {
		this.clientUpdatesTogglesMap.set(clientKey, state)
		this.settingsChanged = true
		if (state) {
			await this.clientUpdate.setClient(clientKey, clientKey)
		} else {
			await this.clientUpdate.setClient(clientKey, 'null')
		}
		this.clientUpdate.checkClientUpdate(clientKey)
	}

	getClientToggleState(clientKey: string): boolean {
		const toggle = this.clientUpdatesTogglesMap.get(clientKey)
		if (toggle == undefined) {
			console.log('Could not return toggle state for client', clientKey)
			return false
		}
		return toggle
	}

	setNotifyToggle(eventName: string, event) {
		console.log('change notify toggle', eventName, event)
		this.settingsChanged = true
		this.notifyTogglesMap.set(eventName, event)
	}

	// changes a toggle without triggering onChange
	lockedToggle = true
	changeToggleSafely(func: () => void) {
		this.lockedToggle = true
		func()
	}

	public async getDefaultNotificationSetting() {
		return (await this.firebaseUtils.hasNotificationConsent()) && (await this.firebaseUtils.hasNotificationToken())
	}

	// Android registers firebase service at app start
	// So if there is no token present when enabling notifications,
	// there might be no google play services on this device
	private async isSupportedOnAndroid() {
		if (this.platform.is('android')) {
			const hasToken = await this.firebaseUtils.hasNotificationToken()
			if (!hasToken) {
				this.alerts.showError(
					'Play Service',
					'We could not enable notifications for your device which might be due to missing Google Play Services. Please note that notifications do not work without Google Play Services.',
					SETTINGS_PAGE + 2
				)
				this.changeToggleSafely(() => {
					this.notify = false
				})
				return false
			}
		}
		return true
	}

	remoteNotifyLoadedOnce = false
	async loadAllToggles() {
		if (!(await this.storage.isLoggedIn())) return

		const net = (await this.api.networkConfig).net

		const request = new NotificationGetRequest()
		const response = await this.api.execute(request)
		const results = request.parse(response)

		const isNotifyClientUpdatesEnabled = await this.storage.isNotifyClientUpdatesEnabled()

		let network = await this.api.getNetworkName()
		if (network == 'main') {
			network = 'mainnet'
		} else if (network == 'local dev') {
			console.warn(
				'You have set your network to ',
				network,
				', subscriptions will not work unless you overwrite the variable below this warning in your code.'
			)
			//network = 'prater' // use me, dear developer
		}
		console.log('result', results, network)

		const clientsToActivate = <string[]>[]

		for (const result of results) {
			this.setToggleFromEvent(result.EventName, network, true, net)
			if (result.EventName == 'monitoring_cpu_load') {
				this.cpuThreshold = Math.round(parseFloat(result.EventThreshold) * 100)
				this.storage.setSetting(CPU_THRESHOLD, this.cpuThreshold)
			} else if (result.EventName == 'monitoring_hdd_almostfull') {
				this.storageThreshold = Math.round(100 - parseFloat(result.EventThreshold) * 100)
				this.storage.setSetting(HDD_THRESHOLD, this.storageThreshold)
			} else if (result.EventName == 'monitoring_memory_usage') {
				this.memoryThreshold = Math.round(parseFloat(result.EventThreshold) * 100)
				this.storage.setSetting(RAM_THRESHOLD, this.memoryThreshold)
			} else if (result.EventName == network + ':rocketpool_colleteral_max') {
				const threshold = parseFloat(result.EventThreshold)
				if (threshold >= 0) {
					this.maxCollateralThreshold = Math.round((threshold - 1) * 1000 + 100) //1 + ((this.maxCollateralThreshold - 100) / 1000)
				} else {
					this.maxCollateralThreshold = Math.round((1 - threshold * -1) * 1000 - 100) //(1 - ((this.maxCollateralThreshold + 100) / 1000)) * -1
				}
			} else if (result.EventName == network + ':rocketpool_colleteral_min') {
				this.minCollateralThreshold = Math.round((parseFloat(result.EventThreshold) - 1) * 100) //1 + this.minCollateralThreshold / 100
			} else if (isNotifyClientUpdatesEnabled && result.EventName == 'eth_client_update') {
				if (
					result.EventFilter &&
					result.EventFilter.length >= 1 &&
					result.EventFilter.charAt(0).toUpperCase() != result.EventFilter.charAt(0) &&
					result.EventFilter != 'null' &&
					result.EventFilter != 'none'
				) {
					clientsToActivate.push(result.EventFilter)
				}
			}
		}

		if (isNotifyClientUpdatesEnabled) {
			Clients.forEach((client) => {
				if (clientsToActivate.find((activate) => client.name.toLocaleLowerCase() == activate) != undefined) {
					this.setClientToggleState(client.key, true)
				} else {
					this.setClientToggleState(client.key, false)
				}
			})
		}

		// locking toggle so we dont execute onChange when setting initial values
		const preferences = await this.storage.loadPreferencesToggles(net)

		this.lockedToggle = true

		if (await this.api.isNotMainnet()) {
			this.lockedToggle = true
			this.notify = preferences
			this.notifyInitialized = true
			this.disableToggleLock()
			return
		}

		await this.getNotificationSetting(preferences).then((result) => {
			this.lockedToggle = true
			this.notify = result
			this.disableToggleLock()
		})

		this.disableToggleLock()

		this.notifyInitialized = true

		if (!this.remoteNotifyLoadedOnce) {
			const remoteNofiy = await this.getRemoteNotificationSetting(preferences)
			if (remoteNofiy != this.notify) {
				this.lockedToggle = true
				this.notify = remoteNofiy
				this.disableToggleLock()
			}
			this.remoteNotifyLoadedOnce = true
		}
	}

	async notifyToggle() {
		if (this.lockedToggle) {
			return
		}

		if (!(await this.isSupportedOnAndroid())) return

		if (this.platform.is('ios') && (await this.firebaseUtils.hasSeenConsentScreenAndNotConsented())) {
			this.changeToggleSafely(() => {
				this.notify = false
			})
			this.firebaseUtils.alertIOSManuallyEnableNotifications()
			return
		}

		if (this.notify == false) {
			for (const key of this.notifyTogglesMap.keys()) {
				this.notifyTogglesMap.set(key, this.notify)
			}
		}

		const net = (await this.api.networkConfig).net
		this.storage.setBooleanSetting(net + SETTING_NOTIFY, this.notify)
		this.settingsChanged = true
		if (!(await this.api.isNotMainnet())) {
			this.sync.changeGeneralNotify(this.notify)
		}

		if (this.notify) this.firebaseUtils.registerPush(true)

		this.api.clearSpecificCache(new NotificationGetRequest())
	}

	private async getRemoteNotificationSetting(notifyLocalStore): Promise<boolean> {
		const local = await this.getNotificationSetting(notifyLocalStore)
		const remote = await this.getRemoteNotificationSettingResponse()

		if (remote && notifyLocalStore) {
			console.log('Returning notification enabled remote state:', remote.notify_enabled)
			return remote.notify_enabled
		}
		return local
	}

	private async getNotificationSetting(notifyLocalStore): Promise<boolean> {
		const local = notifyLocalStore != null ? notifyLocalStore : await this.getDefaultNotificationSetting()
		if (!(await this.firebaseUtils.hasNotificationConsent())) return false
		console.log('Returning notification enabled local state:', local)
		return local
	}

	private async getRemoteNotificationSettingResponse(): Promise<MobileSettingsResponse> {
		const request = new GetMobileSettingsRequest()
		const response = await this.api.execute(request)
		const result = request.parse(response)
		if (result && result.length >= 1) return result[0]
		return null
	}

	notifyClientUpdates() {
		if (this.lockedToggle) {
			return
		}
		this.settingsChanged = true
		this.sync.changeNotifyClientUpdate('eth_client_update', this.notifyTogglesMap.get('eth_client_update'))
		this.api.clearSpecificCache(new NotificationGetRequest())
	}

	private getNotifyToggleFromEvent(eventName: string) {
		const toggle = this.notifyTogglesMap.get(eventName)
		if (toggle == undefined) {
			console.log('Could not return toggle state for event', eventName)
			return false
		}
		return toggle
	}

	private setToggleFromEvent(eventNameTagges, network, value, net) {
		const parts = eventNameTagges.split(':')
		let eventName = eventNameTagges
		if (parts.length == 2) {
			if (parts[0] != network) {
				return
			}
			if (parts[1].indexOf('monitoring_') >= 0) {
				return
			}
			if (parts[1].indexOf('eth_client_update') >= 0) {
				return
			}
			eventName = parts[1]
		}
		this.settingsChanged = true
		this.notifyTogglesMap.set(eventName, value)
		const count = this.activeSubscriptionsPerEventMap.get(eventName)
		this.activeSubscriptionsPerEventMap.set(eventName, count ? count + 1 : 1)

		this.storage.setBooleanSetting(net + eventName, value)
	}

	getCount(eventName) {
		const count = this.activeSubscriptionsPerEventMap.get(eventName)
		return count ? count : 0
	}

	async notifyEventToggle(eventName, filter = null, threshold = null) {
		console.log('notifyEventToggle', this.lockedToggle)
		if (this.lockedToggle) {
			return
		}
		this.settingsChanged = true
		this.sync.changeNotifyEvent(eventName, eventName, this.getNotifyToggleFromEvent(eventName), filter, threshold)
		this.api.clearSpecificCache(new NotificationGetRequest())
	}

	clientUpdateOnToggle(clientKey: string) {
		if (this.lockedToggle) {
			return
		}
		this.settingsChanged = true
		if (this.getClientToggleState(clientKey)) {
			this.sync.changeClient(clientKey, clientKey)
		} else {
			this.sync.changeClient(clientKey, 'null')
		}
	}

	// include filter in key (fe used by machine toggles)
	async notifyEventFilterToggle(eventName, filter = null, threshold = null) {
		console.log('notifyEventFilterToggle', this.lockedToggle)
		if (this.lockedToggle) {
			return
		}
		const key = eventName + filter
		const value = this.getNotifyToggleFromEvent(eventName)
		this.settingsChanged = true
		this.storage.setBooleanSetting(eventName, value)

		this.sync.changeNotifyEventUser(key, eventName, value, filter, threshold)
		this.api.clearSpecificCache(new NotificationGetRequest())
	}

	disableToggleLock() {
		setTimeout(() => {
			this.lockedToggle = false
			this.settingsChanged = false
		}, 300)
	}
}
