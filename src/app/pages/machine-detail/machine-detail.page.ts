import { Component, OnInit, Input } from '@angular/core'
import { ModalController } from '@ionic/angular'
import { Options } from 'highcharts'
import { fromEvent, Subscription } from 'rxjs'
import { StorageService } from 'src/app/services/storage.service'
import MachineController, { ProcessedStats, bytes, MachineChartData } from '../../controllers/MachineController'

@Component({
	selector: 'app-machine-detail',
	templateUrl: './machine-detail.page.html',
	styleUrls: ['./machine-detail.page.scss'],
})
export class MachineDetailPage extends MachineController implements OnInit {
	@Input() key: string
	@Input() data: ProcessedStats
	@Input() timeframe: number
	@Input() selectedTab = 'cpu'

	cpuDelegate = (data: ProcessedStats) => {
		return this.doCPUCharts(data)
	}
	cpuSystemDelegate = (data: ProcessedStats) => {
		return this.doCPUSystemCharts(data)
	}
	memoryDelegate = (data: ProcessedStats) => {
		return this.doMemoryCharts(data)
	}
	syncDelegate = (data: ProcessedStats) => {
		return this.doSyncCharts(data)
	}
	diskDelegate = (data: ProcessedStats) => {
		return this.doDiskCharts(data)
	}
	diskIoDelegate = (data: ProcessedStats) => {
		return this.doDiskIoUsageCharts(data)
	}
	networkDelegate = (data: ProcessedStats) => {
		return this.doNetworkCharts(data)
	}
	memorySystemDelegate = (data: ProcessedStats) => {
		return this.doMemorySystemCharts(data)
	}
	peerDelegate = (data: ProcessedStats) => {
		return this.doPeerCharts(data)
	}
	beaconchainSizeDelegate = (data: ProcessedStats) => {
		return this.doBeaconchainSizeChart(data)
	}
	validatorDelegate = (data: ProcessedStats) => {
		return this.doValidatorChart(data)
	}

	scrolling = false

	headslot = 0
	coreCount = 0
	threadCount = 0
	uptime = 0
	os: string
	stateSynced: string

	validatorLabelActive = ''
	validatorLabelTotal = ''
	diskLabel = ''
	diskFullEst = 0
	beaconchainLabel = ''
	peerLabel = ''
	networkLabelRx = ''
	networkLabelTx = ''
	memoryLabelFree = ''
	memoryLabelTotal = ''
	memoryProcessLabelNode = ''
	memoryProcessLabelVal = ''
	cpuProcessLabelNode = ''
	cpuProcessLabelVal = ''
	cpuLabelTotal = ''
	diskUsageLabelReads = ''
	diskUsageLabelWrites = ''

	syncAttention = null
	diskAttention = null
	memoryAttention = null
	syncLabelState = ''
	syncLabelEth1Connected = ''

	isBuggyPrismVersion = false

	magicGapNumber = 60

	private backbuttonSubscription: Subscription

	constructor(private modalCtrl: ModalController, storage: StorageService) {
		super(storage)
	}

	async ngOnInit() {
		this.selectionTimeFrame = this.timeframe
		const event = fromEvent(document, 'backbutton')
		this.backbuttonSubscription = event.subscribe(() => {
			this.modalCtrl.dismiss()
		})

		if (this.data) {
			this.magicGapNumber = this.normalizeTimeframeNumber(this.data.system)
			this.os = this.formatOS(this.getLastFrom(this.data.system, (array) => array.misc_os))
			this.uptime = this.getLastFrom(this.data.system, (array) => array.misc_node_boot_ts_seconds) * 1000
			this.threadCount = this.getLastFrom(this.data.system, (array) => array.cpu_threads)
			this.coreCount = this.getLastFrom(this.data.system, (array) => array.cpu_cores)

			this.headslot = this.getLastFrom(this.data.node, (array) => array.sync_beacon_head_slot)

			const synced = this.getLastFrom(this.data.node, (array) => array.sync_eth2_synced)
			this.stateSynced = synced ? 'Synced' : 'Syncing'

			this.validatorLabelActive = 'Active: ' + this.getLastFrom(this.data.validator, (array) => array.validator_active)
			this.validatorLabelTotal = 'Total: ' + this.getLastFrom(this.data.validator, (array) => array.validator_total)

			const lastFreeBytes = this.getLastFrom(this.data.system, (array) => array.disk_node_bytes_free)
			const totalBytes = this.getLastFrom(this.data.system, (array) => array.disk_node_bytes_total)
			const percent = Math.round((lastFreeBytes * 1000) / totalBytes) / 10
			this.diskLabel = 'Free: ' + bytes(lastFreeBytes, true, true, 1) + ' - ' + percent + '%'
			this.beaconchainLabel =
				'Size: ' +
				bytes(
					this.getLastFrom(this.data.node, (array) => array.disk_beaconchain_bytes_total),
					true,
					true,
					3
				)

			this.peerLabel = 'Peers: ' + this.getLastFrom(this.data.node, (array) => array.network_peers_connected)

			this.networkLabelRx =
				'Receive: ' +
				bytes(
					this.getAvgFrom(this.data.system, (array) => array.network_node_bytes_total_receive / this.magicGapNumber, true),
					true,
					true,
					2
				) +
				'/s'
			this.networkLabelTx =
				'Transmit: ' +
				bytes(
					this.getAvgFrom(this.data.system, (array) => array.network_node_bytes_total_transmit / this.magicGapNumber, true),
					true,
					true,
					2
				) +
				'/s'

			const lastMemAv = this.getLastFrom(
				this.data.system,
				(array) => array.memory_node_bytes_free + array.memory_node_bytes_buffers + array.memory_node_bytes_cached
			)
			const lastMemTotal = this.getLastFrom(this.data.system, (array) => array.memory_node_bytes_total)
			const percentMem = Math.round(1000 - (lastMemAv * 1000) / lastMemTotal) / 10
			this.memoryLabelFree = 'Used: ' + bytes(lastMemTotal - lastMemAv, true, true, 1) + ' - ' + percentMem + '%'
			this.memoryLabelTotal =
				'Total: ' +
				bytes(
					this.getLastFrom(this.data.system, (array) => array.memory_node_bytes_total),
					true,
					true,
					1
				)

			this.memoryProcessLabelNode =
				'Node: ' +
				bytes(
					this.getLastFrom(this.data.node, (array) => array.memory_process_bytes),
					true,
					true,
					2
				)
			this.memoryProcessLabelVal =
				'Validator: ' +
				bytes(
					this.getLastFrom(this.data.validator, (array) => array.memory_process_bytes),
					true,
					true,
					2
				)

			this.cpuProcessLabelNode =
				'Node: ' +
				(
					this.getAvgRelativeFrom(
						this.getLastN(this.data.node, (array) => array.cpu_process_seconds_total, true),
						this.getLastN(this.data.system, (array) => array.cpu_node_system_seconds_total, true),
						(val1, val2) => {
							return val1 / val2
						}
					) * 100
				).toFixed(1) +
				'%'

			this.cpuProcessLabelVal =
				'Validator: ' +
				(
					this.getAvgRelativeFrom(
						this.getLastN(this.data.validator, (array) => array.cpu_process_seconds_total, true, 180),
						this.getLastN(this.data.system, (array) => array.cpu_node_system_seconds_total, true, 180),
						(val1, val2) => {
							return val1 / val2
						}
					) * 100
				).toFixed(2) +
				'%'

			this.cpuLabelTotal =
				'Current usage: ' +
				(
					100.0 -
					this.getAvgRelativeFrom(
						this.getLastN(this.data.system, (array) => array.cpu_node_idle_seconds_total, true),
						this.getLastN(this.data.system, (array) => array.cpu_node_system_seconds_total, true),
						(val1, val2) => {
							return val1 / val2
						}
					) *
						100
				).toFixed(1) +
				'%'

			this.diskUsageLabelReads =
				'Reads: ' + Math.round(this.getAvgFrom(this.data.system, (array) => array.disk_node_reads_total / this.magicGapNumber, true)) + ' iops'
			this.diskUsageLabelWrites =
				'Writes: ' + Math.round(this.getAvgFrom(this.data.system, (array) => array.disk_node_writes_total / this.magicGapNumber, true)) + ' iops'

			const eth1Connected = this.getLastFrom(this.data.node, (array) => array.sync_eth1_connected)
			this.syncLabelEth1Connected = eth1Connected ? 'Exec Connected' : 'Exec Offline'

			const fullySynced = this.getLastFrom(this.data.node, (array) => array.sync_eth2_synced)
			this.syncLabelState = fullySynced ? 'Synced' : 'Syncing...'

			this.syncAttention = this.getSyncAttention(this.data)
			this.diskAttention = await this.getDiskAttention(this.data)
			this.memoryAttention = await this.getMemoryAttention(this.data)

			this.isBuggyPrismVersion = this.isBuggyPrysmVersion(this.data)
		}
	}

	private formatOS(os: string) {
		switch (os) {
			case 'lin':
				return 'Linux'
			case 'win':
				return 'Windows'
			case 'mac':
				return 'macOS'
			default:
				return 'Unknown'
		}
	}

	ngOnDestroy() {
		this.backbuttonSubscription.unsubscribe()
	}

	closeModal() {
		this.modalCtrl.dismiss()
	}

	onScrollStarted() {
		this.scrolling = true
	}

	onScrollEnded() {
		this.scrolling = false
	}

	public doBeaconchainSizeChart(current: ProcessedStats): MachineChartData {
		const chartData = []

		if (current && current.node) {
			chartData.push({
				name: 'Beaconchain Size',
				color: '#7cb5ec',
				data: this.timeAxisChanges(current.node, (value) => {
					return value.disk_beaconchain_bytes_total
				}),
				pointWidth: 25,
			})
		}

		return {
			Data: chartData,
			Config: this.addBytesConfig(),
		} as MachineChartData
	}

	public doPeerCharts(current: ProcessedStats): MachineChartData {
		const chartData = []

		if (current && current.node) {
			chartData.push({
				name: 'Connected Peers',
				color: '#7cb5ec',
				data: this.timeAxisChanges(
					current.node,
					(value) => {
						return value.network_peers_connected
					},
					false
				),
				pointWidth: 25,
			})
		}

		return {
			Data: chartData,
			Config: this.addAbsoluteConfig(),
		} as MachineChartData
	}

	public doDiskCharts(current: ProcessedStats): MachineChartData {
		const chartData = []

		if (!current) return { Data: chartData } as MachineChartData
		if (!current.system) return { Error: 'system_missing' } as MachineChartData

		if (current && current.system) {
			const data = this.timeAxisChanges(
				current.system,
				(value) => {
					return value.disk_node_bytes_free
				},
				false
			)
			this.diskFullEst = this.getDiskFullTimeEstimate(data)
			chartData.push({
				name: 'Free Space',
				color: '#7cb5ec',
				data: data,
				pointWidth: 25,
			})
		}

		return {
			Data: chartData,
			Config: this.addBytesConfig(),
		} as MachineChartData
	}

	public doValidatorChart(current: ProcessedStats): MachineChartData {
		const chartData = []

		if (current && current.validator) {
			chartData.push({
				name: 'Total',
				color: '#7cb5ec',
				data: this.timeAxisChanges(
					current.validator,
					(value) => {
						return value.validator_total
					},
					false
				),
				pointWidth: 25,
			})
			chartData.push({
				name: 'Active',
				color: '#Dcb5ec',
				data: this.timeAxisChanges(
					current.validator,
					(value) => {
						return value.validator_active
					},
					false
				),
				pointWidth: 25,
			})
		}

		const absolute = this.addAbsoluteConfig()
		const special = {
			config: {
				yAxis: {
					allowDecimals: false,
				},
			},
		}
		const mergedConfig = Object.assign(absolute, special)

		return {
			Data: chartData,
			Config: mergedConfig,
			Error: undefined,
		} as MachineChartData
	}

	public doDiskIoUsageCharts(current: ProcessedStats): MachineChartData {
		const chartData = []

		if (!current) return { Data: chartData } as MachineChartData
		if (!current.system) return { Error: 'system_missing' } as MachineChartData

		if (current && current.system) {
			chartData.push({
				name: 'Reads',
				color: '#Dcb5ec',
				data: this.timeAxisChanges(
					current.system,
					(value) => {
						return value.disk_node_reads_total / this.magicGapNumber
					},
					true
				),
				pointWidth: 25,
			})
			chartData.push({
				name: 'Writes',
				color: '#7cb5ec',
				data: this.timeAxisChanges(
					current.system,
					(value) => {
						return value.disk_node_writes_total / this.magicGapNumber
					},
					true
				),
				pointWidth: 25,
			})
		}

		return {
			Data: chartData,
			Config: this.addAbsoluteConfig(' iops'),
		} as MachineChartData
	}

	public doNetworkCharts(current: ProcessedStats): MachineChartData {
		const chartData = []

		if (!current) return { Data: chartData } as MachineChartData
		if (!current.system) return { Error: 'system_missing' } as MachineChartData

		if (current && current.system) {
			console.log('system', current.system)
			chartData.push({
				name: 'Receive',
				color: '#7cb5ec',
				data: this.timeAxisChanges(
					current.system,
					(value) => {
						return value.network_node_bytes_total_receive / this.magicGapNumber
					},
					true
				),
				pointWidth: 25,
			})
			chartData.push({
				name: 'Transmit',
				color: '#Dcb5ec',
				data: this.timeAxisChanges(
					current.system,
					(value) => {
						return value.network_node_bytes_total_transmit / this.magicGapNumber
					},
					true
				),
				pointWidth: 25,
			})
		}

		return {
			Data: chartData,
			Config: this.addBytesConfig(true),
		} as MachineChartData
	}

	public doCPUSystemCharts(current: ProcessedStats): MachineChartData {
		const chartData = []

		if (!current) return { Data: chartData } as MachineChartData
		if (!current.system) return { Error: 'system_missing' } as MachineChartData

		const cpuSystemTotal = this.timeAxisChanges(
			current.system,
			(value) => {
				return value.cpu_node_system_seconds_total
			},
			true
		)
		const idle = this.timeAxisChanges(
			current.system,
			(value) => {
				return value.cpu_node_idle_seconds_total
			},
			true
		)
		const user = this.timeAxisChanges(
			current.system,
			(value) => {
				return value.cpu_node_user_seconds_total
			},
			true
		)
		const io = this.timeAxisChanges(
			current.system,
			(value) => {
				return value.cpu_node_iowait_seconds_total
			},
			true
		)

		if (current && current.system) {
			chartData.push({
				name: 'Total Usage',
				color: '#7cb5ec',
				data: this.timeAxisRelative(cpuSystemTotal, idle, true),
				pointWidth: 25,
			})
			chartData.push({
				name: 'User',
				color: '#Dcb5ec',
				data: this.timeAxisRelative(cpuSystemTotal, user, false),
				pointWidth: 25,
			})
			chartData.push({
				name: 'IO Wait',
				color: '#3335FF',
				data: this.timeAxisRelative(cpuSystemTotal, io, false, 100),
				pointWidth: 25,
			})
			/*chartData.push(
        {
          name: 'Idle',
          color: '#3FF5ec',
          data: idle,
          pointWidth: 25,
        }
      )*/
		}

		return {
			Data: chartData,
			Config: {
				config: {
					tooltip: {
						style: {
							color: 'var(--text-color)',
							fontWeight: 'bold',
						},
						pointFormatter: function () {
							return '<span style="color:' + this.color + '">\u25CF</span> ' + this.series.name + ': <b>' + this.y.toFixed(2) + '%' + '</b>'
						},
					},
					yAxis: {
						labels: {
							x: -5,
							formatter: function () {
								return this.value + '%'
							},
						},
					},
				} as Options,
			},
		} as MachineChartData
	}

	public doMemorySystemCharts(current: ProcessedStats): MachineChartData {
		const chartData = []

		if (!current) return { Data: chartData } as MachineChartData
		if (!current.system) return { Error: 'system_missing' } as MachineChartData

		if (current && current.system) {
			chartData.push({
				name: 'Total',
				color: '#7cb5ec',
				data: this.timeAxisChanges(current.system, (value) => {
					return value.memory_node_bytes_total
				}),
				pointWidth: 25,
			})

			chartData.push({
				name: 'Cached',
				color: '#3335FF',
				data: this.timeAxisChanges(current.system, (value) => {
					return value.memory_node_bytes_cached
				}),
				pointWidth: 25,
			})
			chartData.push({
				name: 'Buffer',
				color: '#3FF5ec',
				data: this.timeAxisChanges(current.system, (value) => {
					return value.memory_node_bytes_buffers
				}),
				pointWidth: 25,
			})
			chartData.push({
				name: 'Free',
				color: '#Dcb5ec',
				data: this.timeAxisChanges(current.system, (value) => {
					return value.memory_node_bytes_free
				}),
				pointWidth: 25,
			})
		}

		return {
			Data: chartData,
			Config: this.addBytesConfig(),
		} as MachineChartData
	}

	getDiskFullTimeEstimate(data: number[][]): number {
		const amount = data[data.length - 1][1] - data[0][1]
		const tsDiff = Math.abs(data[data.length - 1][0] - data[0][0])
		if (amount > 0) return 0
		return Date.now() + (data[0][1] / Math.abs(amount)) * tsDiff
	}
}
