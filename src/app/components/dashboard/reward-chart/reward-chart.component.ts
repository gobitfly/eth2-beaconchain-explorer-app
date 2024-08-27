
import { Component, computed, Input } from '@angular/core';
import { OverviewData2 } from 'src/app/controllers/OverviewController';
import { ChartSeries } from 'src/app/requests/types/common';
import { ApiService } from 'src/app/services/api.service';
import { epochToTimestamp, formatTsToAbsolute,  formatTsToDateTime,  getLocale } from 'src/app/utils/TimeUtils';
import { fontSize, getTooltipHeader } from '../summary-chart/summary-chart.component';
import BigNumber from 'bignumber.js';
import { getChartTextColor, getChartTooltipBackgroundColor, getRewardChartColors, getRewardsChartLineColor } from 'src/app/utils/ColorUtils';
import { Currency, UnitconvService } from 'src/app/services/unitconv.service';
import { Aggregation } from 'src/app/requests/v2-dashboard';


@Component({
	selector: 'app-reward-chart',
	templateUrl: './reward-chart.component.html',
	styleUrl: './reward-chart.component.scss',
})
export class RewardChartComponent {
	@Input() data: OverviewData2

	fontSize = '12px'
	groupsEnabled = false

	constructor(private api: ApiService, private unit: UnitconvService) {}

	rewardChart = computed(() => {
		return this.createRewardChart(this.series(), this.data.rewardChart()?.categories)
	})

	valueFormatter = (value: number) => {
		return value.toFixed(3) + ''
	}

	colors = computed(() => {
		return {
			background: getChartTooltipBackgroundColor('light'), // todo
			data: getRewardChartColors(),
			label: getChartTextColor('light'),
			line: getRewardsChartLineColor('light'),
		}
	})

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	mapSeriesData = (data: RewardChartSeries, cur: Currency) => {
		data.bigData.forEach((bigValue, index) => {
			if (!bigValue.isZero()) {
				const formatted = bigValue.dividedBy(1e18) //this.unit.convertNonFiat(bigValue, 'WEI', "ETH", true)
				data.formatedData[index] = {
					fullLabel: formatted.toFixed(9) + ' ETH', // todo gnosis
					label: formatted.toFixed(5) + ' ETH', // todo gnosis
				} as ExtendedLabel
				const parsedValue = parseFloat(`${formatted.toFixed(9)}`)
				if (!isNaN(parsedValue)) {
					data.data[index] = parsedValue
				}
			}
		})
	}

	series = computed(() => {
		const list: RewardChartSeries[] = []
		if (!this.data || !this.data.rewardChart() || !this.data.rewardChart().series) {
			return list
		}

		const categoryCount = this.data.rewardChart()?.categories.length ?? 0
		const clSeries: RewardChartSeries = {
			barMaxWidth: 33,
			bigData: Array.from(Array(categoryCount)).map(() => new BigNumber('0')),
			color: this.colors().data.cl,
			data: Array.from(Array(categoryCount)).map(() => 0),
			formatedData: Array.from(Array(categoryCount)).map(() => ({ label: `0 ${this.unit.pref.Cons.unit.display}` })),
			groups: [],
			id: 1,
			name: 'Consensus',
			property: 'cl',
			stack: 'x',
			type: 'bar',
		}
		const elSeries: RewardChartSeries = {
			barMaxWidth: 33,
			bigData: Array.from(Array(categoryCount)).map(() => new BigNumber('0')),
			color: this.colors().data.el,
			data: Array.from(Array(categoryCount)).map(() => 0),
			formatedData: Array.from(Array(categoryCount)).map(() => ({ label: `0 ${this.unit.pref.Exec.unit.display}` })),
			groups: [],
			id: 2,
			name: 'Execution',
			property: 'el',
			stack: 'x',
			type: 'bar',
		}
		list.push(elSeries)
		list.push(clSeries)
		this.data.rewardChart().series.forEach((group) => {
			let name
			// if (!this.groupsEnabled) {
			// 	name = $t('dashboard.validator.rewards.chart.rewards')
			// } else {
			// 	name = getGroupLabel($t, group.id, groups.value)
			// }
			const newData: RewardChartGroupData = {
				bigData: [],
				id: group.id,
				name,
			}
			for (let i = 0; i < categoryCount; i++) {
				const bigValue = group.data[i] ? new BigNumber(group.data[i]) : new BigNumber('0')

				if (!bigValue.isZero()) {
					if (group.property === 'el') {
						elSeries.bigData[i] = elSeries.bigData[i].plus(bigValue)
					} else {
						clSeries.bigData[i] = clSeries.bigData[i].plus(bigValue)
					}
				}
				newData.bigData.push(bigValue)
			}

			if (group.property === 'el') {
				elSeries.groups.push(newData)
			} else {
				clSeries.groups.push(newData)
			}
		})

		this.mapSeriesData(elSeries, this.unit.pref.Exec)
		this.mapSeriesData(clSeries, this.unit.pref.Cons)

		return list
	})

	createRewardChart(series: RewardChartSeries[], categories: number[]) {
		if (!this.data || !categories || !series) {
			return
		}

		const root = document.body
		const chartDefaultColor = getComputedStyle(root).getPropertyValue('--chart-default').trim()
		console.log('chartDefaultColor', chartDefaultColor)

		return {
			dataZoom: {
				// borderColor: this.colors().label,
				// dataBackground: {
				// 	areaStyle: { color: this.colors().label },
				// 	lineStyle: { color: this.colors().label },
				// },
				left: '3%', // Match this with the grid's left margin
				right: '3%', // Match this with the grid's right margin
				end: 100,
				start: 60,
				type: 'slider',
			},
			grid: {
				bottom: 80,
				containLabel: true,
				left: '5%',
				right: '5%',
				top: 20,
			},
			legend: {
				bottom: 50,
				orient: 'horizontal',
				textStyle: {
					color: this.colors().label,
					fontSize: fontSize,
					//fontWeight: fontWeightMedium,
				},
				type: 'scroll',
			},
			series: series,
			textStyle: {
				color: this.colors().label,
				//fontFamily,
				fontSize: fontSize,
				//fontWeight: fontWeightLight,
			},
			tooltip: {
				borderColor: this.colors().background,
				formatter: (params) => {
					const startEpoch = parseInt(params[0].axisValue)
					return (
						getTooltipHeader(epochToTimestamp(this.api, startEpoch) / 1000, this.api, Aggregation.Hourly, (val) =>
							formatTsToDateTime(val, getLocale())
						) +
						'<br/>' +
						params.map((d) => `<span style="color: ${d.color};">●</span> ${d.seriesName}: ${d.value.toFixed(5)} ETH `).join('<br/>')
						// todo gnosis
					)
				},
				order: 'seriesAsc',
				confine: true,
				padding: 0,
				trigger: 'axis',
				triggerOn: 'click',
			},
			xAxis: {
				axisLabel: {
					fontSize: fontSize,
					//fontWeight: fontWeightMedium,
					formatter: (value: number) => {
						const date = formatTsToAbsolute(epochToTimestamp(this.api, value) / 1000, getLocale(), false)
						if (date === undefined) {
							return ''
						}

						return `${date}\nEpoch ${value}`
					},
					lineHeight: 20,
				},
				data: categories,
				type: 'category',
			},
			yAxis: {
				axisLabel: {
					fontSize: fontSize,
					//fontWeight: fontWeightMedium,
					formatter: this.valueFormatter,
					padding: [0, 10, 0, 0],
				},
				silent: true,
				splitLine: { lineStyle: { color: this.colors().line } },
				type: 'value',
			},
		}
	}

}

interface RewardChartGroupData {
	bigData: BigNumber[]
	id: number
	name: string
}

interface RewardChartSeries extends ChartSeries<number, number> {
	barMaxWidth: number
	bigData: BigNumber[]
	color: string
	formatedData: ExtendedLabel[]
	groups: RewardChartGroupData[]
	name: string
	stack: 'x'
	type: 'bar'
}

export type ExtendedLabel = {
	fullLabel?: string
	label: NumberOrString
}
export type NumberOrString = number | string