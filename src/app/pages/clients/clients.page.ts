import { Component, OnInit, Input, WritableSignal, signal } from '@angular/core'
import { ModalController } from '@ionic/angular'
import ClientUpdateUtils from '../../utils/ClientUpdateUtils'
import { NotificationBase } from '../../tab-preferences/notification-base'
import { StorageService } from 'src/app/services/storage.service'
@Component({
	selector: 'app-clients',
	templateUrl: './clients.page.html',
	styleUrls: ['./clients.page.scss'],
})
export class ClientsPage implements OnInit {
	@Input() clientIdentifier = ''

	loading: WritableSignal<boolean> = signal(false)
	online: WritableSignal<boolean> = signal(true)

	constructor(
		private modalCtrl: ModalController,
		private updateUtils: ClientUpdateUtils,
		public notificationBase: NotificationBase,
		private storage: StorageService
	) {}

	async doRefresh(force: boolean = false) {
		if (!(await this.storage.isLoggedIn())) return
		this.loading.set(true)
		const result = await this.notificationBase.updateClientsFromRemote(force)
		if (result.error) {
			this.online.set(false)
		}
		this.loading.set(false)
	}

	async ngOnInit() {
		await this.doRefresh()
		this.updateUtils.getClient('LIGHTHOUSE').then((result) => {
			this.notificationBase.setClientToggleState('LIGHTHOUSE', result && result != 'null')
		})
		this.updateUtils.getClient('LODESTAR').then((result) => {
			this.notificationBase.setClientToggleState('LODESTAR', result && result != 'null')
		})
		this.updateUtils.getClient('PRYSM').then((result) => {
			this.notificationBase.setClientToggleState('PRYSM', result && result != 'null')
		})
		this.updateUtils.getClient('NIMBUS').then((result) => {
			this.notificationBase.setClientToggleState('NIMBUS', result && result != 'null')
		})
		this.updateUtils.getClient('TEKU').then((result) => {
			this.notificationBase.setClientToggleState('TEKU', result && result != 'null')
		})
		this.updateUtils.getClient('BESU').then((result) => {
			this.notificationBase.setClientToggleState('BESU', result && result != 'null')
		})
		this.updateUtils.getClient('ERIGON').then((result) => {
			this.notificationBase.setClientToggleState('ERIGON', result && result != 'null')
		})
		this.updateUtils.getClient('GETH').then((result) => {
			this.notificationBase.setClientToggleState('GETH', result && result != 'null')
		})
		this.updateUtils.getClient('NETHERMIND').then((result) => {
			this.notificationBase.setClientToggleState('NETHERMIND', result && result != 'null')
		})
		this.updateUtils.getClient('RETH').then((result) => {
			this.notificationBase.setClientToggleState('RETH', result && result != 'null')
		})
		this.updateUtils.getClient('GRANDINE').then((result) => {
			this.notificationBase.setClientToggleState('GRANDINE', result && result != 'null')
		})

		this.notificationBase.disableToggleLock()
	}

	closeModal() {
		if (this.notificationBase.settingsChanged) {
			//this.sync.syncAllSettings(true)
			// todo save
		}
		this.modalCtrl.dismiss()
	}
}
