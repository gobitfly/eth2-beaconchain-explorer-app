import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { ApiService } from 'src/app/services/api.service';
import {  StorageService } from 'src/app/services/storage.service';
import { AlertService, SETTINGS_PAGE } from '../services/alert.service';
import { SyncService } from '../services/sync.service';
import FirebaseUtils from '../utils/FirebaseUtils';
import { GetMobileSettingsRequest, MobileSettingsResponse } from '../requests/requests';
import { Injectable } from '@angular/core';

import {  NotificationFilter, CurrentNotificationSubsRequest } from '../requests/requests';
import { SETTING_NOTIFY, SETTING_NOTIFY_ATTESTATION_MISSED, SETTING_NOTIFY_CLIENTUPDATE, SETTING_NOTIFY_CPU_WARN, SETTING_NOTIFY_DECREASED, SETTING_NOTIFY_HDD_WARN, SETTING_NOTIFY_MACHINE_OFFLINE, SETTING_NOTIFY_MEMORY_WARN, SETTING_NOTIFY_PROPOSAL_MISSED, SETTING_NOTIFY_PROPOSAL_SUBMITTED, SETTING_NOTIFY_SLASHED } from '../utils/Constants'
import { ValidatorUtils } from '../utils/ValidatorUtils';
import MachineUtils from '../utils/MachineUtils';


const LOCKED_STATE = "locked_v2"

@Injectable({
  providedIn: 'root'
})
export class NotificationBase implements OnInit {

  notifyInitialized = false

  notify: boolean
  notifySlashed: boolean
  notifyDecreased: boolean
  notifyClientUpdate: boolean
  notifyProposalsSubmitted: boolean
  notifyProposalsMissed: boolean
  notifyAttestationsMissed: boolean

  notifyMachineOffline: boolean
  notifyMachineDiskFull: boolean
  notifyMachineCpuLoad: boolean
  notifyMachineMemoryLoad: boolean

  constructor(
    protected api: ApiService,
    protected storage: StorageService,
    protected firebaseUtils: FirebaseUtils,
    protected platform: Platform,
    protected alerts: AlertService,
    protected sync: SyncService,
    protected validatorUtil: ValidatorUtils,
    protected machineUtil: MachineUtils
  ) { 
  }

  ngOnInit() {
    this.notifyInitialized = false
  }

  // changes a toggle without triggering onChange
  lockedToggle = true;
  public changeToggleSafely(func: () => void) {
    this.lockedToggle = true;
    func()
  }

  public async getDefaultNotificationSetting() {
    if (this.platform.is("ios")) return false // iOS users need to grant notification permission first
    else return await this.firebaseUtils.hasNotificationToken() // on Android, enable as default when token is present
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

  public async loadPreferences(net: string) {
    const machines = await this.machineUtil.getAllMachineNames()
    const validators = await (await this.validatorUtil.getAllMyValidators()).map(v => v.pubkey)
    const preferences = await this.storage.getNotificationTogglePreferences(net, validators, machines)

    this.lockedToggle = true
    this.notifySlashed = preferences.notifySlashed

    // this.notifyDecreased = preferences.notifyDecreased

    this.notifyClientUpdate = preferences.notifyClientUpdate

    this.notifyProposalsSubmitted = preferences.notifyProposalsSubmitted
    this.notifyProposalsMissed = preferences.notifyProposalsMissed

    this.notifyAttestationsMissed = preferences.notifyAttestationsMissed

    this.notifyMachineCpuLoad = preferences.notifyMachineCpuWarn
    this.notifyMachineDiskFull = preferences.notifyMachineHddWarn
    this.notifyMachineOffline = preferences.notifyMachineOffline
    this.notifyMachineMemoryLoad = preferences.notifyMachineMemoryLoad
    return preferences
  }

  remoteNotifyLoadedOnce = false
  public async loadNotifyToggles() {
    const net = (await this.api.networkConfig).networkName
    
    // locking toggle so we dont execute onChange when setting initial values
    const preferences = await this.loadPreferences(net)
    // console.log('checking if mainnet')
    // if (await this.api.isNotMainnet()) {
    //   this.lockedToggle = true
    //   this.notify = preferences.notify
    //   this.notifyInitialized = true;
    //   this.disableToggleLock()
    //   return;
    // }

    await this.getNotificationSetting(preferences.notify).then(result => {
      this.lockedToggle = true
      this.notify = result
      this.disableToggleLock()
    })


    this.disableToggleLock()

    console.log('remote settings loaded? ', this.remoteNotifyLoadedOnce)
    this.notifyInitialized = true;
    if (!this.remoteNotifyLoadedOnce) {
      const remoteNofiy = await this.getRemoteNotificationSetting(preferences.notify)
 
      this.lockedToggle = true
      if (remoteNofiy != this.notify) {
        this.notify = remoteNofiy
      }
      await this.getRemoteNotificationSubscriptions()
      await this.loadPreferences(net)
      
      this.disableToggleLock()
      this.remoteNotifyLoadedOnce = true
    }
  }

  async notifyToggle() {
    if (this.lockedToggle) {
      return;
    }

    if (!(await this.isSupportedOnAndroid())) return

    if (await this.firebaseUtils.hasConsentDenied()) {
      this.changeToggleSafely(() => { this.notify = false })
      this.firebaseUtils.alertIOSManuallyEnableNotifications()
      return
    }

    if (this.notify === false) {
      this.notifyAttestationsMissed = this.notify
      this.notifyDecreased = this.notify
      this.notifyProposalsMissed = this.notify
      this.notifyProposalsSubmitted = this.notify
      this.notifySlashed = this.notify
      this.notifyClientUpdate = this.notify
      this.notifyMachineCpuLoad = this.notify
      this.notifyMachineDiskFull = this.notify
      this.notifyMachineOffline = this.notify
    }

    const net = (await this.api.networkConfig).networkName
    this.storage.setBooleanSetting(net + SETTING_NOTIFY, this.notify)
    
    // if(! (await this.api.isNotMainnet())){
      console.log('queuing for change: ', this.notify)
    this.sync.changeGeneralNotify(net, this.notify)
    // }

    if (this.notify) this.firebaseUtils.registerPush(true)
  }
    
  private async getRemoteNotificationSetting(notifyLocalStore): Promise<boolean> {
    const req : [Promise<boolean>, Promise<MobileSettingsResponse>] =  [this.getNotificationSetting(notifyLocalStore), this.getRemoteNotificationSettingResponse()]
    const [local, remote] = await Promise.all(req)

    
    if (remote && notifyLocalStore) {
      console.log("Returning notification enabled remote state:", remote.notify_enabled)
      return remote.notify_enabled
    }
    return local
  }

  private async getNotificationSetting(notifyLocalStore): Promise<boolean> {
    const local = (notifyLocalStore != null) ? notifyLocalStore : await this.getDefaultNotificationSetting()

    console.log("Returning notification enabled local state:", local)
    return local
  }

  private async getRemoteNotificationSubscriptions(filter?: NotificationFilter): Promise<boolean> {
    const loggedIn = await this.storage.isLoggedIn()
    if (!loggedIn) return false
  
    const request = new CurrentNotificationSubsRequest(filter);
   
    const response = await this.api.execute(request);
    const result = request.wasSuccessfull(response);
    this.storage.keys()
    if (!result) {
      return false
    }
    for (let i = 0; i < response.data.length; i++) {
      console.log('setting boolean setting: ', response.data[i].EventName, response.data[i].EventFilter)
      if(response.data[i].EventFilter) {
        this.storage.setBooleanSetting(response.data[i].EventName + ":" + response.data[i].EventFilter, true)
      } else {
        this.storage.setBooleanSetting(response.data[i].EventName, true)
      }
    }
    return true
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
      SETTING_NOTIFY_CLIENTUPDATE,
      this.notifyClientUpdate
    )
  }


  private getNotifySettingName(eventName: string): string {
    // replace the network prefix
    switch (eventName) {
      case "validator_balance_decreased": return SETTING_NOTIFY_DECREASED
      case "validator_got_slashed": return SETTING_NOTIFY_SLASHED
      case "validator_proposal_submitted": return SETTING_NOTIFY_PROPOSAL_SUBMITTED
      case "validator_proposal_missed": return SETTING_NOTIFY_PROPOSAL_MISSED
      case "validator_attestation_missed": return SETTING_NOTIFY_ATTESTATION_MISSED
      case "monitoring_machine_offline": return SETTING_NOTIFY_MACHINE_OFFLINE
      case "monitoring_cpu_load": return SETTING_NOTIFY_CPU_WARN
      case "monitoring_hdd_almostfull": return SETTING_NOTIFY_HDD_WARN
      case "monitoring_memory_usage": return SETTING_NOTIFY_MEMORY_WARN
      default: return null
    }
  }

  private getToggleFromEvent(eventName) {
    // replace the network prefix
    switch (eventName) {
      case "validator_balance_decreased": return this.notifyDecreased
      case "validator_got_slashed": return this.notifySlashed
      case "validator_proposal_submitted": return this.notifyProposalsSubmitted
      case "validator_proposal_missed": return this.notifyProposalsMissed
      case "validator_attestation_missed": return this.notifyAttestationsMissed
      case "monitoring_machine_offline": return this.notifyMachineOffline
      case "monitoring_cpu_load": return this.notifyMachineCpuLoad
      case "monitoring_hdd_almostfull": return this.notifyMachineDiskFull
      case "monitoring_memory_usage": return this.notifyMachineMemoryLoad
      default: return null
    }
  }

  async notifyEventToggle(eventName, filter = null, threshold = null) {
    console.log("notifyEventToggle", this.lockedToggle)
    if (this.lockedToggle) {
      return;
    }

    this.sync.changeNotifyEvent(
      this.getNotifySettingName(eventName),
      eventName,
      this.getToggleFromEvent(eventName),
      filter,
      threshold
    )
  }

  // include filter in key (fe used by machine toggles)
  async notifyEventFilterToggle(eventName, filter = null, threshold = null) {
    console.log("notifyEventToggle", this.lockedToggle)
    if (this.lockedToggle) {
      return;
    }
    let key = this.getNotifySettingName(eventName) + filter
    let value = this.getToggleFromEvent(eventName)

    this.storage.setBooleanSetting(this.getNotifySettingName(eventName), value)

    this.sync.changeNotifyEventUser(
      key,
      eventName,
      value,
      filter,
      threshold
    )
  }
    
    
  public disableToggleLock() {
    setTimeout(() => {
      this.lockedToggle = false
    }, 300)
  }

}
