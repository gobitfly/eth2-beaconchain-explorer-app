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

import { EpochResponse, SyncCommitteeResponse, ValidatorResponse } from '../requests/requests'
import { sumBigInt, findHighest, findLowest } from '../utils/MathUtils'
import BigNumber from 'bignumber.js'
import { getValidatorQueryString, ValidatorState, Validator } from '../utils/ValidatorUtils'
import { formatDate } from '@angular/common'
import { SyncCommitteesStatistics, SyncCommitteesStatisticsResponse } from '../requests/requests'

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
	displayAttrEffectiveness: boolean
	attrEffectiveness: number

	dashboardState: DashboardStatus
	lazyLoadChart: boolean
	lazyChartValidators: string
	foreignValidator: boolean
	foreignValidatorItem?: Validator
	foreignValidatorWithdrawalCredsAre0x01: boolean
	apr: number
	effectiveBalance: BigNumber
	currentEpoch: EpochResponse
	rocketpool: Rocketpool
	currentSyncCommittee: SyncCommitteeResponse
	nextSyncCommittee: SyncCommitteeResponse
	syncCommitteesStats: SyncCommitteesStatistics
	withdrawalsEnabledForAll: boolean
}

export type Performance = {
	performance1d: BigNumber
	performance31d: BigNumber
	performance7d: BigNumber
	performance365d: BigNumber
	total: BigNumber
	apr: number
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

export default class OverviewController {
	constructor(private refreshCallback: () => void = null, private userMaxValidators = 280) {}

	public processDashboard(validators: Validator[], currentEpoch: EpochResponse, syncCommitteesStatsResponse = null) {
		return this.process(validators, currentEpoch, false, syncCommitteesStatsResponse)
	}

	public processDetail(validators: Validator[], currentEpoch: EpochResponse) {
		return this.process(validators, currentEpoch, true, null)
	}

	private process(validators: Validator[], currentEpoch: EpochResponse, foreignValidator = false, syncCommitteesStatsResponse = null): OverviewData {
		if (!validators || validators.length <= 0 || currentEpoch == null) return null

		const effectiveBalance = sumBigInt(validators, (cur) => cur.data.effectivebalance)
		const validatorDepositActive = sumBigInt(validators, (cur) => {
			if (cur.data.activationepoch <= currentEpoch.epoch) {
				if (!cur.rocketpool || !cur.rocketpool.node_address) return VALIDATOR_32ETH

				let nodeDeposit
				if (cur.rocketpool.node_deposit_balance) {
					nodeDeposit = new BigNumber(cur.rocketpool.node_deposit_balance.toString()).dividedBy(new BigNumber(1e9))
				} else {
					nodeDeposit = VALIDATOR_32ETH.dividedBy(new BigNumber(2))
				}
				return nodeDeposit
			} else {
				return new BigNumber(0)
			}
		})

		const aprPerformance31dExecution = sumBigInt(validators, (cur) =>
			this.sumExcludeSmoothingPool(cur, (cur) => cur.execution.performance31d.toString())
		)

		const overallBalance = this.sumBigIntBalanceRP(validators, (cur) => new BigNumber(cur.data.balance))
		const validatorCount = validators.length
		const activeValidators = this.getActiveValidators(validators)

		const consensusPerf = this.getConsensusPerformance(validators, validatorDepositActive)

		const executionPerf = this.getExecutionPerformance(validators, validatorDepositActive, aprPerformance31dExecution)

		const combinedPerf = {
			performance1d: consensusPerf.performance1d.plus(executionPerf.performance1d),
			performance31d: consensusPerf.performance31d.plus(executionPerf.performance31d),
			performance7d: consensusPerf.performance7d.plus(executionPerf.performance7d),
			performance365d: consensusPerf.performance365d.plus(executionPerf.performance365d),
			apr: this.getAPRFromMonth(validatorDepositActive, aprPerformance31dExecution.plus(consensusPerf.performance31d)),
			total: consensusPerf.total.plus(executionPerf.total),
		}

		let attrEffectiveness = 0
		let displayAttrEffectiveness = false
		if (activeValidators.length > 0) {
			displayAttrEffectiveness = true

			attrEffectiveness = sumBigInt(activeValidators, (cur) =>
				cur.attrEffectiveness ? new BigNumber(cur.attrEffectiveness.toString()) : new BigNumber(0)
			)
				.dividedBy(activeValidators.length)
				.decimalPlaces(1)
				.toNumber()

			const attrChecked = Math.min(Math.max(attrEffectiveness, 0), 100)
			if (attrEffectiveness != attrChecked) {
				console.warn(`Effectiveness out of range: ${attrEffectiveness} (displaying "NaN")`)
				attrEffectiveness = -1 // display "NaN" if something went wrong
			}
		}

		const bestRank = findLowest(validators, (cur) => cur.data.rank7d)
		const worstRank = findHighest(validators, (cur) => cur.data.rank7d)
		const rocketpoolValiCount = sumBigInt(validators, (cur) => (cur.rocketpool ? new BigNumber(1) : new BigNumber(0)))
		const feeSum = sumBigInt(validators, (cur) =>
			cur.rocketpool ? new BigNumber(cur.rocketpool.minipool_node_fee).multipliedBy('100') : new BigNumber('0')
		)
		let feeAvg = 0
		if (feeSum.decimalPlaces(3).toNumber() != 0) {
			feeAvg = feeSum.dividedBy(rocketpoolValiCount).decimalPlaces(1).toNumber()
		}

		const currentSync = validators.find((cur) => !!cur.currentSyncCommittee)
		const nextSync = validators.find((cur) => !!cur.nextSyncCommittee)

		let foreignWCAre0x01 = false
		if (foreignValidator) {
			foreignWCAre0x01 = validators[0].data.withdrawalcredentials.startsWith('0x01')
		}

		return {
			overallBalance: overallBalance,
			validatorCount: validatorCount,
			bestRank: bestRank,
			worstRank: worstRank,
			attrEffectiveness: attrEffectiveness,
			displayAttrEffectiveness: displayAttrEffectiveness,
			consensusPerformance: consensusPerf,
			executionPerformance: executionPerf,
			combinedPerformance: combinedPerf,
			dashboardState: this.getDashboardState(validators, currentEpoch, foreignValidator),
			lazyLoadChart: true,
			lazyChartValidators: getValidatorQueryString(validators, 2000, this.userMaxValidators - 1),
			foreignValidator: foreignValidator,
			foreignValidatorItem: foreignValidator ? validators[0] : null,
			foreignValidatorWithdrawalCredsAre0x01: foreignWCAre0x01,
			effectiveBalance: effectiveBalance,
			currentEpoch: currentEpoch,
			apr: consensusPerf.apr,
			currentSyncCommittee: currentSync ? currentSync.currentSyncCommittee : null,
			nextSyncCommittee: nextSync ? nextSync.nextSyncCommittee : null,
			syncCommitteesStats: this.calculateSyncCommitteeStats(syncCommitteesStatsResponse),
			withdrawalsEnabledForAll:
				validators.filter((cur) => (cur.data.withdrawalcredentials.startsWith('0x01') ? true : false)).length == validatorCount,
			rocketpool: {
				minRpl: this.sumRocketpoolBigIntPerNodeAddress(
					true,
					validators,
					(cur) => cur.rocketpool.node_min_rpl_stake,
					(cur) => cur.rplshare
				),
				maxRpl: this.sumRocketpoolBigIntPerNodeAddress(
					true,
					validators,
					(cur) => cur.rocketpool.node_max_rpl_stake,
					(cur) => cur.rplshare
				),
				currentRpl: this.sumRocketpoolBigIntPerNodeAddress(
					true,
					validators,
					(cur) => cur.rocketpool.node_rpl_stake,
					(cur) => cur.rplshare
				),
				totalClaims: this.sumRocketpoolBigIntPerNodeAddress(
					true,
					validators,
					(cur) => cur.rocketpool.rpl_cumulative_rewards,
					(cur) => cur.rplshare
				),
				fee: feeAvg,
				status: foreignValidator && validators[0].rocketpool ? validators[0].rocketpool.minipool_status : null,
				depositType: foreignValidator && validators[0].rocketpool ? validators[0].rocketpool.minipool_deposit_type : null,
				smoothingPoolClaimed: this.sumRocketpoolSmoothingBigIntPerNodeAddress(
					true,
					validators,
					(cur) => cur.rocketpool.claimed_smoothing_pool,
					(cur) => cur.execshare
				),
				smoothingPoolUnclaimed: this.sumRocketpoolSmoothingBigIntPerNodeAddress(
					true,
					validators,
					(cur) => cur.rocketpool.unclaimed_smoothing_pool,
					(cur) => cur.execshare
				),
				rplUnclaimed: this.sumRocketpoolBigIntPerNodeAddress(
					true,
					validators,
					(cur) => cur.rocketpool.unclaimed_rpl_rewards,
					(cur) => cur.rplshare
				),
				smoothingPool: validators.find((cur) => (cur.rocketpool ? cur.rocketpool.smoothing_pool_opted_in == true : false)) != null ? true : false,
				hasNonSmoothingPoolAsWell:
					validators.find((cur) => (cur.rocketpool ? cur.rocketpool.smoothing_pool_opted_in == false : true)) != null ? true : false,
				cheatingStatus: this.getRocketpoolCheatingStatus(validators),
				depositCredit: this.sumRocketpoolBigIntPerNodeAddress(
					false,
					validators,
					(cur) => (cur.rocketpool.node_deposit_credit ? cur.rocketpool.node_deposit_credit.toString() : '0'),
					() => 1
				),
				vacantPools: validators.filter((cur) => cur.rocketpool && cur.rocketpool.is_vacant).length,
			},
		} as OverviewData
	}

	private getExecutionPerformance(validators: Validator[], validatorDepositActive: BigNumber, aprPerformance31dExecution: BigNumber) {
		const performance1d = this.sumBigIntPerformanceRP(validators, (cur) =>
			this.sumExcludeSmoothingPool(cur, (cur) => cur.execution.performance1d.toString()).multipliedBy(
				new BigNumber(cur.execshare == null ? 1 : cur.execshare)
			)
		)
		const performance31d = this.sumBigIntPerformanceRP(validators, (cur) =>
			this.sumExcludeSmoothingPool(cur, (cur) => cur.execution.performance31d.toString()).multipliedBy(
				new BigNumber(cur.execshare == null ? 1 : cur.execshare)
			)
		)
		const performance7d = this.sumBigIntPerformanceRP(validators, (cur) =>
			this.sumExcludeSmoothingPool(cur, (cur) => cur.execution.performance7d.toString()).multipliedBy(
				new BigNumber(cur.execshare == null ? 1 : cur.execshare)
			)
		)

		const aprExecution = this.getAPRFromMonth(validatorDepositActive, aprPerformance31dExecution) // todo
		return {
			performance1d: performance1d,
			performance31d: performance31d,
			performance7d: performance7d,
			performance365d: new BigNumber(0), // not yet implemented
			apr: aprExecution,
			total: new BigNumber(0), // not yet implemented
		}
	}

	private sumExcludeSmoothingPool(cur: Validator, field: (cur: Validator) => string) {
		// Exclude rocketpool minipool from execution rewards collection
		if (!cur.rocketpool || !cur.rocketpool.smoothing_pool_opted_in) {
			return cur.execution ? new BigNumber(field(cur)).dividedBy(new BigNumber('1e9')) : new BigNumber(0)
		}
		return new BigNumber(0)
	}

	private getConsensusPerformance(validators: Validator[], validatorDepositActive: BigNumber) {
		const performance1d = this.sumBigIntPerformanceRP(validators, (cur) =>
			new BigNumber(cur.data.performance1d).multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
		)
		const performance31d = this.sumBigIntPerformanceRP(validators, (cur) =>
			new BigNumber(cur.data.performance31d).multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
		)
		const performance7d = this.sumBigIntPerformanceRP(validators, (cur) =>
			new BigNumber(cur.data.performance7d).multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
		)
		const performance365d = this.sumBigIntPerformanceRP(validators, (cur) =>
			new BigNumber(cur.data.performance365d).multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
		)
		const total = this.sumBigIntPerformanceRP(validators, (cur) => {
			if (cur.data.performancetotal !== undefined) {
				return new BigNumber(cur.data.performancetotal).multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
			} else {
				return new BigNumber(0)
			}
		})

		const aprConsensus = this.getAPRFromMonth(validatorDepositActive, performance31d)

		return {
			performance1d: performance1d,
			performance31d: performance31d,
			performance7d: performance7d,
			performance365d: performance365d,
			apr: aprConsensus,
			total: total,
		}
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

	private getAPRFromMonth(validatorDepositActive: BigNumber, performance: BigNumber): number {
		return new BigNumber(performance.toString()).multipliedBy('1177').dividedBy(validatorDepositActive).decimalPlaces(1).toNumber()
	}

	private getDashboardState(validators: Validator[], currentEpoch: EpochResponse, foreignValidator): DashboardStatus {
		// collect data
		const validatorCount = validators.length
		const activeValidators = this.getActiveValidators(validators)
		const activeValidatorCount = activeValidators.length
		const slashedValidators = this.getSlashedValidators(validators)
		const slashedCount = slashedValidators.length
		const exitedValidators = this.getExitedValidators(validators)
		const exitedValidatorsCount = exitedValidators.length
		const awaitingActivation = this.getWaitingForActivationValidators(validators)
		const awaitingCount = awaitingActivation.length
		const activationEligibility = this.getEligableValidators(validators)
		const eligibilityCount = activationEligibility.length

		// create status object with some default values
		const dashboardStatus: DashboardStatus = {
			state: StateType.none,
			title: `${activeValidatorCount} / ${validatorCount}`,
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
		this.updateStateSlashed(dashboardStatus, slashedCount, validatorCount, foreignValidator, slashedValidators[0]?.data, currentEpoch)

		// handle offline validators
		const offlineCount = validatorCount - activeValidatorCount - exitedValidatorsCount - slashedCount - awaitingCount - eligibilityCount
		this.updateStateOffline(dashboardStatus, validatorCount, offlineCount, foreignValidator)

		// handle awaiting activation validators
		if (awaitingCount > 0) {
			this.updateStateAwaiting(dashboardStatus, awaitingCount, validatorCount, foreignValidator, awaitingActivation[0].data, currentEpoch)
		}

		// handle eligable validators
		if (eligibilityCount > 0) {
			this.updateStateEligibility(dashboardStatus, eligibilityCount, validatorCount, foreignValidator, activationEligibility[0].data, currentEpoch)
		}

		// handle exited validators
		this.updateExitedState(dashboardStatus, exitedValidatorsCount, validatorCount, foreignValidator)

		// handle ok state, always call last
		this.updateStateOk(dashboardStatus, activeValidatorCount, validatorCount, foreignValidator, activeValidators[0]?.data, currentEpoch)

		if (dashboardStatus.state == StateType.mixed) {
			// remove extended description if more than one state is shown
			dashboardStatus.extendedDescription = ''
			dashboardStatus.extendedDescriptionPre = ''
		}

		return dashboardStatus
	}

	private descriptionSwitch(myText, foreignText, foreignValidator) {
		return foreignValidator ? foreignText : myText
	}

	private getExitingDescription(validatorResp: ValidatorResponse, currentEpoch: EpochResponse): Description {
		if (!validatorResp.exitepoch) return { extendedDescriptionPre: null, extendedDescription: null }

		const exitDiff = validatorResp.exitepoch - currentEpoch.epoch
		const isExiting = exitDiff >= 0 && exitDiff < 6480 // ~ 1 month
		const exitingDate = isExiting ? this.getEpochDate(validatorResp.exitepoch, currentEpoch) : null

		return {
			extendedDescriptionPre: isExiting ? 'Exiting on ' : null,
			extendedDescription: exitingDate,
		}
	}

	private singularPluralSwitch(totalValidatorCount: number, validatorCount: number, verbSingular: string, verbPlural: string): string {
		if (totalValidatorCount != validatorCount && validatorCount == 1) {
			return ` ${verbSingular}`
		} else {
			return ` ${verbPlural}`
		}
	}

	private updateStateSlashed(
		dashboardStatus: DashboardStatus,
		slashedCount: number,
		validatorCount: number,
		foreignValidator: boolean,
		validatorResp: ValidatorResponse,
		currentEpoch: EpochResponse
	) {
		if (slashedCount == 0) {
			return
		}

		if (dashboardStatus.state == StateType.none) {
			dashboardStatus.icon = 'alert-circle-outline'
			dashboardStatus.iconCss = 'err'
			const exitingDescription = this.getExitingDescription(validatorResp, currentEpoch)
			dashboardStatus.extendedDescriptionPre = exitingDescription.extendedDescriptionPre
			dashboardStatus.extendedDescription = exitingDescription.extendedDescription
			dashboardStatus.state = StateType.slashed
		} else {
			dashboardStatus.state = StateType.mixed
		}

		const pre = validatorCount == slashedCount ? 'All' : `${slashedCount}`
		const helpingVerb = this.singularPluralSwitch(validatorCount, slashedCount, 'was', 'were')
		dashboardStatus.description.push({
			text: this.descriptionSwitch(pre + ' of your validators' + helpingVerb + ' slashed', 'This validator was slashed', foreignValidator),
			highlight: true,
		})
	}

	private updateStateAwaiting(
		dashboardStatus: DashboardStatus,
		awaitingCount: number,
		validatorCount: number,
		foreignValidator: boolean,
		awaitingActivation: ValidatorResponse,
		currentEpoch: EpochResponse
	) {
		if (awaitingCount == 0) {
			return
		}

		if (dashboardStatus.state == StateType.none) {
			const estEta = this.getEpochDate(awaitingActivation.activationeligibilityepoch, currentEpoch)

			dashboardStatus.icon = 'timer-outline'
			dashboardStatus.iconCss = 'waiting'
			dashboardStatus.state = StateType.activation
			dashboardStatus.extendedDescriptionPre = estEta ? 'Estimated on ' : null
			dashboardStatus.extendedDescription = estEta ? estEta : null
		}

		const pre = validatorCount == awaitingCount ? 'All' : `${awaitingCount}`
		const helpingVerb = this.singularPluralSwitch(validatorCount, awaitingCount, 'is', 'are')
		dashboardStatus.description.push({
			text: this.descriptionSwitch(
				pre + ' of your validators' + helpingVerb + ' waiting for activation',
				'This validator is waiting for activation',
				foreignValidator
			),
			highlight: true,
		})
	}

	private updateStateEligibility(
		dashboardStatus: DashboardStatus,
		eligibilityCount: number,
		validatorCount: number,
		foreignValidator: boolean,
		eligbleState: ValidatorResponse,
		currentEpoch: EpochResponse
	) {
		if (eligibilityCount == 0) {
			return
		}

		const estEta = this.getEpochDate(eligbleState.activationeligibilityepoch, currentEpoch)

		if (dashboardStatus.state == StateType.none) {
			dashboardStatus.icon = 'timer-outline'
			dashboardStatus.iconCss = 'waiting'
			dashboardStatus.state = StateType.eligibility
			dashboardStatus.extendedDescriptionPre = estEta ? 'Estimated on ' : null
			dashboardStatus.extendedDescription = estEta ? estEta : null
		}

		const pre = validatorCount == eligibilityCount ? 'All' : `${eligibilityCount}`
		const helpingVerb = this.singularPluralSwitch(validatorCount, eligibilityCount, 'is', 'are')
		dashboardStatus.description.push({
			text: this.descriptionSwitch(
				pre + " of your validators' deposits" + helpingVerb + ' being processed',
				"This validator's deposit is being processed",
				foreignValidator
			),
			highlight: true,
		})
	}

	private updateExitedState(dashboardStatus: DashboardStatus, exitedCount: number, validatorCount: number, foreignValidator: boolean) {
		if (exitedCount == 0) {
			return
		}

		const allValidatorsExited = validatorCount == exitedCount
		if (dashboardStatus.state == StateType.none && allValidatorsExited) {
			dashboardStatus.icon = this.descriptionSwitch('ribbon-outline', 'home-outline', foreignValidator)
			dashboardStatus.iconCss = 'ok'
			dashboardStatus.state = StateType.exited
			dashboardStatus.extendedDescription = this.descriptionSwitch('Thank you for your service', null, foreignValidator)
		} else {
			dashboardStatus.state = StateType.mixed
		}

		const pre = allValidatorsExited ? 'All' : `${exitedCount}`
		const helpingVerb = this.singularPluralSwitch(validatorCount, exitedCount, 'has', 'have')
		// exit message is only highlighted if it is about foreign validators or if all validators are exited
		const highlight = foreignValidator || allValidatorsExited
		dashboardStatus.description.push({
			text: this.descriptionSwitch(pre + ' of your validators' + helpingVerb + ' exited', 'This validator has exited', foreignValidator),
			highlight: highlight,
		})
	}

	private updateStateOffline(dashboardStatus: DashboardStatus, validatorCount: number, offlineCount: number, foreignValidator: boolean) {
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
		const helpingVerb = this.singularPluralSwitch(validatorCount, offlineCount, 'is', 'are')
		dashboardStatus.description.push({
			text: this.descriptionSwitch(pre + ' of your validators' + helpingVerb + ' offline', 'This validator is offline', foreignValidator),
			highlight: true,
		})
	}

	private updateStateOk(
		dashboardStatus: DashboardStatus,
		activeCount: number,
		validatorCount: number,
		foreignValidator: boolean,
		validatorResp: ValidatorResponse,
		currentEpoch: EpochResponse
	) {
		if (dashboardStatus.state != StateType.mixed && dashboardStatus.state != StateType.none) {
			return
		}

		if (dashboardStatus.state == StateType.none) {
			const pre = validatorCount == activeCount ? 'All' : `${activeCount}`
			const helpingVerb = this.singularPluralSwitch(validatorCount, activeCount, 'is', 'are')
			dashboardStatus.description.push({
				text: this.descriptionSwitch(pre + ' of your validators ' + helpingVerb + ' active', 'This validator is active', foreignValidator),
				highlight: true,
			})

			const exitingDescription = this.getExitingDescription(validatorResp, currentEpoch)
			dashboardStatus.extendedDescriptionPre = exitingDescription.extendedDescriptionPre
			dashboardStatus.extendedDescription = exitingDescription.extendedDescription
			dashboardStatus.state = StateType.online
		}
	}

	private getEpochDate(activationEpoch: number, currentEpoch: EpochResponse) {
		try {
			const diff = activationEpoch - currentEpoch.epoch
			if (diff <= 0) {
				if (this.refreshCallback) this.refreshCallback()
				return null
			}

			const date = new Date(currentEpoch.lastCachedTimestamp)

			const inEpochOffset = (32 - currentEpoch.scheduledblocks) * 12 // block time 12s

			date.setSeconds(diff * 6.4 * 60 - inEpochOffset)

			const timeString = formatDate(date, 'medium', 'en-US')
			return timeString
		} catch (e) {
			console.warn('could not get activation time', e)
			return null
		}
	}

	private getActiveValidators(validators: Validator[]) {
		return validators.filter((item) => {
			return item.state == ValidatorState.ACTIVE
		})
	}

	private getSlashedValidators(validators: Validator[]) {
		return validators.filter((item) => {
			return item.state == ValidatorState.SLASHED
		})
	}

	private getExitedValidators(validators: Validator[]) {
		return validators.filter((item) => {
			return item.state == ValidatorState.EXITED
		})
	}

	private getWaitingForActivationValidators(validators: Validator[]) {
		return validators.filter((item) => {
			return item.state == ValidatorState.WAITING
		})
	}

	private getEligableValidators(validators: Validator[]) {
		return validators.filter((item) => {
			return item.state == ValidatorState.ELIGABLE
		})
	}

	private calculateSyncCommitteeStats(stats: SyncCommitteesStatisticsResponse): SyncCommitteesStatistics {
		if (stats) {
			// if no slots where expected yet, don't show any statistic as either no validator is subscribed or they have not been active in the selected timeframe
			if (stats.expectedSlots > 0) {
				const slotsTotal = stats.participatedSlots + stats.missedSlots
				const slotsPerSyncPeriod = 32 * 256
				const r: SyncCommitteesStatistics = {
					committeesParticipated: Math.ceil(slotsTotal / 32 / 256),
					committeesExpected: Math.round((stats.expectedSlots * 100) / 32 / 256) / 100,
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

interface RocketpoolCheatingStatus {
	strikes: number
	penalties: number
}
