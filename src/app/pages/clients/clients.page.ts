import { Component, OnInit, Input } from '@angular/core'
import { ModalController } from '@ionic/angular'
import ClientUpdateUtils from '../../utils/ClientUpdateUtils'
import { NotificationBase } from '../../tab-preferences/notification-base'
import { SyncService } from '../../services/sync.service'

@Component({
	selector: 'app-clients',
	templateUrl: './clients.page.html',
	styleUrls: ['./clients.page.scss'],
})
export class ClientsPage implements OnInit {
	@Input() clientIdentifier = ''

	constructor(
		private modalCtrl: ModalController,
		private updateUtils: ClientUpdateUtils,
		private sync: SyncService,
		public notificationBase: NotificationBase
	) {}

	ngOnInit() {
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

		this.notificationBase.disableToggleLock()
	}

	closeModal() {
		if (this.notificationBase.settingsChanged) {
			this.sync.syncAllSettings(true)
		}
		this.modalCtrl.dismiss()
	}
}
