import { Component, Input, OnInit, SimpleChanges } from '@angular/core'
import { highChartOptions } from '@utils/HighchartOptions'
import * as HighCharts from 'highcharts'
import * as Highstock from 'highcharts/highstock'
import { MachineChartData } from '@controllers/MachineController'
import { ApiService } from '@services/api.service'

@Component({
	selector: 'app-machinechart',
	templateUrl: './machinechart.component.html',
	styleUrls: ['./machinechart.component.scss'],
	standalone: false,
})
export class MachinechartComponent implements OnInit {
	@Input() title?: string = null
	@Input() subtitleLeft?: string
	@Input() subtitleRight?: string
	@Input() icon?: string
	@Input() priority = false
	@Input() clickAction = () => {
		return
	}

	@Input() chartData: MachineChartData
	@Input() key: string

	id = ''
	chartError = false
	specificError: string = null

	constructor(private api: ApiService) {}

	doClick() {
		this.clickAction()
	}

	ngOnChanges(changes: SimpleChanges) {
		if (changes['chartData']) {
			this.updateCharts()
		}
	}

	private updateCharts() {
		// just so we don't load everything at the same time
		const priorityDelay = this.priority ? 0 : 80 + Math.random() * 200

		setTimeout(() => {
			try {
				if (this.chartData && this.chartData.Error == 'system_missing') {
					this.specificError = 'system_missing'
					this.chartError = true
					return
				}
				this.doChart(this.key, this.id, this.chartData)

				this.chartError = this.chartData.Data.length <= 0 || this.chartData.Data[0].data.length <= 1
			} catch (e) {
				console.warn('cannot get chart data', e)
				this.chartError = true
			}
		}, 400 + priorityDelay)
	}

	ngOnInit() {
		highChartOptions(Highstock, this.api.getHostName())
		this.id = makeid(6)
	}

	public doChart(key: string, type = '', data: MachineChartData) {
		const id = 'machinechart_' + type + '_' + this.hashCode(key)

		let overrideConfig = {}
		if (Object.prototype.hasOwnProperty.call(data.Config, 'config')) {
			overrideConfig = data.Config.config
		}

		const baseConfig = {
			accessibility: {
				enabled: false,
			},
			chart: {
				type: 'area',
				marginLeft: 0,
				marginRight: 0,
				spacingLeft: 0,
				spacingRight: 0,
			},
			legend: {
				enabled: true,
			},
			title: {
				text: '', //Balance History for all Validators
			},
			colors: ['#ff835c', '#e4a354', '#2b908f', '#7cb5ec', '#f45b5b', '#91e8e1'],
			xAxis: {
				lineWidth: 0,
				tickColor: '#e5e1e1',
				type: 'datetime',
				minPadding: 0,
				maxPadding: 0,
				ordinal: false,
			},
			yAxis: {
				allowDecimals: false,
				opposite: false,
				minPadding: 0,
				maxPadding: 0,
				labels: {
					x: -5,
				},
			},
			tooltip: {
				style: {
					color: 'var(--text-color)',
					fontWeight: 'bold',
				},
			},
			plotOptions: {
				series: {
					borderWidth: 0,
				},
			},
			series: data.Data || [],
			rangeSelector: {
				enabled: false,
			},
			scrollbar: {
				enabled: false,
			},
			navigator: {
				enabled: false,
			},
		} as HighCharts.Options
		const mergedConfig = Object.assign(baseConfig, overrideConfig)

		Highstock.stockChart(id, mergedConfig, null)
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

function makeid(length: number) {
	let result = ''
	const characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
	const charactersLength = characters.length
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength))
	}
	return result
}
