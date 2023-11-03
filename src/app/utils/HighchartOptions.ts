/*
 *  // Copyright (C) 2020 - 2021 Bitfly GmbH
 *  // Manuel Caspari (manuel@bitfly.at)
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

export function highChartOptions(where, hostName) {
	where.setOptions({
		time: {
			useUTC: false,
		},
		credits: {
			enabled: true,
			href: 'https://' + hostName,
			text: '',
			style: {
				color: 'var(--body-color)',
			},
		},
		exporting: {
			scale: 1,
			enabled: false,
		},
		title: {
			style: {
				color: 'var(--font-color)',
			},
		},
		subtitle: {
			style: {
				color: 'var(--font-color)',
			},
		},
		chart: {
			animation: false,
			style: {
				fontFamily: 'Mukta, Helvetica Neue", Helvetica, Arial, sans-serif',
				color: 'var(--body-color)',
				fontSize: '12px',
			},
			backgroundColor: 'var(--bg-color)',
		},
		colors: ['var(--chart-default)', '#90ed7d', '#f7a35c', '#8085e9', '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1'],
		legend: {
			enabled: true,
			layout: 'horizontal',
			align: 'center',
			verticalAlign: 'bottom',
			borderWidth: 0,
			itemStyle: {
				color: 'var(--body-color)',
				'font-size': '0.8rem',
				// 'font-weight': 'lighter'
			},
			itemHoverStyle: {
				color: 'var(--primary)',
			},
		},
		xAxis: {
			ordinal: false,
			labels: {
				style: {
					color: 'var(--font-color)',
				},
			},
		},
		yAxis: {
			title: {
				style: {
					color: 'var(--font-color)',
					// 'font-size': '0.8rem'
				},
			},
			labels: {
				style: {
					color: 'var(--body-color)',
					'font-size': '0.8rem',
				},
			},
			gridLineColor: 'var(--border-color-transparent)',
		},
		navigation: {
			menuStyle: {
				border: '1px solid var(--border-color-transparent)',
				background: 'var(--bg-color-nav)',
				padding: '1px 0',
				'box-shadow': 'var(--bg-color-nav) 2px 2px 5px',
			},
			buttonOptions: {
				symbolStroke: 'var(--body-color)',
				symbolFill: 'var(--body-color)',
				theme: {
					fill: 'var(--bg-color)',
				},
			},
			menuItemStyle: {
				padding: '0.5em 1em',
				color: 'var(--transparent-font-color)',
				background: 'none',
				fontSize: '11px/14px',
				transition: 'background 250ms, color 250ms',
			},
			menuItemHoverStyle: { background: 'var(--primary)', color: 'var(--font-color)' },
		},
		navigator: {
			enabled: true,
			height: 25,

			outlineColor: 'var(--border-color)',
			handles: {
				borderColor: 'var(--transparent-font-color)',
			},
			xAxis: {
				gridLineColor: 'var(--border-color)',
				labels: {
					formatter: function () {
						return
					},
				},
			},
		},

		plotOptions: {
			series: {
				fillOpacity: 0.1,
				marker: {
					enabled: false,
				},
			},
			line: {
				borderWidth: 0,
				animation: false,
				lineWidth: 2.5,
				dashStyle: 'Solid',
			},
			negativeColor: '#ff835c',
		},
	})
}
