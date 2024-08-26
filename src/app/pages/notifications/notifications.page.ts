import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { ModalController, Platform } from '@ionic/angular'
import { AlertService } from 'src/app/services/alert.service'
import { ApiService, capitalize } from 'src/app/services/api.service'
import { CPU_THRESHOLD, HDD_THRESHOLD, RAM_THRESHOLD, StorageService } from 'src/app/services/storage.service'
import { SyncService } from 'src/app/services/sync.service'
import { NotificationBase } from 'src/app/tab-preferences/notification-base'
import ClientUpdateUtils from 'src/app/utils/ClientUpdateUtils'
import FirebaseUtils from 'src/app/utils/FirebaseUtils'
import FlavorUtils from 'src/app/utils/FlavorUtils'
import MachineUtils, { UNSUPPORTED_PRYSM } from 'src/app/utils/MachineUtils'
import { MerchantUtils } from 'src/app/utils/MerchantUtils'
import { SubscribePage } from '../subscribe/subscribe.page'
import { Browser } from '@capacitor/browser'
import { ValidatorUtils } from 'src/app/utils/ValidatorUtils'
@Component({
	selector: 'app-notifications',
	templateUrl: './notifications.page.html',
	styleUrls: ['./notifications.page.scss'],
})
export class NotificationsPage extends NotificationBase implements OnInit {
	network = 'main'
	authUser = null

	canCustomizeThresholds = false

	initialized = false

	allMachines: Promise<string[]>
	noMachines = true

	unsupportedPrysm = false

	noGoogle = false

	disableRocketpoolNode = true

	constructor(
		protected api: ApiService,
		protected storage: StorageService,
		protected firebaseUtils: FirebaseUtils,
		protected platform: Platform,
		protected alerts: AlertService,
		public sync: SyncService,
		private merchantUtils: MerchantUtils,
		private modalController: ModalController,
		private machineUtils: MachineUtils,
		protected clientUpdateUtils: ClientUpdateUtils,
		private router: Router,
		private flavor: FlavorUtils,
		private validatorUtils: ValidatorUtils
	) {
		super(api, storage, firebaseUtils, platform, alerts, sync, clientUpdateUtils)

		this.flavor.isNoGoogleFlavor().then((result) => {
			this.noGoogle = result
		})
	}

	saveAndBack() {
		if (this.settingsChanged) {
			this.sync.syncAllSettings(true)
		}

		this.router.navigate(['/tabs/preferences'])
	}

	handleLockedClick() {
		if (this.canCustomizeThresholds) return

		this.openUpgrades()
	}

	async configureWebhooks() {
		await Browser.open({ url: this.api.getBaseUrl() + '/user/webhooks', toolbarColor: '#2f2e42' })
	}

	async ionViewWillEnter() {
		this.initialized = false

		this.storage.getBooleanSetting(UNSUPPORTED_PRYSM, false).then((result) => {
			this.unsupportedPrysm = result
		})

		this.storage.getAuthUser().then((result) => (this.authUser = result))
		this.network = capitalize(this.api.getNetworkName())
		// this.merchantUtils.hasCustomizableNotifications().then((result) => {
		// 	this.canCustomizeThresholds = result
		// })

		await this.loadAllToggles()
		setTimeout(() => {
			this.initialized = true
		}, 400)

		this.disableRocketpoolNode = !(await this.validatorUtils.areRocketpoolValidatorsSubscribed())
	}

	changeValidatorOffline() {
		if (!this.initialized) return
		this.notifyEventFilterToggle('validator_is_offline', null, 3)
	}

	changeDiskNotification() {
		if (!this.initialized) return
		this.storage.setSetting(HDD_THRESHOLD, this.storageThreshold)
		const thresholdConv = (100 - this.storageThreshold) / 100 // endpoint takes in percantage of free space available
		this.notifyEventToggleAllMachines('monitoring_hdd_almostfull', thresholdConv)
	}

	changeCPUNotification() {
		if (!this.initialized) return
		this.storage.setSetting(CPU_THRESHOLD, this.cpuThreshold)
		const thresholdConv = this.cpuThreshold / 100
		this.notifyEventToggleAllMachines('monitoring_cpu_load', thresholdConv)
	}

	changeMemoryNotification() {
		if (!this.initialized) return
		this.storage.setSetting(RAM_THRESHOLD, this.memoryThreshold)
		const thresholdConv = this.memoryThreshold / 100
		this.notifyEventToggleAllMachines('monitoring_memory_usage', thresholdConv)
	}

	changeRocketpoolMaxCollateral() {
		if (!this.initialized) return

		let thresholdConv = 0
		if (this.maxCollateralThreshold >= 0) {
			thresholdConv = 1 + (this.maxCollateralThreshold - 100) / 1000
		} else {
			thresholdConv = (1 - (this.maxCollateralThreshold + 100) / 1000) * -1
		}

		this.notifyEventFilterToggle('rocketpool_colleteral_max', null, thresholdConv)
	}

	changeRocketpoolMinCollateral() {
		if (!this.initialized) return

		const thresholdConv = 1 + this.minCollateralThreshold / 100
		this.notifyEventFilterToggle('rocketpool_colleteral_min', null, thresholdConv)
	}

	async notifyEventToggleAllMachines(event: string, threshold: number = null) {
		const array = await this.allMachines
		array.forEach((machine) => {
			this.notifyEventFilterToggle(event, machine, threshold)
		})
	}

	async ngOnInit() {
		this.allMachines = this.machineUtils.getAllMachineNames()
		const result = await this.allMachines
		this.noMachines = result.length == 0
	}

	changeStorageThreshold($event) {
		this.storageThreshold = $event.detail.value
	}

	changeCPUThreshold($event) {
		this.cpuThreshold = $event.detail.value
	}

	async openUpgrades() {
		const modal = await this.modalController.create({
			component: SubscribePage,
			cssClass: 'my-custom-class',
		})
		return await modal.present()
	}
}
