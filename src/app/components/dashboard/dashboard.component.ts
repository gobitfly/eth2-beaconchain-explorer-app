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
import { UnitconvService } from '../../services/unitconv.service'
import { ApiService } from '../../services/api.service'
import { OverviewData2 } from '../../controllers/OverviewController'
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
import { epochToTimestamp, getLocale } from 'src/app/utils/TimeUtils'
import { Period, setID } from 'src/app/requests/v2-dashboard'
import { getSuccessFailMode, Mode } from './success-fail-view/success-fail-view.component'

type ExtraTabs = 'chartIncome' | 'chartSummary' | 'rocketPool'
type RewardTabs = 'combined' | 'cons' | 'exec'
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

	selectedExtraTab: WritableSignal<ExtraTabs> = signal('chartIncome')

	rplState = 'rpl'
	rplDisplay

	nextRewardRound = null

	notificationPermissionPending = false
	depositCreditText = null
	vacantMinipoolText = null
	showWithdrawalInfo = false

	rewardTab: RewardTabs = 'combined'

	successFailMode: WritableSignal<Mode> = signal('percentage')

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

	selectedExtraTabTitle = computed(() => {
		if (this.selectedExtraTab() == 'chartIncome') return 'Income'
		if (this.selectedExtraTab() == 'chartSummary') return 'Efficiency'
		if (this.selectedExtraTab() == 'rocketPool') return 'Rocket Pool'
		return 'Income'
	})

	selectedExtraTabTimeframe = computed(() => {
		if (this.selectedExtraTab() == 'rocketPool') return ''
		if (this.data && this.data.timeframeDisplay()) return this.data.timeframeDisplay()
		return Period.AllTime
	})

	showFirstProposalMsg = computed(async () => {
		if (!this.data || this.data.foreignValidator || !this.data.summary() || this.data.summary().length == 0) return
		const foundAtLeasOne = this.data.summary()[0].proposals.success === 1
		const noPreviousFirstProposal = await this.storage.getBooleanSetting('first_proposal_executed', false)
		if (foundAtLeasOne && !noPreviousFirstProposal && this.data?.timeframe() == Period.AllTime) {
			return true
		}
	})

	finalizationIssue: Signal<boolean> = computed(() => {
		if (!this.data || !this.data.latestState()?.state) return false
		const epochsToWaitBeforeFinalizationIssue = 4 // 2 normal delay + 2 extra
		return (
			slotToEpoch(this.api, this.data.latestState().state.finalized_epoch) - epochsToWaitBeforeFinalizationIssue >
			this.data.latestState().state.finalized_epoch
		)
	})

	awaitGenesis = computed(() => {
		if (!this.data || !this.data.latestState()?.state) return false
		const currentEpoch = slotToEpoch(this.api, this.data.latestState().state.current_slot)
		return currentEpoch == 0 && this.data.latestState().state.current_slot <= 0
	})

	earlyGenesis = computed(() => {
		if (!this.data || !this.data.latestState()?.state) return false
		const currentEpoch = slotToEpoch(this.api, this.data.latestState().state.current_slot)
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

	ngOnChanges(event) {
		console.log('event data', event.data)
		if (event.data && event.data instanceof SimpleChange) {
			if (event.data.currentValue) {
				if (this.platform.is('ios') || this.platform.is('android')) {
					this.firebaseUtils.hasNotificationConsent().then(async (result) => {
						const loggedIn = await this.storage.isLoggedIn()
						if (!loggedIn) return

						this.notificationPermissionPending = !result
					})
				}

				this.beaconChainUrl = this.api.getBaseUrl()
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
				tab: 'dolphin',
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
