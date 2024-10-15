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

import BigNumber from 'bignumber.js'
import {
	Aggregation,
	dashboardID,
	EfficiencyType,
	Period,
	V2DashboardOverview,
	V2DashboardRewardChart,
	V2DashboardRocketPool,
	V2DashboardSummaryChart,
	V2DashboardSummaryGroupTable,
	V2DashboardSummaryTable,
} from '../requests/v2-dashboard'
import { ApiService, LatestStateWithTime } from '../services/api.service'
import { VDBGroupSummaryData, VDBOverviewData, VDBRocketPoolTableRow, VDBSummaryTableRow } from '../requests/types/validator_dashboard'
import { computed, Injectable, signal, Signal, WritableSignal } from '@angular/core'
import { ChartData } from '../requests/types/common'
import { DashboardUtils } from '../utils/DashboardUtils'
import { ChainNetwork, findChainNetworkById } from '../utils/NetworkData'
import { sumBigInt } from '../utils/MathUtils'
export interface SummaryChartOptions {
	aggregation: Aggregation
	startTime: number
	endTime: number
	force: boolean
}

@Injectable({ providedIn: 'root' })
export class OverviewProvider {
	constructor(
		private api: ApiService,
		private dashboardUtils: DashboardUtils
	) {}

	clearRequestCache(data: OverviewData2) {
		if (!data) return
		return this.api.clearAllAssociatedCacheKeys(data.associatedCacheKey)
	}

	async setSummaryChartOptions(data: OverviewData2, options: SummaryChartOptions, force: boolean = false) {
		data.summaryChartOptionsInternal.set(options)
		const aggregation = options.aggregation

		let startTime = options.startTime
		if (startTime == null) {
			startTime = Date.now() / 1000 - 12 * 60 * 60
			if (aggregation == Aggregation.Epoch) {
				startTime = Date.now() / 1000 - 8 * 60 * 60
			} else if (aggregation == Aggregation.Daily) {
				startTime = Date.now() / 1000 - 21 * 24 * 60 * 60
			} else if (aggregation == Aggregation.Weekly) {
				startTime = Date.now() / 1000 - 8 * 7 * 24 * 60 * 60
			}
		}

		const request = new V2DashboardSummaryChart(data.id, EfficiencyType.All, aggregation, startTime, options.endTime)
			.withAllowedCacheResponse(!force)
			.withCustomCacheKey('summary-chart-initial-' + aggregation + data.id)
		if (options.force) {
			request.withAllowedCacheResponse(false)
		}
		const result = await this.api.set(request, data.summaryChart, data.associatedCacheKey)
		if (result.error) {
			console.error('Error fetching summary chart', result.error)
		}
	}

	async setTimeframe(data: OverviewData2, timeframe: Period, force: boolean = false) {
		data.timeframeInternal.set(timeframe)
		const period = timeframe

		return Promise.all([
			this.api.set(new V2DashboardSummaryTable(data.id, period, null).withAllowedCacheResponse(!force), data.summary, data.associatedCacheKey),
			this.api.set(
				new V2DashboardSummaryGroupTable(data.id, 0, period, null).withAllowedCacheResponse(!force),
				data.summaryGroup,
				data.associatedCacheKey
			),
		])
	}

	async create(
		id: dashboardID,
		timeframe: Period,
		summaryChartOptions: SummaryChartOptions,
		associatedCacheKey: string = null
	): Promise<OverviewData2> {
		if (!id) return null

		const temp = new OverviewData2(id, associatedCacheKey)

		const overview = this.api.set(new V2DashboardOverview(id), temp.overviewData, associatedCacheKey)
		this.setTimeframe(temp, timeframe, false)

		this.api.set(new V2DashboardRocketPool(id), temp.rocketpool, associatedCacheKey)
		this.api.set(new V2DashboardRewardChart(id).withCustomCacheKey('reward-chart-initial-' + id), temp.rewardChart, associatedCacheKey)

		this.api.getLatestState().then((latestState) => {
			temp.latestState.set(latestState)
		})

		temp.summaryChartOptionsInternal.set(summaryChartOptions)

		//this.setSummaryChartOptions(temp, summaryChartOptions) // Summary Chart handles its own fetch logic, so below is not necessary

		// wait after all requests are made
		const overviewResult = await overview
		if (overviewResult.error) {
			throw overviewResult.error
		}

		return temp
	}
}

function getPeriodDisplayable(period: Period): string {
	if (period == Period.AllTime) return 'All'
	if (period == Period.Last1h) return '1h'
	if (period == Period.Last24h) return '24h'
	if (period == Period.Last7d) return '7d'
	if (period == Period.Last30d) return '30d'
}
export class OverviewData2 {
	associatedCacheKey: string = null

	loading: WritableSignal<boolean> = signal(false)
	id: dashboardID

	overviewData: WritableSignal<VDBOverviewData> = signal(null)
	summary: WritableSignal<VDBSummaryTableRow[]> = signal(null)
	summaryGroup: WritableSignal<VDBGroupSummaryData> = signal(null)
	latestState: WritableSignal<LatestStateWithTime> = signal(null)
	rocketpool: WritableSignal<VDBRocketPoolTableRow[]> = signal(null)
	summaryChart: WritableSignal<ChartData<number, number>> = signal(null)
	rewardChart: WritableSignal<ChartData<number, string>> = signal(null)

	timeframeInternal: WritableSignal<Period> = signal(null)
	timeframe = computed(() => this.timeframeInternal())
	timeframeDisplay = computed(() => getPeriodDisplayable(this.timeframe()))

	summaryChartOptionsInternal: WritableSignal<SummaryChartOptions> = signal(null)
	summaryChartOptions = computed(() => this.summaryChartOptionsInternal())

	foreignValidator: boolean = false

	chainNetwork: Signal<ChainNetwork> = computed(() => {
		if (!this.overviewData()) return findChainNetworkById(1)
		return findChainNetworkById(this.overviewData().network)
	})

	constructor(id: dashboardID, associatedCacheKey: string) {
		this.id = id
		this.associatedCacheKey = associatedCacheKey
	}

	isEmpty = computed(() => {
		return this.validatorCount() == 0
	})

	validatorCount: Signal<number> = computed(() => {
		if (!this.overviewData()) return 0
		return getValidatorCount(this.overviewData())
	})

	dashboardState: Signal<DashboardStatus> = computed(() => {
		return getDashboardState(this.overviewData(), this.validatorCount(), this.foreignValidator)
	})

	consensusPerformance: Signal<Performance> = computed(() => {
		return getConsensusPerformance(this.overviewData())
	})

	executionPerformance: Signal<Performance> = computed(() => {
		return getExecutionPerformance(this.overviewData())
	})

	combinedPerformance: Signal<Performance> = computed(() => {
		return getCombinedPerformance(this.consensusPerformance(), this.executionPerformance())
	})

	showSyncStats: Signal<boolean> = computed(() => {
		if (this.summaryGroup() == null) return false
		return (
			this.summaryGroup().sync_count.current_validators > 0 ||
			this.summaryGroup().sync_count.past_periods > 0 ||
			this.summaryGroup().sync_count.upcoming_validators > 0
		)
	})

	syncEfficiency: Signal<number> = computed(() => {
		if (this.summaryGroup() == null) return 0
		const total = this.summaryGroup().sync.status_count.success + this.summaryGroup().sync.status_count.failed
		if (total == 0) return 0
		return (this.summaryGroup().sync.status_count.success * 100) / total
	})

	syncCount: Signal<number> = computed(() => {
		if (this.summaryGroup() == null) return 0
		return this.summaryGroup().sync_count.past_periods + this.summaryGroup().sync_count.current_validators > 0 ? 1 : 0
	})

	isReadyToDisplay: Signal<boolean> = computed(() => {
		return this.overviewData() != null && this.summary() != null && this.summaryGroup() != null
	})

	rpTotalRPLClaimed: Signal<BigNumber> = computed(() => {
		if (this.rocketpool() == null) return new BigNumber(0)
		const claimed = sumBigInt(this.rocketpool(), (rp) => new BigNumber(rp.rpl.claimed))
		const unclaimed = sumBigInt(this.rocketpool(), (rp) => new BigNumber(rp.rpl.unclaimed))

		return claimed.plus(unclaimed)
	})

	avgNetworkEfficiency: Signal<number> = computed(() => {
		if (this.summary() == null) return 0
		return this.summary()[0].average_network_efficiency
	})

	getTotalMissedRewards: Signal<BigNumber> = computed(() => {
		if (this.summaryGroup() == null) return new BigNumber(0)
		return new BigNumber(this.summaryGroup().missed_rewards.attestations)
			.plus(new BigNumber(this.summaryGroup().missed_rewards.proposer_rewards.cl))
			.plus(new BigNumber(this.summaryGroup().missed_rewards.proposer_rewards.el))
			.plus(new BigNumber(this.summaryGroup().missed_rewards.sync))
	})

	totalSmoothingPool: Signal<BigNumber> = computed(() => {
		if (this.rocketpool() == null) return new BigNumber(0)
		const claimed = sumBigInt(this.rocketpool(), (rp) => new BigNumber(rp.smoothing_pool.claimed))
		const unclaimed = sumBigInt(this.rocketpool(), (rp) => new BigNumber(rp.smoothing_pool.unclaimed))
		return claimed.plus(unclaimed)
	})

	totalRPL: Signal<BigNumber> = computed(() => {
		if (this.rocketpool() == null) return new BigNumber(0)
		const claimed = sumBigInt(this.rocketpool(), (rp) => new BigNumber(rp.rpl.claimed))
		const unclaimed = sumBigInt(this.rocketpool(), (rp) => new BigNumber(rp.rpl.unclaimed))
		return claimed.plus(unclaimed)
	})
}

export function getValidatorCount(overviewData: VDBOverviewData): number {
	return (
		overviewData.validators.exited +
		overviewData.validators.offline +
		overviewData.validators.online +
		overviewData.validators.slashed +
		overviewData.validators.pending
	)
}

export type Performance = {
	performance1d: BigNumber
	performance30d: BigNumber
	performance7d: BigNumber
	total: BigNumber
	apr7d: number
	apr30d: number
	aprTotal: number
}

export type Rocketpool = {
	minRpl: BigNumber
	maxRpl: BigNumber
	currentRpl: BigNumber
	totalClaims: BigNumber
	fee: number
	status: string
	depositType: string
	smoothingPoolClaimed: BigNumber
	smoothingPoolUnclaimed: BigNumber
	rplUnclaimed: BigNumber
	smoothingPool: boolean
	hasNonSmoothingPoolAsWell: boolean
	cheatingStatus: RocketpoolCheatingStatus
	depositCredit: BigNumber
	vacantPools: number
}

enum StateType {
	online,
	offline,
	slashed,
	exited,
	activation,
	eligibility,

	none,
	mixed,
}

type DashboardDescription = {
	text: string
	highlight: boolean
}

export type DashboardStatus = {
	state: StateType
	icon: string
	title: string
	description: DashboardDescription[]
	extendedDescription: string
	extendedDescriptionPre: string
	iconCss: string
}

export type Description = {
	extendedDescription: string
	extendedDescriptionPre: string
}

function getDashboardState(overviewData: VDBOverviewData, validatorCount: number, foreignValidator: boolean): DashboardStatus {
	if (!overviewData) return null
	// create status object with some default values
	const dashboardStatus: DashboardStatus = {
		state: StateType.none,
		title: `${overviewData.validators.online} / ${validatorCount}`,
		iconCss: 'ok',
		icon: 'checkmark-circle-outline',
		description: [],
		extendedDescription: '',
		extendedDescriptionPre: '',
	}

	////
	// Attention: The order of all the updateStateX functions matters!
	// 	The first one that matches will set the icon and its css as well as, if only one state matches, the extendedDescription

	// handle slashed validators
	updateStateSlashed(dashboardStatus, overviewData.validators.slashed, validatorCount, foreignValidator)

	// handle offline validators
	updateStateOffline(dashboardStatus, validatorCount, overviewData.validators.offline, foreignValidator)

	// handle awaiting activation validators
	if (overviewData.validators.pending > 0) {
		updateStateAwaiting(dashboardStatus, overviewData.validators.pending, validatorCount, foreignValidator)
	}

	// handle exited validators
	updateExitedState(dashboardStatus, overviewData.validators.exited, validatorCount, foreignValidator)

	// handle ok state, always call last
	updateStateOk(dashboardStatus, overviewData.validators.online, validatorCount, foreignValidator)

	if (dashboardStatus.state == StateType.mixed) {
		// remove extended description if more than one state is shown
		dashboardStatus.extendedDescription = ''
		dashboardStatus.extendedDescriptionPre = ''
	}

	return dashboardStatus
}

function descriptionSwitch(myText: string, foreignText: string, foreignValidator: boolean) {
	return foreignValidator ? foreignText : myText
}

function singularPluralSwitch(totalValidatorCount: number, validatorCount: number, verbSingular: string, verbPlural: string): string {
	if (totalValidatorCount != validatorCount && validatorCount == 1) {
		return ` ${verbSingular}`
	} else {
		return ` ${verbPlural}`
	}
}

function updateStateSlashed(dashboardStatus: DashboardStatus, slashedCount: number, validatorCount: number, foreignValidator: boolean) {
	if (slashedCount == 0) {
		return
	}

	if (dashboardStatus.state == StateType.none) {
		dashboardStatus.icon = 'alert-circle-outline'
		dashboardStatus.iconCss = 'err'
		dashboardStatus.state = StateType.slashed
	} else {
		dashboardStatus.state = StateType.mixed
	}

	const pre = validatorCount == slashedCount ? 'All' : `${slashedCount}`
	const helpingVerb = singularPluralSwitch(validatorCount, slashedCount, 'was', 'were')
	dashboardStatus.description.push({
		text: descriptionSwitch(pre + ' of your validators' + helpingVerb + ' slashed', 'This validator was slashed', foreignValidator),
		highlight: true,
	})
}

function updateStateAwaiting(dashboardStatus: DashboardStatus, awaitingCount: number, validatorCount: number, foreignValidator: boolean) {
	if (awaitingCount == 0) {
		return
	}

	if (dashboardStatus.state == StateType.none) {
		dashboardStatus.icon = 'timer-outline'
		dashboardStatus.iconCss = 'waiting'
		dashboardStatus.state = StateType.activation
	}

	const pre = validatorCount == awaitingCount ? 'All' : `${awaitingCount}`
	const helpingVerb = singularPluralSwitch(validatorCount, awaitingCount, 'is', 'are')
	dashboardStatus.description.push({
		text: descriptionSwitch(
			pre + ' of your validators' + helpingVerb + ' waiting for activation',
			'This validator is waiting for activation',
			foreignValidator
		),
		highlight: true,
	})
}

function updateExitedState(dashboardStatus: DashboardStatus, exitedCount: number, validatorCount: number, foreignValidator: boolean) {
	if (exitedCount == 0) {
		return
	}

	const allValidatorsExited = validatorCount == exitedCount
	if (dashboardStatus.state == StateType.none && allValidatorsExited) {
		dashboardStatus.icon = descriptionSwitch('ribbon-outline', 'home-outline', foreignValidator)
		dashboardStatus.iconCss = 'ok'
		dashboardStatus.state = StateType.exited
		dashboardStatus.extendedDescription = descriptionSwitch('Thank you for your service', null, foreignValidator)
	} else {
		dashboardStatus.state = StateType.mixed
	}

	const pre = allValidatorsExited ? 'All' : `${exitedCount}`
	const helpingVerb = singularPluralSwitch(validatorCount, exitedCount, 'has', 'have')
	// exit message is only highlighted if it is about foreign validators or if all validators are exited
	const highlight = foreignValidator || allValidatorsExited
	dashboardStatus.description.push({
		text: descriptionSwitch(pre + ' of your validators' + helpingVerb + ' exited', 'This validator has exited', foreignValidator),
		highlight: highlight,
	})
}

function updateStateOffline(dashboardStatus: DashboardStatus, validatorCount: number, offlineCount: number, foreignValidator: boolean) {
	if (offlineCount == 0) {
		return
	}

	if (dashboardStatus.state == StateType.none) {
		dashboardStatus.icon = 'alert-circle-outline'
		dashboardStatus.iconCss = 'warn'
		dashboardStatus.state = StateType.offline
	} else {
		dashboardStatus.state = StateType.mixed
	}

	const pre = validatorCount == offlineCount ? 'All' : `${offlineCount}`
	const helpingVerb = singularPluralSwitch(validatorCount, offlineCount, 'is', 'are')
	dashboardStatus.description.push({
		text: descriptionSwitch(pre + ' of your validators' + helpingVerb + ' offline', 'This validator is offline', foreignValidator),
		highlight: true,
	})
}

function updateStateOk(dashboardStatus: DashboardStatus, activeCount: number, validatorCount: number, foreignValidator: boolean) {
	if (dashboardStatus.state != StateType.mixed && dashboardStatus.state != StateType.none) {
		return
	}

	if (dashboardStatus.state == StateType.none) {
		const pre = validatorCount == activeCount ? 'All' : `${activeCount}`
		const helpingVerb = singularPluralSwitch(validatorCount, activeCount, 'is', 'are')
		dashboardStatus.description.push({
			text: descriptionSwitch(pre + ' of your validators ' + helpingVerb + ' active', 'This validator is active', foreignValidator),
			highlight: true,
		})

		dashboardStatus.state = StateType.online
	}
}

function emptyPerformance(): Performance {
	return {
		performance1d: new BigNumber(0),
		performance30d: new BigNumber(0),
		performance7d: new BigNumber(0),
		total: new BigNumber(0),
		apr7d: 0,
		apr30d: 0,
		aprTotal: 0,
	}
}

function getExecutionPerformance(overviewData: VDBOverviewData): Performance {
	if (!overviewData) return emptyPerformance()
	return {
		performance1d: new BigNumber(overviewData.rewards.last_24h.el),
		performance30d: new BigNumber(overviewData.rewards.last_30d.el),
		performance7d: new BigNumber(overviewData.rewards.last_7d.el),
		total: new BigNumber(overviewData.rewards.all_time.el),
		apr30d: overviewData.apr.last_30d.el,
		apr7d: overviewData.apr.last_7d.el,
		aprTotal: overviewData.apr.all_time.el,
	}
}

function getConsensusPerformance(overviewData: VDBOverviewData): Performance {
	if (!overviewData) return emptyPerformance()
	return {
		performance1d: new BigNumber(overviewData.rewards.last_24h.cl),
		performance30d: new BigNumber(overviewData.rewards.last_30d.cl),
		performance7d: new BigNumber(overviewData.rewards.last_7d.cl),
		total: new BigNumber(overviewData.rewards.all_time.cl),
		apr30d: overviewData.apr.last_30d.cl,
		apr7d: overviewData.apr.last_7d.cl,
		aprTotal: overviewData.apr.all_time.cl,
	}
}

function getCombinedPerformance(cons: Performance, exec: Performance): Performance {
	return {
		performance1d: cons.performance1d.plus(exec.performance1d),
		performance30d: cons.performance30d.plus(exec.performance30d),
		performance7d: cons.performance7d.plus(exec.performance7d),
		total: cons.total.plus(exec.total),
		apr30d: cons.apr30d + exec.apr30d,
		apr7d: cons.apr7d + exec.apr7d,
		aprTotal: cons.aprTotal + exec.aprTotal,
	}
}

interface RocketpoolCheatingStatus {
	strikes: number
	penalties: number
}
