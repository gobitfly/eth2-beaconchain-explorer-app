import { Component, Input, WritableSignal, signal, SimpleChanges } from '@angular/core'
import { ModalController } from '@ionic/angular'
import ClientUpdateUtils, { ClientInfo, Clients } from '@utils/ClientUpdateUtils'
import { NotificationBase } from '../../tabs/tab-preferences/notification-base'
import { StorageService } from 'src/app/services/storage.service'
@Component({
	selector: 'app-clients',
	templateUrl: './clients.page.html',
	styleUrls: ['./clients.page.scss'],
	standalone: false,
})
export class ClientsPage {
	@Input() clientIdentifier = ''

	loading: WritableSignal<boolean> = signal(false)
	online: WritableSignal<boolean> = signal(true)

	clients: ClientInfo[] = null

	constructor(
		private modalCtrl: ModalController,
		private updateUtils: ClientUpdateUtils,
		public notificationBase: NotificationBase,
		private storage: StorageService
	) {}

	ngOnChanges(changes: SimpleChanges) {
		if (changes.clientIdentifier && !changes.clientIdentifier.firstChange) {
			this.init() // Refresh data based on new identifier
		}
	}

	async doRefresh(force: boolean = false) {
		if (!(await this.storage.isLoggedIn())) return
		this.loading.set(true)
		const result = await this.notificationBase.updateClientsFromRemote(force)
		if (result.error) {
			this.online.set(false)
		}
		this.loading.set(false)
	}

	getClientListFilter() {
		if (this.clientIdentifier == 'eth1Clients') {
			return 'exec'
		}
		if (this.clientIdentifier == 'eth2Clients') {
			return 'cons'
		}
		return '3rdparty'
	}

	async init() {
		this.clients = Clients.filter((client) => client.type == this.getClientListFilter())
		await this.doRefresh()

		for (const client of this.clients) {
			this.updateUtils.getClient(client.key).then((result) => {
				this.notificationBase.setClientToggleState(client.key, result && result != 'null')
			})
		}

		this.notificationBase.disableToggleLock()
	}

	ionViewWillEnter() {
		this.init()
	}

	closeModal() {
		if (this.notificationBase.settingsChanged) {
			//this.sync.syncAllSettings(true)
			// todo save
		}
		this.modalCtrl.dismiss()
	}
}
