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

import { APIRequest, ProposalLuckResponse, SyncCommitteeResponse } from '../requests/requests'
import { sumBigInt } from '../utils/MathUtils'
import BigNumber from 'bignumber.js'
import { Validator } from '../utils/ValidatorUtils'
import { SyncCommitteesStatistics, SyncCommitteesStatisticsResponse } from '../requests/requests'
import { UnitconvService } from '../services/unitconv.service'
import { ApiNetwork } from '../models/StorageTypes'
import { Aggregation, dashboardID, EfficiencyType, Period, V2DashboardOverview, V2DashboardRocketPool, V2DashboardSummaryChart, V2DashboardSummaryGroupTable, V2DashboardSummaryTable } from '../requests/v2-dashboard'
import { ApiService, LatestStateWithTime } from '../services/api.service'
import { VDBGroupSummaryData, VDBOverviewData, VDBRocketPoolTableRow, VDBSummaryTableRow } from '../requests/types/validator_dashboard'
import { computed, signal, Signal, WritableSignal } from '@angular/core'
import { ChartData } from '../requests/types/common'

export class OverviewData2 {
	id: dashboardID

	overviewData: WritableSignal<VDBOverviewData> = signal(null)
	summary: WritableSignal<VDBSummaryTableRow[]> = signal(null)
	summaryGroup: WritableSignal<VDBGroupSummaryData> = signal(null)
	latestState: WritableSignal<LatestStateWithTime> = signal(null)
	rocketpool: WritableSignal<VDBRocketPoolTableRow> = signal(null)
	summaryChart: WritableSignal<ChartData<number, number>> = signal(null)

	network: ApiNetwork
	foreignValidator: boolean

	constructor(network: ApiNetwork, foreignValidator: boolean) {
		this.network = network
		this.foreignValidator = foreignValidator
	}

	validatorCount: Signal<number> = computed(() => {
		if (!this.overviewData()) return 0
		return (
			this.overviewData().validators.exited +
			this.overviewData().validators.offline +
			this.overviewData().validators.online +
			this.overviewData().validators.slashed +
			this.overviewData().validators.pending
		)
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
		return this.summaryGroup().sync.status_count.success / total
	})

	isReadyToDisplay: Signal<boolean> = computed(() => {
		// todo, we can prob show before waiting on all the data
		return this.overviewData() != null && this.summary() != null && this.summaryGroup() != null
	})

	rpTotalRPLClaimed: Signal<BigNumber> = computed(() => {
		if (this.rocketpool() == null) return new BigNumber(0)
		return new BigNumber(this.rocketpool().rpl.claimed).plus(new BigNumber(this.rocketpool().rpl.unclaimed))
	})

	avgNetworkEfficiency: Signal<number> = computed(() => {
		if (this.summary() == null) return 0
		return this.summary()[0].average_network_efficiency 
	})
}

export type OverviewData = {
	overallBalance: BigNumber
	validatorCount: number
	requiredValidatorsForOKState: number
	exitedValidatorsCount: number
	activeValidatorCount: number
	consensusPerformance: Performance
	executionPerformance: Performance
	combinedPerformance: Performance
	slashedCount: number
	awaitingActivationCount: number
	activationeligibilityCount: number
	bestRank: number
	worstRank: number
	bestTopPercentage: number
	worstTopPercentage: number
	displayAttrEffectiveness: boolean
	attrEffectiveness: number
	proposalLuckResponse: ProposalLuckResponse
	dashboardState: DashboardStatus
	lazyLoadChart: boolean
	lazyChartValidators: string
	foreignValidator: boolean
	foreignValidatorItem?: Validator
	foreignValidatorWithdrawalCredsAre0x01: boolean
	effectiveBalance: BigNumber
	latestState: LatestStateWithTime
	rocketpool: Rocketpool
	currentSyncCommittee: SyncCommitteeResponse
	nextSyncCommittee: SyncCommitteeResponse
	syncCommitteesStats: SyncCommitteesStatistics
	proposalLuck: ProposalLuckResponse
	withdrawalsEnabledForAll: boolean
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

const VALIDATOR_32ETH = new BigNumber(32000000000)

export function getValidatorData(api: ApiService, id: dashboardID): OverviewData2 {
	function set<T>(request: APIRequest<T>, s: WritableSignal<T>, errHandler: (err: string) => void = null) {
		api.execute2(request).then((data) => {
			if (data.error) {
				if (errHandler) errHandler(data.error)
				return
			}
			s.set(data.data[0])
		})
	}
	function setArray<T>(request: APIRequest<T>, s: WritableSignal<T[]>, errHandler: (err: string) => void = null) {
		api.execute2(request).then((data) => {
			if (data.error) {
				if (errHandler) errHandler(data.error)
				return
			}
			s.set(data.data)
		})
	}

	const temp = new OverviewData2(api.getNetwork(), false)

	set(new V2DashboardOverview(id), temp.overviewData)
	setArray(new V2DashboardSummaryTable(id, Period.AllTime, null), temp.summary)
	set(new V2DashboardSummaryGroupTable(id, 0, Period.AllTime, null), temp.summaryGroup)
	set(new V2DashboardRocketPool(id), temp.rocketpool)
	set(
		new V2DashboardSummaryChart(id, EfficiencyType.All, Aggregation.Hourly, Math.floor(Date.now() / 1000 - 1 * 24 * 60 * 60)).withCustomCacheKey("summary-chart-initial"),
		temp.summaryChart
	)

	api.getLatestState().then((latestState) => {
		temp.latestState.set(latestState)
	})

	temp.id = id

	return temp
}

export default class OverviewController {
	constructor(private refreshCallback: () => void = null, private userMaxValidators = 280, private unit: UnitconvService = null) {}

	// public processDashboard(
	// 	overviewData: VDBOverviewData,
	// 	summaryTableData: VDBSummaryTableRow[],
	// 	summaryGroupTableData: VDBGroupSummaryData,
	// 	latestState: LatestStateWithTime,
	// 	network: ApiNetwork
	// ) {
	// 	return this.process(
	// 		overviewData,
	// 		summaryTableData,
	// 		summaryGroupTableData,
	// 		latestState,
	// 		false,
	// 		network
	// 	)
	// }

	// public processDetail(
	// 	overviewData: VDBOverviewData,
	// 	summaryTableData: VDBSummaryTableRow[],
	// 	summaryGroupTableData: VDBGroupSummaryData,
	// 	latestState: LatestStateWithTime,
	// 	network: ApiNetwork
	// ) {
	// 	return this.process(overviewData, summaryTableData, summaryGroupTableData, latestState, true, network)
	// }

	// private process(
	// 	overviewData: VDBOverviewData,
	// 	summaryTableData: VDBSummaryTableRow[],
	// 	summaryGroupTableData: VDBGroupSummaryData,
	// 	latestState: LatestStateWithTime,
	// 	foreignValidator = false, // whether it's part of the users validator set or not, might affect how certain warnings and tooltips behave
	// 	network: ApiNetwork
	// ): OverviewData {
	// 	if (!validators || validators.length <= 0 || latestState.state == null) return null

	// 	const effectiveBalance = sumBigInt(validators, (cur) => cur.data.effectivebalance)
	// 	const validatorDepositActive = sumBigInt(validators, (cur) => {
	// 		// todo use validator status
	// 		if (cur.data.activationepoch <= slotToEpoch(latestState.state.current_slot)) {
	// 			if (!cur.rocketpool || !cur.rocketpool.node_address) return VALIDATOR_32ETH.multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))

	// 			let nodeDeposit
	// 			if (cur.rocketpool.node_deposit_balance) {
	// 				nodeDeposit = new BigNumber(cur.rocketpool.node_deposit_balance.toString()).dividedBy(new BigNumber(1e9))
	// 			} else {
	// 				nodeDeposit = VALIDATOR_32ETH.dividedBy(new BigNumber(2))
	// 			}
	// 			return nodeDeposit.multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
	// 		} else {
	// 			return new BigNumber(0)
	// 		}
	// 	})

	// 	const overallBalance = this.sumBigIntBalanceRP(validators, (cur) => new BigNumber(cur.data.balance))
	// 	const validatorCount = validators.length
	// 	const activeValidators = this.getActiveValidators(validators)
	// 	const offlineValidators = this.getOfflineValidators(validators)

	// 	const consensusPerf = this.getConsensusPerformance(validators, validatorDepositActive)

	// 	const executionPerf = this.getExecutionPerformance(validators, validatorDepositActive)

	// 	const smoothingPoolClaimed = this.sumRocketpoolSmoothingBigIntPerNodeAddress(
	// 		true,
	// 		validators,
	// 		(cur) => cur.rocketpool.claimed_smoothing_pool,
	// 		(cur) => cur.execshare
	// 	).dividedBy(new BigNumber('1e9'))

	// 	const smoothingPoolUnclaimed = this.sumRocketpoolSmoothingBigIntPerNodeAddress(
	// 		true,
	// 		validators,
	// 		(cur) => cur.rocketpool.unclaimed_smoothing_pool,
	// 		(cur) => cur.execshare
	// 	).dividedBy(new BigNumber('1e9'))

	// 	const combinedPerf = {
	// 		performance1d: consensusPerf.performance1d.plus(this.unit.convertELtoCL(executionPerf.performance1d)),
	// 		performance31d: consensusPerf.performance31d.plus(this.unit.convertELtoCL(executionPerf.performance31d)),
	// 		performance7d: consensusPerf.performance7d.plus(this.unit.convertELtoCL(executionPerf.performance7d)),
	// 		performance365d: consensusPerf.performance365d.plus(this.unit.convertELtoCL(executionPerf.performance365d)),
	// 		apr31d: this.getAPRFrom(31, validatorDepositActive, this.unit.convertELtoCL(executionPerf.performance31d).plus(consensusPerf.performance31d)),
	// 		apr7d: this.getAPRFrom(7, validatorDepositActive, this.unit.convertELtoCL(executionPerf.performance7d).plus(consensusPerf.performance7d)),
	// 		apr365d: this.getAPRFrom(
	// 			365,
	// 			validatorDepositActive,
	// 			this.unit.convertELtoCL(executionPerf.performance365d).plus(consensusPerf.performance365d)
	// 		),
	// 		total: consensusPerf.total.plus(this.unit.convertELtoCL(executionPerf.total)).plus(smoothingPoolClaimed).plus(smoothingPoolUnclaimed),
	// 	} as Performance

	// 	let attrEffectiveness = 0
	// 	let displayAttrEffectiveness = false
	// 	if (activeValidators.length > 0) {
	// 		displayAttrEffectiveness = true

	// 		attrEffectiveness = sumBigInt(activeValidators, (cur) =>
	// 			cur.attrEffectiveness ? new BigNumber(cur.attrEffectiveness.toString()) : new BigNumber(0)
	// 		)
	// 			.dividedBy(activeValidators.length)
	// 			.decimalPlaces(1)
	// 			.toNumber()

	// 		const attrChecked = Math.min(Math.max(attrEffectiveness, 0), 100)
	// 		if (attrEffectiveness != attrChecked) {
	// 			console.warn(`Effectiveness out of range: ${attrEffectiveness} (displaying "NaN")`)
	// 			attrEffectiveness = -1 // display "NaN" if something went wrong
	// 		}
	// 	}

	// 	let bestRank = 0
	// 	let bestTopPercentage = 0
	// 	let worstRank = 0
	// 	let worstTopPercentage = 0
	// 	const rankRelevantValidators = activeValidators.concat(offlineValidators)
	// 	if (rankRelevantValidators.length > 0) {
	// 		bestRank = findLowest(rankRelevantValidators, (cur) => cur.data.rank7d)
	// 		bestTopPercentage = findLowest(rankRelevantValidators, (cur) => cur.data.rankpercentage)
	// 		worstRank = findHighest(rankRelevantValidators, (cur) => cur.data.rank7d)
	// 		worstTopPercentage = findHighest(rankRelevantValidators, (cur) => cur.data.rankpercentage)
	// 	}

	// 	const rocketpoolValiCount = sumBigInt(validators, (cur) => (cur.rocketpool ? new BigNumber(1) : new BigNumber(0)))
	// 	const feeSum = sumBigInt(validators, (cur) =>
	// 		cur.rocketpool ? new BigNumber(cur.rocketpool.minipool_node_fee).multipliedBy('100') : new BigNumber('0')
	// 	)
	// 	let feeAvg = 0
	// 	if (feeSum.decimalPlaces(3).toNumber() != 0) {
	// 		feeAvg = feeSum.dividedBy(rocketpoolValiCount).decimalPlaces(1).toNumber()
	// 	}

	// 	const currentSync = validators.find((cur) => !!cur.currentSyncCommittee)
	// 	const nextSync = validators.find((cur) => !!cur.nextSyncCommittee)

	// 	let foreignWCAre0x01 = false
	// 	if (foreignValidator) {
	// 		foreignWCAre0x01 = validators[0].data.withdrawalcredentials.startsWith('0x01')
	// 	}

	// 	return {
	// 		overallBalance: overallBalance,
	// 		validatorCount: validatorCount,
	// 		bestRank: bestRank,
	// 		bestTopPercentage: bestTopPercentage,
	// 		worstRank: worstRank,
	// 		worstTopPercentage: worstTopPercentage,
	// 		attrEffectiveness: attrEffectiveness,
	// 		displayAttrEffectiveness: displayAttrEffectiveness,
	// 		consensusPerformance: consensusPerf,
	// 		executionPerformance: executionPerf,
	// 		combinedPerformance: combinedPerf,
	// 		dashboardState: this.getDashboardState(validators, latestState, foreignValidator, network),
	// 		lazyLoadChart: true,
	// 		lazyChartValidators: getValidatorQueryString(validators, 2000, this.userMaxValidators - 1),
	// 		foreignValidator: foreignValidator,
	// 		foreignValidatorItem: foreignValidator ? validators[0] : null,
	// 		foreignValidatorWithdrawalCredsAre0x01: foreignWCAre0x01,
	// 		effectiveBalance: effectiveBalance,
	// 		latestState: latestState,
	// 		currentSyncCommittee: currentSync ? currentSync.currentSyncCommittee : null,
	// 		nextSyncCommittee: nextSync ? nextSync.nextSyncCommittee : null,
	// 		syncCommitteesStats: this.calculateSyncCommitteeStats(syncCommitteesStatsResponse, network),
	// 		proposalLuckResponse: proposalLuckResponse,
	// 		withdrawalsEnabledForAll:
	// 			validators.filter((cur) => (cur.data.withdrawalcredentials.startsWith('0x01') ? true : false)).length == validatorCount,
	// 		rocketpool: {
	// 			minRpl: this.sumRocketpoolBigIntPerNodeAddress(
	// 				true,
	// 				validators,
	// 				(cur) => cur.rocketpool.node_min_rpl_stake,
	// 				(cur) => cur.rplshare
	// 			),
	// 			maxRpl: this.sumRocketpoolBigIntPerNodeAddress(
	// 				true,
	// 				validators,
	// 				(cur) => cur.rocketpool.node_max_rpl_stake,
	// 				(cur) => cur.rplshare
	// 			),
	// 			currentRpl: this.sumRocketpoolBigIntPerNodeAddress(
	// 				true,
	// 				validators,
	// 				(cur) => cur.rocketpool.node_rpl_stake,
	// 				(cur) => cur.rplshare
	// 			),
	// 			totalClaims: this.sumRocketpoolBigIntPerNodeAddress(
	// 				true,
	// 				validators,
	// 				(cur) => cur.rocketpool.rpl_cumulative_rewards,
	// 				(cur) => cur.rplshare
	// 			),
	// 			fee: feeAvg,
	// 			status: foreignValidator && validators[0].rocketpool ? validators[0].rocketpool.minipool_status : null,
	// 			depositType: foreignValidator && validators[0].rocketpool ? validators[0].rocketpool.minipool_deposit_type : null,
	// 			smoothingPoolClaimed: smoothingPoolClaimed,
	// 			smoothingPoolUnclaimed: smoothingPoolUnclaimed,
	// 			rplUnclaimed: this.sumRocketpoolBigIntPerNodeAddress(
	// 				true,
	// 				validators,
	// 				(cur) => cur.rocketpool.unclaimed_rpl_rewards,
	// 				(cur) => cur.rplshare
	// 			),
	// 			smoothingPool: validators.find((cur) => (cur.rocketpool ? cur.rocketpool.smoothing_pool_opted_in == true : false)) != null ? true : false,
	// 			hasNonSmoothingPoolAsWell:
	// 				validators.find((cur) => (cur.rocketpool ? cur.rocketpool.smoothing_pool_opted_in == false : true)) != null ? true : false,
	// 			cheatingStatus: this.getRocketpoolCheatingStatus(validators),
	// 			depositCredit: this.sumRocketpoolBigIntPerNodeAddress(
	// 				false,
	// 				validators,
	// 				(cur) => (cur.rocketpool.node_deposit_credit ? cur.rocketpool.node_deposit_credit.toString() : '0'),
	// 				() => 1
	// 			),
	// 			vacantPools: validators.filter((cur) => cur.rocketpool && cur.rocketpool.is_vacant).length,
	// 		},
	// 	} as OverviewData
	// }


	private sumExcludeSmoothingPool(cur: Validator, field: (cur: Validator) => string) {
		// Exclude rocketpool minipool from execution rewards collection
		if (!cur.rocketpool || !cur.rocketpool.smoothing_pool_opted_in) {
			return cur.execution ? new BigNumber(field(cur)).dividedBy(new BigNumber('1e9')) : new BigNumber(0)
		}
		return new BigNumber(0)
	}

	private getRocketpoolCheatingStatus(validators: Validator[]): RocketpoolCheatingStatus {
		let strikes = 0
		let penalties = 0

		validators.forEach((cur) => {
			if (cur.rocketpool && cur.rocketpool.node_address) {
				const penalty_count = cur.rocketpool.penalty_count
				if (penalty_count >= 3) {
					penalties += penalty_count
				} else {
					strikes += penalty_count
				}
			}
		})

		return {
			strikes: strikes,
			penalties: penalties,
		}
	}

	public sumBigIntBalanceRP(validators: Validator[], field: (cur: Validator) => BigNumber): BigNumber {
		return sumBigInt(validators, (cur) => {
			const fieldVal = field(cur)
			if (!cur.rocketpool) return fieldVal.multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
			if (!cur.rocketpool.node_address) {
				return fieldVal.multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
			}

			let nodeDeposit
			if (cur.rocketpool.node_deposit_balance) {
				nodeDeposit = new BigNumber(cur.rocketpool.node_deposit_balance.toString()).dividedBy(new BigNumber(1e9))
			} else {
				nodeDeposit = VALIDATOR_32ETH.dividedBy(new BigNumber(2))
			}

			const rewards = new BigNumber(fieldVal.toString()).minus(VALIDATOR_32ETH)

			const nodeShare = nodeDeposit.dividedBy(VALIDATOR_32ETH).toNumber()
			const rewardNode = new BigNumber(rewards).multipliedBy(new BigNumber(nodeShare))
			const rewardNodeFromPool = new BigNumber(rewards)
				.multipliedBy(new BigNumber(1 - nodeShare))
				.multipliedBy(new BigNumber(cur.rocketpool.minipool_node_fee.toString()))

			// if negative, rocketpool reimburses the rETH holder by taking it from the node operator
			let wholeBalance
			if (rewards.isNegative()) {
				wholeBalance = nodeDeposit.plus(rewards)
				// if less than what the user deposited upfront, he lost everything and we put the balance to 0
				// the validator can leak below that of course, but that's now at the expense of the rETH holders
				if (wholeBalance.isNegative()) {
					wholeBalance = new BigNumber(0)
				}
			} else {
				wholeBalance = nodeDeposit.plus(rewardNode).plus(rewardNodeFromPool)
			}

			return wholeBalance.multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
		})
	}

	private sumBigIntPerformanceRP(validators: Validator[], field: (cur: Validator) => BigNumber): BigNumber {
		return sumBigInt(validators, (cur) => {
			if (!cur.rocketpool) return field(cur)
			if (!cur.rocketpool.node_address) return field(cur)

			let fieldResolved = field(cur)
			if (fieldResolved.s == null && fieldResolved.e == null) {
				fieldResolved = new BigNumber(0)
			}

			let nodeDeposit
			if (cur.rocketpool.node_deposit_balance) {
				nodeDeposit = new BigNumber(cur.rocketpool.node_deposit_balance.toString()).dividedBy(new BigNumber(1e9))
			} else {
				nodeDeposit = VALIDATOR_32ETH.dividedBy(new BigNumber(2))
			}

			const rewards = new BigNumber(fieldResolved.toString())

			const nodeShare = nodeDeposit.dividedBy(VALIDATOR_32ETH).toNumber()

			const rewardNode = new BigNumber(rewards).multipliedBy(new BigNumber(nodeShare))
			const rewardNodeFromPool = new BigNumber(rewards)
				.multipliedBy(new BigNumber(1 - nodeShare))
				.multipliedBy(new BigNumber(cur.rocketpool.minipool_node_fee.toString()))

			// if negative, rocketpool reimburses the rETH holder by taking it from the node operator
			let resultReward
			if (rewards.isNegative()) {
				resultReward = rewards
				const negativeDepositBalance = nodeDeposit.multipliedBy(-1)
				if (resultReward.isLessThan(negativeDepositBalance)) {
					resultReward = negativeDepositBalance
				}
			} else {
				resultReward = rewardNode.plus(rewardNodeFromPool)
			}

			return resultReward
		})
	}

	private sumRocketpoolBigIntPerNodeAddress(
		applyShare: boolean,
		validators: Validator[],
		field: (cur: Validator) => string,
		share: (cur: Validator) => number
	): BigNumber {
		const nodesAdded = new Set()
		return sumBigInt(validators, (cur) => {
			if (!cur.rocketpool) return new BigNumber(0)
			if (!cur.rocketpool.node_address) return new BigNumber(0)
			if (nodesAdded.has(cur.rocketpool.node_address)) return new BigNumber(0)
			nodesAdded.add(cur.rocketpool.node_address)
			const temp = new BigNumber(field(cur).toString())
			if (applyShare) {
				return temp.multipliedBy(share(cur) == null ? 1 : share(cur))
			}
			return temp
		})
	}

	private sumRocketpoolSmoothingBigIntPerNodeAddress(
		applyShare: boolean,
		validators: Validator[],
		field: (cur: Validator) => string,
		share: (cur: Validator) => number
	): BigNumber {
		const totalMinipoolFeeForNodeCache = new Map<string, number>()

		return sumBigInt(validators, (cur) => {
			if (!cur.rocketpool) return new BigNumber(0)
			if (!cur.rocketpool.node_address) return new BigNumber(0)

			if (!totalMinipoolFeeForNodeCache.has(cur.rocketpool.node_address)) {
				const totalMinipoolFeeForNode = validators
					.filter((item) => {
						if (!item.rocketpool) return false
						if (!item.rocketpool.node_address) return false
						return item.rocketpool.node_address == cur.rocketpool.node_address
					})
					.reduce((accumulator, currentValue) => accumulator + parseFloat(currentValue.rocketpool.minipool_node_fee.toString()), 0)
				totalMinipoolFeeForNodeCache.set(cur.rocketpool.node_address, totalMinipoolFeeForNode)
			}

			const nodeFeeShare =
				parseFloat(cur.rocketpool.minipool_node_fee.toString()) / (totalMinipoolFeeForNodeCache.get(cur.rocketpool.node_address) || 1)
			let temp = new BigNumber(field(cur).toString())
			temp = temp.multipliedBy(nodeFeeShare)
			if (applyShare) {
				return temp.multipliedBy(share(cur) == null ? 1 : share(cur))
			}
			return temp
		})
	}

	private getAPRFrom(days: number, validatorDepositActive: BigNumber, performance: BigNumber): number {
		return new BigNumber(performance.toString())
			.multipliedBy(36500 / days)
			.dividedBy(validatorDepositActive)
			.decimalPlaces(1)
			.toNumber()
	}


	private calculateSyncCommitteeStats(stats: SyncCommitteesStatisticsResponse, network: ApiNetwork): SyncCommitteesStatistics {
		if (stats) {
			// if no slots where expected yet, don't show any statistic as either no validator is subscribed or they have not been active in the selected timeframe
			if (stats.expectedSlots > 0) {
				const slotsTotal = stats.participatedSlots + stats.missedSlots
				const slotsPerSyncPeriod = network.slotPerEpoch * network.epochsPerSyncPeriod
				const r: SyncCommitteesStatistics = {
					committeesParticipated: Math.ceil(slotsTotal / network.slotPerEpoch / network.epochsPerSyncPeriod),
					committeesExpected: Math.round((stats.expectedSlots * 100) / network.slotPerEpoch / network.epochsPerSyncPeriod) / 100,
					slotsPerSyncCommittee: slotsPerSyncPeriod,
					slotsLeftInSyncCommittee: slotsPerSyncPeriod - stats.scheduledSlots,
					slotsParticipated: stats.participatedSlots,
					slotsMissed: stats.missedSlots,
					slotsScheduled: stats.scheduledSlots,
					efficiency: 0,
					luck: (slotsTotal * 100) / stats.expectedSlots,
				}
				if (slotsTotal > 0) {
					r.efficiency = Math.round(((stats.participatedSlots * 100) / slotsTotal) * 100) / 100
				}

				return r
			}
		}
		return null
	}
}

	function getDashboardState(overviewData: VDBOverviewData, validatorCount: number, foreignValidator): DashboardStatus {
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
		updateStateSlashed(
			dashboardStatus,
			overviewData.validators.slashed,
			validatorCount,
			foreignValidator
		)

		// handle offline validators
		updateStateOffline(dashboardStatus, validatorCount, overviewData.validators.offline, foreignValidator)

		// handle awaiting activation validators
		if (overviewData.validators.pending > 0) {
			updateStateAwaiting(
				dashboardStatus,
				overviewData.validators.pending,
				validatorCount,
				foreignValidator
			)
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

	function descriptionSwitch(myText, foreignText, foreignValidator) {
		return foreignValidator ? foreignText : myText
	}

	function singularPluralSwitch(totalValidatorCount: number, validatorCount: number, verbSingular: string, verbPlural: string): string {
		if (totalValidatorCount != validatorCount && validatorCount == 1) {
			return ` ${verbSingular}`
		} else {
			return ` ${verbPlural}`
		}
	}

	function updateStateSlashed(
		dashboardStatus: DashboardStatus,
		slashedCount: number,
		validatorCount: number,
		foreignValidator: boolean,
	) {
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

	function updateStateAwaiting(
		dashboardStatus: DashboardStatus,
		awaitingCount: number,
		validatorCount: number,
		foreignValidator: boolean
	) {
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

	function updateStateOk(
		dashboardStatus: DashboardStatus,
		activeCount: number,
		validatorCount: number,
		foreignValidator: boolean
	) {
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

	function getExecutionPerformance(
		overviewData: VDBOverviewData,
	): Performance {
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
