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

import { Component, OnInit, Input, SimpleChange, signal, WritableSignal, computed, Signal, effect, Output, EventEmitter } from '@angular/core'
import { UnitconvService } from '@services/unitconv.service'
import { ApiService } from '@services/api.service'
import { OverviewData2 } from '../../controllers/OverviewController'
import { Release } from '@utils/ClientUpdateUtils'
import ThemeUtils from 'src/app/utils/ThemeUtils'
import { StorageService } from 'src/app/services/storage.service'
import confetti from 'canvas-confetti'
import { Browser } from '@capacitor/browser'
import { ModalController, Platform } from '@ionic/angular'
import { SubscribePage } from 'src/app/pages/subscribe/subscribe.page'
import { MerchantUtils } from 'src/app/utils/MerchantUtils'
import { ValidatorUtils } from 'src/app/utils/ValidatorUtils'
import FirebaseUtils from 'src/app/utils/FirebaseUtils'
import { endEpochSyncCommittee, slotToEpoch, startEpochSyncCommittee } from 'src/app/utils/MathUtils'
import { epochToTimestamp, getLocale } from 'src/app/utils/TimeUtils'
import { Period, setID } from 'src/app/requests/v2-dashboard'
import { getSuccessFailMode, Mode } from './success-fail-view/success-fail-view.component'
import { DashboardUtils } from '@utils/DashboardUtils'
import { formatAddress } from '@utils/Formatting'
import BigNumber from 'bignumber.js'
type ExtraTabs = 'chartIncome' | 'chartSummary' | 'rocketPool'
type RewardTabs = 'combined' | 'cons' | 'exec'
@Component({
	selector: 'app-validator-dashboard',
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss'],
	standalone: false,
})
export class DashboardComponent implements OnInit {
	public classReference = UnitconvService

	@Input() data?: OverviewData2
	@Input() updates?: Release[]
	@Input() currentY: number
	@Input() scrolling: boolean
	@Input() online: boolean
	@Output() fadeInCompleted = new EventEmitter<void>()
	@Output() changedGroup = new EventEmitter<void>()

	beaconChainUrl: string = null

	selectedExtraTab: WritableSignal<ExtraTabs> = signal('chartIncome')
	selectedRPNode: WritableSignal<string> = signal(null)

	rplState = 'rpl'

	nextRewardRound: string = null

	notificationPermissionPending = false

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
		private platform: Platform,
		private dashboardUtils: DashboardUtils
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

	formatAddress = formatAddress

	groups = computed(() => {
		return this.dashboardUtils.getGroupList(this.data?.overviewData()?.groups)
	})

	selectedExtraTabTitle = computed(() => {
		if (this.selectedExtraTab() == 'chartIncome') return 'Income'
		if (this.selectedExtraTab() == 'chartSummary') return 'Efficiency'
		return 'Income'
	})

	selectedExtraTabTimeframe = computed(() => {
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
			slotToEpoch(this.data.chainNetwork().id, this.data.latestState().state.finalized_epoch) - epochsToWaitBeforeFinalizationIssue >
			this.data.latestState().state.finalized_epoch
		)
	})

	awaitGenesis = computed(() => {
		if (!this.data || !this.data.latestState()?.state) return false
		const currentEpoch = slotToEpoch(this.data.chainNetwork().id, this.data.latestState().state.current_slot)
		return currentEpoch == 0 && this.data.latestState().state.current_slot <= 0
	})

	earlyGenesis = computed(() => {
		if (!this.data || !this.data.latestState()?.state) return false
		const currentEpoch = slotToEpoch(this.data.chainNetwork().id, this.data.latestState().state.current_slot)
		return !this.awaitGenesis() && !this.finalizationIssue() && currentEpoch <= 7
	})

	currentSyncCommitteeMessage: Signal<SyncCommitteeMessage> = computed(() => {
		if (this.data && this.data.summaryGroup().sync_count.current_validators > 0 && this.data.latestState()?.state) {
			const startEpoch = startEpochSyncCommittee(this.data.chainNetwork().id, this.data.latestState().state.current_slot)
			const startTs = epochToTimestamp(this.data.chainNetwork().id, startEpoch)

			const endEpoch = endEpochSyncCommittee(this.data.chainNetwork().id, this.data.latestState().state.current_slot)
			const endTs = epochToTimestamp(this.data.chainNetwork().id, endEpoch)

			const plural = this.data.summaryGroup().sync_count.current_validators > 1
			const options = this.syncDateFormatOptions()

			const opening = plural ? `${this.data.summaryGroup().sync_count.current_validators} of your validators` : 'Your validator'
			return {
				title: 'Sync Committee',
				text: `${opening} ${plural ? 'are' : 'is'} currently part of the active sync committee.
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
			const startEpoch = endEpochSyncCommittee(this.data.chainNetwork().id, this.data.latestState().state.current_slot) // end of current is start of next
			const startTs = epochToTimestamp(this.data.chainNetwork().id, startEpoch)

			const endEpoch = endEpochSyncCommittee(this.data.chainNetwork().id, startEpoch * this.data.chainNetwork().slotPerEpoch) // end of next
			const endTs = epochToTimestamp(this.data.chainNetwork().id, endEpoch)

			const plural = this.data.summaryGroup().sync_count.upcoming_validators > 1
			const options = this.syncDateFormatOptions()

			const opening = plural ? `${this.data.summaryGroup().sync_count.current_validators} of your validators` : 'Your validator'
			return {
				title: 'Sync Committee Soon',
				text: `${opening}  ${plural ? 'are' : 'is'} part of the <strong>next</strong> sync committee.
					<br/><br/>This duty starts at ${new Date(startTs).toLocaleString(getLocale(), options)} (Epoch ${startEpoch}) and 
					will end at ${new Date(endTs).toLocaleString(getLocale(), options)} (Epoch ${endEpoch - 1}). 
					<br/><br/>You'll earn extra rewards during this period if you are online and attesting.
      			`,
			} as SyncCommitteeMessage
		}
		return null
	})

	async onGroupChanged(id: number) {
		await this.storage.setDashboardGroupID(id)
		this.data?.selectedGroupID.set(id)

		this.changedGroup.emit()
	}

	syncDateFormatOptions(): Intl.DateTimeFormatOptions {
		return {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		}
	}

	ngOnChanges(event: { data: { currentValue: unknown } }) {
		if (event.data && event.data instanceof SimpleChange) {
			if (event.data.currentValue) {
				this.beaconChainUrl = this.api.getBaseUrl()
			}
			this.selectedRPNode.set(this.data?.rocketpool()?.[0]?.node?.hash)
		}
	}

	depositCreditText = computed(() => {
		let depositCredit = new BigNumber(0)
		this.data.rocketpool()?.forEach((item) => {
			depositCredit = depositCredit.plus(new BigNumber(item.deposit_credit))
		})
		if (depositCredit.gt(0)) {
			return `You have ${this.unit.convertNonFiat(
				depositCredit,
				'WEI',
				'ETHER',
				true
			)} in unused Rocketpool deposit credit.<br/><br/>You can use this credit to spin up more minipools. Be aware that you can not withdraw your deposit credit.`
		}
		return null
	})

	ngOnInit() {
		getSuccessFailMode(this.storage).then((result) => {
			this.successFailMode.set(result)
		})
		if (this.platform.is('ios') || this.platform.is('android')) {
			this.firebaseUtils.hasNotificationConsent().then(async (result) => {
				const loggedIn = await this.storage.isLoggedIn()
				if (!loggedIn) return

				this.notificationPermissionPending = !result
			})
		}
		this.storage.getItem('rpl_pdisplay_mode').then((result) => (this.rplState = result ? result : 'rpl'))
	}

	async upgrade() {
		const modal = await this.modalController.create({
			component: SubscribePage,
			cssClass: 'my-custom-class',
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

	async openBrowser() {
		await Browser.open({ url: this.getBrowserURL(), toolbarColor: '#2f2e42' })
	}

	getBrowserURL(): string {
		return setID(this.api.getBaseUrl() + '/dashboard/{id}', this.data.id)
	}
}

interface SyncCommitteeMessage {
	title: string
	text: string
}
