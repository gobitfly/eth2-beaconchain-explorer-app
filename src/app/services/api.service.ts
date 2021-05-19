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
import axios, { AxiosResponse } from "axios";
import { APIRequest, Method, RefreshTokenRequest } from "../requests/requests";
import localforage from "localforage";
import { IAxiosCacheAdapterOptions, setupCache } from "axios-cache-adapter";
import { StorageService } from './storage.service';
import { ApiNetwork } from '../models/StorageTypes';
import { isDevMode } from "@angular/core"
import { Mutex } from 'async-mutex';
import { MAP } from '../utils/NetworkData'
import { AlertService } from './alert.service';

const LOGTAG = "[ApiService]";
var cacheKey = "api-cache"

const forageStore = localforage.createInstance({
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
  name: cacheKey,
});

const cache = setupCache({
  maxAge: 5 * 60 * 1000, // 5 min cache time
  store: forageStore,
  readHeaders: false,
  exclude: { query: false },
});

const SERVER_TIMEOUT = 25000

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  networkConfig: Promise<ApiNetwork>

  public connectionStateOK = true

  public isAuthorized = false

  awaitingResponses: Map<string, Mutex> = new Map()

  debug = false

  public lastRefreshed = 0 // only updated by calls that have the updatesLastRefreshState flag enabled

  constructor(
    private storage: StorageService
  ) {
    this.isDebugMode().then((result) => {
      this.debug = result
      this.disableLogging()
    }) 

    this.registerLogMiddleware()
    this.updateNetworkConfig()
  }

  private http = axios.create({
      timeout: SERVER_TIMEOUT,
      adapter: cache.adapter
    }
  );

  mayInvalidateOnFaultyConnectionState() {
    if(!this.connectionStateOK) this.invalidateCache()
  }

  invalidateCache() {
    console.log("invalidating request cache")
    // @ts-ignore
    cache.store.clear()
    forageStore.clear()
    this.storage.invalidateAllCache()
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
      if (!user || !user.accessToken) return null
    }

    return {
      Authorization: 'Bearer ' + user.accessToken
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
    const resp = await this.execute(req)
    const result = req.parse(resp)

    console.log("Refresh token", result, resp)
    if (!result || result.length <= 0 || !result[0].access_token) {
      console.warn("could not refresh token", result)
      return null

      /*if (result && result[0]) {
        this.alertService.showInfo("Login Expired", "Please log back in to receive further notifications.")
        this.storage.setAuthUser(null)
      }
      return*/
    }

    user.accessToken = result[0].access_token
    user.expiresIn = now + (result[0].expires_in * 1000)

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


  async execute(request: APIRequest<any>) {
    var options = request.options

   // if (request.requiresAuth) {

      const authHeader = await this.getAuthHeader(request instanceof RefreshTokenRequest)
      if (authHeader) {

        const headers = { ...options.headers, ...authHeader }

        options.headers = headers;
      }
   // }

    if (!this.connectionStateOK) {
      options.clearCacheEntry = true
    }

    await this.lockOrWait(request.resource)


    var response: Promise<AxiosResponse<any>>
    switch (request.method) {
      case Method.GET:
        response = this.get(request.resource, request.endPoint, request.ignoreFails, options)
        break;
      case Method.POST:
        response = this.post(request.resource, request.postData, request.endPoint, request.ignoreFails, options)
        break;
      default:
        throw "Unsupported method: " + request.method;
    }

    const result = await response
    if (request.updatesLastRefreshState) this.updateLastRefreshed(result)

    this.unlock(request.resource)
    return result
  }


  private updateLastRefreshed(response: AxiosResponse<any>) {
    if (response.status == 200) {
      const cached = response.request.fromCache == true;
      if (!cached || this.lastRefreshed == 0) {
        this.lastRefreshed = Date.now()
      }
    }
  }

  private async get(resource: string, endpoint: string = "default", ignoreFails = false, options = {}) {
    return this.http
      .get(await this.getResourceUrl(resource, endpoint), options)
      .catch((err) => {
        this.updateConnectionState(ignoreFails, false);
        console.warn("Connection err", err)
      })
      .then((response: AxiosResponse<any>) => this.validateResponse(ignoreFails, response));
  }

  private async post(resource: string, data: any, endpoint: string = "default", ignoreFails = false, options = {}) {
    return this.http

      .post(await this.getResourceUrl(resource, endpoint), this.formatPostData(data), options)
      .catch((err) => {
        this.updateConnectionState(ignoreFails, false);
        console.warn("Connection err", err)
      })
      .then((response: AxiosResponse<any>) => this.validateResponse(ignoreFails, response));
  }

  private formatPostData(data: any) {
    if (data instanceof FormData) return data
    return JSON.stringify(data)
  }

  private updateConnectionState(ignoreFails: boolean, working: boolean) {
    if (ignoreFails) return
    this.connectionStateOK = working
    console.log(LOGTAG + " setting status", working)
  }

  private validateResponse(ignoreFails, response: AxiosResponse<any>): AxiosResponse<any> {
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

  private registerLogMiddleware() {
    this.http.interceptors.request.use(
      function (config) {
        console.log(LOGTAG + " Send request: " + config.url, config)
        return config;
      },
      function (error) {
        console.log(LOGTAG + " Request error:", error);
        return Promise.reject(error);
      }
    );

    this.http.interceptors.response.use(
      function (response) {
        const cached = response.request.fromCache == true;
        console.log(
          LOGTAG + " Response: " + (cached ? "(cached) " : "") + response.config.url + "",
          response
        );
        return response;
      },
      function (error) {
        console.log(LOGTAG + " Response error:", error);
        return Promise.reject(error);
      }
    );
  }

  private disableLogging() {
    if (!this.debug) {
      if (window) {
        window.console.log = function () { };
        window.console.info = function () { };
        window.console.warn = function () { };
      }
    }
  }
}
