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

import { Component, OnInit, Input, SimpleChange, signal, WritableSignal, computed, Signal, effect } from '@angular/core'
import { RewardType, UnitconvService } from '../../services/unitconv.service'
import { ApiService } from '../../services/api.service'
import * as Highstock from 'highcharts/highstock'
import BigNumber from 'bignumber.js'
import { OverviewData2, Rocketpool } from '../../controllers/OverviewController'
import { Release } from '../../utils/ClientUpdateUtils'
import ThemeUtils from 'src/app/utils/ThemeUtils'
import { StorageService } from 'src/app/services/storage.service'
import confetti from 'canvas-confetti'
import { Browser } from '@capacitor/browser'
import { ModalController, Platform } from '@ionic/angular'
import { SubscribePage } from 'src/app/pages/subscribe/subscribe.page'
import { MerchantUtils } from 'src/app/utils/MerchantUtils'
import { ValidatorUtils } from 'src/app/utils/ValidatorUtils'
import FirebaseUtils from 'src/app/utils/FirebaseUtils'
import { trigger, style, animate, transition } from '@angular/animations'
import { endEpochSyncCommittee, slotToEpoch, startEpochSyncCommittee } from 'src/app/utils/MathUtils'
import { epochToTimestamp, getLocale} from 'src/app/utils/TimeUtils'
import { setID } from 'src/app/requests/v2-dashboard'
import { getSuccessFailMode, Mode } from './success-fail-view/success-fail-view.component'
@Component({
	selector: 'app-validator-dashboard',
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss'],
	animations: [trigger('fadeIn', [transition(':enter', [style({ opacity: 0 }), animate('300ms 300ms', style({ opacity: 1 }))])])],
})
export class DashboardComponent implements OnInit {
	public classReference = UnitconvService

	@Input() data?: OverviewData2
	@Input() updates?: Release[]
	@Input() currentY: number
	@Input() scrolling: boolean

	beaconChainUrl: string = null

	utilizationAvg = -1

	chartData

	selectedChart = 'chartSummary'

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

	notificationPermissionPending = false
	depositCreditText = null
	vacantMinipoolText = null
	showWithdrawalInfo = false

	rewardTab: 'combined' | 'cons' | 'exec' = 'combined'

	successFailMode: WritableSignal<Mode> = signal('percentage')

	aggregationValue = 'hourly'

	ignoreConfetti = false

	constructor(
		public unit: UnitconvService,
		public api: ApiService,
		public theme: ThemeUtils,
		private storage: StorageService,
		private modalController: ModalController,
		public merchant: MerchantUtils,
		public validatorUtils: ValidatorUtils,
		private firebaseUtils: FirebaseUtils,
		private platform: Platform
	) {
		effect(async () => {
			if ((await this.showFirstProposalMsg()) && !this.ignoreConfetti) {
				this.ignoreConfetti = true
				setTimeout(() => {
					confetti({
						particleCount: 30,
						spread: 50,
						origin: { y: 0.41 },
					})
				}, 800)
			}
		})
	}

	showFirstProposalMsg = computed(async () => {
		if (!this.data || this.data.foreignValidator) return
		const foundAtLeasOne = this.data.summary()[0].proposals.success === 1
		const noPreviousFirstProposal = await this.storage.getBooleanSetting('first_proposal_executed', false)
		if (foundAtLeasOne && !noPreviousFirstProposal) {
			return true
		}
	})

	finalizationIssue: Signal<boolean> = computed(() => {
		if (!this.data || !this.data.latestState()?.state) return false
		const epochsToWaitBeforeFinalizationIssue = 4 // 2 normal delay + 2 extra
		return (
			slotToEpoch(this.data.latestState().state.finalized_epoch) - epochsToWaitBeforeFinalizationIssue > this.data.latestState().state.finalized_epoch
		)
	})

	awaitGenesis = computed(() => {
		if (!this.data || !this.data.latestState()?.state) return false
		const currentEpoch = slotToEpoch(this.data.latestState().state.current_slot)
		return currentEpoch == 0 && this.data.latestState().state.current_slot <= 0
	})

	earlyGenesis = computed(() => {
		if (!this.data || !this.data.latestState()?.state) return false
		const currentEpoch = slotToEpoch(this.data.latestState().state.current_slot)
		return !this.awaitGenesis() && !this.finalizationIssue() && currentEpoch <= 7
	})

	currentSyncCommitteeMessage: Signal<SyncCommitteeMessage> = computed(() => {
		if (this.data && this.data.summaryGroup().sync_count.current_validators > 0 && this.data.latestState()?.state) {
			const startEpoch = startEpochSyncCommittee(this.api, this.data.latestState().state.current_slot)
			const startTs = epochToTimestamp(this.api, startEpoch)

			const endEpoch = endEpochSyncCommittee(this.api, this.data.latestState().state.current_slot)
			const endTs = epochToTimestamp(this.api, endEpoch)

			const plural = this.data.summaryGroup().sync_count.current_validators > 1
			const options = this.syncDateFormatOptions()
			return {
				title: 'Sync Committee',
				text: `${this.data.summaryGroup().sync_count.current_validators} of your validator${plural ? 's' : ''} ${
					plural ? 'are' : 'is'
				} currently part of the active sync committee.
					<br/><br/>This duty started at ${new Date(startTs).toLocaleString(getLocale(), options)} (Epoch ${startEpoch}) and 
					will end at ${new Date(endTs).toLocaleString(getLocale(), options)} (Epoch ${endEpoch - 1}). 
					<br/><br/>You'll earn extra rewards during this period if you are online and attesting.
      			`,
			} as SyncCommitteeMessage
		}
		return null
	})

	nextSyncCommitteeMessage: Signal<SyncCommitteeMessage> = computed(() => {
		if (this.data && this.data.summaryGroup().sync_count.upcoming_validators > 0 && this.data.latestState()?.state) {
			const startEpoch = endEpochSyncCommittee(this.api, this.data.latestState().state.current_slot) // end of current is start of next
			const startTs = epochToTimestamp(this.api, startEpoch)

			const endEpoch = endEpochSyncCommittee(this.api, startEpoch * this.api.networkConfig.slotPerEpoch) // end of next
			const endTs = epochToTimestamp(this.api, endEpoch)

			const plural = this.data.summaryGroup().sync_count.upcoming_validators > 1
			const options = this.syncDateFormatOptions()
			return {
				title: 'Sync Committee Soon',
				text: `${this.data.summaryGroup().sync_count.upcoming_validators} of your validator${plural ? 's' : ''}  ${
					plural ? 'are' : 'is'
				} part of the <strong>next</strong> sync committee.
					<br/><br/>This duty starts at ${new Date(startTs).toLocaleString(getLocale(), options)} (Epoch ${startEpoch}) and 
					will end at ${new Date(endTs).toLocaleString(getLocale(), options)} (Epoch ${endEpoch - 1}). 
					<br/><br/>You'll earn extra rewards during this period if you are online and attesting.
      			`,
			} as SyncCommitteeMessage
		}
		return null
	})

	syncDateFormatOptions(): Intl.DateTimeFormatOptions {
		return {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		}
	}

	isAfterPotentialMergeTarget() {
		const now = Date.now()
		const target = 1663624800000 // target sept 20th to dismiss merge checklist
		return now >= target
	}

	ngOnChanges(event) {
		console.log('event data', event.data)
		if (event.data && event.data instanceof SimpleChange) {
			if (event.data.currentValue) {
				this.chartData = null

				if (this.platform.is('ios') || this.platform.is('android')) {
					this.firebaseUtils.hasNotificationConsent().then(async (result) => {
						const loggedIn = await this.storage.isLoggedIn()
						if (!loggedIn) return

						this.notificationPermissionPending = !result
					})
				}

				if (this.balanceChart) {
					this.balanceChart.destroy()
				}

				setTimeout(() => {
					// this.drawBalanceChart()
					// this.drawProposalChart()
				}, 500)

				this.beaconChainUrl = this.api.getBaseUrl()

				// todo
				// await Promise.all([
				// 	this.updateRplDisplay(),
				// 	this.updateNextRewardRound(),
				// 	this.updateRplCommission(),
				// 	this.updateRplApr(),
				// 	this.updateRplProjectedClaim(),
				// 	this.updateSmoothingPool(),
				// 	this.updateActiveSyncCommitteeMessage(this.data.currentSyncCommittee),
				// 	this.updateNextSyncCommitteeMessage(this.data.nextSyncCommittee),
				// 	this.updateDepositCreditText(),
				// 	this.updateVacantMinipoolText(),
				// 	this.updateWithdrawalInfo(),
				// ])
			}
		}
	}

	// updateWithdrawalInfo() {
	// 	this.storage.getBooleanSetting('withdrawal_info_dismissed', false).then((result) => {
	// 		this.showWithdrawalInfo = !this.data.withdrawalsEnabledForAll && !result
	// 	})
	// }

	// updateDepositCreditText() {
	// 	if (this.data.rocketpool.depositCredit && this.data.rocketpool.depositCredit.gt(0)) {
	// 		this.depositCreditText = `You have ${this.unit.convertNonFiat(
	// 			this.data.rocketpool.depositCredit,
	// 			'WEI',
	// 			'ETHER',
	// 			true
	// 		)} in unused Rocketpool deposit credit.<br/><br/>You can use this credit to spin up more minipools. Be aware that you can not withdraw your deposit credit.`
	// 	}
	// }

	// updateVacantMinipoolText() {
	// 	if (this.data.rocketpool.vacantPools && this.data.rocketpool.vacantPools > 0) {
	// 		this.vacantMinipoolText = `${this.data.rocketpool.vacantPools} of your ${
	// 			this.data.rocketpool.vacantPools == 1 ? 'minipool is' : 'minipools are'
	// 		}
	// 		currently vacant. Head over to the validators tab to see which one has a vacant label.<br/><br/>
	// 		If you recently converted a validator to a minipool please make sure you did change the 0x0 withdrawal credentials to the new vacant minipool address (0x01) to fix this warning.<br/><br/>
	// 		If you already changed the withdrawal credentials this warning will disappear on it's own within 24h.
	// 		`
	// 	}
	// }

	// updateSmoothingPool() {
	// 	try {
	// 		if (!this.validatorUtils.rocketpoolStats || !this.validatorUtils.rocketpoolStats.effective_rpl_staked) return
	// 		this.hasNonSmoothingPoolAsWell = this.data.rocketpool.hasNonSmoothingPoolAsWell
	// 		this.displaySmoothingPool = this.data.rocketpool.smoothingPool
	// 		this.smoothingClaimed = this.data.rocketpool.smoothingPoolClaimed
	// 		this.smoothingUnclaimed = this.data.rocketpool.smoothingPoolUnclaimed
	// 		this.unclaimedRpl = this.data.rocketpool.rplUnclaimed
	// 		this.totalRplEarned = this.data.rocketpool.totalClaims.plus(this.data.rocketpool.rplUnclaimed)
	// 	} catch (e) {
	// 		console.warn('cannot update smoothing pool', e)
	// 	}
	// }

	// updateRplProjectedClaim() {
	// 	try {
	// 		if (!this.validatorUtils.rocketpoolStats || !this.validatorUtils.rocketpoolStats.effective_rpl_staked) return
	// 		if (this.data.rocketpool.currentRpl.isLessThanOrEqualTo(this.data.rocketpool.minRpl)) {
	// 			this.rplProjectedClaim = 0
	// 			return
	// 		}

	// 		const temp = this.getEffectiveRplStake(this.data.rocketpool)
	// 			.dividedBy(new BigNumber(this.validatorUtils.rocketpoolStats.effective_rpl_staked))
	// 			.multipliedBy(new BigNumber(this.validatorUtils.rocketpoolStats.node_operator_rewards))

	// 		this.rplProjectedClaim = temp
	// 		if (temp.isLessThanOrEqualTo(new BigNumber('0'))) {
	// 			this.rplProjectedClaim = null
	// 		}
	// 	} catch (e) {
	// 		console.warn('cannot updateRplProjectedClaim', e)
	// 	}
	// }

	getEffectiveRplStake(data: Rocketpool): BigNumber {
		if (data.currentRpl.isGreaterThanOrEqualTo(data.maxRpl)) return data.maxRpl
		if (data.currentRpl.isLessThanOrEqualTo(data.minRpl)) return data.minRpl
		return data.currentRpl
	}

	updateRplApr() {
		try {
			if (!this.validatorUtils.rocketpoolStats || !this.validatorUtils.rocketpoolStats.claim_interval_time) return
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
			if (!this.validatorUtils.rocketpoolStats || !this.validatorUtils.rocketpoolStats.current_node_fee) return
			this.rplCommission = Math.round(this.validatorUtils.rocketpoolStats.current_node_fee * 10000) / 100
		} catch (e) {
			console.warn('cannot updateRplCommission', e)
		}
	}

	updateNextRewardRound() {
		try {
			if (!this.validatorUtils.rocketpoolStats || !this.validatorUtils.rocketpoolStats.claim_interval_time) return
			const hoursToAdd = this.validatorUtils.rocketpoolStats.claim_interval_time.split(':')[0]
			this.nextRewardRound = this.validatorUtils.rocketpoolStats.claim_interval_time_start * 1000 + parseInt(hoursToAdd) * 60 * 60 * 1000
		} catch (e) {
			console.warn('cannot updateNextRewardRound', e)
		}
	}

	ngOnInit() {
		getSuccessFailMode(this.storage).then((result) => {
			this.successFailMode.set(result)
		})
		this.storage.getItem('rpl_pdisplay_mode').then((result) => (this.rplState = result ? result : 'rpl'))
	}

	// TODO
	// async getChartData(data: 'allbalances' | 'proposals') {
	// 	if (!this.data || !this.data.lazyChartValidators) return null
	// 	const chartReq = new DashboardDataRequest(data, this.data.lazyChartValidators)
	// 	const response = await this.api.execute(chartReq).catch(() => {
	// 		return null
	// 	})
	// 	if (!response) {
	// 		this.chartError = true
	// 		return null
	// 	}
	// 	return chartReq.parse(response)
	// }

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

	switchRplStake(canPercent = false) {
		if (this.rplState == 'rpl' && canPercent) {
			// next %
			this.rplState = '%'
			this.storage.setItem('rpl_pdisplay_mode', this.rplState)
			return
		} else if ((this.rplState == 'rpl' && !canPercent) || this.rplState == '%') {
			// next %
			this.rplState = 'conv'
			this.storage.setItem('rpl_pdisplay_mode', this.rplState)
			return
		} else {
			this.rplState = 'rpl'
			this.storage.setItem('rpl_pdisplay_mode', this.rplState)
			return
		}
	}

	// TODO
	// updateRplDisplay() {
	// 	if (this.rplState == '%') {
	// 		const rplPrice = this.unit.getRPLPrice()
	// 		const currentETH = this.data.rocketpool.currentRpl.multipliedBy(rplPrice)
	// 		const minETH = this.data.rocketpool.minRpl.multipliedBy(rplPrice).multipliedBy(10) // since collateral is 10% of borrowed eth, multiply by 10 to get to the borrowed eth amount

	// 		this.rplDisplay = currentETH.dividedBy(minETH).multipliedBy(100).decimalPlaces(1).toNumber()
	// 	} else {
	// 		this.rplDisplay = this.data.rocketpool.currentRpl
	// 	}
	// }

	// todo
	// async drawBalanceChart() {
	// 	this.chartData = await this.getChartData('allbalances')

	// 	if (!this.chartData || this.chartData.length < 3) {
	// 		this.chartError = true
	// 		return
	// 	}

	// 	this.chartError = false

	// 	const setTimestampToMidnight = (ts: number): number => {
	// 		const d = new Date(ts)
	// 		d.setHours(0)
	// 		d.setMinutes(0)
	// 		d.setSeconds(0)
	// 		d.setMilliseconds(0)
	// 		return d.getTime()
	// 	}

	// 	// force timestamp to be at 00:00AM for the day to keep columns centered on ticks
	// 	for (let i = 0; i < this.chartData.consensusChartData.length; i++) {
	// 		this.chartData.consensusChartData[i].x = setTimestampToMidnight(this.chartData.consensusChartData[i].x)
	// 	}
	// 	for (let i = 0; i < this.chartData.executionChartData.length; i++) {
	// 		this.chartData.executionChartData[i].x = setTimestampToMidnight(this.chartData.executionChartData[i].x)
	// 	}

	// 	// accumulate all execution income entries per day into a single entry
	// 	for (let i = this.chartData.executionChartData.length - 1; i > 0; i--) {
	// 		if (this.chartData.executionChartData[i].x == this.chartData.executionChartData[i - 1].x) {
	// 			this.chartData.executionChartData[i - 1].y += this.chartData.executionChartData[i].y
	// 			this.chartData.executionChartData.splice(i, 1)
	// 		}
	// 	}

	// 	this.createBalanceChart(this.chartData.consensusChartData, this.chartData.executionChartData)
	// }

	private getChartToolTipCaption(timestamp: number, genesisTs: number, slotTime: number, slotsPerEpoch: number, dataGroupLength: number) {
		const dateToEpoch = (ts: number): number => {
			const slot = Math.floor((ts / 1000 - genesisTs) / slotTime)
			const epoch = Math.floor(slot / slotsPerEpoch)
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

	private balanceChart = null
	createBalanceChart(consensusIncome, executionIncome) {
		executionIncome = executionIncome || []

		const ticksDecimalPlaces = 3
		const network = this.api.getNetwork()

		const getValueString = (value: BigNumber, type: RewardType): string => {
			let text
			if (type == 'cons') {
				text = `${value.toFixed(5)} ` + this.unit.getNetworkDefaultUnit(type).display
				if (!this.unit.isDefaultCurrency(this.unit.pref.Cons)) {
					text += ` (${this.unit.convertToPref(value, this.unit.getNetworkDefaultCurrency(type), type)})`
				}
			} else if (type == 'exec') {
				// Gnosis: All values provided by the API are in the CL currency, including the el rewards
				text = `${this.unit.convertCLtoEL(value).toFixed(5)} ` + this.unit.getNetworkDefaultUnit(type).display
				if (!this.unit.isDefaultCurrency(this.unit.pref.Exec)) {
					text += ` (${this.unit.convertToPref(value, this.unit.getNetworkDefaultCurrency('cons'), 'cons')})`
				}
			}

			return text
		}

		this.balanceChart = Highstock.chart(
			'highcharts',
			{
				accessibility: {
					enabled: false,
				},
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
						let text = this.getChartToolTipCaption(
							tooltip.chart.hoverPoints[0].x,
							network.genesisTs,
							network.slotsTime,
							network.slotPerEpoch,
							tooltip.chart.hoverPoints[0].dataGroup.length
						)

						// income
						// Gnosis: All values provided by the API are in the CL currency, including the el rewards which is why we can simply add them for total
						let total = new BigNumber(0)
						for (let i = 0; i < tooltip.chart.hoverPoints.length; i++) {
							const type = tooltip.chart.hoverPoints[i].series.name == 'Execution' ? 'exec' : 'cons'

							const value = new BigNumber(tooltip.chart.hoverPoints[i].y)
							text += `<b><span style="color:${tooltip.chart.hoverPoints[i].color}">●</span> ${
								tooltip.chart.hoverPoints[i].series.name
							}: ${getValueString(value, type)}</b><br/>`

							total = total.plus(value)
						}

						// add total if hovered point contains rewards for both EL and CL
						// only if both exec and cons currencies are the same
						if (tooltip.chart.hoverPoints.length > 1) {
							text += `<b>Total: ${getValueString(total, 'cons')}</b>`
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
						borderWidth: 0,
						stacking: 'normal',
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

	async openBrowser() {
		// todo
		await Browser.open({ url: this.getBrowserURL(), toolbarColor: '#2f2e42' })
	}

	getBrowserURL(): string {
		// todo foreign validator
		// if (this.data.foreignValidator) {
		// 	return this.api.getBaseUrl() + '/dashboard/' + this.data.foreignValidatorItem
		// } else {
		return setID(this.api.getBaseUrl() + '/dashboard/{id}', this.data.id)
		//}
	}
}

interface SyncCommitteeMessage {
	title: string
	text: string
}


