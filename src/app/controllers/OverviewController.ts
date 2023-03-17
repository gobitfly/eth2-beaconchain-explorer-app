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
import { Validator } from '../utils/ValidatorUtils'
import { formatDate } from '@angular/common'
import { getValidatorQueryString, ValidatorState } from '../utils/ValidatorUtils'

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
}

export type DashboardStatus = {
	icon: string
	title: string
	description: string
	extendedDescription: string
	extendedDescriptionPre: string
	iconCss: string
}

export type Description = {
	extendedDescription: string
	extendedDescriptionPre: string
}

export default class OverviewController {
	constructor(private refreshCallback: () => void = null, private userMaxValidators = 280) {}

	public processDashboard(validators: Validator[], currentEpoch: EpochResponse) {
		return this.process(validators, currentEpoch, false)
	}

	public processDetail(validators: Validator[], currentEpoch: EpochResponse) {
		return this.process(validators, currentEpoch, true)
	}

	private process(validators: Validator[], currentEpoch: EpochResponse, foreignValidator = false): OverviewData {
		if (!validators || validators.length <= 0 || currentEpoch == null) return null

		const effectiveBalance = sumBigInt(validators, (cur) => cur.data.effectivebalance)
		const effectiveBalanceActive = sumBigInt(validators, (cur) => {
			return cur.data.activationepoch <= currentEpoch.epoch ? cur.data.effectivebalance : new BigNumber(0)
		})
		const investedBalance = this.sumBigIntBalanceRpl(validators, (cur) => {
			return new BigNumber(cur.data.effectivebalance.toString())
		})

		const aprPerformance31dConsensus = sumBigInt(validators, (cur) => cur.data.performance31d)
		const aprPerformance31dExecution = sumBigInt(validators, (cur) =>
			this.sumExcludeSmoothingPool(cur, (cur) => cur.execution.performance31d.toString())
		)

		const overallBalance = this.sumBigIntBalanceRpl(validators, (cur) => new BigNumber(cur.data.balance))
		const validatorCount = validators.length
		const activeValidators = this.getActiveValidators(validators)

		const consensusPerf = this.getConsensusPerformance(
			validators,
			effectiveBalanceActive,
			aprPerformance31dConsensus,
			overallBalance.minus(investedBalance)
		)

		const executionPerf = this.getExecutionPerformance(
			validators,
			effectiveBalance,
			aprPerformance31dExecution,
			new BigNumber(0) // not implemented yet
		)

		const combinedPerf = {
			performance1d: consensusPerf.performance1d.plus(executionPerf.performance1d),
			performance31d: consensusPerf.performance31d.plus(executionPerf.performance31d),
			performance7d: consensusPerf.performance7d.plus(executionPerf.performance7d),
			performance365d: consensusPerf.performance365d.plus(executionPerf.performance365d),
			apr: this.getAPRFromMonth(effectiveBalanceActive, aprPerformance31dExecution.plus(aprPerformance31dConsensus)),
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
			},
		} as OverviewData
	}

	private getExecutionPerformance(
		validators: Validator[],
		effectiveBalanceActive: BigNumber,
		aprPerformance31dExecution: BigNumber,
		total: BigNumber
	) {
		const performance1d = this.sumBigIntPerformanceRpl(validators, (cur) =>
			this.sumExcludeSmoothingPool(cur, (cur) => cur.execution.performance1d.toString()).multipliedBy(
				new BigNumber(cur.execshare == null ? 1 : cur.execshare)
			)
		)
		const performance31d = this.sumBigIntPerformanceRpl(validators, (cur) =>
			this.sumExcludeSmoothingPool(cur, (cur) => cur.execution.performance31d.toString()).multipliedBy(
				new BigNumber(cur.execshare == null ? 1 : cur.execshare)
			)
		)
		const performance7d = this.sumBigIntPerformanceRpl(validators, (cur) =>
			this.sumExcludeSmoothingPool(cur, (cur) => cur.execution.performance7d.toString()).multipliedBy(
				new BigNumber(cur.execshare == null ? 1 : cur.execshare)
			)
		)

		const aprExecution = this.getAPRFromMonth(effectiveBalanceActive, aprPerformance31dExecution) // todo
		return {
			performance1d: performance1d,
			performance31d: performance31d,
			performance7d: performance7d,
			performance365d: new BigNumber(0), // not yet implemented
			apr: aprExecution,
			total: total,
		}
	}

	private sumExcludeSmoothingPool(cur: Validator, field: (cur: Validator) => string) {
		// Exclude rocketpool minipool from execution rewards collection
		if (!cur.rocketpool || !cur.rocketpool.smoothing_pool_opted_in) {
			return cur.execution ? new BigNumber(field(cur)).dividedBy(new BigNumber('1e9')) : new BigNumber(0)
		}
		return new BigNumber(0)
	}

	private getConsensusPerformance(
		validators: Validator[],
		effectiveBalanceActive: BigNumber,
		aprPerformance31dConsensus: BigNumber,
		total: BigNumber
	) {
		const performance1d = this.sumBigIntPerformanceRpl(validators, (cur) =>
			new BigNumber(cur.data.performance1d).multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
		)
		const performance31d = this.sumBigIntPerformanceRpl(validators, (cur) =>
			new BigNumber(cur.data.performance31d).multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
		)
		const performance7d = this.sumBigIntPerformanceRpl(validators, (cur) =>
			new BigNumber(cur.data.performance7d).multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
		)
		const performance365d = this.sumBigIntPerformanceRpl(validators, (cur) =>
			new BigNumber(cur.data.performance365d).multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
		)

		const aprConsensus = this.getAPRFromMonth(effectiveBalanceActive, aprPerformance31dConsensus)

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

	public sumBigIntBalanceRpl(validators: Validator[], field: (cur: Validator) => BigNumber): BigNumber {
		return sumBigInt(validators, (cur) => {
			const fieldVal = field(cur)
			if (!cur.rocketpool) return fieldVal.multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
			if (!cur.rocketpool.node_address) return fieldVal.multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))

			const rewards = new BigNumber(fieldVal.toString()).minus(cur.data.effectivebalance)
			const nodeOperatorRewards = new BigNumber(rewards)
				.multipliedBy(new BigNumber('1').plus(new BigNumber(cur.rocketpool.minipool_node_fee.toString())))
				.dividedBy('2')
			const wholeBalance = new BigNumber('16000000000').plus(nodeOperatorRewards)
			return wholeBalance.multipliedBy(new BigNumber(cur.share == null ? 1 : cur.share))
		})
	}

	private sumBigIntPerformanceRpl(validators: Validator[], field: (cur: Validator) => BigNumber): BigNumber {
		return sumBigInt(validators, (cur) => {
			if (!cur.rocketpool) return field(cur)
			if (!cur.rocketpool.node_address) return field(cur)

			return new BigNumber(field(cur).toString())
				.multipliedBy(new BigNumber('1').plus(new BigNumber(cur.rocketpool.minipool_node_fee.toString())))
				.dividedBy('2')
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

	private getAPRFromMonth(effectiveBalance: BigNumber, performance: BigNumber): number {
		if (effectiveBalance.toNumber() == 0) return 0
		return new BigNumber(performance.toString()).multipliedBy('1177').dividedBy(effectiveBalance).decimalPlaces(1).toNumber()
	}

	private getDashboardState(validators: Validator[], currentEpoch: EpochResponse, foreignValidator): DashboardStatus {
		const validatorCount = validators.length
		const activeValidators = this.getActiveValidators(validators)
		const activeValidatorCount = activeValidators.length

		const exitedValidators = this.getExitedValidators(validators)
		const exitedValidatorsCount = exitedValidators.length
		const requiredValidatorsForOKState = validatorCount - exitedValidatorsCount

		const slashedValidators = this.getSlashedValidators(validators)
		const slashedCount = slashedValidators.length

		if (slashedCount > 0) {
			return this.getSlashedState(
				activeValidatorCount,
				validatorCount,
				foreignValidator,
				slashedValidators[0].data,
				currentEpoch,
				slashedCount == validatorCount
			)
		}

		if (activeValidatorCount == requiredValidatorsForOKState && activeValidatorCount != 0) {
			return this.getOkState(activeValidatorCount, validatorCount, foreignValidator, activeValidators[0].data, currentEpoch)
		} else if (activeValidatorCount == requiredValidatorsForOKState && activeValidatorCount == 0) {
			return this.getExitedState(activeValidatorCount, validatorCount, foreignValidator)
		}

		const awaitingActivation = this.getWaitingForActivationValidators(validators)
		const activationeligibility = this.getEligableValidators(validators)

		if (awaitingActivation.length > 0) {
			return this.getAwaitingActivationState(
				activeValidatorCount,
				validatorCount,
				awaitingActivation[0].data,
				currentEpoch,
				foreignValidator,
				awaitingActivation.length == validatorCount
			)
		}

		if (activationeligibility.length > 0) {
			return this.getEligbableActivationState(
				activeValidatorCount,
				validatorCount,
				activationeligibility[0].data,
				currentEpoch,
				foreignValidator,
				activationeligibility.length == validatorCount
			)
		}

		return this.getOfflineState(activeValidatorCount, validatorCount, foreignValidator)
	}

	private descriptionSwitch(myText, foreignText, foreignValidator) {
		return foreignValidator ? foreignText : myText
	}

	private getOkState(
		activeValidatorCount,
		validatorCount,
		foreignValidator,
		validatorResp: ValidatorResponse,
		currentEpoch: EpochResponse
	): DashboardStatus {
		const exitingDescription = this.getExitingDescription(validatorResp, currentEpoch)

		return {
			icon: 'checkmark-circle-outline',
			title: activeValidatorCount + ' / ' + validatorCount,
			description: this.descriptionSwitch('All validators are active', 'This validator is active', foreignValidator),
			extendedDescriptionPre: exitingDescription.extendedDescriptionPre,
			extendedDescription: exitingDescription.extendedDescription,
			iconCss: 'ok',
		}
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

	private getSlashedState(
		activeValidatorCount,
		validatorCount,
		foreignValidator,
		validatorResp: ValidatorResponse,
		currentEpoch: EpochResponse,
		allAffected: boolean
	): DashboardStatus {
		const exitingDescription = this.getExitingDescription(validatorResp, currentEpoch)

		const pre = allAffected ? 'All' : 'Some'
		return {
			icon: 'alert-circle-outline',
			title: activeValidatorCount + ' / ' + validatorCount,
			description: this.descriptionSwitch(pre + ' of your validators were slashed', 'This validator was slashed', foreignValidator),
			extendedDescriptionPre: exitingDescription.extendedDescriptionPre,
			extendedDescription: exitingDescription.extendedDescription,
			iconCss: 'err',
		}
	}

	private getAwaitingActivationState(
		activeValidatorCount,
		validatorCount,
		awaitingActivation: ValidatorResponse,
		currentEpoch: EpochResponse,
		foreignValidator,
		allAffected: boolean
	): DashboardStatus {
		const pre = allAffected ? 'All' : 'Some'
		const estEta = this.getEpochDate(awaitingActivation.activationeligibilityepoch, currentEpoch)
		return {
			icon: 'timer-outline',
			title: activeValidatorCount + ' / ' + validatorCount,
			description: this.descriptionSwitch(
				pre + ' of your validators are waiting for activation',
				'This validator is waiting for activation',
				foreignValidator
			),
			extendedDescriptionPre: estEta ? 'Estimated on ' : null,
			extendedDescription: estEta ? estEta : null,
			iconCss: 'waiting',
		}
	}

	private getEligbableActivationState(
		activeValidatorCount,
		validatorCount,
		eligbleState: ValidatorResponse,
		currentEpoch: EpochResponse,
		foreignValidator,
		allAffected: boolean
	): DashboardStatus {
		const pre = allAffected ? 'All' : 'Some'
		const estEta = this.getEpochDate(eligbleState.activationeligibilityepoch, currentEpoch)
		return {
			icon: 'timer-outline',
			title: activeValidatorCount + ' / ' + validatorCount,
			description: this.descriptionSwitch(
				pre + " of your validators' deposits are being processed",
				"This validator's deposit is being processed",
				foreignValidator
			),
			extendedDescriptionPre: estEta ? 'Estimated on ' : null,
			extendedDescription: estEta ? estEta : null,
			iconCss: 'waiting',
		}
	}

	private getExitedState(activeValidatorCount, validatorCount, foreignValidator): DashboardStatus {
		return {
			icon: this.descriptionSwitch('ribbon-outline', 'home-outline', foreignValidator),
			title: activeValidatorCount + ' / ' + validatorCount,
			description: this.descriptionSwitch('All of your validators have exited', 'This validator has exited', foreignValidator),
			extendedDescriptionPre: null,
			extendedDescription: this.descriptionSwitch('Thank you for your service', null, foreignValidator),
			iconCss: 'ok',
		}
	}

	private getOfflineState(activeValidatorCount, validatorCount, foreignValidator): DashboardStatus {
		const pre = activeValidatorCount == 0 ? 'All' : 'Some'
		return {
			icon: 'alert-circle-outline',
			title: activeValidatorCount + ' / ' + validatorCount,
			description: this.descriptionSwitch(pre + ' of your validators are offline', 'This validator is offline', foreignValidator),
			extendedDescriptionPre: null,
			extendedDescription: null,
			iconCss: 'warn',
		}
	}

	private getEpochDate(activationEpoch, currentEpoch: EpochResponse) {
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
}

interface RocketpoolCheatingStatus {
	strikes: number
	penalties: number
}
