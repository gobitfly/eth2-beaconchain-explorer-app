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

import { Injectable } from '@angular/core';
import { APIRequest, FormDataContainer, Method, RefreshTokenRequest } from "../requests/requests";
import { StorageService } from './storage.service';
import { ApiNetwork } from '../models/StorageTypes';
import { isDevMode } from "@angular/core"
import { Mutex } from 'async-mutex';
import { MAP } from '../utils/NetworkData'
import { Http, HttpResponse } from '@capacitor-community/http';
import { CacheModule } from '../utils/CacheModule';
import axios, { AxiosResponse } from "axios";
import { Device } from '@capacitor/device';

const LOGTAG = "[ApiService]";
var cacheKey = "api-cache"

const SERVER_TIMEOUT = 25000

@Injectable({
  providedIn: 'root'
})
export class ApiService extends CacheModule {

  networkConfig: Promise<ApiNetwork>

  public connectionStateOK = true

  public isAuthorized = false

  awaitingResponses: Map<string, Mutex> = new Map()

  debug = false

  public lastRefreshed = 0 // only updated by calls that have the updatesLastRefreshState flag enabled

  lastCacheInvalidate = 0

  private httpLegacy = axios.create({
    timeout: SERVER_TIMEOUT,
  }
);

  forceNativeAll = true

  constructor(
    private storage: StorageService
  ) {
    super("api", 5 * 60 * 1000, storage)
    this.isDebugMode().then((result) => {
      this.debug = result
      window.localStorage.setItem("debug", this.debug ? "true" : "false") 
    }) 
    this.lastCacheInvalidate = Date.now()
    //this.registerLogMiddleware()
    this.updateNetworkConfig()
    //this.isIOS15().then((result) => { this.forceNativeAll = result })
  }

  mayInvalidateOnFaultyConnectionState() {
    if(!this.connectionStateOK) this.invalidateCache()
  }

  invalidateCache() {
    if (this.lastCacheInvalidate + 40000 < Date.now()) {
      this.lastCacheInvalidate = Date.now()
      console.log("invalidating request cache")
      this.invalidateAllCache()
      this.storage.invalidateAllCache()
    }
  }

  async updateNetworkConfig() {
    this.networkConfig = this.storage.getNetworkPreferences()
    await this.networkConfig
  }

  async getNetworkName(): Promise<string> {
    return (await this.networkConfig).key
  }

  private async getAuthHeader(isTokenRefreshCall: boolean) {
    var user = await this.storage.getAuthUser()
    if (!user || !user.accessToken) return null

    if (!isTokenRefreshCall && user.expiresIn <= Date.now() - (SERVER_TIMEOUT + 1000)) { // grace window, should be higher than allowed server timeout
      console.log("Token expired, refreshing...", user.expiresIn)
      user = await this.refreshToken()
      if (!user || !user.accessToken) {
        
        // logout logic if token can not be refreshed again within an 12 hour window
        const markForLogout = await this.storage.getItem("mark_for_logout")
        const markForLogoutInt = parseInt(markForLogout)
        if (!isNaN(markForLogoutInt) && markForLogoutInt + 12 * 60 * 1000 < Date.now()) {
          console.log("[auto-logout] mark_for_logout reached, logout user")
          this.storage.setItem("mark_for_logout", null)
          this.storage.setAuthUser(null)
        } else if(isNaN(markForLogoutInt) ){
          console.log("[auto-logout] mark_for_logout set")
          this.storage.setItem("mark_for_logout", Date.now() + "")
        }

        return null
      }
    }

    return {
      'Authorization': 'Bearer ' + user.accessToken
    }
  }

  async refreshToken() {
    const user = await this.storage.getAuthUser()
    if (!user || !user.refreshToken) {
      console.warn("No refreshtoken, cannot refresh token")
      return null
    }

    const now = Date.now()
    const req = new RefreshTokenRequest(user.refreshToken)

    var formBody = new FormData();
    formBody.set("grant_type", "refresh_token");
    formBody.set("refresh_token", user.refreshToken);
    const url = await this.getResourceUrl(req.resource, req.endPoint)
    
    // use js here for the request since the native http plugin performs inconsistent across platforms with non json requests
    const resp = await fetch(
       url,
        {
            method: 'POST',
            body: formBody,
            headers: await this.getAuthHeader(true)
        }
    )
    const result = await resp.json()

    console.log("Refresh token", result, resp)
    if (!result || !result.access_token) {
      console.warn("could not refresh token", result)
      return null
    }

    user.accessToken = result.access_token
    user.expiresIn = now + (result.expires_in * 1000)

    await this.storage.setAuthUser(user)
    return user
  }

  private async lockOrWait(resource) {
    if (!this.awaitingResponses[resource]) {
      console.log("Locking ", resource)
      this.awaitingResponses[resource] = new Mutex()

    }
    await this.awaitingResponses[resource].acquire()
  }

  private async unlock(resource) {
    console.log("Unlocking  ", resource);

    this.awaitingResponses[resource].release()
  }

  async isNotMainnet(): Promise<boolean> {
    const test = (await this.networkConfig).net != ""
    console.log("isNotMainnet", test)
    return test
  }

  private async getCacheKey(request: APIRequest<any>): Promise<string> {
    return request.method + await this.getResourceUrl(request.resource, request.endPoint)
  }

  async execute(request: APIRequest<any>) {
    await this.initialized

    if (!this.connectionStateOK) {
      this.invalidateCache()
    }

    // If cached and not stale, return cache
    let cached = await this.getCache(await this.getCacheKey(request))
    if (cached) {
      if (this.lastRefreshed == 0) this.lastRefreshed = Date.now()
      cached.cached = true
      return cached
    }

    var options = request.options

    // second is special case for notifications
    // notifications are rescheduled if response is != 200
    // but user can switch network in the mean time, so we need to reapply the network
    // the user was currently on, when they set the notification toggle
    // hence the additional request.requiresAuth
    if (request.endPoint == "default" || request.requiresAuth) {
      const authHeader = await this.getAuthHeader(request instanceof RefreshTokenRequest)

      if (authHeader) {
        const headers = { ...options.headers, ...authHeader }
        options.headers = headers;
      }
    }

    await this.lockOrWait(request.resource)

    console.log(LOGTAG + " Send request: " + request.resource, request)
    let startTs = Date.now()

    if (this.forceNativeAll) { // android appears to have issues with native POST right now
      console.log("force native all")
      request.nativeHttp = true
    }

    var response: Promise<Response>
    switch (request.method) {
      case Method.GET:
        if (request.nativeHttp) {
          response = this.get(request.resource, request.endPoint, request.ignoreFails, options)
        } else {
          response = this.legacyGet(request.resource, request.endPoint, request.ignoreFails, options)
        }
        break;
      case Method.POST:
        if (request.nativeHttp) {
          response = this.post(request.resource, request.postData, request.endPoint, request.ignoreFails, options)
        } else {
          response = this.legacyPost(request.resource, request.postData, request.endPoint, request.ignoreFails, options)
        }
        break;
      default:
        throw "Unsupported method: " + request.method;
    }

    const result = await response
    if (request.method == Method.GET && result && result.status == 200 && result.data) {
      this.putCache(await this.getCacheKey(request), result, request.maxCacheAge)
    }

    if (request.updatesLastRefreshState) this.updateLastRefreshed(result)

    this.unlock(request.resource)
    console.log(
      LOGTAG + " Response: " + result.url + "",
      result,
      Date.now() - startTs
    );

    result.cached = false

    return result
  }

  private updateLastRefreshed(response: Response) {
    if (response && response.status == 200) {
        this.lastRefreshed = Date.now()
    }
  }

  private async get(resource: string, endpoint: string = "default", ignoreFails = false, options = {headers: {}}) {
    const getOptions = {
      url: await this.getResourceUrl(resource, endpoint),
      method: "get",
      headers: options.headers
    }
    return Http
      .get(getOptions)
      .catch((err) => {
        this.updateConnectionState(ignoreFails, false);
        console.warn("Connection err", err)
      })
      .then((response: Response) => this.validateResponse(ignoreFails, response));
  }

  private async post(resource: string, data: any, endpoint: string = "default", ignoreFails = false, options = { headers: {}}) {
    if(!options.headers.hasOwnProperty("Content-Type")){
      options.headers = { ...options.headers, ...{ 'Content-Type':this.getContentType(data)}}
    }
    
    const postOptions = {
      url: await this.getResourceUrl(resource, endpoint),
      headers: options.headers,
      data: this.formatPostData(data),
      method: "post",
    }
    return Http

      .post(postOptions) //options)
      .catch((err) => {
        this.updateConnectionState(ignoreFails, false);
        console.warn("Connection err", err)
      })
      .then((response: Response) => this.validateResponse(ignoreFails, response));
  }

  private async legacyGet(resource: string, endpoint: string = "default", ignoreFails = false, options = {headers: {}}) {
    return this.httpLegacy
      .get(await this.getResourceUrl(resource, endpoint), options)
      .catch((err) => {
        this.updateConnectionState(ignoreFails, false);
        console.warn("Connection err", err)
      })
      .then((response: AxiosResponse<any>) => this.validateResponseLegacy(ignoreFails, response));
  }

  private async legacyPost(resource: string, data: any, endpoint: string = "default", ignoreFails = false, options = { headers: {} }) {
    if(!options.headers.hasOwnProperty("Content-Type")){
      options.headers = { ...options.headers, ...{ 'Content-Type':this.getContentType(data)}}
    }
    const resp = await fetch(
      await this.getResourceUrl(resource, endpoint),
       {
           method: 'POST',
           body: JSON.stringify(this.formatPostData(data)),
           headers: options.headers
       }
    )
    if (resp) {
      return resp.json()
    } else {
      return null
    }
  }

  private async isIOS15(): Promise<boolean> {
    const osVersion = (await Device.getInfo()).osVersion
    if(!osVersion) return false
    const splitVersion = osVersion.split(".")
    if(!splitVersion || splitVersion.length < 1) return false
    const majorVersion = parseInt(splitVersion[0])
    if(isNaN(majorVersion)) return false
    return (await Device.getInfo()).platform == "ios" && majorVersion >= 15
  }

  private getContentType(data: any): string {
    if (data instanceof FormDataContainer) return "application/x-www-form-urlencoded"
    return "application/json"
    
  }

  private formatPostData(data: any) {
    if (data instanceof FormDataContainer) return data.getBody()
    return data
  }

  private updateConnectionState(ignoreFails: boolean, working: boolean) {
    if (ignoreFails) return
    this.connectionStateOK = working
    console.log(LOGTAG + " setting status", working)
  }

  private validateResponseLegacy(ignoreFails, response: AxiosResponse<any>): Response {
    if (!response || !response.data) { // || !response.data.data
      this.updateConnectionState(ignoreFails, false)
      return
    }
    this.updateConnectionState(ignoreFails, true)
    return {
      cached: false,
      data: response.data,
      status: response.status,
      headers: response.headers,
      url: response.config.url,
    }
  }

  private validateResponse(ignoreFails, response: Response): Response {
    if (!response || !response.data) { // || !response.data.data
      this.updateConnectionState(ignoreFails, false)
      return
    }
    this.updateConnectionState(ignoreFails, true)
    return response;
  }

  async getResourceUrl(resource: string, endpoint: string = "default"): Promise<string> {
    const base = await this.getBaseUrl()
    if (endpoint == "default") {
      return await this.getApiBaseUrl() + "/" + resource;
    } else {
      const substitute = endpoint.replace("{$BASE}", base)
      return substitute + "/" + resource
    }
  }

  async getApiBaseUrl() {
    const cfg = await this.networkConfig
    const base = await this.getBaseUrl()
    return await this.getBaseUrl() + cfg.endpoint + cfg.version
  }

  async getBaseUrl(): Promise<string> {
    const cfg = await this.networkConfig
    return cfg.protocol + "://" + cfg.net + cfg.host
  }

  private async isDebugMode() {
    const devMode = isDevMode()
    if (devMode) return true
    const permanentDevMode = await this.storage.getObject("dev_mode")
    return permanentDevMode && permanentDevMode.enabled
  }

  async getAllTestNetNames() {
    const debug = await this.isDebugMode()
    const re: string[][] = []

    for (let entry of MAP) {
      if (entry.key == "main") continue;
      if (!entry.active) continue;
      if (entry.onlyDebug && !debug) continue;
      re.push([this.capitalize(entry.key) + " (Testnet)", entry.key])
    }
    return re
  }

  capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

}

interface Response extends HttpResponse {
  cached: boolean
}