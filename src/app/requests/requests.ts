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

import { HttpHeaders, HttpOptions } from '@capacitor/core'
import BigNumber from 'bignumber.js'
import { StatsResponse } from '../controllers/MachineController'
import { Response } from '../services/api.service'
import { ZoneInfo } from '../utils/AdUtils'

export enum Method {
	GET,
	POST,
	DELETE,
	PUT
}

export interface APIResponse {
	status: string
	data: unknown
}

export interface NoContent { }

export interface ApiResult<T> {
	data: T
	error: string | null
	cached: boolean
}

export abstract class APIRequest<T> {
	abstract resource: string
	abstract method: Method

	endPoint = 'default'
	postData?: unknown
	expectedResponseStatus = 200
	customCacheKey: string = null

	withCustomCacheKey(key: string): this {
		this.customCacheKey = key
		return this
	}

	sortResultFn: (a: T, b: T) => number = null

	parse(response: Response): T[] {
		return this.parseBase(response)
	}

	parse2(response: Response): ApiResult<T[]> {
		if (this.wasSuccessful(response)) {
			return {
				data: this.parse(response),
				error: null,
				cached: response.cached,
			}
		}

		return {
			data: null,
			error: response?.data?.error || response ? 'HTTP status code: ' + response.status : 'No response error',
			cached: response?.cached || false,
		}
	}

	// Usually you can expect either a Response or a boolean
	// response.status can be a string though depending on the type of http connector used
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	wasSuccessful(response: any, hasDataStatus = true): boolean {
		if (typeof response === 'boolean') {
			return response
		}
		return response && (response.status == 'OK' || response.status == this.expectedResponseStatus || !hasDataStatus)
	}

	protected parseBase(response: Response, hasDataStatus = true): T[] {
		if (!this.wasSuccessful(response, hasDataStatus)) {
			return []
		}

		if (response && response.data && response.data.data) {
			const data = response.data.data
			if (Array.isArray(data)) {
				if (this.sortResultFn) {
					data.sort(this.sortResultFn)
				}

				return data as T[]
			} else {
				return [data]
			}
		}
		return []
	}

	options: HttpOptions = {
		url: null, // unused
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		} as HttpHeaders,
	}

	/** @deprecated can be removed in v2 */
	cacheablePOST = false

	/** @deprecated can be removed in v2 */
	requiresAuth = false

	updatesLastRefreshState = false
	ignoreFails = false
	maxCacheAge = 6 * 60 * 1000
}

// ------------- Responses -------------

export interface BlockResponse {
	baseFee: number
	blockHash: string
	blockMevReward: string
	blockNumber: number
	blockReward: string
	consensusAlgorithm: string
	feeRecipient: string
	gasLimit: number
	gasUsed: number
	internalTxCount: number
	parentHash: string
	producerReward: string
	timestamp: number
	txCount: number
	uncleCount: number
	posConsensus: PoSConsensus
	relay: Relay
}

export interface Relay {
	builderPubkey: string
	producerFeeRecipient: string
	tag: string
}

export interface PoSConsensus {
	epoch: number
	slot: number
	proposerIndex: number
	finalized: boolean
}

export interface MyValidatorResponse {
	PubKey: string
	Index: number
}

export interface ApiTokenResponse {
	access_token: string
	expires_in: number
	refresh_token: string
	token_type: string
}

export interface MobileSettingsResponse {
	notify_enabled: boolean
}

export interface GithubReleaseResponse {
	url: string
	html_url: string
	id: number
	tag_name: string
	draft: boolean
	prerelease: boolean
	created_at: string
	published_at: string
}

export interface CoinbaseExchangeResponse {
	base: string
	currency: string
	amount: string
}

export interface ETH1ValidatorResponse {
	publickey: string
	validatorindex: number
}

export interface ValidatorResponse {
	activationeligibilityepoch: number
	activationepoch: number
	balance: BigNumber
	effectivebalance: BigNumber
	exitepoch: number
	lastattestationslot: number
	name: string
	pubkey: string
	slashed: boolean
	validatorindex: number
	withdrawableepoch: number
	withdrawalcredentials: string
	status: string
	performance1d: BigNumber
	performance31d: BigNumber
	performance365d: BigNumber
	performance7d: BigNumber
	performancetotal: BigNumber
	rank7d: number
	rankpercentage: number
}

export interface AttestationPerformanceResponse {
	attestation_efficiency: BigNumber
	pubkey: string
	validatorindex: number
}

export interface SyncCommitteeResponse {
	end_epoch: number
	period: number
	start_epoch: number
	validators: number[]
}

export interface SyncCommitteesStatistics {
	committeesParticipated: number
	committeesExpected: number
	slotsPerSyncCommittee: number
	slotsLeftInSyncCommittee: number
	slotsParticipated: number
	slotsMissed: number
	slotsScheduled: number
	efficiency: number
	luck: number
}

export interface SyncCommitteesStatisticsResponse {
	expectedSlots: number
	participatedSlots: number
	missedSlots: number
	scheduledSlots: number
}

export interface EpochResponse {
	attestationscount: number
	attesterslashingscount: number
	averagevalidatorbalance: BigNumber
	blockscount: number
	depositscount: BigNumber
	eligibleether: BigNumber
	epoch: number
	finalized: boolean
	globalparticipationrate: BigNumber
	missedblocks: number
	orphanedblocks: number
	proposedblocks: number
	proposerslashingscount: BigNumber
	scheduledblocks: number
	totalvalidatorbalance: BigNumber
	validatorscount: number
	voluntaryexitscount: number
	votedether: BigNumber
	lastCachedTimestamp: number
}

export interface BalanceHistoryResponse {
	balance: BigNumber
	effectivebalance: BigNumber
	epoch: number
	validatorindex: number
}

export interface DashboardResponse {
	validators: ValidatorResponse[]
	effectiveness: AttestationPerformanceResponse[]
	currentEpoch: EpochResponse[]
	olderEpoch: EpochResponse[]
	rocketpool_validators: RocketPoolResponse[]
	execution_performance: ExecutionResponse[]
	rocketpool_network_stats: RocketPoolNetworkStats[]
	current_sync_committee: SyncCommitteeResponse[]
	next_sync_committee: SyncCommitteeResponse[]
	sync_committees_stats: SyncCommitteesStatisticsResponse
	proposal_luck_stats: ProposalLuckResponse
}

export interface RocketPoolNetworkStats {
	rpl_price: string
	claim_interval_time: string // TODO?
	claim_interval_time_start: number // TODO?
	current_node_fee: number
	current_node_demand: string
	reth_supply: string
	reth_apr: number
	effective_rpl_staked: string
	node_operator_rewards: string
	reth_exchange_rate: string
}

export interface RocketPoolResponse {
	index: number
	minipool_address: string
	minipool_deposit_type: string
	minipool_node_fee: string
	minipool_status: string
	minipool_status_time: number
	node_address: string
	node_max_rpl_stake: string
	node_min_rpl_stake: string
	node_rpl_stake: string
	rpl_cumulative_rewards: string
	node_timezone_location: string
	unclaimed_rpl_rewards: string
	unclaimed_smoothing_pool: string
	claimed_smoothing_pool: string
	smoothing_pool_opted_in: boolean
	penalty_count: number
	user_deposit_balance: BigNumber
	node_refund_balance: BigNumber
	node_deposit_balance: BigNumber
	node_deposit_credit: BigNumber
	is_vacant: boolean
	version: number
}

export interface ExecutionResponse {
	validatorindex: number
	performance1d: number
	performance7d: number
	performance31d: number
	performance365d: number
	performanceTotal: number
}

export interface NotificationGetResponse {
	CreatedEpoch: number
	CreatedTime: string
	EventFilter: string
	EventName: string
	EventThreshold: string
}

export interface BitflyAdResponse {
	html: string
	width: string
	height: string
}

export interface ProposalLuckResponse {
	proposal_luck: number
	average_proposal_interval: number
	next_proposal_estimate_ts: number
	time_frame_name: string
}

// ------------- Reqests -------------

export class DashboardRequest extends APIRequest<DashboardResponse> {
	resource = 'app/dashboard'
	method = Method.POST
	updatesLastRefreshState = true
	cacheablePOST = true

	/**
	 * @param validator Index or PubKey
	 */
	constructor(...validator: number[] | string[]) {
		super()
		this.postData = { indicesOrPubkey: validator.join().replace(/\s/g, '') }
	}
}

export class ValidatorRequest extends APIRequest<ValidatorResponse> {
	resource = 'validator/'
	method = Method.GET

	/**
	 * @param validator Index or PubKey
	 */
	constructor(...validator: number[] | string[]) {
		super()
		this.resource += validator.join().replace(/\s/g, '')
	}
}

export class ValidatorViaDepositAddress extends APIRequest<ETH1ValidatorResponse> {
	resource = 'validator/eth1/'
	method = Method.GET

	/**
	 * @param ethAddress Address
	 */
	constructor(ethAddress: string) {
		super()
		this.resource += ethAddress.replace(/\s/g, '')
	}
}

export class ValidatorViaWithdrawalAddress extends APIRequest<ETH1ValidatorResponse> {
	resource = 'validator/withdrawalCredentials/'
	method = Method.GET

	/**
	 * @param ethAddress Address or Withdrawal Credential
	 */
	constructor(ethAddress: string) {
		super()
		this.resource += ethAddress.replace(/\s/g, '')
		this.resource += '?limit=300'
	}
}

export class BlockProducedByRequest extends APIRequest<BlockResponse> {
	resource = 'execution/'
	method = Method.GET
	ignoreFails = true

	parse(response: Response): BlockResponse[] {
		if (!this.wasSuccessful(response, true)) {
			return []
		}
		return response.data.data
	}

	/**
	 * @param validator Index or PubKey
	 */
	constructor(offset: number, limit: number, ...validator: number[] | string[]) {
		super()
		this.resource += validator.join().replace(/\s/g, '') + '/produced?offset=' + offset + '&limit=' + limit
	}
}

export class DashboardDataRequest extends APIRequest<number[]> {
	resource = 'dashboard/data/'
	method = Method.GET
	ignoreFails = true

	parse(response: Response): number[][] {
		if (!this.wasSuccessful(response, false)) {
			return []
		}
		return response.data
	}

	/**
	 * @param validator Index or PubKey
	 */
	constructor(data: 'allbalances' | 'proposals', ...validator: number[] | string[]) {
		super()
		this.resource += data + '?validators=' + validator.join().replace(/\s/g, '')
	}
}

// ------------ Authorized Calls -----------------

/** @deprecated Notification management will be removed from app in v2*/
export class SetMobileSettingsRequest extends APIRequest<MobileSettingsResponse> {
	resource = 'user/mobile/settings'
	method = Method.POST

	requiresAuth = true
	ignoreFails = true

	parse(response: Response): MobileSettingsResponse[] {
		if (!response || !response.data) return null
		return response.data as MobileSettingsResponse[]
	}

	constructor(notifyEnabled: boolean) {
		super()
		this.postData = { notify_enabled: notifyEnabled }
	}
}

export interface SubscriptionTransaction {
	id: string
	receipt: string
	type: string
}

export interface SubscriptionData {
	currency: string
	id: string
	priceMicros: number
	transaction: SubscriptionTransaction
	valid: boolean
}

/**@deprecated Replaced by V2PurchaseValidation */
export class PostMobileSubscription extends APIRequest<MobileSettingsResponse> {
	resource = 'user/subscription/register'
	method = Method.POST
	requiresAuth = true
	ignoreFails = true

	constructor(subscriptionData: SubscriptionData) {
		super()
		this.postData = subscriptionData
	}
}

/** @deprecated Notification management will be removed from app in v2*/
export class GetMobileSettingsRequest extends APIRequest<MobileSettingsResponse> {
	resource = 'user/mobile/settings'
	method = Method.GET
	requiresAuth = true
	ignoreFails = true
}

export class GetMyValidatorsRequest extends APIRequest<MyValidatorResponse> {
	resource = 'user/validator/saved'
	method = Method.GET
	requiresAuth = true
}

export class GetMyMachinesRequest extends APIRequest<StatsResponse> {
	resource = 'user/stats'
	method = Method.GET
	requiresAuth = true
	ignoreFails = true

	constructor(offset = 0, limit = 180) {
		super()
		this.resource += '/' + offset + '/' + limit
	}
}

export class RemoveMyValidatorsRequest extends APIRequest<ApiTokenResponse> {
	resource = 'user/validator/{pubkey}/remove'
	method = Method.POST
	requiresAuth = true
	postData = {}
	ignoreFails = true

	options = {
		url: null, // unused
		headers: {
			'Content-Type': 'application/text',
			Accept: 'application/json',
		},
	}

	parse(response: Response): ApiTokenResponse[] {
		if (!response || !response.data) return null
		return response.data as ApiTokenResponse[]
	}

	constructor(pubKey: string) {
		super()
		this.resource = this.resource.replace('{pubkey}', pubKey)
	}
}

export class AddMyValidatorsRequest extends APIRequest<ApiTokenResponse> {
	resource = 'user/dashboard/save'
	method = Method.POST
	requiresAuth = true
	ignoreFails = true

	options = {
		url: null, // unused
		headers: {
			'Content-Type': 'application/text',
			Accept: 'application/json',
		},
	}

	parse(response: Response): ApiTokenResponse[] {
		if (!response || !response.data) return null
		return response.data as ApiTokenResponse[]
	}

	constructor(indices: string[]) {
		super()
		this.postData = indices
	}
}

/** @deprecated Notification management will be removed from app in v2*/
export class NotificationGetRequest extends APIRequest<NotificationGetResponse> {
	resource = 'user/notifications'
	method = Method.GET
	requiresAuth = true
	postData = {}
	ignoreFails = true

	constructor() {
		super()
	}

	parse(response: Response): NotificationGetResponse[] {
		if (!response || !response.data || !response.data.data) return []
		return response.data.data as NotificationGetResponse[]
	}
}

/** @deprecated */
export interface BundleSub {
	event_name: string
	event_filter: string
	event_threshold: number
}

/** @deprecated Notification management will be removed from app in v2*/
export class NotificationBundleSubsRequest extends APIRequest<ApiTokenResponse> {
	private subscribe = 'subscribe'
	private unsubscribe = 'unsubscribe'

	resource = 'user/notifications/bundled/'
	method = Method.POST
	requiresAuth = true
	postData = {}
	ignoreFails = true

	constructor(enabled: boolean, data: BundleSub[]) {
		super()
		this.resource += enabled ? this.subscribe : this.unsubscribe
		this.postData = data
	}
}

/** @deprecated */
export class RefreshTokenRequest extends APIRequest<ApiTokenResponse> {
	resource = 'user/token'
	method = Method.POST
	requiresAuth = true
	ignoreFails = true
	maxCacheAge = 1000
	options = {
		url: null,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json',
		},
	}

	parse(response: Response): ApiTokenResponse[] {
		if (response && response.data) return [response.data] as ApiTokenResponse[]
		else return []
	}

	constructor(refreshToken: string, isIOS: boolean) {
		super()
		// ¯\_(ツ)_/¯
		if (isIOS) {
			this.postData = {
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
			}
		} else {
			const formBody = new FormData()
			formBody.set('grant_type', 'refresh_token')
			formBody.set('refresh_token', refreshToken)
			this.postData = formBody
			this.options.headers = undefined
		}
	}
}

/** @deprecated Has been replaced by V2RegisterPushNotificationToken */
export class UpdateTokenRequest extends APIRequest<APIResponse> {
	resource = 'user/mobile/notify/register'
	method = Method.POST
	requiresAuth = true
	ignoreFails = true

	parse(response: Response): APIResponse[] {
		if (response && response.data) return response.data as APIResponse[]
		return null
	}

	constructor(token: string) {
		super()
		this.postData = { token: token }
	}
}

// ------------ Special external api requests -----------------

export class BitflyAdRequest extends APIRequest<BitflyAdResponse> {
	endPoint = 'https://ads.bitfly.at'

	resource = '/www/delivery/asyncspc.php?zones={ZONE}&prefix={PREFIX}'
	method = Method.GET
	ignoreFails = true
	maxCacheAge = 4 * 60 * 1000

	options = {
		url: null, // unused
		headers: undefined,
	}

	parse(response: Response): BitflyAdResponse[] {
		if (!response || !response.data) {
			return []
		}

		return Object.values(response.data)
	}

	constructor(zoneInfo: ZoneInfo) {
		super()
		this.resource = this.resource.replace('{ZONE}', zoneInfo.zones.toString()).replace('{PREFIX}', zoneInfo.prefix)
		console.log('bitfly ad resource', this.resource)
	}
}

export class CoinbaseExchangeRequest extends APIRequest<CoinbaseExchangeResponse> {
	endPoint = 'https://api.coinbase.com'

	resource = 'v2/prices/'
	method = Method.GET
	ignoreFails = true
	maxCacheAge = 40 * 60 * 1000

	parse(response: Response): CoinbaseExchangeResponse[] {
		return this.parseBase(response, false)
	}

	constructor(currencyPair: string) {
		super()
		this.resource += currencyPair + '/spot'
	}
}

export class GithubReleaseRequest extends APIRequest<GithubReleaseResponse> {
	endPoint = 'https://api.github.com'

	resource = 'repos/'
	method = Method.GET
	ignoreFails = true
	maxCacheAge = 4 * 60 * 60 * 1000
	options = {
		url: null, // unused
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			'User-Agent': 'beaconcha.in Dashboard',
		},
	}

	parse(response: Response): GithubReleaseResponse[] {
		if (!this.wasSuccessful(response, false)) {
			return []
		}

		const data = response.data
		if (Array.isArray(data)) {
			return data
		} else {
			return [data]
		}
	}

	constructor(repo: string, latest = true) {
		super()
		this.resource += repo + '/releases' + (latest ? '/latest' : '')
	}
}

export default class {}
