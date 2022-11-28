import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { ApiService } from 'src/app/services/api.service';
import { CPU_THRESHOLD, HDD_THRESHOLD, OFFLINE_THRESHOLD, RAM_THRESHOLD, SETTING_NOTIFY, StorageService } from 'src/app/services/storage.service';
import { AlertService, SETTINGS_PAGE } from '../services/alert.service';
import { SyncService } from '../services/sync.service';
import FirebaseUtils from '../utils/FirebaseUtils';
import { GetMobileSettingsRequest, MobileSettingsResponse, NotificationGetRequest } from '../requests/requests';
import { Injectable } from '@angular/core';
import ClientUpdateUtils from '../utils/ClientUpdateUtils';

const LOCKED_STATE = "locked_v2"

@Injectable({
  providedIn: 'root'
})
export class NotificationBase implements OnInit {

  notifyInitialized = false

  notify: boolean  = false

  storageThreshold = 90
  cpuThreshold = 60
  memoryThreshold = 80

  maxCollateralThreshold = 100
  minCollateralThreshold = 0

  offlineThreshold = 3

  activeSubscriptionsPerEventMap = new Map<String, number>() // map storing the count of subscribed validators per event
  notifyTogglesMap = new Map<String, boolean>()

  smartnode: boolean
  mevboost: boolean

  constructor(
    protected api: ApiService,
    protected storage: StorageService,
    protected firebaseUtils: FirebaseUtils,
    protected platform: Platform,
    protected alerts: AlertService,
    protected sync: SyncService,
    protected clientUpdate: ClientUpdateUtils
  ) { }

  ngOnInit() {
    this.notifyInitialized = false
  }

  setToggle(eventName, event) {
    console.log("change toggle", eventName, event)
    this.notifyTogglesMap.set(eventName, event)
  }

  // changes a toggle without triggering onChange
  lockedToggle = true;
  public changeToggleSafely(func: () => void) {
    this.lockedToggle = true;
    func()
  }

  public async getDefaultNotificationSetting() {
    return await this.firebaseUtils.hasNotificationConsent() && await this.firebaseUtils.hasNotificationToken()
  }

  // Android registers firebase service at app start
  // So if there is no token present when enabling notifications,
  // there might be no google play services on this device
  private async isSupportedOnAndroid() {
    if (this.platform.is("android")) {
      const hasToken = await this.firebaseUtils.hasNotificationToken()
      if (!hasToken) {
        this.alerts.showError(
          "Play Service",
          "We could not enable notifications for your device which might be due to missing Google Play Services. Please note that notifications do not work without Google Play Services.",
          SETTINGS_PAGE + 2
        )
        this.changeToggleSafely(() => { this.notify = false })
        return false
      }
    }
    return true
  }

  remoteNotifyLoadedOnce = false
  public async loadNotifyToggles() {
    if (!(await this.storage.isLoggedIn())) return
    
    const net = (await this.api.networkConfig).net

    const request = new NotificationGetRequest()
    const response = await this.api.execute(request)
    const results = request.parse(response)
   
    var network = await this.api.getNetworkName()
    if (network == "main") {
      network = "mainnet"
    }
    console.log("result", results, network)

    var containsRocketpoolUpdateSub = false
    var containsMevboostUpdateSub = false
    for (const result of results) {
      this.setToggleFromEvent(result.EventName, network, true, net)
      if (result.EventName == "monitoring_cpu_load") {
        this.cpuThreshold = Math.round(parseFloat(result.EventThreshold) * 100)
        this.storage.setSetting(CPU_THRESHOLD, this.cpuThreshold) 
      }
      else if (result.EventName == network+":validator_is_offline") {
        this.offlineThreshold = Math.round(parseFloat(result.EventThreshold))
        this.storage.setSetting(OFFLINE_THRESHOLD, this.offlineThreshold)
      }
      else if (result.EventName == "monitoring_hdd_almostfull") {
        this.storageThreshold = Math.round(100 - (parseFloat(result.EventThreshold) * 100))
        this.storage.setSetting(HDD_THRESHOLD, this.storageThreshold)
      }
      else if (result.EventName == "monitoring_memory_usage") {
        
        this.memoryThreshold = Math.round(parseFloat(result.EventThreshold) * 100)
        this.storage.setSetting(RAM_THRESHOLD, this.memoryThreshold)
      }
      else if (result.EventName == network+":rocketpool_colleteral_max") {
        const threshold =  parseFloat(result.EventThreshold)
        if (threshold >= 0) {
          this.maxCollateralThreshold = Math.round(((threshold-1)*1000) + 100) //1 + ((this.maxCollateralThreshold - 100) / 1000)
        } else {
          this.maxCollateralThreshold = Math.round(((1-(threshold * -1))*1000) - 100) //(1 - ((this.maxCollateralThreshold + 100) / 1000)) * -1
        }

      }
      else if(result.EventName == network+":rocketpool_colleteral_min") {
        this.minCollateralThreshold = Math.round((parseFloat(result.EventThreshold)-1) *100) //1 + this.minCollateralThreshold / 100 
        console.log("minCollateralThreshold", result.EventThreshold, this.minCollateralThreshold)
      } else if (result.EventName == "eth_client_update") {
        if (result.EventFilter && result.EventFilter.length >= 1 && result.EventFilter.charAt(0).toUpperCase() != result.EventFilter.charAt(0) && result.EventFilter != "null" && result.EventFilter != "none") {
          this.clientUpdate.setUnknownLayerClient(result.EventFilter)
          if (result.EventFilter == "rocketpool") {
            this.smartnode = true
            containsRocketpoolUpdateSub = true
          } else if (result.EventFilter == "mev-boost") {
            this.mevboost = true
            containsMevboostUpdateSub = true
          }
        }
      }
  
    }

    if (!containsRocketpoolUpdateSub) {
      console.log("disabling rocketpool smartnode updates")
      this.clientUpdate.setRocketpoolClient(null)
      this.smartnode = false
    }

    if (!containsMevboostUpdateSub) {
      console.log("disabling mev boost updates")
      this.clientUpdate.setMevBoostClient(null)
      this.mevboost = false
    }
    
    // locking toggle so we dont execute onChange when setting initial values
    const preferences = await this.storage.loadPreferencesToggles(net)

    this.lockedToggle = true

    if (await this.api.isNotMainnet()) {
      this.lockedToggle = true
      this.notify = preferences
      this.notifyInitialized = true;
      this.disableToggleLock()
      return;
    }

    await this.getNotificationSetting(preferences).then((result) => {
      this.lockedToggle = true
      this.notify = result
      this.disableToggleLock()
    })

    this.disableToggleLock()

    this.notifyInitialized = true;

    if (!this.remoteNotifyLoadedOnce) {
      const remoteNofiy = await this.getRemoteNotificationSetting(preferences)
      if (remoteNofiy != this.notify) {
        this.lockedToggle = true
        this.notify = remoteNofiy
        this.disableToggleLock()
      }
      this.remoteNotifyLoadedOnce = true
    }
  }

  async notifyToggle() {
    if (this.lockedToggle) {
      return;
    }

    if (!(await this.isSupportedOnAndroid())) return

    if (this.platform.is("ios") && await this.firebaseUtils.hasSeenConsentScreenAndNotConsented()) {
      this.changeToggleSafely(() => { this.notify = false })
      this.firebaseUtils.alertIOSManuallyEnableNotifications()
      return
    }

    if (this.notify == false) {
      for (const [key, value] of this.notifyTogglesMap) {
        this.notifyTogglesMap.set(key, this.notify)
      }
    }

    const net = (await this.api.networkConfig).net
    this.storage.setBooleanSetting(net + SETTING_NOTIFY, this.notify)
    
    if(! (await this.api.isNotMainnet())){
      this.sync.changeGeneralNotify(this.notify)
    }

    if (this.notify) this.firebaseUtils.registerPush(true)

    this.api.clearSpecificCache(new NotificationGetRequest())
  }
    
  private async getRemoteNotificationSetting(notifyLocalStore): Promise<boolean> {
    const local = await this.getNotificationSetting(notifyLocalStore)
    const remote = await this.getRemoteNotificationSettingResponse()

    if (remote && notifyLocalStore) {
      console.log("Returning notification enabled remote state:", remote.notify_enabled)
      return remote.notify_enabled
    }
    return local
  }

  private async getNotificationSetting(notifyLocalStore): Promise<boolean> {
    const local = (notifyLocalStore != null) ? notifyLocalStore : await this.getDefaultNotificationSetting()
    if( ! (await this.firebaseUtils.hasNotificationConsent())) return false
    console.log("Returning notification enabled local state:", local)
    return local
  }

  private async getRemoteNotificationSettingResponse(): Promise<MobileSettingsResponse> {
    const request = new GetMobileSettingsRequest()
    const response = await this.api.execute(request)
    const result = request.parse(response)
    if (result && result.length >= 1) return result[0]
    return null
  }
    
  notifyClientUpdates() {
    if (this.lockedToggle) {
      return;
    }

    this.sync.changeNotifyClientUpdate(
      "eth_client_update",
      this.notifyTogglesMap.get("eth_client_update")
    )
    this.api.clearSpecificCache(new NotificationGetRequest())
  }

  private getToggleFromEvent(eventName) {
    const toggle = this.notifyTogglesMap.get(eventName)
    return toggle
    /*switch (eventName) {
      case "validator_balance_decreased": return this.notifyDecreased
      case "validator_got_slashed": return this.notifySlashed
      case "validator_proposal_submitted": return this.notifyProposalsSubmitted
      case "validator_proposal_missed": return this.notifyProposalsMissed
      case "validator_attestation_missed": return this.notifyAttestationsMissed
      case "monitoring_machine_offline": return this.notifyMachineOffline
      case "monitoring_cpu_load": return this.notifyMachineCpuLoad
      case "monitoring_hdd_almostfull": return this.notifyMachineDiskFull
      case "monitoring_memory_usage": return this.notifyMachineMemoryLoad
      case "eth_client_update": return this.notifyClientUpdate 
      case "validator_synccommittee_soon": return this.notifySyncDuty
      case "rocketpool_new_claimround": return this.notifyRPLNewRewardRound
      case "rocketpool_colleteral_min": return this.notifyRPLMinColletaral
      case "rocketpool_colleteral_max": return this.notifyRPLMaxColletaral
      default: return null
    }*/
  }

  private setToggleFromEvent(eventNameTagges, network, value, net) {
    var parts = eventNameTagges.split(":")
    var eventName = eventNameTagges
    if (parts.length == 2) {
      if (parts[0] != network) { return }
      if (parts[1].indexOf("monitoring_") >= 0) { return; }
      if (parts[1].indexOf("eth_client_update") >= 0) { return; }
      eventName = parts[1]
    }

    this.notifyTogglesMap.set(eventName, value)
    const count = this.activeSubscriptionsPerEventMap.get(eventName)
    this.activeSubscriptionsPerEventMap.set(eventName, count ? count + 1 : 1)
    
    this.storage.setBooleanSetting(net + eventName, value)
  }

  getCount(eventName) {
    const count = this.activeSubscriptionsPerEventMap.get(eventName)
    return count ? count : 0
  }

  async notifyEventToggle(eventName, filter = null, threshold = null) {
    console.log("notifyEventToggle", this.lockedToggle)
    if (this.lockedToggle) {
      return;
    }

    this.sync.changeNotifyEvent(
      eventName,
      eventName,
      this.getToggleFromEvent(eventName),
      filter,
      threshold
    )
    this.api.clearSpecificCache(new NotificationGetRequest())
  }

  // include filter in key (fe used by machine toggles)
  async notifyEventFilterToggle(eventName, filter = null, threshold = null) {
    console.log("notifyEventToggle", this.lockedToggle)
    if (this.lockedToggle) {
      return;
    }
    let key = eventName + filter
    let value = this.getToggleFromEvent(eventName)

    this.storage.setBooleanSetting(eventName, value)

    this.sync.changeNotifyEventUser(
      key,
      eventName,
      value,
      filter,
      threshold
    )
    this.api.clearSpecificCache(new NotificationGetRequest())
  }
    
    
  public disableToggleLock() {
    setTimeout(() => {
      this.lockedToggle = false
    }, 300)
  }

}

