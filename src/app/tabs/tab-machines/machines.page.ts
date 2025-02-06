import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { ModalController } from '@ionic/angular'
import { MachineDetailPage } from '@pages/machine-detail/machine-detail.page'
import MachineController, { ProcessedStats } from '../../controllers/MachineController'
import { AlertService } from 'src/app/services/alert.service'
import { MerchantUtils } from 'src/app/utils/MerchantUtils'
import { StorageService } from 'src/app/services/storage.service'
import { OAuthUtils } from 'src/app/utils/OAuthUtils'

import { Browser } from '@capacitor/browser'
import { ApiService } from 'src/app/services/api.service'
import { APIUnauthorizedError } from 'src/app/requests/requests'
import { V2MyMachines } from '@requests/v2-user'

@Component({
	selector: 'app-machines',
	templateUrl: './machines.page.html',
	styleUrls: ['./machines.page.scss'],
	standalone: false,
})
export class MachinesPage extends MachineController implements OnInit {
	data: Map<string, ProcessedStats> = null
	scrolling = false
	selectedChart = 'cpu'
	showData = true
	selectedTimeFrame: string = '3h'

	loggedIn = false

	orderedKeys: string[] = []
	legacyApi = false

	initialLoading: boolean = true
	online: boolean = true

	cpuDelegate = (data: ProcessedStats) => {
		return this.doCPUCharts(data)
	}
	memoryDelegate = (data: ProcessedStats) => {
		return this.doMemoryCharts(data)
	}
	syncDelegate = (data: ProcessedStats) => {
		return this.doSyncCharts(data)
	}
	clientFormatter = (data: ProcessedStats) => {
		return this.formatClientText(data)
	}
	onlineStateDelegate = async (data: ProcessedStats) => {
		return await this.getOnlineState(data)
	}
	machineClickDelegate = (data: string) => {
		return () => {
			return this.openMachineDetail(data)
		}
	}

	constructor(
		private modalController: ModalController,
		private alertService: AlertService,
		public merchant: MerchantUtils,
		private storage: StorageService,
		private oauthUtils: OAuthUtils,
		private ref: ChangeDetectorRef,
		protected api: ApiService
	) {
		super(storage)
	}

	ngOnInit() {
		// this.validatorUtils.registerListener(() => {
		// 	this.getAndProcessData()
		// })
	}

	async doRefresh(event: { target: { complete: () => void } }) {
		await this.getAndProcessData()
		setTimeout(() => {
			if (event) event.target.complete()
			this.ref.detectChanges()
		}, 500)
	}

	lastEnter = 0
	async ionViewWillEnter() {
		if (this.lastEnter == 0 || this.lastEnter + 5 * 60 * 1000 < Date.now()) {
			this.lastEnter = Date.now()
			this.getAndProcessData()
		}
		this.loggedIn = await this.storage.isLoggedIn()
	}

	delegater(func: unknown) {
		return () => {
			return func
		}
	}

	async login() {
		await this.oauthUtils.login()
		this.loggedIn = await this.storage.isLoggedIn()
	}

	formatClientText(data: ProcessedStats) {
		let result = null
		if (data.client) result = data.client
		if (!result) return result

		if (data.clientVersion) result += ' v' + data.clientVersion
		if (result.length > 22) {
			return result.substring(0, 20) + '...'
		}
		return result
	}

	openTimeSelection() {
		if (!this.merchant.hasMachineMonitoringPremium()) {
			this.alertService.showInfo('Limit Reached', 'Upgrade to premium to get up to 30 days of monitoring data')
			return
		}

		this.alertService.showSelect(
			'Time',
			[
				{
					name: 'time',
					label: '3h',
					value: '3h',
					type: 'radio',
				},
				{
					name: 'time',
					label: '12h',
					value: '12h',
					type: 'radio',
				},
				{
					name: 'time',
					label: '24h',
					value: '24h',
					type: 'radio',
				},
				{
					name: 'time',
					label: '2d',
					value: '2d',
					type: 'radio',
				},
				{
					name: 'time',
					label: '7d',
					value: '7d',
					type: 'radio',
				},
				{
					name: 'time',
					label: '14d',
					value: '14d',
					type: 'radio',
				},
				{
					name: 'time',
					label: '30d',
					value: '30d',
					type: 'radio',
				},
			],
			(data) => {
				if (data) {
					if (data != this.selectedChart) {
						this.selectedTimeFrame = data as string
						this.selectionTimeFrame = this.getTimeSelectionLimit()
						this.data = null
						this.getAndProcessData()
					}
				}
			}
		)
	}

	getTimeSelectionLimit(): number {
		switch (this.selectedTimeFrame) {
			case '3h':
				return 180
			case '12h':
				return 720
			case '24h':
				return 1440
			case '2d':
				return 2880
			case '7d':
				return 10080
			case '14d':
				return 20160
			case '30d':
				return 43200
		}
		return 180
	}

	async getAndProcessData() {
		this.loggedIn = await this.storage.isLoggedIn()
		if (!this.loggedIn) {
			this.data = new Map()
			this.orderedKeys = []
			this.showData = false
			this.initialLoading = false
			return
		}

		this.data = await this.getAndProcessDataBase(this.getTimeSelectionLimit())
		// const machineNames = this.getAllMachineNamesFrom(this.data)
		// console.log('machine names', machineNames)

		this.orderedKeys = await this.getOrderedKeys(this.data)
		this.showData = this.data.size > 0
		this.initialLoading = false
	}

	// private getAllMachineNamesFrom(data: Map<string, ProcessedStats>): string[] {
	// 	const result: string[] = []
	// 	for (const key of data.keys()) {
	// 		result.push(key)
	// 	}
	// 	return result
	// }

	private async getAndProcessDataBase(timeslot = 180) {
		const apiResult = await this.api.execute(new V2MyMachines(0, timeslot))
		if (apiResult.error) {
			//this.dashboardUtils.defaultDashboardErrorHandler(apiResult.error)
			if (!(apiResult.error instanceof APIUnauthorizedError)) {
				this.online = false
			}
			return
		}

		if (apiResult.data == null) {
			return new Map()
		}

		const machineController = new MachineController(this.storage)

		const result = await machineController.combineByMachineName(
			machineController.filterMachines(apiResult.data.validator_metrics),
			machineController.filterMachines(apiResult.data.node_metrics),
			machineController.filterMachines(apiResult.data.system_metrics)
		)

		console.log('baum', result.size, machineController.filterMachines(apiResult.data.system_metrics))

		return result
	}

	private async getOrderedKeys(data: Map<string, ProcessedStats>): Promise<string[]> {
		if (!data) return []

		const online = []
		const attention = []
		const offline = []

		for (const key of Array.from(data.keys())) {
			const it = data.get(key)
			const status = await this.getOnlineState(it)
			if (status == 'online') {
				online.push(key)
			} else if (status == 'offline') {
				offline.push(key)
			} else {
				attention.push(key)
			}
		}

		// sorting arrays
		online.sort((a, b) => a.localeCompare(b))
		attention.sort((a, b) => a.localeCompare(b))
		offline.sort((a, b) => a.localeCompare(b))

		// concating keys
		const result = online.concat(attention).concat(offline)

		return result
	}

	async openMachineDetail(key: string) {
		const processedStats = this.data.get(key) as ProcessedStats
		const attention = this.getSyncAttention(processedStats)
		const diskAttention = await this.getDiskAttention(processedStats)
		const memoryAttention = await this.getMemoryAttention(processedStats)

		const modal = await this.modalController.create({
			component: MachineDetailPage,
			cssClass: 'my-custom-class',
			componentProps: {
				data: processedStats,
				key: key,
				timeframe: this.selectionTimeFrame,
				selectedTab: attention ? 'sync' : diskAttention ? 'disk' : memoryAttention ? 'memory' : this.selectedChart,
			},
		})
		return await modal.present()
	}

	onScrollStarted() {
		this.scrolling = true
	}

	onScrollEnded() {
		this.scrolling = false
	}

	async openBrowser(link: string) {
		await Browser.open({ url: link, toolbarColor: '#2f2e42' })
	}
}
