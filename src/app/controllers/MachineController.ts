/*
 *  // Copyright (C) 2020 - 2024 bitfly explorer GmbH
 *  //
 *  // This file is part of Beaconchain Dashboard.
 *  //
 *  // Beaconchain Dashboard is free software: you can redistribute it and/or modify
 *  // it under the terms of the GNU General Public License as published by
 *  // the Free Software Foundation, either version 3 of the License, or
 *  // (at your option) any later version.
 *  //
 *  // Beaconchain Dashboard is distributed in the hope that it will be useful,
 *  // but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  // GNU General Public License for more details.
 *  //
 *  // You should have received a copy of the GNU General Public License
 *  // along with Beaconchain Dashboard.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Options } from 'highcharts'
import { HDD_THRESHOLD, RAM_THRESHOLD, StorageService } from '../services/storage.service'
import { MachineMetricNode, MachineMetricSystem, MachineMetricValidator } from '../requests/types/machine_metrics'
import { environment } from 'src/environments/environment'

const OFFLINE_THRESHOLD = 8 * 60 * 1000

export interface MachineChartData {
	Data: Highcharts.SeriesAreaOptions[]
	Config: MachineChartConfig
	Error?: string | undefined
}

export default class MachineController {
	constructor(private store: StorageService) {}

	selectionTimeFrame = 180

	public addBytesConfig(perS = false): MachineChartConfig {
		return {
			config: {
				tooltip: {
					style: {
						color: 'var(--text-color)',
						fontWeight: 'bold',
					},
					pointFormatter: function () {
						return (
							'<span style="color:' +
							this.color +
							'">\u25CF</span> ' +
							this.series.name +
							': <b>' +
							bytes(this.y, true, true) +
							(perS ? '/s' : '') +
							'</b>'
						)
					},
				},
				yAxis: {
					labels: {
						x: -5,
						formatter: function () {
							return bytes(parseInt(this.value.toString()), true, this.isFirst, 0) + (perS ? '/s' : '')
						},
					},
				},
			} as Options,
		}
	}

	public addAbsoluteConfig(postFix = '') {
		return {
			config: {
				tooltip: {
					style: {
						color: 'var(--text-color)',
						fontWeight: 'bold',
					},
					// @ts-expect-error: noImplicitThis disabled for this line
					pointFormatter: function () {
						// @ts-expect-error: noImplicitThis disabled for this line
						return '<span style="color:' + this.color + '">\u25CF</span> ' + this.series.name + ': <b>' + this.y.toFixed(0) + postFix + '</b>'
					},
				},
				yAxis: {
					labels: {
						x: -5,
						// @ts-expect-error: noImplicitThis disabled for this line
						formatter: function () {
							// @ts-expect-error: noImplicitThis disabled for this line
							return this.value
						},
					},
				} as Options,
			},
		}
	}

	public doMemoryCharts(current: ProcessedStats): MachineChartData {
		const chartData = []

		if (current && current.system_metrics) {
			chartData.push({
				name: 'Memory: System',
				color: '#7cb5ec',
				data: this.timeAxisChanges(current.system_metrics, (value) => {
					return value.memory_node_bytes_total
				}),
				pointWidth: 25,
			})
		}

		if (current && current.node_metrics) {
			chartData.push({
				name: 'Memory: Beaconnode',
				color: '#Dcb5ec',
				data: this.timeAxisChanges(current.node_metrics, (value) => {
					return value.memory_process_bytes
				}),
				pointWidth: 25,
			})
		}

		if (current && current.validator_metrics) {
			chartData.push({
				name: 'Memory: Validator',
				color: '#3FF5ec',
				data: this.timeAxisChanges(current.validator_metrics, (value) => {
					return value.memory_process_bytes
				}),
				pointWidth: 25,
			})
		}

		return {
			Data: chartData,
			Config: this.addBytesConfig(),
		} as unknown as MachineChartData
	}

	public doCPUCharts(current: ProcessedStats): MachineChartData {
		const chartData: { name: string; color: string; data: unknown[][]; pointWidth: number }[] = []

		if (!current) return { Data: chartData } as unknown as MachineChartData
		if (!current.system_metrics) return { Error: 'system_missing' } as MachineChartData

		const cpuSystemTotal = this.timeAxisChanges(
			current.system_metrics,
			(value) => {
				return value.cpu_node_system_seconds_total
			},
			true
		)

		if (current && current.validator_metrics) {
			const cpuValidator = this.timeAxisChanges(
				current.validator_metrics,
				(value) => {
					return value.cpu_process_seconds_total
				},
				true
			)
			chartData.push({
				name: 'CPU: Validator',
				color: '#7cb5ec',
				data: this.timeAxisRelative(cpuSystemTotal, cpuValidator, false, 100), //this.timeAxisChanges(current.validator, (value) => { return value.cpu_process_seconds_total }, true),
				pointWidth: 25,
			})
		}

		if (current && current.node_metrics) {
			const cpuNode = this.timeAxisChanges(
				current.node_metrics,
				(value) => {
					return value.cpu_process_seconds_total
				},
				true
			)
			chartData.push({
				name: 'CPU: Beaconnode',
				color: '#Dcb5ec',
				data: this.timeAxisRelative(cpuSystemTotal, cpuNode, false), //this.timeAxisChanges(current.node, (value) => { return value.cpu_process_seconds_total }, true),
				pointWidth: 25,
			})
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
		} as unknown as MachineChartData
	}

	public doSyncCharts(current: ProcessedStats): MachineChartData {
		const chartData = []

		if (current && current.node_metrics) {
			chartData.push({
				name: 'Exec Connected',
				color: '#3335FF',
				data: this.timeAxisChanges(
					current.node_metrics,
					(value) => {
						return value.sync_eth1_connected ? 1.2 : 0
					},
					false
				),
				pointWidth: 25,
			})
		}

		if (current && current.node_metrics) {
			chartData.push({
				name: 'Cons Synced',
				color: '#3FF5ec',
				data: this.timeAxisChanges(
					current.node_metrics,
					(value) => {
						return value.sync_eth2_synced ? 1.3 : 0
					},
					false
				),
				pointWidth: 25,
			})
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
							return '<span style="color:' + this.color + '">\u25CF</span> ' + this.series.name + ': <b>' + (this.y ? 'True' : 'False') + '</b>'
						},
					},
					yAxis: {
						allowDecimals: false,
						labels: {
							x: -5,
							step: 1,
							formatter: function () {
								return parseFloat(this.value.toString()) >= 1 ? 'True' : 'False'
							},
						},
					},
				} as Options,
			},
		} as unknown as MachineChartData
	}

	isBuggyPrysmVersion(data: ProcessedStats): boolean {
		return data.client == 'prysm' && (!data.system_metrics || data.system_metrics.length <= 2 || data.system_metrics[0].cpu_cores == 0)
	}

	async getAnyAttention(data: ProcessedStats) {
		const sync = this.getSyncAttention(data)
		if (sync) return sync
		const disk = await this.getDiskAttention(data)
		if (disk) return disk
		return await this.getMemoryAttention(data)
	}

	protected async getDiskAttention(data: ProcessedStats): Promise<string> {
		if (!data || !data.system_metrics) return null
		const freePercentage = this.getLastFrom(data.system_metrics, (array) => array.disk_node_bytes_free / array.disk_node_bytes_total)
		const threshold = 100 - ((await this.store.getSetting(HDD_THRESHOLD, 90)) as number)
		console.log('HDD threshold', threshold)

		if (freePercentage < threshold / 100) {
			return "Your disk is almost full. There's less than " + threshold + '% free space available.'
		}

		return null
	}

	protected async getMemoryAttention(data: ProcessedStats): Promise<string> {
		if (!data || !data.system_metrics) return null
		const usagePercentage =
			1 -
			this.getLastFrom(
				data.system_metrics,
				(array) => (array.memory_node_bytes_free + array.memory_node_bytes_buffers + array.memory_node_bytes_cached) / array.memory_node_bytes_total
			)
		const threshold = (await this.store.getSetting(RAM_THRESHOLD, 80)) as number
		console.log('RAM threshold', threshold, usagePercentage)

		if (usagePercentage > threshold / 100) {
			return 'Your RAM usage exceeded ' + threshold + '% of the available space.'
		}

		return null
	}

	async getOnlineState(data: ProcessedStats) {
		if (!data || !data.formattedDate) return 'offline'
		const now = Date.now()
		const diff = now - data.formattedDate.getTime()
		if (diff > OFFLINE_THRESHOLD) return 'offline'

		if ((await this.getAnyAttention(data)) != null) {
			return 'attention'
		}
		return 'online'
	}

	protected getSyncAttention(data: ProcessedStats): string {
		const synced = this.getLastFrom(data.node_metrics, (array) => array.sync_eth2_synced)
		const eth1Connected = this.getLastFrom(data.node_metrics, (array) => array.sync_eth1_connected)

		if (!data.node_metrics) {
			return "No beaconnode data found. If you wish to track this data, make sure to configure metric tracking on your beaconnode machine too. <a target='_blank' href='https://kb.beaconcha.in/mobile-app-less-than-greater-than-beacon-node'>Learn more here</a>."
		} else if (!eth1Connected) {
			return 'No execution client connection, make sure you have configured an execution endpoint and it is currently active and synced.'
		} else if (!synced) {
			return 'Your beaconnode is currently syncing. It might take some time to get fully synced.'
		} else if (!data.validator_metrics) {
			return "No validator data found. If you wish to track this data, make sure to configure metric tracking on your validator machine too. <a target='_blank' href='https://kb.beaconcha.in/mobile-app-less-than-greater-than-beacon-node'>Learn more here</a>."
		}
		return null
	}

	protected getLastN<T>(dataArray: T[], callbackValue: (array: T) => number, isDiffPair = false, depth = 10): number[] {
		const erg = []
		if (!dataArray) return null
		const length = Math.min(dataArray.length, depth)
		if (length <= 0) return null

		if (isDiffPair && length <= 2) return null

		for (let i = 1; i < length; i++) {
			if (isDiffPair) {
				erg[i - 1] = callbackValue(dataArray[dataArray.length - i]) - callbackValue(dataArray[dataArray.length - (i + 1)])
			} else {
				erg[i - 1] = callbackValue(dataArray[dataArray.length - i])
			}
		}

		return erg
	}

	protected getAvgFrom<T>(dataArray: T[], callbackValue: (array: T) => number, isDiffPair = false, depth = 10): number {
		const data = this.getLastN(dataArray, callbackValue, isDiffPair, depth)
		if (!data) return null

		const erg = data.reduce((sum, cur) => sum + cur)

		return Math.round((erg / (depth - 1)) * 100) / 100
	}

	protected getAvgRelativeFrom(data1LastN: number[], data2LastN: number[], callback: (val1: number, val2: number) => number) {
		if (!data1LastN || !data2LastN) return null
		const length = Math.min(data1LastN.length, data2LastN.length)

		let erg = 0
		for (let i = 0; i < length; i++) {
			const second = data2LastN[i]
			if (second == 0) continue
			erg += callback(data1LastN[i], second)
		}

		console.log('getAvgRelativeFrom', Math.round((erg / length) * 10000) / 10000)
		return Math.round((erg / length) * 10000) / 10000
	}

	protected getLastFrom<T, V>(dataArray: T[], callbackValue: (array: T) => V): V {
		if (!dataArray || dataArray.length <= 0) return null
		const first = callbackValue(dataArray[dataArray.length - 1])
		return first
	}

	// --- Data helper functions ---

	getTimeDiff(dataSet: number[][], startIndex: number, endIndex: number) {
		return Math.abs(dataSet[startIndex][0] - dataSet[endIndex][0])
	}

	getGapSize(dataSet: number[][]) {
		if (!dataSet || dataSet.length == 0) return 60000
		let temp = this.getTimeDiff(dataSet, dataSet.length - 2, dataSet.length - 1)

		if (isNaN(temp) || temp < 30000) temp = this.getTimeDiff(dataSet, 0, 1)
		if (isNaN(temp) || temp < 30000) temp = Math.abs(dataSet[0][0] - dataSet[1][0])
		if (isNaN(temp) || temp < 30000) temp = Math.abs(dataSet[dataSet.length - 2][0] - dataSet[dataSet.length - 1][0])

		if (isNaN(temp) || temp < 30000) temp = 60000
		return temp
	}

	normalizeTimeframeNumber(dataSet: number[][]): number {
		const gapSize = Math.round(this.getGapSize(dataSet) / 1000)
		return gapSize
	}

	timeAxisRelative(max: number[][], current: number[][], inverted = false, rounding = 10) {
		const result = []
		const gapSize = this.normalizeTimeframeNumber(max)

		let maxOffset = 0
		let currentOffset = 0

		// eslint-disable-next-line no-constant-condition
		while (true) {
			if (current.length <= currentOffset) break
			if (max.length <= maxOffset) break
			const curV = current[currentOffset]
			const maxV = max[maxOffset]

			const drift = curV[0] - maxV[0]

			if (drift > gapSize * 1500) {
				maxOffset++
				continue
			} else if (drift < gapSize * -1500) {
				currentOffset++
				continue
			}

			const tempValue = maxV[1] == 0 ? 0 : Math.round((curV[1] / maxV[1]) * (100 * rounding)) / rounding
			const value = inverted ? Math.round((100 - tempValue) * 10) / 10 : tempValue
			result.push([maxV[0], maxV[1] == 0 ? 0 : value])

			maxOffset++
			currentOffset++
		}
		return result
	}

	public timeAxisChanges<T extends StatsBase>(data: T[], delegateValue: (value: T, timeDiff?: unknown) => number, accumilative = false) {
		let result: number[][] = []
		let summedUp = -1
		let lastValue = 0
		let lastTimestamp = -1
		data.forEach((value) => {
			const current = delegateValue(value, value.timestamp - lastTimestamp)
			if (accumilative && current < summedUp) summedUp = 0

			const temp = accumilative ? Math.round((current - summedUp) * 100) / 100 : current

			if (lastTimestamp != -1 && lastTimestamp + this.selectionTimeFrame * 60 * 1000 < value.timestamp) {
				console.log('shorting selection: ', this.selectionTimeFrame)
				result = []
				summedUp = -1
			} else {
				if (lastTimestamp != -1 && lastTimestamp + 45 * 60 * 1000 < value.timestamp) {
					console.log('filling empty plots with zeros: ', lastTimestamp, value.timestamp)

					this.fillWithZeros(result, lastTimestamp, value.timestamp)

					summedUp = -1
				}
			}

			if (summedUp != -1 || !accumilative) {
				if (!accumilative || summedUp * 25 > temp) {
					result.push([value.timestamp, temp > 0 ? temp : 0])
				} else {
					summedUp = temp
				}
			}

			lastTimestamp = value.timestamp
			lastValue = current
			if (accumilative) {
				summedUp = lastValue
			}
		})
		return result
	}

	fillWithZeros(array: number[][], from: number, to: number): number[][] {
		const interval = 60000
		for (let i: number = from + interval; i < to - interval; i += interval) {
			array.push([i, 0])
		}
		return array
	}

	public async combineByMachineName(validator: Map<string, StatsValidator[]>, node: Map<string, StatsNode[]>, system: Map<string, StatsSystem[]>) {
		const allKeys = this.findAllKeys(validator, node, system)
		const debugShowOldMachines = await this.store.getBooleanSetting('debug_show_old_machines', false)

		const result: Map<string, ProcessedStats> = new Map()
		for (const key of allKeys) {
			const sortedVal = this.sortData(validator.get(key))
			const sortedNode = this.sortData(node.get(key))
			const sortedSystem = this.sortData(system.get(key))

			const unixTime = this.findAnyData(sortedVal, sortedNode, sortedSystem, (value) => {
				return value.timestamp
			})

			// do not display machines that have not been online for more than 4 days
			if (!debugShowOldMachines && !environment.mock_combine_machines && unixTime && Date.now() - unixTime > 96 * 60 * 60 * 1000) {
				continue
			}

			result.set(key, {
				validator_metrics: sortedVal,
				node_metrics: sortedNode,
				system_metrics: sortedSystem,
				client: this.findAnyData(sortedVal, sortedNode, sortedSystem, (value) => {
					return (value as ProcessBase).client_name
				}),
				clientVersion: this.findAnyData(sortedVal, sortedNode, sortedSystem, (value) => {
					return (value as ProcessBase).client_version
				}),
				formattedDate: unixTime ? new Date(unixTime) : null,
				status: 'ONLINE',
			})
		}

		return result
	}

	public sortData<Type extends StatsBase>(array: Type[]): Type[] {
		if (!array) return array
		return array.sort((n1, n2) => {
			if (n1.timestamp > n2.timestamp) return 1
			if (n1.timestamp < n2.timestamp) return -1
			return 0
		})
	}

	public findAnyData<V>(
		validator: StatsValidator[],
		node: StatsNode[],
		system: StatsSystem[],
		dataCallback: (value: StatsValidator | StatsNode | StatsSystem) => V
	) {
		const result1 = this.findAnyDataIn(validator, dataCallback)
		const result3 = this.findAnyDataIn(node, dataCallback)
		const result4 = this.findAnyDataIn(system, dataCallback)
		return result1 != null ? result1 : result3 != null ? result3 : result4 != null ? result4 : null
	}

	public findAnyDataIn<T, V>(current: T[], dataCallback: (value: T) => V) {
		if (!current || current.length <= 0) return null
		const result = dataCallback(current[current.length - 1])
		if (result) {
			return result
		}
		return null
	}

	public findAllKeys(validator: Map<string, StatsValidator[]>, node: Map<string, StatsNode[]>, system: Map<string, StatsSystem[]>): string[] {
		const set = new Set<string>()
		for (const key of validator.keys()) {
			set.add(key)
		}
		for (const key of node.keys()) {
			set.add(key)
		}
		for (const key of system.keys()) {
			set.add(key)
		}
		return Array.from(set)
	}

	public filterMachines<T extends StatsBase>(data: T[]): Map<string, T[]> {
		return data.reduce((result, current) => {
			if (environment.mock_combine_machines) {
				current.machine = 'test'
			}

			const existingArray = result.get(current.machine) || []
			existingArray.push(current)
			result.set(current.machine, existingArray)
			return result
		}, new Map<string, T[]>())
	}

	public hashCode(string: string) {
		let hash = 0
		for (let i = 0; i < string.length; i++) {
			const character = string.charCodeAt(i)
			hash = (hash << 5) - hash + character
			hash = hash & hash
		}
		return hash
	}
}

export const bytes = (function () {
	const s = ['b', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'],
		tempLabel: number[] = []
	let count: number

	return function (byteData: number, label: unknown, isFirst: unknown, precision = 3) {
		let e, value

		if (byteData == 0) return 0

		if (isFirst) count = 0

		e = Math.floor(Math.log(byteData) / Math.log(1024))
		value = parseInt((byteData / Math.pow(1024, Math.floor(e))).toFixed(precision))

		tempLabel[count] = value
		if (count > 0 && Math.abs(tempLabel[count - 1] - tempLabel[count]) < 0.0001)
			value = (byteData / Math.pow(1024, Math.floor(--e))).toFixed(precision)

		e = e < 0 ? -e : e
		if (label) value += ' ' + s[e]

		count++
		return value
	}
})()

export interface MachineChartConfig {
	config: Options
}

export interface ProcessedStats extends StatsResponse {
	client: string
	clientVersion: string
	formattedDate: Date
	status: 'ONLINE' | 'OFFLINE'
}

export interface StatsBase {
	machine?: string
	timestamp?: number
	//row: number
}

export interface ProcessBase extends StatsBase {
	client_name?: string
	client_version?: string
	cpu_process_seconds_total?: number
	memory_process_bytes?: number
}

export interface StatsResponse {
	validator_metrics: StatsValidator[]
	node_metrics: StatsNode[]
	system_metrics: StatsSystem[]
}

export interface StatsValidator extends MachineMetricValidator, ProcessBase {}

export interface StatsNode extends MachineMetricNode, ProcessBase {}

export interface StatsSystem extends MachineMetricSystem, StatsBase {}
