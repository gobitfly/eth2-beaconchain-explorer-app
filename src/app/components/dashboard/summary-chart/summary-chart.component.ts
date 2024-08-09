import { Component, computed, Input } from '@angular/core';
import { IonSkeletonText } from "@ionic/angular/standalone";
import { OverviewData2 } from 'src/app/controllers/OverviewController';
import { ChartData } from 'src/app/requests/types/common';
import { V2DashboardSummaryChart } from 'src/app/requests/v2-dashboard';
import { ApiService } from 'src/app/services/api.service';
import { formatGoTimestamp, formatTsToTime, getEndTs, getLocale, ONE_DAY, ONE_HOUR, ONE_WEEK, slotToTimestamp, timestampToEpoch } from 'src/app/utils/TimeUtils';

import { NgxEchartsDirective } from 'ngx-echarts'
import { CommonModule } from '@angular/common';

@Component({
	selector: 'app-summary-chart',
	standalone: true,
	imports: [IonSkeletonText, NgxEchartsDirective, CommonModule],
	templateUrl: './summary-chart.component.html',
	styleUrl: './summary-chart.component.scss',
})
export class SummaryChartComponent {
	@Input() data: OverviewData2
	@Input() aggregationValue: string

	fontSize = '12px'

	constructor(private api: ApiService) {}

	summaryChart = computed(() => {
		return this.createSummaryChart(this.data.summaryChart(), this.categories())
	})

	categories = computed<number[]>(() => {
		if (!this.data || !this.data.latestState()) {
			return []
		}
		// charts have 5 slots delay
		if (this.data.latestState().state.current_slot <= 5 || !this.aggregationValue) {
			return []
		}
		const maxSeconds = this.data.overviewData().chart_history_seconds?.[this.aggregationValue] ?? 0
		if (!maxSeconds) {
			return []
		}
		const list: number[] = []
		let latestTs = slotToTimestamp(this.api, this.data.latestState().state.current_slot - 5) || 0
		let step = 0
		switch (this.aggregationValue) {
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

	createSummaryChart(data: ChartData<number, number>, categories: number[]) {
		if (!data || !categories || data.series.length < 1) {
			return
		}

		const root = document.body
		const chartDefaultColor = getComputedStyle(root).getPropertyValue('--chart-default').trim()
		console.log('chartDefaultColor', chartDefaultColor)

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

		return {
			grid: {
				containLabel: true,
				top: 0,
				left: '3%',
				right: '3%',
			},
			xAxis: [
				{
					// xAxis of the chart
					type: 'category',
					data: data.categories,
					boundaryGap: false,
					axisLabel: {
						fontSize: this.fontSize,
						lineHeight: 20,
						formatter: this.formatTimestamp,
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
					fontSize: this.fontSize,
				},
				splitLine: {
					lineStyle: {
						//color: colors.value.label
					},
				},
			},
			textStyle: {
				//fontFamily,
				fontSize: this.fontSize,
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
					fontSize: this.fontSize,
					//fontWeight: fontWeightMedium
				},
			},
			tooltip: {
				order: 'seriesAsc',
				trigger: 'axis',
				padding: 3,
				formatter: (params) => {
					const ts = parseInt(params[0].axisValue)
					return (
						this.getTooltipHeader(ts) +
						'<br/>' +
						params.map((d) => `<span style="color: ${d.color};">●</span> ${d.seriesName}: ${d.value.toFixed(2)} % `).join('<br/>')
					)
				},
			},
			// dataZoom: {
			// 	type: 'slider',
			// 	...currentZoom,
			// 	labelFormatter: (_value: number, valueStr: string) => {
			// 		return formatToDateOrEpoch(valueStr)
			// 	},
			// 	xAxisIndex: [1],
			// 	dataBackground: {
			// 		lineStyle: {
			// 			color: colors.value.label,
			// 		},
			// 		areaStyle: {
			// 			color: colors.value.label,
			// 		},
			// 	},
			// 	borderColor: colors.value.label,
			// },
		}
	}

	getTooltipHeader(ts: number): string {
		return (
			'<span style="font-size: 12px;">' +
			formatTsToTime(ts, getLocale()) +
			' - ' +
			formatTsToTime(getEndTs(this.aggregationValue, ts), getLocale()) +
			'<br>Epoch ' +
			timestampToEpoch(this.api, ts * 1000) +
			' - ' +
			timestampToEpoch(this.api, getEndTs(this.aggregationValue, ts) * 1000) +
			'</span>'
		)
	}

	formatTSToDate = (value: string) => {
		return formatGoTimestamp(Number(value), undefined, 'absolute', 'narrow', getLocale(), false)
	}
	formatTSToEpoch = (value: number) => {
		return `Epoch ${timestampToEpoch(this.api, Number(value))}`
	}

	formatTimestamp = (value: string) => {
		const date = this.formatTSToDate(value)
		switch (this.aggregationValue) {
			case 'epoch':
				return `${date}\n${timestampToEpoch(this.api, parseInt(value))}`
			case 'hourly':
				return `${date}\n${formatTsToTime(Number(value), getLocale())}`
			default:
				return date
		}
	}
}


interface SeriesObject {
	data: number[]
	type: string
	smooth: boolean
	symbol: string
	name: string
}