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

import BigNumber from "bignumber.js";
import { StatsResponse } from '../controllers/MachineController'

export enum Method {
  GET,
  POST,
}

export interface APIResponse {
  status: string;
  data: any;
}

export abstract class APIRequest<T> {
  
  abstract resource: string;
  abstract method: Method;

  endPoint: string = "default"
  postData?: any;

  parse(response: any): T[] {
    return this.parseBase(response)
  }

  wasSuccessfull(response: any, hasDataStatus = true): boolean {
    if (!response || !response.status) return false
    return response.status == 200 && (response.data.status == "OK" || !hasDataStatus)
  }

  protected parseBase(response: any, hasDataStatus = true): T[] {
    if (!this.wasSuccessfull(response, hasDataStatus)) {
      return []
    }

    const data = response.data.data;
    if (Array.isArray(data)) {
      return data
    } else {
      return [data]
    }
  }

  options: any = {
    headers: {
      'Content-Type': 'application/json',
      "Accept": "application/json",
    }
  }

  requiresAuth = false
  updatesLastRefreshState = false
  ignoreFails = false
}

// ------------- Responses -------------

export interface MyValidatorResponse {
  PubKey: string
  Index: number
}

export interface ApiTokenResponse {
  access_token: string,
  expires_in: number,
  refresh_token: string,
  token_type: string
}

export interface MobileSettingsResponse {
  notify_enabled: boolean
}

export interface GithubReleaseResponse {
  url: string,
  html_url: string,
  id: number,
  tag_name: string,
  draft: boolean,
  prerelease: boolean
  created_at: string,
  published_at: string
}

export interface CoinbaseExchangeResponse {
  base: string,
  currency: string,
  amount: string
}

export interface ETH1ValidatorResponse {
  publickey: string,
  valid_signature: boolean,
  validatorindex: number
}

export interface ValidatorResponse {
  activationeligibilityepoch: number;
  activationepoch: number;
  balance: BigNumber;
  effectivebalance: BigNumber;
  exitepoch: number;
  lastattestationslot: number;
  name: string;
  pubkey: string;
  slashed: boolean;
  validatorindex: number;
  withdrawableepoch: number;
  withdrawalcredentials: string;
  status: string;
}

export interface PerformanceResponse {
  balance: BigNumber;
  performance1d: BigNumber;
  performance31d: BigNumber;
  performance365d: BigNumber;
  performance7d: BigNumber;
  rank7d: number;
  validatorindex: number;
}

export interface AttestationPerformanceResponse {
  attestation_efficiency: BigNumber;
  pubkey: string
  validatorindex: number;
}

export interface EpochResponse {
  attestationscount: number,
  attesterslashingscount: number,
  averagevalidatorbalance: BigNumber,
  blockscount: number,
  depositscount: BigNumber,
  eligibleether: BigNumber,
  epoch: number,
  finalized: boolean,
  globalparticipationrate: BigNumber,
  missedblocks: number,
  orphanedblocks: number,
  proposedblocks: number,
  proposerslashingscount: BigNumber,
  scheduledblocks: number,
  totalvalidatorbalance: BigNumber,
  validatorscount: number,
  voluntaryexitscount: number,
  votedether: BigNumber,
  lastCachedTimestamp: number
}

export interface BalanceHistoryResponse {
  balance: BigNumber,
  effectivebalance: BigNumber,
  epoch: number,
  validatorindex: number
}

export interface CoinzillaAdResponse {
  title: string,
  img: string,
  thumbnail: string
  description: string
  description_short: string
  cta_button: string
  website: string
  name: string
  url: string
  impressionUrl: string
}

// ------------- Reqests -------------

export class ValidatorRequest extends APIRequest<ValidatorResponse>  {
  resource = "validator/";
  method = Method.GET;

  /**
   * @param validator Index or PubKey
   */
  constructor(...validator: any) {
    super();
    this.resource += validator.join().replace(/\s/g, "")
  }
}

export class ValidatorETH1Request extends APIRequest<ETH1ValidatorResponse> {
  resource = "validator/eth1/";
  method = Method.GET;

  /**
   * @param validator Index or PubKey
   */
  constructor(ethAddress: string) {
    super();
    this.resource += ethAddress.replace(/\s/g, "")
  }
}

export class PerformanceRequest extends APIRequest<PerformanceResponse> {
  resource = "validator/";
  method = Method.GET;
  updatesLastRefreshState = true

  /**
   * @param validator Index or PubKey
   */
  constructor(...validator: any) {
    super()
    this.resource += validator.join().replace(/\s/g, "") + "/performance";
  }
}

export class AttestationPerformanceRequest extends APIRequest<AttestationPerformanceResponse> {
  resource = "validator/";
  method = Method.GET;
  updatesLastRefreshState = true
  ignoreFails = true

  /**
   * @param validator Index or PubKey
   */
  constructor(...validator: any) {
    super()
    this.resource += validator.join().replace(/\s/g, "") + "/attestationefficiency";
  }
}

export class BalanceHistoryRequest extends APIRequest<BalanceHistoryResponse> {
  resource = "validator/";
  method = Method.GET;

  /**
   * @param validator Index or PubKey
   */
  constructor(...validator: any) {
    super()
    this.resource += validator.join().replace(/\s/g, "") + "/balancehistory";
  }
}

export class DasboardDataRequest extends APIRequest<any> {
  resource = "dashboard/data/";
  method = Method.GET;
  ignoreFails = true

  parse(response: any): any[] {
    if (!this.wasSuccessfull(response, false)) {
      return []
    }
    return response.data;
  }

  /**
   * @param validator Index or PubKey
   */
  constructor(data: ('balances' | 'proposals'), ...validator: any) {
    super()
    this.resource += data + "?validators=" + validator.join().replace(/\s/g, "");
  }
}

export class EpochRequest extends APIRequest<EpochResponse> {
  resource = "epoch/";
  method = Method.GET;

  constructor(epoch: string = "latest") {
    super()
    this.resource += epoch;
  }
}

// ------------ Authorized Calls -----------------

export class SetMobileSettingsRequest extends APIRequest<MobileSettingsResponse> {
  resource = "user/mobile/settings";
  method = Method.POST;
  postData: any
  requiresAuth = true
  ignoreFails = true

  parse(response: any): MobileSettingsResponse[] {
    if (!response || !response.data) return null
    return response.data as MobileSettingsResponse[];
  }

  constructor(notifyEnabled: boolean) {
    super()
    this.postData = { notify_enabled: notifyEnabled }
  }
}

export interface SubscriptionTransaction {
  id: string,
  receipt: string,
  type: string
}

export interface SubscriptionData {
  currency: string,
  id: string,
  priceMicros: number,
  transaction: SubscriptionTransaction,
  valid: boolean
}

export class PostMobileSubscription extends APIRequest<MobileSettingsResponse> {
  resource = "user/subscription/register";
  method = Method.POST;
  requiresAuth = true
  ignoreFails = true

  constructor(subscriptionData: SubscriptionData) {
    super()
    this.postData = subscriptionData
  }

}

export class GetMobileSettingsRequest extends APIRequest<MobileSettingsResponse> {
  resource = "user/mobile/settings";
  method = Method.GET;
  requiresAuth = true
  ignoreFails = true
}

export class GetMyValidatorsRequest extends APIRequest<MyValidatorResponse> {
  resource = "user/validator/saved";
  method = Method.GET;
  requiresAuth = true
}

export class GetMyMachinesRequest extends APIRequest<StatsResponse> {
  resource = "user/stats";
  method = Method.GET;
  requiresAuth = true
  ignoreFails = true

  constructor(offset: number = 0, limit: number = 180) {
    super()
    this.resource += "/" + offset + "/" + limit
  }
}

export class RemoveMyValidatorsRequest extends APIRequest<ApiTokenResponse> {
  resource = "user/validator/{pubkey}/remove";
  method = Method.POST;
  requiresAuth = true
  postData = {}
  ignoreFails = true

  options: any = {
    headers: {
      'Content-Type': "application/text",
      "Accept": "application/json",
    }
  }

  parse(response: any): ApiTokenResponse[] {
    if (!response || !response.data) return null
    return response.data as ApiTokenResponse[];
  }

  constructor(pubKey: string) {
    super()
    this.resource = this.resource.replace("{pubkey}", pubKey)
  }
}

export class AddMyValidatorsRequest extends APIRequest<ApiTokenResponse> {
  resource = "user/dashboard/save";
  method = Method.POST;
  requiresAuth = true
  postData: any
  ignoreFails = true

  options: any = {
    headers: {
      'Content-Type': "application/text",
      "Accept": "application/json",
    }
  }

  parse(response: any): ApiTokenResponse[] {
    if (!response || !response.data) return null
    return response.data as ApiTokenResponse[];
  }

  constructor(indices: string[]) {
    super()
    this.postData = indices
  }
}

export class NotificationSubsRequest extends APIRequest<ApiTokenResponse> {
  private subscribe = "subscribe"
  private unsubscribe = "unsubscribe"

  resource = "user/notifications/";
  method = Method.POST;
  requiresAuth = true
  postData: any = {}
  ignoreFails = true

  constructor(eventName: string, filter: string = null, enabled: boolean) {
    super()
    if (filter != null) {
      this.resource += (enabled ? this.subscribe : this.unsubscribe) + "?event=" + eventName + "&filter=" + filter
    } else {
      this.resource += (enabled ? this.subscribe : this.unsubscribe) + "?event=" + eventName
    }
  }
}

export class RefreshTokenRequest extends APIRequest<ApiTokenResponse> {
  resource = "user/token";
  method = Method.POST;
  requiresAuth = true
  postData: any
  ignoreFails = true

  // should not be cached for long
  options = {
    cache: {
      maxAge: 1000
    }
  }

  parse(response: any): ApiTokenResponse[] {
    if (response && response.data) return [response.data] as ApiTokenResponse[];
    else return []
  }

  constructor(refreshToken: string) {
    super()
    this.postData = new FormData();
    this.postData.append('grant_type', 'refresh_token');
    this.postData.append('refresh_token', refreshToken);
  }
}

export class UpdateTokenRequest extends APIRequest<APIResponse> {
  resource = "user/mobile/notify/register";
  method = Method.POST;
  postData: any
  requiresAuth = true
  ignoreFails = true

  parse(response: any): APIResponse[] {
    if (response && response.data) return response.data as APIResponse[];
    return null
  }

  constructor(token: string) {
    super()
    this.postData = { token: token }
  }
}

// ------------ Special external api requests -----------------

export class CoinzillaAdRequest extends APIRequest<CoinzillaAdResponse> {
  endPoint = "https://request-global.czilladx.com"

  resource = "/serve/native-app.php?z=";
  method = Method.GET;
  ignoreFails = true

  options = {
    cache: {
      maxAge: 4 * 60 * 1000,
    }
  }


  parse(response: any): CoinzillaAdResponse[] {
    if (!this.wasSuccessfull(response, false) || !response.data.ad) {
      return []
    }

    return [response.data.ad];
  }

  constructor(tracker: string) {
    super()
    this.resource += tracker
  }

}



export class CoinbaseExchangeRequest extends APIRequest<CoinbaseExchangeResponse> {
  endPoint = "https://api.coinbase.com"

  resource = "v2/prices/";
  method = Method.GET;
  ignoreFails = true

  options = {
    cache: {
      maxAge: 1 * 60 * 60 * 1000,
    }
  }

  parse(response: any): CoinbaseExchangeResponse[] {
    return this.parseBase(response, false);
  }

  constructor(currencyPair: string) {
    super()
    this.resource += currencyPair + "/spot"
  }
}

export class GithubReleaseRequest extends APIRequest<GithubReleaseResponse> {
  endPoint = "https://api.github.com"
  
  resource = "repos/"; 
  method = Method.GET;
  ignoreFails = true

  options = {
    cache: {
      maxAge: 4 * 60 * 60 * 1000,
    }
  }

  parse(response: any): GithubReleaseResponse[] {
    if (!this.wasSuccessfull(response, false)) {
      return []
    }

    const data = response.data;
    if (Array.isArray(data)) {
      return data
    } else {
      return [data]
    }
  }

  constructor(repo: string, latest = true) {
    super()
    this.resource += repo + "/releases" + (latest ? "/latest" : "")
  }

}

export default class { }