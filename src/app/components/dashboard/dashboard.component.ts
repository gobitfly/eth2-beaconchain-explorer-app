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

import { Component, OnInit, Input, SimpleChange } from '@angular/core'
import { UnitconvService } from '../../services/unitconv.service'
import { ApiService } from '../../services/api.service'
import { DashboardDataRequest, EpochResponse, SyncCommitteeResponse } from '../../requests/requests'
import * as HighCharts from 'highcharts'
import * as Highstock from 'highcharts/highstock'
import BigNumber from 'bignumber.js'
import { OverviewData, Rocketpool } from '../../controllers/OverviewController'
import { Release } from '../../utils/ClientUpdateUtils'
import ThemeUtils from 'src/app/utils/ThemeUtils'
import { highChartOptions } from 'src/app/utils/HighchartOptions'
import { StorageService } from 'src/app/services/storage.service'
import confetti from 'canvas-confetti'
import { Browser } from '@capacitor/browser'
import { ModalController, Platform } from '@ionic/angular'
import { SubscribePage } from 'src/app/pages/subscribe/subscribe.page'
import { MerchantUtils } from 'src/app/utils/MerchantUtils'
import { ValidatorUtils } from 'src/app/utils/ValidatorUtils'
import FirebaseUtils from 'src/app/utils/FirebaseUtils'

@Component({
	selector: 'app-validator-dashboard',
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
	public classReference = UnitconvService

	@Input() data?: OverviewData
	@Input() updates?: Release[]
	@Input() currentY: number
	@Input() scrolling: boolean

	fadeIn = 'invisible'

	beaconChainUrl: string = null
	finalizationIssue = false
	awaitGenesis = false
	earlyGenesis = false
	utilizationAvg = -1

	chartData
	chartDataProposals
	chartError = false

	readonly randomChartId

	rankPercentMode = false

	selectedChart = 'chartIncome'

	showFirstProposalMsg = false
	showMergeChecklist = false
	firstCelebrate = true

	doneLoading = false
	proposals: Proposals = {
		good: 0,
		bad: 0,
	}
	currentPackageMaxValidators = 100

	rplState = 'rpl'
	rplDisplay

	nextRewardRound = null
	rplCommission = 0
	rplApr = ''
	rplProjectedClaim = null

	displaySmoothingPool: boolean
	smoothingClaimed: BigNumber
	smoothingUnclaimed: BigNumber
	unclaimedRpl: BigNumber
	totalRplEarned: BigNumber
	hasNonSmoothingPoolAsWell: boolean

	currentSyncCommitteeMessage: SyncCommitteeMessage = null
	nextSyncCommitteeMessage: SyncCommitteeMessage = null

	notificationPermissionPending = false
	depositCreditText = null
	vacantMinipoolText = null
	showWithdrawalInfo = false

	constructor(
		public unit: UnitconvService,
		public api: ApiService,
		public theme: ThemeUtils,
		private storage: StorageService,
		private modalController: ModalController,
		private merchant: MerchantUtils,
		public validatorUtils: ValidatorUtils,
		private firebaseUtils: FirebaseUtils,
		private platform: Platform
	) {
		this.randomChartId = getRandomInt(Number.MAX_SAFE_INTEGER)
		//this.storage.setBooleanSetting("merge_list_dismissed", false)
		this.updateMergeListDismissed()
	}

	updateMergeListDismissed() {
		this.storage.getBooleanSetting('merge_list_dismissed', false).then((result) => {
			if (this.isAfterPotentialMergeTarget()) {
				this.showMergeChecklist = false
			} else {
				this.showMergeChecklist = !result
			}
		})
	}

	isAfterPotentialMergeTarget() {
		const now = Date.now()
		const target = 1663624800000 // target sept 20th to dismiss merge checklist
		console.log('afterPotentialMerge', now, target, now >= target)
		return now >= target
	}

	async ngOnChanges(event) {
		if (event.data && event.data instanceof SimpleChange) {
			if (event.data.currentValue) {
				this.chartError = false
				this.chartData = null

				if (this.platform.is('ios') || this.platform.is('android')) {
					this.firebaseUtils.hasNotificationConsent().then(async (result) => {
						const loggedIn = await this.storage.isLoggedIn()
						if (!loggedIn) return

						this.notificationPermissionPending = !result
					})
				}
				this.drawBalanceChart()
				this.drawProposalChart()
				this.beaconChainUrl = await this.getBaseBrowserUrl()

				await Promise.all([
					this.updateRplDisplay(),
					this.updateNextRewardRound(),
					this.updateRplCommission(),
					this.updateRplApr(),
					this.updateRplProjectedClaim(),
					this.updateSmoothingPool(),
					this.updateActiveSyncCommitteeMessage(this.data.currentSyncCommittee),
					this.updateNextSyncCommitteeMessage(this.data.nextSyncCommittee),
					this.updateDepositCreditText(),
					this.updateVacantMinipoolText(),
					this.updateWithdrawalInfo(),
				])

				console.log('dashboard data', this.data)

				if (!this.data.foreignValidator) {
					await Promise.all([this.checkForFinalization(), this.checkForGenesisOccurred()])
				}

				this.doneLoading = true
				this.fadeIn = 'fade-in'
				setTimeout(() => {
					this.fadeIn = null
				}, 1000)
			}
		}
	}

	async updateWithdrawalInfo() {
		this.storage.getBooleanSetting('withdrawal_info_dismissed', false).then((result) => {
			this.showWithdrawalInfo = !this.data.withdrawalsEnabledForAll && !result
		})
	}

	async updateDepositCreditText() {
		if (this.data.rocketpool.depositCredit && this.data.rocketpool.depositCredit.gt(0)) {
			this.depositCreditText = `You have ${this.unit.convert(
				this.data.rocketpool.depositCredit,
				'WEI',
				'ETHER',
				true
			)} in unused Rocketpool deposit credit.<br/><br/>You can use this credit to spin up more minipools. Be aware that you can not withdraw your deposit credit.`
		}
	}

	async updateVacantMinipoolText() {
		if (this.data.rocketpool.vacantPools && this.data.rocketpool.vacantPools > 0) {
			this.vacantMinipoolText = `${this.data.rocketpool.vacantPools} of your ${
				this.data.rocketpool.vacantPools == 1 ? 'minipool is' : 'minipools are'
			}
			currently vacant. Head over to the validators tab to see which one has a vacant label.<br/><br/>
			If you recently converted a validator to a minipool please make sure you did change the 0x0 withdrawal credentials to the new vacant minipool address (0x01) to fix this warning.<br/><br/>
			If you already changed the withdrawal credentials this warning will disappear on it's own within 24h.
			`
		}
	}

	async epochToTimestamp(epoch: number) {
		const network = await this.api.getNetwork()
		return (network.genesisTs + epoch * 32 * 12) * 1000
	}

	async updateActiveSyncCommitteeMessage(committee: SyncCommitteeResponse) {
		if (committee) {
			const endTs = await this.epochToTimestamp(committee.end_epoch)
			const startTs = await this.epochToTimestamp(committee.start_epoch)
			this.currentSyncCommitteeMessage = {
				title: 'Sync Committee',
				text: `Your validator${committee.validators.length > 1 ? 's' : ''} ${committee.validators.toString()} ${
					committee.validators.length > 1 ? 'are' : 'is'
				} currently part of the active sync committee.
      <br/><br/>This duty started at epoch ${committee.start_epoch} at ${new Date(startTs).toLocaleString()} and 
      will end at epoch ${committee.end_epoch} at ${new Date(endTs).toLocaleString()}. 
      <br/><br/>You'll earn extra rewards during this period.
      `,
			} as SyncCommitteeMessage
		} else {
			this.currentSyncCommitteeMessage = null
		}
	}

	async updateNextSyncCommitteeMessage(committee: SyncCommitteeResponse) {
		if (committee) {
			const endTs = await this.epochToTimestamp(committee.end_epoch)
			const startTs = await this.epochToTimestamp(committee.start_epoch)
			this.nextSyncCommitteeMessage = {
				title: 'Sync Committee Soon',
				text: `Your validator${committee.validators.length > 1 ? 's' : ''} ${committee.validators.toString()} ${
					committee.validators.length > 1 ? 'are' : 'is'
				} part of the <strong>next</strong> sync committee.
      <br/><br/>This duty starts at epoch ${committee.start_epoch} at ${new Date(startTs).toLocaleString()} and 
      will end at epoch ${committee.end_epoch} at ${new Date(endTs).toLocaleString()}. 
      <br/><br/>You'll earn extra rewards during this period.
      `,
			} as SyncCommitteeMessage
		} else {
			this.nextSyncCommitteeMessage = null
		}
	}

	updateSmoothingPool() {
		try {
			this.hasNonSmoothingPoolAsWell = this.data.rocketpool.hasNonSmoothingPoolAsWell
			this.displaySmoothingPool = this.data.rocketpool.smoothingPool
			this.smoothingClaimed = this.data.rocketpool.smoothingPoolClaimed.dividedBy(new BigNumber('1e9'))
			this.smoothingUnclaimed = this.data.rocketpool.smoothingPoolUnclaimed.dividedBy(new BigNumber('1e9'))
			this.unclaimedRpl = this.data.rocketpool.rplUnclaimed
			this.totalRplEarned = this.data.rocketpool.totalClaims.plus(this.data.rocketpool.rplUnclaimed)
		} catch (e) {
			console.warn('cannot update smoothing pool', e)
		}
	}

	updateRplProjectedClaim() {
		try {
			if (this.data.rocketpool.currentRpl.isLessThanOrEqualTo(this.data.rocketpool.minRpl)) {
				this.rplProjectedClaim = 0
				return
			}

			const temp = this.getEffectiveRplStake(this.data.rocketpool)
				.dividedBy(new BigNumber(this.validatorUtils.rocketpoolStats.effective_rpl_staked))
				.multipliedBy(new BigNumber(this.validatorUtils.rocketpoolStats.node_operator_rewards))

			this.rplProjectedClaim = temp
			if (temp.isLessThanOrEqualTo(new BigNumber('0'))) {
				this.rplProjectedClaim = null
			}
		} catch (e) {
			console.warn('cannot updateRplProjectedClaim', e)
		}
	}

	getEffectiveRplStake(data: Rocketpool): BigNumber {
		if (data.currentRpl.isGreaterThanOrEqualTo(data.maxRpl)) return data.maxRpl
		if (data.currentRpl.isLessThanOrEqualTo(data.minRpl)) return data.minRpl
		return data.currentRpl
	}

	updateRplApr() {
		try {
			const hoursToAdd = this.validatorUtils.rocketpoolStats.claim_interval_time.split(':')[0]
			const hoursNumber = parseInt(hoursToAdd)
			this.rplApr = new BigNumber(this.validatorUtils.rocketpoolStats.node_operator_rewards)
				.dividedBy(new BigNumber(this.validatorUtils.rocketpoolStats.effective_rpl_staked))
				.dividedBy(new BigNumber(hoursNumber / 24))
				.multipliedBy(new BigNumber(36500))
				.decimalPlaces(2)
				.toFixed()
		} catch (e) {
			console.warn('cannot updateRplApr', e)
		}
	}

	updateRplCommission() {
		try {
			this.rplCommission = Math.round(this.validatorUtils.rocketpoolStats.current_node_fee * 10000) / 100
		} catch (e) {
			console.warn('cannot updateRplCommission', e)
		}
	}

	updateNextRewardRound() {
		try {
			const hoursToAdd = this.validatorUtils.rocketpoolStats.claim_interval_time.split(':')[0]
			this.nextRewardRound = this.validatorUtils.rocketpoolStats.claim_interval_time_start * 1000 + parseInt(hoursToAdd) * 60 * 60 * 1000
		} catch (e) {
			console.warn('cannot updateNextRewardRound', e)
		}
	}

	ngOnInit() {
		//this.doneLoading = false
		this.storage.getBooleanSetting('rank_percent_mode', false).then((result) => (this.rankPercentMode = result))
		this.storage.getItem('rpl_pdisplay_mode').then((result) => (this.rplState = result ? result : 'rpl'))
		highChartOptions(HighCharts)
		highChartOptions(Highstock)
		this.merchant.getCurrentPlanMaxValidator().then((result) => {
			this.currentPackageMaxValidators = result
		})
	}

	private async checkForGenesisOccurred() {
		if (!this.data || !this.data.currentEpoch) return
		const currentEpoch = this.data.currentEpoch as EpochResponse
		this.awaitGenesis = currentEpoch.epoch == 0 && currentEpoch.proposedblocks <= 1
		this.earlyGenesis = !this.awaitGenesis && !this.finalizationIssue && currentEpoch.epoch <= 7
	}

	async checkForFinalization() {
		const cachedFinalizationIssue = (await this.storage.getObject('finalization_issues')) as FinalizationIssue
		if (cachedFinalizationIssue) {
			if (cachedFinalizationIssue.ts && cachedFinalizationIssue.ts + 4 * 60 * 60 * 1000 > Date.now()) {
				console.log('returning cached finalization issue state', cachedFinalizationIssue)
				this.finalizationIssue = cachedFinalizationIssue.value
				return
			}
		}

		const olderResult = await this.validatorUtils.getOlderEpoch()
		if (!this.data || !this.data.currentEpoch || !olderResult) return
		console.log('checkForFinalization', olderResult)
		this.finalizationIssue = new BigNumber(olderResult.globalparticipationrate).isLessThan('0.664') && olderResult.epoch > 7
		this.storage.setObject('finalization_issues', { ts: Date.now(), value: this.finalizationIssue } as FinalizationIssue)
	}

	async getChartData(data: 'allbalances' | 'proposals') {
		if (!this.data || !this.data.lazyChartValidators) return null
		const chartReq = new DashboardDataRequest(data, this.data.lazyChartValidators)
		const response = await this.api.execute(chartReq).catch(() => {
			return null
		})
		if (!response) {
			this.chartError = true
			return null
		}
		return chartReq.parse(response)
	}

	async upgrade() {
		const modal = await this.modalController.create({
			component: SubscribePage,
			cssClass: 'my-custom-class',
			componentProps: {
				tab: 'whale',
			},
		})
		return await modal.present()
	}

	switchCurrencyPipe() {
		if (this.unit.pref == 'ETHER') {
			if (UnitconvService.currencyPipe == null) return
			this.unit.pref = UnitconvService.currencyPipe
		} else {
			UnitconvService.currencyPipe = this.unit.pref
			this.unit.pref = 'ETHER'
		}
	}

	switchCurrencyPipeRocketpool() {
		if (this.unit.prefRpl == 'RPL') {
			if (UnitconvService.currencyPipe == null) return
			this.unit.prefRpl = UnitconvService.currencyPipe
		} else {
			UnitconvService.currencyPipe = this.unit.pref
			this.unit.prefRpl = 'RPL'
		}
	}

	switchRplStake(canPercent = false) {
		if (this.rplState == 'rpl' && canPercent) {
			// next %
			this.rplState = '%'
			this.updateRplDisplay()
			this.storage.setItem('rpl_pdisplay_mode', this.rplState)
			return
		} else if ((this.rplState == 'rpl' && !canPercent) || this.rplState == '%') {
			// next %
			this.rplState = 'conv'
			this.updateRplDisplay()
			this.storage.setItem('rpl_pdisplay_mode', this.rplState)
			return
		} else {
			this.rplState = 'rpl'
			this.updateRplDisplay()
			this.storage.setItem('rpl_pdisplay_mode', this.rplState)
			return
		}
	}

	updateRplDisplay() {
		if (this.rplState == '%') {
			this.rplDisplay = this.data.rocketpool.currentRpl.dividedBy(this.data.rocketpool.maxRpl).multipliedBy(new BigNumber(150)).decimalPlaces(1)
		} else {
			this.rplDisplay = this.data.rocketpool.currentRpl
		}
	}

	async drawProposalChart() {
		this.chartDataProposals = await this.getChartData('proposals')

		if (!this.chartDataProposals || this.chartDataProposals.length < 1) {
			this.chartDataProposals = false
			return
		}

		const proposed = []
		const missed = []
		const orphaned = []
		this.chartDataProposals.map((d) => {
			if (d[1] == 1) proposed.push([d[0] * 1000, 1])
			else if (d[1] == 2) missed.push([d[0] * 1000, 1])
			else if (d[1] == 3) orphaned.push([d[0] * 1000, 1])
		})

		this.proposals = {
			good: proposed.length,
			bad: missed.length + orphaned.length,
		}

		this.checkForFirstProposal(proposed)

		this.createProposedChart(proposed, missed, orphaned)
	}

	private async checkForFirstProposal(chartData) {
		if (this.data.foreignValidator) return
		const foundAtLeasOne = chartData.length >= 1 && chartData.length <= 2
		const noPreviousFirstProposal = await this.storage.getBooleanSetting('first_proposal_executed', false)
		if (foundAtLeasOne && !noPreviousFirstProposal) {
			this.showFirstProposalMsg = true

			if (this.firstCelebrate) {
				setTimeout(() => {
					confetti({
						particleCount: 30,
						spread: 50,
						origin: { y: 0.41 },
					})
				}, 800)
			}
			this.firstCelebrate = false
		}
	}

	async drawBalanceChart() {
		this.chartData = await this.getChartData('allbalances')

		if (!this.chartData || this.chartData.length < 3) {
			this.chartError = true
			return
		}

		this.chartError = false

		const setTimestampToMidnight = (ts: number): number => {
			const d = new Date(ts)
			d.setHours(0)
			d.setMinutes(0)
			d.setSeconds(0)
			d.setMilliseconds(0)
			return d.getTime()
		}

		// force timestamp to be at 00:00AM for the day to keep columns centered on ticks
		for (let i = 0; i < this.chartData.consensusChartData.length; i++) {
			this.chartData.consensusChartData[i].x = setTimestampToMidnight(this.chartData.consensusChartData[i].x)
		}
		for (let i = 0; i < this.chartData.executionChartData.length; i++) {
			this.chartData.executionChartData[i].x = setTimestampToMidnight(this.chartData.executionChartData[i].x)
		}

		// accumulate all execution income entries per day into a single entry
		for (let i = this.chartData.executionChartData.length - 1; i > 0; i--) {
			if (this.chartData.executionChartData[i].x == this.chartData.executionChartData[i - 1].x) {
				this.chartData.executionChartData[i - 1].y += this.chartData.executionChartData[i].y
				this.chartData.executionChartData.splice(i, 1)
			}
		}

		this.createBalanceChart(this.chartData.consensusChartData, this.chartData.executionChartData)
	}

	switchRank() {
		this.rankPercentMode = !this.rankPercentMode
		this.storage.setBooleanSetting('rank_percent_mode', this.rankPercentMode)
	}

	private getChartToolTipCaption(timestamp: number, genesisTs: number, dataGroupLength: number) {
		const dateToEpoch = (ts: number): number => {
			const slot = Math.floor((ts / 1000 - genesisTs) / 12)
			const epoch = Math.floor(slot / 32)
			return Math.max(0, epoch)
		}

		const startEpoch = dateToEpoch(timestamp)
		const dateForNextDay = new Date(timestamp)
		dateForNextDay.setDate(dateForNextDay.getDate() + dataGroupLength)
		const endEpoch = dateToEpoch(dateForNextDay.getTime()) - 1
		const epochText = `(Epochs ${startEpoch} - ${endEpoch})<br/>`

		if (dataGroupLength == 1) {
			return `${new Date(timestamp).toLocaleDateString()} ${epochText}`
		} else {
			return `${new Date(timestamp).toLocaleDateString()} - ${new Date(dateForNextDay).toLocaleDateString()} <br/>${epochText}`
		}
	}

	async createProposedChart(proposed, missed, orphaned) {
		const network = await this.api.getNetwork()

		Highstock.chart(
			'highchartsBlocks' + this.randomChartId,
			{
				chart: {
					type: 'column',
					marginLeft: 0,
					marginRight: 0,
					spacingLeft: 0,
					spacingRight: 0,
					spacingTop: 12,
				},
				legend: {
					enabled: true,
				},
				title: {
					text: '',
				},
				colors: ['var(--chart-default)', '#ff835c', '#e4a354', '#2b908f', '#f45b5b', '#91e8e1'],
				xAxis: {
					lineWidth: 0,
					tickColor: '#e5e1e1',
					type: 'datetime',
					range: 31 * 24 * 60 * 60 * 1000,
				},
				yAxis: [
					{
						title: {
							text: '',
						},
						allowDecimals: false,
						opposite: false,
						labels: {
							align: 'left',
							x: 1,
							y: -2,
						},
					},
				],
				tooltip: {
					style: {
						color: 'var(--text-color)',
						display: `inline-block`,
						width: 250,
					},
					shared: true,
					formatter: (tooltip) => {
						// date and epoch
						let text = this.getChartToolTipCaption(tooltip.chart.hoverPoints[0].x, network.genesisTs, tooltip.chart.hoverPoints[0].dataGroup.length)

						// summary
						for (let i = 0; i < tooltip.chart.hoverPoints.length; i++) {
							text += `<b><span style="color:${tooltip.chart.hoverPoints[i].color}">●</span> ${tooltip.chart.hoverPoints[i].series.name}: ${tooltip.chart.hoverPoints[i].y}</b><br/>`
						}

						return text
					},
				},
				plotOptions: {
					series: {
						dataGrouping: {
							units: [
								['day', [1, 2, 3]],
								['week', [1, 2]],
								['month', [1, 2, 3, 6]],
							],
							forced: true,
							enabled: true,
							groupAll: true,
						},
					},
					column: {
						centerInCategory: true,
					},
				},
				series: [
					{
						name: 'Proposed',
						color: 'var(--chart-default)',
						data: proposed,
						pointWidth: 5,
						type: 'column',
					},
					{
						name: 'Missed',
						color: '#ff835c',
						data: missed,
						pointWidth: 5,
						type: 'column',
					},
					{
						name: 'Orphaned',
						color: '#e4a354',
						data: orphaned,
						pointWidth: 5,
						type: 'column',
					},
				],
				rangeSelector: {
					enabled: false,
				},
				scrollbar: {
					enabled: false,
				},
				navigator: {
					enabled: true,
				},
			},
			null
		)
	}

	async createBalanceChart(consensusIncome, executionIncome) {
		executionIncome = executionIncome || []

		const ticksDecimalPlaces = 3
		const network = await this.api.getNetwork()

		const getValueString = (value: BigNumber): string => {
			let text = `${value.toFixed(5)} ETH`
			if (this.unit.pref != 'ETHER' && network.key == 'main') {
				text += ` (${this.unit.convertToPref(value, 'ETHER')})`
			}
			return text
		}

		Highstock.chart(
			'highcharts' + this.randomChartId,
			{
				exporting: {
					scale: 1,
				},
				rangeSelector: {
					enabled: false,
				},
				scrollbar: {
					enabled: false,
				},
				chart: {
					type: 'column',
					marginLeft: 0,
					marginRight: 0,
					spacingLeft: 0,
					spacingRight: 0,
					spacingTop: 12,
				},
				legend: {
					enabled: true,
				},
				title: {
					text: '', //Balance History for all Validators
				},
				xAxis: {
					type: 'datetime',
					range: 31 * 24 * 60 * 60 * 1000,
				},
				tooltip: {
					style: {
						color: 'var(--text-color)',
						display: `inline-block`,
						width: 250,
					},
					shared: true,
					formatter: (tooltip) => {
						// date and epoch
						let text = this.getChartToolTipCaption(tooltip.chart.hoverPoints[0].x, network.genesisTs, tooltip.chart.hoverPoints[0].dataGroup.length)

						// income
						let total = new BigNumber(0)
						for (let i = 0; i < tooltip.chart.hoverPoints.length; i++) {
							const value = new BigNumber(tooltip.chart.hoverPoints[i].y)
							text += `<b><span style="color:${tooltip.chart.hoverPoints[i].color}">●</span> ${
								tooltip.chart.hoverPoints[i].series.name
							}: ${getValueString(value)}</b><br/>`
							total = total.plus(value)
						}

						// add total if hovered point contains rewards for both EL and CL
						if (tooltip.chart.hoverPoints.length > 1) {
							text += `<b>Total: ${getValueString(total)}</b>`
						}

						return text
					},
				},
				navigator: {
					enabled: true,
					series: {
						data: consensusIncome,
						color: '#7cb5ec',
					},
				},
				plotOptions: {
					column: {
						stacking: 'stacked',
						dataLabels: {
							enabled: false,
						},
						dataGrouping: {
							forced: true,
							enabled: true,

							units: [
								['day', [1, 2, 3]],
								['week', [1, 2]],
								['month', [1, 2, 3, 6]],
							],
						},
					},
					series: {
						turboThreshold: 10000,
					},
				},
				yAxis: [
					{
						title: {
							text: '',
						},
						opposite: false,
						tickPositioner: function () {
							const precision = Math.pow(10, ticksDecimalPlaces)
							// make sure that no bar reaches the top or bottom of the chart (looks nicer)
							const padding = 1.15
							// make sure that the top and bottom tick are exactly at a position with [ticksDecimalPlaces] decimal places
							const min = Math.round(this.chart.series[1].dataMin * padding * precision) / precision

							// series[1].dataMax contains the consensus reward only and is therefore always available (we use it as default)
							// series[0].dataMax contains the highest visible bar that contains BOTH consensus AND execution reward
							// 	=> i.e. series[0].dataMax is undefined if no execution reward is shown
							// keep in mind that the user can toggle series on/off (can be checked via the series' visible parameter)
							let maxSeries = 1
							if (
								this.chart.series[0].visible &&
								this.chart.series[0].dataMax != undefined &&
								(this.chart.series[1].dataMax == undefined ||
									!this.chart.series[1].visible ||
									this.chart.series[0].dataMax > this.chart.series[1].dataMax)
							) {
								// use series[0] to calculate max since it is available and series[1] is either unavailable/hidden or lower than series[0]
								maxSeries = 0
							}

							const max = Math.round(this.chart.series[maxSeries].dataMax * padding * precision) / precision

							// only show 3 ticks if min < 0 && max > 0
							let positions
							if (min < 0) {
								if (max < 0) {
									positions = [min, 0]
								} else {
									positions = [min, 0, max]
								}
							} else {
								positions = [0, max]
							}

							return positions
						},
						labels: {
							align: 'left',
							x: 1,
							y: -2,
							formatter: function () {
								if (this.value == 0) {
									return '0'
								}
								return parseFloat(this.value.toString()).toFixed(ticksDecimalPlaces)
							},
						},
					},
				],
				series: [
					{
						name: 'Consensus',
						data: consensusIncome,
						index: 2,
						type: 'column',
					},
					{
						name: 'Execution',
						data: executionIncome,
						index: 1,
						type: 'column',
					},
				],
			},
			null
		)
	}

	onDismissed() {
		this.updateMergeListDismissed()
	}

	async openBrowser() {
		await Browser.open({ url: await this.getBrowserURL(), toolbarColor: '#2f2e42' })
	}

	async getBrowserURL(): Promise<string> {
		if (this.data.foreignValidator) {
			return (await this.getBaseBrowserUrl()) + '/validator/' + this.data.foreignValidatorItem.pubkey
		} else {
			return (await this.getBaseBrowserUrl()) + '/dashboard?validators=' + this.data.lazyChartValidators
		}
	}

	async getBaseBrowserUrl() {
		const net = (await this.api.networkConfig).net
		return 'https://' + net + 'beaconcha.in'
	}
}

function getRandomInt(max) {
	return Math.floor(Math.random() * Math.floor(max))
}

interface Proposals {
	good: number
	bad: number
}

interface SyncCommitteeMessage {
	title: string
	text: string
}

interface FinalizationIssue {
	ts: number
	value: boolean
}
