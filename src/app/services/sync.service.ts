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
import { ApiService } from './api.service';
import { SETTING_NOTIFY, SETTING_NOTIFY_CLIENTUPDATE, StorageService } from './storage.service';
import { Mutex } from 'async-mutex';
import { BundleSub, NotificationBundleSubsRequest, SetMobileSettingsRequest } from '../requests/requests';
import ClientUpdateUtils, { ETH1_CLIENT_SAVED, ETH2_CLIENT_SAVED } from '../utils/ClientUpdateUtils';
import { ValidatorSyncUtils } from '../utils/ValidatorSyncUtils';

const NOTIFY_SYNCCHANGE = "notify_syncchange_"

const MAX_SERVER_BUNDLE_SIZE = 100

interface SyncChanged {
  lastChanged: number,
  lastSynced: number,
  eventName: string,
  network: string,
  eventFilter?: string,
  eventThreshold?: number
}

enum SyncActionEvent {
  NOTIFY_GLOBAL,
  NOTIFY_CLIENTUPDATE,
  ETH1_UPDATE,
  ETH2_UPDATE,
  NOTIFICATIONS
}

interface BundleSubWithAction extends BundleSub{
  onComplete: (boolean) => void
}

interface BundleSubContainer {
  bundle: BundleSubWithAction,
  network: string,
  enabled: boolean
}

interface NetworkBundle {
  bundles: BundleSubWithAction[],
  network: string,
  subscribe: boolean
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {

  private syncLock = new Mutex()
  private lastNotifySync = 0
  private bundleList: BundleSubContainer[] = []

  constructor(
    private api: ApiService,
    private storage: StorageService,
    private validatorSyncUtils: ValidatorSyncUtils,
    private updateUtils: ClientUpdateUtils,
  ) { }

  public async mightSyncUpAndSyncDelete() {
    await this.validatorSyncUtils.mightSyncUpAndSyncDelete(
      () => { this.syncAllSettingsForceStaleNotifications() }
    )
  }

  public async fullSync() {
    await this.validatorSyncUtils.fullSync(
      () => { this.syncAllSettingsForceStaleNotifications() }
    )
  }

  public async syncDown() {
    await this.validatorSyncUtils.syncDown()
  }

  async syncAllSettings() {
    const loggedIn = await this.storage.isLoggedIn()
    if (!loggedIn) return false

    if (this.syncLock.isLocked()) return

    if (this.lastNotifySync + (2 * 60 * 1000) > Date.now()) {
      console.log("Syncing notify cancelled, last update was less than 2 minutes ago")
      return;
    }

    console.log("== Syncing notify ==")

    const unlock = await this.syncLock.acquire();
    this.bundleList = []

    const allNotifyKeys = await this.getAllSyncChangeKeys()
    for (const key of allNotifyKeys) {
      const cleanKey = key.replace(NOTIFY_SYNCCHANGE, "")
      const syncAction = this.getSyncAction(cleanKey)

      await this.syncSingle(
        cleanKey,
        syncAction
      )
    }

    await this.postNotifyBundles()

    unlock();

    console.log("== Syncing notify completed ==")
  }

  async syncAllSettingsForceStaleNotifications() {
    const loggedIn = await this.storage.isLoggedIn()
    if (!loggedIn) return false

    const allNotifyKeys = await this.getAllSyncChangeKeys()
    for (const key of allNotifyKeys) {
      const cleanKey = key.replace(NOTIFY_SYNCCHANGE, "")
      const syncAction = this.getSyncActionEvent(cleanKey)
      console.log("STALE CHECK " + cleanKey, syncAction)

      if (syncAction == SyncActionEvent.NOTIFICATIONS) {
        const temp = await this.getChanged(cleanKey)
        console.log("== STALING " + cleanKey + " ==", temp)
        this.setLastChanged(cleanKey, temp.eventName, temp.eventFilter, temp.eventThreshold)
      }
    }

    this.syncAllSettings()
  }

  async developDeleteQueue() {
    if (!this.api.debug) return false

    const allNotifyKeys = await this.getAllSyncChangeKeys()
    for (const key of allNotifyKeys) {
      this.storage.remove(key)
    }
  }

  private getSyncAction(key: string): (syncChange: SyncChanged, onComplete: (boolean) => void) => Promise<boolean> {
    const actionEvent = this.getSyncActionEvent(key)

    if (actionEvent == SyncActionEvent.NOTIFY_GLOBAL) {
      return async (_) => {
        const currentValue = await this.storage.getBooleanSetting(key)
        return this.updateRemoteGeneralNotifySettings(currentValue)
      }
    } else if (actionEvent == SyncActionEvent.NOTIFY_CLIENTUPDATE) {
     return this.getClientUpdateNotifySyncAction()
    } 
    else if (actionEvent == SyncActionEvent.ETH2_UPDATE) {
      return this.getClientUpdateSyncAction(ETH2_CLIENT_SAVED)
    } else if (actionEvent == SyncActionEvent.ETH1_UPDATE) {
      return this.getClientUpdateSyncAction(ETH1_CLIENT_SAVED)
    }

    return this.getNotifySubSyncAction(key, null)
  }

  async getClientUpdateFilter(clientKey): Promise<any> {
    const client = await this.updateUtils.getClient(clientKey)
    if (!client) {
      return new Error("No clients configured");
    }
    return client.toLocaleLowerCase()
  }

  getGeneralFilter(item: SyncChanged): string {
    return item.eventFilter
  }

  getNotifySubSyncAction (key, oldFilter: Promise<any> | null) {
    return async (syncChange: SyncChanged, superOnComplete: (boolean) => void) => {
      const currentValue = await this.storage.getBooleanSetting(key)

      // Filter handler for client updates
      // TODO: refactor to use new the new simpler filter handler
      var resolvedFilter = oldFilter ? await oldFilter : null
      if(resolvedFilter && resolvedFilter instanceof Error){
        console.log("Error resolving filter", resolvedFilter)
        // this case only fails if no eth clients are configured and we want to sync
        // client update notification settings. In this case, we drop the sync request
        // since there is nothing to sync (returning true)
        return true
      }
      // ^== TODO

      if (resolvedFilter == null) {
        resolvedFilter = this.getGeneralFilter(syncChange)
      }

      this.queueForPost(currentValue, syncChange.network, {
        event_name: syncChange.eventName,
        event_filter: resolvedFilter,
        event_threshold: syncChange.eventThreshold,
        onComplete: superOnComplete
      })
    }
  }

  getSyncActionEvent(key: string) {
    if (key.endsWith(SETTING_NOTIFY)) {
      return SyncActionEvent.NOTIFY_GLOBAL
    } else if (key.endsWith(SETTING_NOTIFY_CLIENTUPDATE)) {
      return SyncActionEvent.NOTIFY_CLIENTUPDATE
    } else if (key.endsWith(ETH2_CLIENT_SAVED)) {
      return SyncActionEvent.ETH2_UPDATE
    } else if (key.endsWith(ETH1_CLIENT_SAVED)) {
      return SyncActionEvent.ETH1_UPDATE
    }

    return SyncActionEvent.NOTIFICATIONS
  }

  private getClientUpdateNotifySyncAction() {
    const eth2Success = this.getNotifySubSyncAction(SETTING_NOTIFY_CLIENTUPDATE,
      this.getClientUpdateFilter(ETH2_CLIENT_SAVED)
    )

    const eth1Success = this.getNotifySubSyncAction(SETTING_NOTIFY_CLIENTUPDATE,
      this.getClientUpdateFilter(ETH1_CLIENT_SAVED)
    )

    return async (syncChange, onComplete): Promise<boolean> => {
      return await eth1Success(syncChange, onComplete) && await eth2Success(syncChange, onComplete)
    }
  }

  private getClientUpdateSyncAction(key){
    return async (syncChange: SyncChanged, superOnComplete: (boolean) => void) => {
      const oldClient = await this.getDeleteOldClient(key)
      if (oldClient) {
        this.queueForPost(
          false, syncChange.network, {
            event_name: syncChange.eventName,
            event_filter: oldClient.toLocaleLowerCase(),
            event_threshold: syncChange.eventThreshold, 
            onComplete: (success) => {
              superOnComplete(success)

              if (!success) return
              this.setDeleteOldClient(key, null)
            }
          }
        )        
      }
      const filter = this.getClientUpdateFilter(key)
      return this.getNotifySubSyncAction(SETTING_NOTIFY_CLIENTUPDATE, filter)(syncChange, superOnComplete)
    }
  }


  private queueForPost(enabled: boolean, network: string, bundle: BundleSubWithAction) {
    this.bundleList.push({
      bundle: bundle,
      enabled: enabled,
      network: network
    })
  }

  private getNetworkBundles(filterEnabled: boolean): NetworkBundle[] {
    // Prepare by filtering to networks
    var networkMap = new Map<string, BundleSubWithAction[]>()
    this.bundleList.forEach((it) => {
      if (it.enabled == filterEnabled) {
        var array: BundleSubWithAction[] = []
        if (networkMap.has(it.network)) {
          array = networkMap.get(it.network)
        }
              
        array.push(it.bundle)
        networkMap.set(it.network, array)
      }
    })

    // Adding all networks in an array for return
    var result: NetworkBundle[] = []
    networkMap.forEach((value, key) => {
      result.push({
        bundles: value,
        network: key,
        subscribe: filterEnabled
      })
    })
    return result
  }

  private getBundles(): NetworkBundle[] {
    return this.getNetworkBundles(true).concat(this.getNetworkBundles(false))
  }

  async postNotifyBundles() {
    let bundles = this.getBundles()
    for (var i = 0; i < bundles.length; i++) {
      let bundle = bundles[i]
      while (bundle.bundles.length) {
        let splice = bundle.bundles.splice(0,MAX_SERVER_BUNDLE_SIZE) 
        let success = await this.postNotifyBundle(bundle.subscribe, splice, bundle.network)
        if (success) this.lastNotifySync = Date.now()
        
        for (var j = 0; j < splice.length; j++){
          await splice[j].onComplete(success)
        }
      }
    }
  }

  private async postNotifyBundle(subscribe: boolean, data: BundleSub[], network: string): Promise<boolean> {
    const loggedIn = await this.storage.isLoggedIn()
    if (!loggedIn) return false

    const request = new NotificationBundleSubsRequest(subscribe, data);
    if (network) {
      request.endPoint = network
    }

    const response = await this.api.execute(request)
    const result = request.wasSuccessfull(response) 
    if (!result) {
      return false
    }

    return true
  }

  private async updateRemoteGeneralNotifySettings(value): Promise<boolean> {
    const req = new SetMobileSettingsRequest(value)
    const resp = await this.api.execute(req)
    const result = req.parse(resp)
    if (!result || (result.length >= 0 && result[0].notify_enabled != value)) {
      return false
    }
    return true
  }

  private async syncSingle(key: string, syncAction: (syncChange: SyncChanged, onComplete: (boolean) => void) => Promise<boolean>) {
    const syncChange = await this.getChanged(key)
    if (syncChange.eventName == "") {
      console.log("== Sync notify: (key) " + key + " has no event name, abort")
      return
    }

    if (syncChange.lastChanged > syncChange.lastSynced) {
      console.log("== Syncing notify: " + key + " changed, updating on remote... ==")
      const actionPromise = syncAction(syncChange, (success) => {
        if (success) {
          console.log("== Syncing notify: " + key + " synced successfully! ==")
          this.setLastSynced(key, syncChange.eventName)
        }
      })
      await actionPromise

      return true
    }
    return false
  }

  async changeETH2Client(value: string) {
    const oldValue = await this.updateUtils.getETH2Client()
    const changed = await this.updateUtils.setETH2Client(value)
    if (changed) {
      this.setLastChanged(ETH2_CLIENT_SAVED, "eth_client_update", null, null)
      this.setDeleteOldClient(ETH2_CLIENT_SAVED, oldValue)
    }
  }

  async changeETH1Client(value: string) {
    const oldValue = await this.updateUtils.getETH1Client()
    const changed = await this.updateUtils.setETH1Client(value)
    if (changed) {
      this.setLastChanged(ETH1_CLIENT_SAVED, "eth_client_update", null, null)
      this.setDeleteOldClient(ETH1_CLIENT_SAVED, oldValue)
    }
  }

  private async getDeleteOldClient(key: string): Promise<string> {
    const temp = await this.storage.getItem("UNSYNCED_OLD" + key)
    if (temp && temp.length >= 1) return temp
    return null
  }

  private setDeleteOldClient(key: string, value: string) {
    this.storage.setItem("UNSYNCED_OLD" + key, value)
  }

  async changeGeneralNotify(value: boolean, filter: string = null) {
    this.storage.setBooleanSetting(SETTING_NOTIFY, value)
    this.setLastChanged(SETTING_NOTIFY, SETTING_NOTIFY, filter, null)
  }

  async changeNotifyEvent(key: string, event: string, value: boolean, filter: string = null, threshold: number = null) {
    const net = (await this.api.networkConfig).net
    this.storage.setBooleanSetting(net + key, value)
    this.setLastChanged(net + key, event, filter, threshold)
  }

  async changeNotifyEventUser(key: string, event: string, value: boolean, filter: string = null, threshold: number = null) {
    this.storage.setBooleanSetting(key, value)
    this.setLastChanged( key, event, filter, threshold)
  }

  async reapplyNotifyEvent(key: string, event: string, filter: string = null): Promise<boolean> {
    const currentKey = await this.findSimilarChanged(key)
    if (currentKey == null) {
      console.log("ignoring reapplyNotifyEvent, no key with similar name found", key, event)
      return false
    }

    const current = await this.getChanged(currentKey)
    if (current.eventName == "") {
      console.log("ignoring reapplyNotifyEvent since no previous setting change has been found for event", key, event)
      return false
    }
    this.setLastChanged(key + filter, event, filter, current.eventThreshold)
    return true
  }

  changeNotifyClientUpdate(key: string, value: boolean, filter: string = null) {
    this.storage.setBooleanSetting(key, value)
    this.setLastChanged(key, "eth_client_update", filter, null)
  }

  private async setLastSynced(key: string, event: string, value: number = Date.now()) {
    const current = await this.getChanged(key)
    this.setChanged(key, {
      lastChanged: current.lastChanged,
      lastSynced: value,
      eventName: event,
      network: await this.api.getApiBaseUrl(),
      eventFilter: current.eventFilter,
      eventThreshold: current.eventThreshold
    })
  }

  private async setLastChanged(key: string, event: string, filter: string, threshold: number, value: number = Date.now()) {
    const current = await this.getChanged(key)
    this.setChanged(key, {
      lastChanged: value,
      lastSynced: current.lastSynced,
      eventName: event,
      network: await this.api.getApiBaseUrl(),
      eventFilter: filter,
      eventThreshold: threshold
    })
  }

  private async getAllSyncChangeKeys() {
    return await this.storage.findAllKeys(NOTIFY_SYNCCHANGE)
  }

  private setChanged(key: string, syncChanged: SyncChanged) {
    this.storage.setObject(NOTIFY_SYNCCHANGE + key, syncChanged)
  }

  private async getChanged(key: string): Promise<SyncChanged> {
    const temp: SyncChanged = await this.storage.getObject(NOTIFY_SYNCCHANGE + key)
    if (temp && temp.lastChanged) return temp
    return {
      lastChanged: 0,
      lastSynced: 0,
      eventName: "",
      network: await this.api.getApiBaseUrl(),
      eventFilter: null,
      eventThreshold: null
    }
  }

  // finds newest changed key with similar name
  private async findSimilarChanged(keySearch: string) {
    var erg: string = null
    var ergRetrieved: SyncChanged
    const allNotifyKeys = await this.getAllSyncChangeKeys()
    for (const key of allNotifyKeys) {
      const cleanKey = key.replace(NOTIFY_SYNCCHANGE, "")
      if (cleanKey.indexOf(keySearch) >= 0) {
        if (erg == null) {
          erg = cleanKey
          ergRetrieved = await this.getChanged(key)
        }
        else {
          const retrieved = await this.getChanged(key)
          if (retrieved.lastChanged > ergRetrieved.lastChanged) {
            erg = cleanKey
            ergRetrieved = await this.getChanged(key)
          }
        }
      }
    }
    return erg
  }
}