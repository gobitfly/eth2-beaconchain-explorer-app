import { Component, computed, Input, OnInit } from '@angular/core'
import { Toast } from '@capacitor/toast'
import { OverviewData2, OverviewProvider } from '@controllers/OverviewController'
import { ChartData } from '@requests/types/common'
import { Aggregation, V2DashboardSummaryChart } from '@requests/v2-dashboard'
import { AlertService } from '@services/alert.service'
import { getChartTextColor, getChartTooltipBackgroundColor, getSummaryChartGroupColors } from '@utils/ColorUtils'
import { MerchantUtils } from '@utils/MerchantUtils'
import {
	formatGoTimestamp,
	formatTsToDateTime,
	formatTsToTime,
	getEndTs,
	getLocale,
	ONE_DAY,
	ONE_HOUR,
	ONE_WEEK,
	slotToSecondsTimestamp,
	timestampToEpoch,
} from '@utils/TimeUtils'
import { get } from 'lodash-es'
import { ECharts, EChartsOption } from 'echarts'
import { StorageService } from '@services/storage.service'

const currentZoom = {
	end: 100,
	start: 80,
}
const MAX_DATA_POINTS = 199

const bounceTime = 450

@Component({
	selector: 'app-summary-chart',
	templateUrl: './summary-chart.component.html',
	styleUrl: './summary-chart.component.scss',
	standalone: false,
})
export class SummaryChartComponent implements OnInit {
	@Input() data: OverviewData2

	chips: ChipsOptions[] = null

	timeFrames: { from?: number; to?: number; lastUpdate?: number } = {}

	chartInstance: ECharts = null

	selectedAggregation: Aggregation = Aggregation.Hourly

	constructor(
		private merchant: MerchantUtils,
		private alert: AlertService,
		private storage: StorageService,
		private overviewProvider: OverviewProvider
	) {}

	ngOnInit() {
		this.merchant.getUserInfo(false).then(() => {
			this.initChips()
		})
	}

	onChartInit(ec: ECharts) {
		this.chartInstance = ec
		this.initLoad()
	}

	async initLoad() {
		console.log('INIT LOAD')
		this.validateDataZoom(true, true, true)
		const options = Object.assign({}, this.data.summaryChartOptions())
		if (options) {
			options.aggregation = await this.storage.getDashboardSummaryAggregation()
			options.force = true
			options.endTime = this.timeFrames.to
			options.startTime = this.timeFrames.from
		} else {
			console.warn('No options found')
		}

		await this.overviewProvider.setSummaryChartOptions(this.data, options)
		//this.validateDataZoom(undefined, true, true)
		// this.overviewProvider.setSummaryChartOptions(this.data, {
		// 	aggregation: await this.storage.getDashboardSummaryAggregation(),
		// 	startTime: null,
		// 	endTime: null,
		// 	force: false,
		// } as SummaryChartOptions)
	}

	initChips() {
		const temp = [
			{
				name: 'Epoch',
				value: Aggregation.Epoch,
				disabled: false,
			},
			{
				name: 'Hourly',
				value: Aggregation.Hourly,
				disabled: false,
			},
			{
				name: 'Daily',
				value: Aggregation.Daily,
				disabled: false,
			},
			{
				name: 'Weekly',
				value: Aggregation.Weekly,
				disabled: false,
			},
		]

		this.chips = temp.map((item) => {
			item.disabled = this.merchant.userAllowedChartAggregations().filter((a) => a === item.value).length === 0

			// handle special case where user has select a premium aggregator but does not extend premium after it expired
			// reset to default (hourly)
			if (item.value === this.data.summaryChartOptions().aggregation && item.disabled) {
				this.changeAggregation(temp[1]) // hourly
			}

			return item
		})
	}

	changeAggregation(chip: ChipsOptions) {
		if (chip.disabled) {
			Toast.show({
				text: 'This feature is available with a premium subscription',
				duration: 'short',
			})
			return
		}

		this.storage.setDashboardSummaryAggregation(chip.value)

		// const tsData = this.getTimestamps(chip.value, true)
		// if (!this.data) {
		// 	return
		// }

		const options = Object.assign({}, this.data.summaryChartOptions())
		if (options) {
			options.aggregation = chip.value
			options.force = true
		} else {
			console.warn('No options found')
		}
		this.data.summaryChartOptionsInternal.set(options)
		this.changeZoom(true)

		//
		// if (options) {
		// 	options.aggregation = chip.value
		// 	options.force = true
		// 	options.endTime = Math.floor(Date.now() / 1000) // tsData.newTimeFrames.to
		// 	options.startTime = null //tsData.newTimeFrames.from
		// } else {
		// 	console.warn('No options found')
		// }

		// await this.overviewProvider.setSummaryChartOptions(this.data, options)
		//this.validateDataZoom(undefined, true, true)

		//this.data. = chip.value
	}

	summaryChart = computed(() => {
		const temp = this.createSummaryChart(this.data.summaryChart(), this.categories())
		//this.validateDataZoom(undefined, undefined, true)
		//this.initZoom()
		return temp
	})

	categories = computed<number[]>(() => {
		if (!this.data || !this.data.latestState() || !this.data.summaryChartOptions()) {
			return []
		}
		// charts have 5 slots delay
		if (this.data.latestState().state.current_slot <= 5 || !this.data.summaryChartOptions().aggregation) {
			return []
		}
		const maxSeconds = this.data.overviewData().chart_history_seconds?.[this.data.summaryChartOptions().aggregation] ?? 0
		if (!maxSeconds) {
			return []
		}
		const list: number[] = []
		let latestTs = slotToSecondsTimestamp(this.data.chainNetwork().id, this.data.latestState().state.current_slot - 5) || 0
		console.log('latestTs', latestTs, this.data.chainNetwork().id, this.data.latestState())

		let step = 0
		switch (this.data.summaryChartOptions().aggregation) {
			case Aggregation.Epoch:
				step = this.data.chainNetwork().slotsTime * this.data.chainNetwork().slotPerEpoch
				break
			case Aggregation.Daily:
				step = ONE_DAY
				break
			case Aggregation.Hourly:
				step = ONE_HOUR
				break
			case Aggregation.Weekly:
				step = ONE_WEEK
				break
		}
		if (!step) {
			return []
		}
		const minTs = Math.max(slotToSecondsTimestamp(this.data.chainNetwork().id, 0) || 0, latestTs - maxSeconds)
		while (latestTs >= minTs) {
			list.splice(0, 0, latestTs)

			latestTs -= step
		}
		console.log('latestTS', latestTs, maxSeconds, minTs)

		return list
	})

	rawDataToSeries(data: ChartData<number, number>) {
		if (!data || !data.series) {
			return []
		}
		const newSeries: SeriesObject[] = []
		data.series.forEach((element) => {
			let name: string
			if (element.id === V2DashboardSummaryChart.SUMMARY_CHART_GROUP_TOTAL) {
				name = 'Total'
			} else if (element.id === V2DashboardSummaryChart.SUMMARY_CHART_GROUP_NETWORK_AVERAGE) {
				name = 'Network Average'
			}
			//else {
			// name = getGroupLabel($t, element.id, groups.value, allGroups)
			// }
			const newObj: SeriesObject = {
				data: element.data,
				type: 'line',
				smooth: false,
				symbol: 'none',
				name,
			}
			newSeries.push(newObj)
		})
		return newSeries
	}

	createSummaryChart(data: ChartData<number, number>, categories: number[]) {
		// if (!data || !categories || data.series.length < 1) {
		// 	return
		// }

		const root = document.body
		const chartDefaultColor = getComputedStyle(root).getPropertyValue('--chart-default').trim()

		const newSeries: SeriesObject[] = this.rawDataToSeries(data)
		const dataCategories = data ? (data.categories ?? []) : []

		return {
			grid: {
				containLabel: true,
				top: 0,
				left: '3%',
				right: '3%',
				//bottom: 35,
			},
			xAxis: [
				{
					// xAxis of the chart
					type: 'category',
					data: dataCategories,
					boundaryGap: false,
					axisLabel: {
						fontSize: fontSize,
						lineHeight: 20,
						formatter: (value: string) => {
							return formatTimestamp(value, this.data.chainNetwork().id, this.data.summaryChartOptions().aggregation)
						},
					},
				},
				{
					// xAxis of the time frame selection
					type: 'category',
					data: categories,
					show: false,
					boundaryGap: false,
				},
			],
			series: newSeries,
			yAxis: {
				nameLocation: 'center',
				nameTextStyle: {
					padding: [0, 0, 30, 0],
				},
				type: 'value',
				minInterval: 10,
				maxInterval: 20,
				min: (range: { min: number }) => (range.min >= 0 ? Math.max(0, 10 * Math.ceil(range.min / 10 - 1)) : 10 * Math.ceil(range.min / 10 - 1)),
				silent: true,
				axisLabel: {
					formatter: '{value} %',
					fontSize: fontSize,
				},
				splitLine: {
					lineStyle: {
						//color: colors.value.label
					},
				},
			},
			textStyle: {
				//fontFamily,
				fontSize: fontSize,
				//fontWeight: fontWeightLight,
				//color: colors.value.label
			},
			color: [chartDefaultColor, '#ff835c', '#e4a354', '#2b908f', '#f45b5b', '#91e8e1'],
			legend: {
				type: 'scroll',
				orient: 'horizontal',
				bottom: 40,
				textStyle: {
					//color: colors.value.label,
					fontSize: fontSize,
					//fontWeight: fontWeightMedium
				},
			},
			tooltip: {
				order: 'seriesAsc',
				trigger: 'axis',
				padding: 3,
				confine: true,
				formatter: (params: { color: string; seriesName: string; value: number; axisValue: string }[]) => {
					if (Array.isArray(params)) {
						const ts = parseInt(params[0].axisValue)
						return (
							getTooltipHeader(ts, this.data.chainNetwork().id, this.data.summaryChartOptions().aggregation, (val) =>
								formatTsToDateTime(val, getLocale())
							) +
							'<br/>' +
							params.map((d) => `<span style="color: ${d.color};">●</span> ${d.seriesName}: ${d.value.toFixed(2)} % `).join('<br/>')
						)
					}
				},
			},
			dataZoom: {
				type: 'slider',
				...currentZoom,
				labelFormatter: (_value: number, valueStr: string) => {
					return this.formatToDateOrEpoch(valueStr)
				},
				xAxisIndex: [1],
				bottom: 10,
				left: '3%', // Match this with the grid's left margin
				right: '3%', // Match this with the grid's right margin
				dataBackground: {
					areaStyle: { color: this.colors().background },
					lineStyle: { color: this.colors().background },
				},
			},
		} as unknown as EChartsOption
	}

	colors = computed(() => {
		return {
			background: getChartTooltipBackgroundColor(),
			groups: getSummaryChartGroupColors('light'), // todo
			label: getChartTextColor(),
		}
	})

	async ionViewWillEnter() {
		if (this.data.id != (await this.storage.getDashboardID())) {
			this.changeZoom(true)
			return
		}
	}

	formatToDateOrEpoch = (value: string) => {
		if (this.data.summaryChartOptions().aggregation === 'epoch') {
			return formatTSToEpoch(value + '', this.data.chainNetwork().id)
		}
		return formatTSToDate(value + '')
	}

	async loadData(startTime: number, endTime: number) {
		if (!this.data || (!startTime && !endTime)) {
			return
		}

		const loading = await this.alert.presentLoading('Loading...')
		loading.present()

		console.log('load data', startTime, endTime)
		try {
			const options = Object.assign({}, this.data.summaryChartOptions())
			options.startTime = startTime
			options.endTime = endTime
			options.force = true
			await this.overviewProvider.setSummaryChartOptions(this.data, options)
			loading.dismiss()
		} catch (e) {
			loading.dismiss()
			console.log('err', e)
			// TODO: Maybe we want to show an error here (either a toast or inline centred in the chart space)
		}
	}

	private preventOnZoomHandling = false
	onDataZoom() {
		if (this.preventOnZoomHandling) {
			this.preventOnZoomHandling = false
			return
		}
		//this.updateTimestamp()
		this.validateDataZoom()
	}

	// get the current dataZoom settings in the chart
	getDataZoomValues = () => {
		const chartOptions = this.chartInstance.getOption()
		const start: number = get(chartOptions, 'dataZoom[0].start', 80) as number
		const end: number = get(chartOptions, 'dataZoom[0].end', 100) as number
		return {
			end,
			start,
		}
	}

	// get the from to values for the selected zoom settings
	getZoomTimestamps = () => {
		if (!this.data.summaryChartOptions()) return undefined
		const max = this.categories().length - 1
		if (max <= 0) {
			return
		}
		const zoomValues = this.getDataZoomValues()
		const toIndex = Math.floor((max / 100) * zoomValues.end)
		const fromIndex = Math.floor((max / 100) * zoomValues.start)
		return {
			...zoomValues,
			fromIndex,
			fromTs: this.categories()[fromIndex],
			toIndex,
			toTs: this.categories()[toIndex],
		}
	}

	maxDataPoints(aggregation: Aggregation) {
		switch (aggregation) {
			case Aggregation.Epoch:
				return Math.floor(
					this.merchant.userInfo().premium_perks.chart_history_seconds.epoch /
						(this.data.chainNetwork().slotsTime * this.data.chainNetwork().slotPerEpoch)
				)
			case Aggregation.Daily:
				return Math.floor(this.merchant.userInfo().premium_perks.chart_history_seconds.daily / ONE_DAY)
			case Aggregation.Hourly:
				return Math.floor(this.merchant.userInfo().premium_perks.chart_history_seconds.hourly / ONE_HOUR)
			case Aggregation.Weekly:
				return Math.floor(this.merchant.userInfo().premium_perks.chart_history_seconds.weekly / ONE_WEEK)
		}
		return 199
	}

	getDefaultTargetPoints(aggregation: Aggregation) {
		switch (aggregation) {
			case Aggregation.Epoch:
				return 12
			case Aggregation.Daily:
				return 7
			case Aggregation.Weekly:
				return 8
		}
		return 6
	}

	getTimestamps(aggregation: Aggregation, categoryChanged: boolean) {
		if (!this.chartInstance) {
			return
		}
		const timestamps = this.getZoomTimestamps()
		if (!timestamps) {
			return
		}

		const firstTime = categoryChanged //!this.data.summaryChartOptions.value.endTime

		const max = this.categories().length - 1

		const useDefault = categoryChanged
		let dataPointsChanged = false
		if (useDefault) {
			dataPointsChanged = true
			let targetPoints = this.getDefaultTargetPoints(aggregation)
			// for dashboards with a large amount of time frames we show at least 3%
			targetPoints = Math.max(targetPoints, Math.ceil(max * 0.03))
			timestamps.toIndex = firstTime ? max : Math.max(Math.ceil((max / 100) * timestamps.end), targetPoints)
			timestamps.fromIndex = timestamps.toIndex - targetPoints
			console.log('fresh timestamps', aggregation, timestamps)
		} else if (timestamps.toIndex - timestamps.fromIndex > MAX_DATA_POINTS) {
			console.log('adjusting zoom', timestamps, currentZoom)
			dataPointsChanged = true
			if (timestamps.start !== currentZoom.start) {
				timestamps.toIndex = Math.min(timestamps.fromIndex + MAX_DATA_POINTS, max)
			} else {
				timestamps.fromIndex = Math.max(0, timestamps.toIndex - MAX_DATA_POINTS)
			}
		} else {
			let minDataPoints = 3
			if (aggregation === 'epoch') {
				minDataPoints = 6
			}
			if (timestamps.toIndex - timestamps.fromIndex < minDataPoints) {
				dataPointsChanged = true
				if (timestamps.start !== currentZoom.start) {
					timestamps.toIndex = Math.min(timestamps.fromIndex + minDataPoints, max)
					timestamps.fromIndex = timestamps.toIndex - minDataPoints
				} else {
					timestamps.fromIndex = Math.max(timestamps.toIndex - minDataPoints, 0)
					timestamps.toIndex = timestamps.fromIndex + minDataPoints
				}
			}
		}

		if (dataPointsChanged) {
			timestamps.end = (timestamps.toIndex * 100) / max
			timestamps.toTs = this.categories()[timestamps.toIndex]
			timestamps.start = (timestamps.fromIndex * 100) / max
			timestamps.fromTs = this.categories()[timestamps.fromIndex]
		}

		let fromTs: number | undefined = timestamps.fromTs
		let toTs: number | undefined = timestamps.toTs
		const bufferSteps = aggregation === Aggregation.Epoch ? 0 : 5
		// if we are on the far left/right we omit the from/to timestamp
		// to prevent webservice errors if we get slight over the limit
		// when we omit one of the time stamps the backend will use the max secons of the dashboard settings
		if (timestamps.fromIndex <= bufferSteps) {
			fromTs = undefined
		} else if (timestamps.toIndex >= max - bufferSteps) {
			toTs = undefined
		}
		const newTimeFrames = {
			from: fromTs,
			to: toTs,
			lastUpdate: Date.now(),
		}

		return {
			timestamps: timestamps,
			newTimeFrames: newTimeFrames,
		}
	}

	// validate and adjust zoom settings
	async validateDataZoom(instant?: boolean, categoryChanged?: boolean, doNotLoad: boolean = false) {
		const { timestamps, newTimeFrames } = this.getTimestamps(this.data.summaryChartOptions().aggregation, categoryChanged)

		// when the timeframes of the slider change we bounce the new timeframe for the chart
		if (this.data.summaryChartOptions().endTime !== newTimeFrames.to || this.data.summaryChartOptions().startTime !== newTimeFrames.from) {
			if (instant) {
				this.timeFrames = newTimeFrames
				if (!doNotLoad) {
					if (this.timeFrames.lastUpdate + bounceTime <= Date.now()) {
						await this.loadData(this.timeFrames.from, this.timeFrames.to)
						console.log('CHART DATA UPDATE', newTimeFrames)
					}
				}
			} else {
				this.timeFrames = newTimeFrames
				if (!doNotLoad) {
					await debounce(() => {
						if (this.timeFrames.lastUpdate + bounceTime <= Date.now()) {
							console.log('CHART DATA UPDATE', newTimeFrames)
							return this.loadData(this.timeFrames.from, this.timeFrames.to)
						}
					}, bounceTime)
				}
			}
		}

		// if we had to fix the slider ranges we need to update the zoom settings
		if (timestamps.start !== currentZoom.start || timestamps.end !== currentZoom.end) {
			currentZoom.end = timestamps.end
			currentZoom.start = timestamps.start
			this.changeZoom()
		}
	}

	changeZoom(triggerZoomHandling = false) {
		if (!triggerZoomHandling) {
			this.preventOnZoomHandling = true
		}

		this.chartInstance.setOption({
			dataZoom: {
				...((get(this.chartInstance, 'xAxis[1]') as object) || {}),
				...currentZoom,
			},
		})
		if (get(this.chartInstance.getOption(), 'dataZoom[0]')) {
			this.chartInstance.dispatchAction({
				type: 'dataZoom',
				...currentZoom,
			})
		}
	}

	// initZoom() {
	// 	if (!this.chartInstance) {
	// 		return
	// 	}
	// 	const timestamps = this.getZoomTimestamps()
	// 	if (!timestamps) {
	// 		return
	// 	}
	// 	currentZoom.end = timestamps.end
	// 	currentZoom.start = timestamps.start
	// 	this.chartInstance.setOption({
	// 		dataZoom: {
	// 			...(get(this.chartInstance, 'xAxis[1]') || {}),
	// 			...currentZoom,
	// 		},
	// 	})
	// 	if (get(this.chartInstance.getOption(), 'dataZoom[0]')) {
	// 		this.chartInstance.dispatchAction({
	// 			type: 'dataZoom',
	// 			...currentZoom,
	// 		})
	// 	}
	// }
}

function debounce(callback: () => Promise<void>, wait: number): Promise<void> {
	return new Promise<void>((resolve) =>
		setTimeout(async () => {
			await callback()
			resolve()
		}, wait)
	)
}

export const fontSize = '12px'

export function getTooltipHeader(ts: number, chainID: number, aggregationValue: string, timeFormat: (number: number) => string): string {
	let endDateFormatted = ''
	let endEpochFormatted = ''
	if (aggregationValue != 'epoch') {
		endDateFormatted = ' - ' + timeFormat(getEndTs(aggregationValue, ts))
		endEpochFormatted = ' - ' + timestampToEpoch(chainID, getEndTs(aggregationValue, ts) * 1000)
	}
	return (
		'<span style="font-size: 12px;">' +
		timeFormat(ts) +
		endDateFormatted +
		'<br>Epoch ' +
		timestampToEpoch(chainID, ts * 1000) +
		endEpochFormatted +
		'</span>'
	)
}

export function formatTSToDate(value: string) {
	return formatGoTimestamp(Number(value), undefined, 'absolute', 'narrow', getLocale(), false)
}
export function formatTSToEpoch(value: string, chainID: number) {
	return `Epoch ${timestampToEpoch(chainID, parseInt(value) * 1000)}`
}

export function formatTimestamp(value: string, chainID: number, aggregationValue: string) {
	const date = formatTSToDate(value)
	switch (aggregationValue) {
		case 'epoch':
			return `${date}\n${timestampToEpoch(chainID, parseInt(value) * 1000)}`
		case 'hourly':
			return `${date}\n${formatTsToTime(Number(value), getLocale())}`
		default:
			return date
	}
}

interface SeriesObject {
	data: number[]
	type: string
	smooth: boolean
	symbol: string
	name: string
}

interface ChipsOptions {
	name: string
	value: Aggregation
	disabled: boolean
}
