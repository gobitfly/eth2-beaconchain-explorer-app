import { Component, computed, Input } from '@angular/core';
import { Toast } from '@capacitor/toast';
import { OverviewData2 } from 'src/app/controllers/OverviewController';
import { ChartData } from 'src/app/requests/types/common';
import { Aggregation, V2DashboardSummaryChart } from 'src/app/requests/v2-dashboard';
import { AlertService } from 'src/app/services/alert.service';
import { ApiService } from 'src/app/services/api.service';
import { getChartTextColor, getChartTooltipBackgroundColor, getSummaryChartGroupColors } from 'src/app/utils/ColorUtils';
import { MerchantUtils } from 'src/app/utils/MerchantUtils';
import { formatGoTimestamp, formatTsToDateTime, formatTsToTime, getEndTs, getLocale, ONE_DAY, ONE_HOUR, ONE_WEEK, slotToTimestamp, timestampToEpoch } from 'src/app/utils/TimeUtils';
import { get } from 'lodash-es'
import { ECharts } from 'echarts';
import { StorageService } from 'src/app/services/storage.service';

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
})
export class SummaryChartComponent {
	@Input() data: OverviewData2

	chips: ChipsOptions[] = null

	timeFrames: { from?: number; to?: number; lastUpdate?: number } = {}

	chartInstance: ECharts = null

	constructor(
		private api: ApiService,
		private merchant: MerchantUtils,
		private alert: AlertService,
		private storage: StorageService
	) {
		this.merchant.getUserInfo(false).then(() => {
			this.initChips()
		})
	}

	onChartInit(ec) {
		this.chartInstance = ec
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
			if (item.value === this.data.summaryChartOptions.value.aggregation && item.disabled) {
				this.changeAggregation(temp[1]) // hourly
			}

			return item
		})
	}

	async changeAggregation(chip: ChipsOptions) {
		if (chip.disabled) {
			Toast.show({
				text: 'This feature is available with a premium subscription',
				duration: 'short',
			})
			return
		}

		const loading = await this.alert.presentLoading('Loading...')
		loading.present()
		this.storage.setDashboardSummaryAggregation(chip.value)
		await this.data?.setSummaryChartAggregation(this.api, chip.value)
		this.validateDataZoom(undefined, true, true)
		loading.dismiss()
		//this.data. = chip.value
	}

	summaryChart = computed(() => {
		const temp = this.createSummaryChart(this.data.summaryChart(), this.categories())
		this.validateDataZoom(undefined, undefined, true)
		return temp
	})

	categories = computed<number[]>(() => {
		if (!this.data || !this.data.latestState()) {
			return []
		}
		// charts have 5 slots delay
		if (this.data.latestState().state.current_slot <= 5 || !this.data.summaryChartOptions.value.aggregation) {
			return []
		}
		const maxSeconds = this.data.overviewData().chart_history_seconds?.[this.data.summaryChartOptions.value.aggregation] ?? 0
		if (!maxSeconds) {
			return []
		}
		const list: number[] = []
		let latestTs = slotToTimestamp(this.api, this.data.latestState().state.current_slot - 5) || 0
		let step = 0
		switch (this.data.summaryChartOptions.value.aggregation) {
			case 'epoch':
				step = this.api.getNetwork().slotsTime * this.api.getNetwork().slotPerEpoch
				break
			case 'daily':
				step = ONE_DAY
				break
			case 'hourly':
				step = ONE_HOUR
				break
			case 'weekly':
				step = ONE_WEEK
				break
		}
		if (!step) {
			return []
		}
		const minTs = Math.max(slotToTimestamp(this.api, 0) || 0, latestTs - maxSeconds)
		while (latestTs >= minTs) {
			list.splice(0, 0, latestTs)

			latestTs -= step
		}

		return list
	})

	rawDataToSeries(data: ChartData<number, number>) {
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
		if (!data || !categories || data.series.length < 1) {
			return
		}

		const root = document.body
		const chartDefaultColor = getComputedStyle(root).getPropertyValue('--chart-default').trim()

		const newSeries: SeriesObject[] = this.rawDataToSeries(data)

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
					data: data.categories,
					boundaryGap: false,
					axisLabel: {
						fontSize: fontSize,
						lineHeight: 20,
						formatter: (value) => {
							return formatTimestamp(value, this.api, this.data.summaryChartOptions.value.aggregation)
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
				min: (range) => (range.min >= 0 ? Math.max(0, 10 * Math.ceil(range.min / 10 - 1)) : 10 * Math.ceil(range.min / 10 - 1)),
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
				formatter: (params) => {
					const ts = parseInt(params[0].axisValue)
					return (
						getTooltipHeader(ts, this.api, this.data.summaryChartOptions.value.aggregation, (val) => formatTsToDateTime(val, getLocale())) +
						'<br/>' +
						params.map((d) => `<span style="color: ${d.color};">●</span> ${d.seriesName}: ${d.value.toFixed(2)} % `).join('<br/>')
					)
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
				// borderColor: this.colors().label,
				// dataBackground: {
				// 	areaStyle: { color: this.colors().label },
				// 	lineStyle: { color: this.colors().label },
				// },
			},
		}
	}

	colors = computed(() => {
		return {
			background: getChartTooltipBackgroundColor('light'),
			groups: getSummaryChartGroupColors('light'),
			label: getChartTextColor('light'),
		}
	})

	formatToDateOrEpoch = (value: string) => {
		if (this.data.summaryChartOptions.value.aggregation === 'epoch') {
			return formatTSToEpoch(parseInt(value) / 1000 + '', this.api)
		}
		return formatTSToDate((parseInt(value)/1000) + "")
	}

	async loadData(startTime: number, endTime: number) {
		// reloadCounter++
		// const currentCounter = reloadCounter
		//let newCategories: number[] = []
		if (!this.data || (!startTime && !endTime)) {
			return
		}
		//isLoading.value = true
		//const newSeries: SeriesObject[] = []
		const loading = await this.alert.presentLoading('Loading...')
		loading.present()

		try {
			await this.data.setSummaryChartTime(this.api, startTime, endTime)
			loading.dismiss()
		} catch (e) {
			loading.dismiss()
			// TODO: Maybe we want to show an error here (either a toast or inline centred in the chart space)
		}
		//isLoading.value = false
		// chartCategories.value = newCategories
		// series.value = newSeries
	}

	onDataZoom() {
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
		if(!this.data.summaryChart()) return undefined
		const max = this.data.summaryChart().categories.length - 1
		if (max <= 0) {
			return
		}
		const zoomValues = this.getDataZoomValues()
		const toIndex = Math.floor((max / 100) * zoomValues.end)
		const fromIndex = Math.floor((max / 100) * zoomValues.start)
		return {
			...zoomValues,
			fromIndex,
			fromTs: this.data.summaryChart().categories[fromIndex],
			toIndex,
			toTs: this.data.summaryChart().categories[toIndex],
		}
	}

	// validate and adjust zoom settings
	validateDataZoom(instant?: boolean, categoryChanged?: boolean, doNotLoad: boolean = false) {
		if (!this.chartInstance) {
			return
		}
		const timestamps = this.getZoomTimestamps()
		if (!timestamps) {
			return
		}
		const firstTime = false //!this.data.summaryChartOptions.value.endTime

		const max = this.data.summaryChart().categories.length - 1

		const useDefault = categoryChanged || firstTime
		let dataPointsChanged = false
		if (useDefault) {
			dataPointsChanged = true
			let targetPoints = 6
			switch (this.data.summaryChartOptions.value.aggregation) {
				case 'epoch':
					targetPoints = 12
					break
				case 'daily':
					targetPoints = 7
					break
				case 'weekly':
					targetPoints = 8
					break
			}
			// for dashboards with a large amount of time frames we show at least 3%
			targetPoints = Math.max(targetPoints, Math.ceil(max * 0.03))
			timestamps.toIndex = firstTime ? max : Math.max(Math.ceil((max / 100) * timestamps.end), targetPoints)
			timestamps.fromIndex = timestamps.toIndex - targetPoints
		} else if (timestamps.toIndex - timestamps.fromIndex > MAX_DATA_POINTS) {
			dataPointsChanged = true
			if (timestamps.start !== currentZoom.start) {
				timestamps.toIndex = Math.min(timestamps.fromIndex + MAX_DATA_POINTS, max)
			} else {
				timestamps.fromIndex = Math.max(0, timestamps.toIndex - MAX_DATA_POINTS)
			}
		} else {
			let minDataPoints = 3
			if (this.data.summaryChartOptions.value.aggregation === 'epoch') {
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
			timestamps.toTs = this.data.summaryChart().categories[timestamps.toIndex]
			timestamps.start = (timestamps.fromIndex * 100) / max
			timestamps.fromTs = this.data.summaryChart().categories[timestamps.fromIndex]
		}

		let fromTs: number | undefined = timestamps.fromTs
		let toTs: number | undefined = timestamps.toTs
		const bufferSteps = this.data.summaryChartOptions.value.aggregation === 'epoch' ? 0 : 5
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

		// when the timeframes of the slider change we bounce the new timeframe for the chart
		if (this.data.summaryChartOptions.value.endTime !== newTimeFrames.to || this.data.summaryChartOptions.value.startTime !== newTimeFrames.from) {
			if (instant) {
				this.timeFrames = newTimeFrames
			} else {
				this.timeFrames = newTimeFrames
				if (!doNotLoad) {
					setTimeout(() => {
						if (this.timeFrames.lastUpdate + bounceTime <= Date.now()) {
							this.loadData(this.timeFrames.from, this.timeFrames.to)
							console.log('CHART DATA UPDATE', newTimeFrames)
						}
					}, bounceTime)
				}
			}
		}
		// if we had to fix the slider ranges we need to update the zoom settings
		if (timestamps.start !== currentZoom.start || timestamps.end !== currentZoom.end) {
			currentZoom.end = timestamps.end
			currentZoom.start = timestamps.start

			this.chartInstance.setOption({
				dataZoom: {
					...(get(this.chartInstance, 'xAxis[1]') || {}),
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
	}
}

export const fontSize = '12px'

export function getTooltipHeader(ts: number, api: ApiService, aggregationValue: string, timeFormat: (number) => string): string {
		let endDateFormatted = ""
		let endEpochFormatted = ""
		if (aggregationValue != 'epoch') {
			endDateFormatted = ' - ' + timeFormat(getEndTs(aggregationValue, ts))
			endEpochFormatted = ' - ' + timestampToEpoch(api, getEndTs(aggregationValue, ts) * 1000)
		}
		return (
			'<span style="font-size: 12px;">' +
			timeFormat(ts) +
			endDateFormatted+
			'<br>Epoch ' +
			timestampToEpoch(api, ts * 1000) +
			endEpochFormatted + 
			'</span>'
		)
	}

export function formatTSToDate (value: string) {
		return formatGoTimestamp(Number(value), undefined, 'absolute', 'narrow', getLocale(), false)
	}
export function formatTSToEpoch(value: string, api: ApiService) {
	return `Epoch ${timestampToEpoch(api, parseInt(value)*1000)}`
}

export function formatTimestamp(value: string, api: ApiService, aggregationValue: string) {
		const date = formatTSToDate(value)
		switch (aggregationValue) {
			case 'epoch':
				return `${date}\n${timestampToEpoch(api, parseInt(value)*1000)}`
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