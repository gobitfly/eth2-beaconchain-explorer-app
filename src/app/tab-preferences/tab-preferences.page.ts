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

import { Component } from '@angular/core';
import { ApiService } from '../services/api.service';
import BigNumber from "bignumber.js";
import { StorageService, SETTING_NOTIFY, SETTING_NOTIFY_SLASHED, SETTING_NOTIFY_CLIENTUPDATE, SETTING_NOTIFY_DECREASED, SETTING_NOTIFY_PROPOSAL_SUBMITTED, SETTING_NOTIFY_PROPOSAL_MISSED, SETTING_NOTIFY_ATTESTATION_MISSED } from '../services/storage.service';
import { UnitconvService } from '../services/unitconv.service';
import { OAuthUtils } from '../utils/OAuthUtils';
import ClientUpdateUtils from '../utils/ClientUpdateUtils';
import ThemeUtils from '../utils/ThemeUtils';
import { findConfigForKey } from '../utils/NetworkData';
import { ModalController } from '@ionic/angular';
import { HelppagePage } from '../pages/helppage/helppage.page';
import { Plugins } from '@capacitor/core';
import { ValidatorUtils } from '../utils/ValidatorUtils';
import Unit, { MAPPING } from '../utils/EthereumUnits';
import { AlertController } from '@ionic/angular';
import { GetMobileSettingsRequest, MobileSettingsResponse } from '../requests/requests';
import FirebaseUtils from '../utils/FirebaseUtils';
import { Platform } from '@ionic/angular';
import { AlertService, SETTINGS_PAGE } from '../services/alert.service';
import { SyncService } from '../services/sync.service';
import { LicencesPage } from '../pages/licences/licences.page';
import { SubscribePage } from '../pages/subscribe/subscribe.page';
import { MerchantUtils } from '../utils/MerchantUtils';

const { Device } = Plugins;
const { Browser } = Plugins;
const { Toast } = Plugins;

const LOCK_KEY = "first_time_push_v6"
const LOCKED_STATE = "locked"

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab-preferences.page.html',
  styleUrls: ['tab-preferences.page.scss']
})
export class Tab3Page {

  fadeIn = "invisible"

  darkMode: boolean
  notify: boolean

  notifySlashed: boolean
  notifyDecreased: boolean
  notifyClientUpdate: boolean
  notifyProposalsSubmitted: boolean
  notifyProposalsMissed: boolean
  notifyAttestationsMissed: boolean

  eth1client: string
  eth2client: string

  network: string = "main"

  allTestNetworks: string[][]

  authUser

  updateChannel: string

  allCurrencies

  appVersion: string

  debug = false

  blocked = false

  notifyInitialized = false

  snowing: boolean

  stakingShare = null

  themeColor: string
<<<<<<< Updated upstream
=======
  widgetThemeColor: string
>>>>>>> Stashed changes
  currentPlan: string

  constructor(
    private api: ApiService,
    private oauth: OAuthUtils,
    public theme: ThemeUtils,
    public unit: UnitconvService,
    private storage: StorageService,
    private updateUtils: ClientUpdateUtils,
    private validatorUtils: ValidatorUtils,
    private modalController: ModalController,
    private alertController: AlertController,
    private firebaseUtils: FirebaseUtils,
    public platform: Platform,
    private alerts: AlertService,
    private sync: SyncService,
    private merchant: MerchantUtils
  ) { }

  ngOnInit() {
    this.notifyInitialized = false
    this.theme.isDarkThemed().then((result) => this.darkMode = result)
    this.theme.getThemeColor().then((result) => this.themeColor = result)

    this.updateUtils.getETH1Client().then((result) => this.eth1client = result)
    this.updateUtils.getETH2Client().then((result) => this.eth2client = result)
    this.updateUtils.getUpdateChannel().then((result) => this.updateChannel = result)

    this.loadNotifyToggles()
    this.theme.isWinterEnabled().then((result) => this.snowing = result)

    this.allCurrencies = this.getAllCurrencies()
    this.api.getAllTestNetNames().then(result => {
      this.allTestNetworks = result
    })

    Device.getInfo().then((result) => this.appVersion = result.appVersion)

    this.storage.getStakingShare().then((result) => this.stakingShare = result)

    this.merchant.getCurrentPlanConfirmed().then((result) => {
      // TODO: uncomment below to enforce
      //this.currentPlan = result
      this.currentPlan = "debug"
    })

    this.fadeIn = "fade-in"
    setTimeout(() => {
      this.fadeIn = null
    }, 1500)
  }

  // changes a toggle without triggering onChange
  private lockedToggle = true;
  private changeToggleSafely(func: () => void) {
    this.lockedToggle = true;
    func()
  }

<<<<<<< Updated upstream
=======
  changeWidgetTheme() {
    
  }

>>>>>>> Stashed changes
  themeColorLock = false
  changeThemeColor() {
    this.themeColorLock = true;
    this.theme.undoColor()
    setTimeout(() => {
      this.theme.toggle(this.darkMode, true, this.themeColor)
      this.themeColorLock = false;
    }, 250)
    
  }

  ionViewWillEnter() {
    this.storage.getAuthUser().then((result) => this.authUser = result)
    this.debug = this.api.debug
    this.api.getNetworkName().then((result) => {
      this.network = result
    })
  }

  private async loadNotifyToggles() {
    const net = (await this.api.networkConfig).net
    
    // locking toggle so we dont execute onChange when setting initial values
    const preferences = await this.storage.getNotificationTogglePreferences(net)

    this.lockedToggle = true
    this.notifySlashed = preferences.notifySlashed

    this.notifyDecreased = preferences.notifyDecreased

    this.notifyClientUpdate = preferences.notifyClientUpdate

    this.notifyProposalsSubmitted = preferences.notifyProposalsSubmitted
    this.notifyProposalsMissed = preferences.notifyProposalsMissed

    this.notifyAttestationsMissed = preferences.notifyAttestationsMissed

    if (await this.api.isNotMainnet()) {
      this.lockedToggle = true
      this.notify = preferences.notify
      this.notifyInitialized = true;
      this.disableToggleLock()
      return;
    }

    await this.getNotificationSetting(preferences.notify).then((result) => {
      this.lockedToggle = true
      this.notify = result
      this.disableToggleLock()
    })

    this.disableToggleLock()

    this.notifyInitialized = true;

    const remoteNofiy = await this.getRemoteNotificationSetting(preferences.notify)
    if (remoteNofiy != this.notify) {
      this.lockedToggle = true
      this.notify = remoteNofiy
      this.disableToggleLock()
    }

    setTimeout(() => this.firstTimePushAllNotificationSettings(), 200)
  }

  private disableToggleLock() {
    setTimeout(() => {
      this.lockedToggle = false
    }, 300)
  }

  private getAllCurrencies() {
    const erg = []
    MAPPING.forEach((value: Unit, key) => {
      if (value.settingName) {
        erg.push([
          [value.settingName], [key]
        ])
      }
    })
    return erg
  }

  darkModeToggle() {
    this.theme.toggle(this.darkMode)
  }

  private async getDefaultNotificationSetting() {
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

    if (await this.api.isNotMainnet()) {
      this.notifyAttestationsMissed = this.notify
      this.notifyDecreased = this.notify
      this.notifyProposalsMissed = this.notify
      this.notifyProposalsSubmitted = this.notify
      this.notifySlashed = this.notify

      const net = (await this.api.networkConfig).net
      this.storage.setBooleanSetting(net + SETTING_NOTIFY, this.notify)
    } else {
      this.sync.changeGeneralNotify(this.notify)
    }

    if (this.notify) this.firebaseUtils.registerPush(true)
  }

  overrideDisplayCurrency = null
  private changeCurrencyLocked = false
  changeCurrency() {
    if (this.changeCurrencyLocked) return
    this.changeCurrencyLocked = true;

    this.overrideDisplayCurrency = this.unit.pref

    this.unit.updatePriceData()
    this.unit.save()

    setTimeout(() => {
      this.changeCurrencyLocked = false;
      this.overrideDisplayCurrency = null
    }, 2500)
  }

  openOAuth() {
    this.oauth.login().then((success) => {
      if (success) {
        this.storage.getAuthUser().then((result) => this.authUser = result)
      }
    })
  }

  private async getRemoteNotificationSetting(notifyLocalStore): Promise<boolean> {
    const local = await this.getNotificationSetting(notifyLocalStore)
    const remote = await this.getRemoteNotificationSettingResponse()

    if (remote) {
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

  private async getRemoteNotificationSettingResponse(): Promise<MobileSettingsResponse> {
    const request = new GetMobileSettingsRequest()
    const response = await this.api.execute(request)
    const result = request.parse(response)
    if (result && result.length >= 1) return result[0]
    return null
  }

  private async firstTimePushAllNotificationSettings() {
    if (!this.notify) return

    const locked = await this.storage.getItem(LOCK_KEY)
    if (locked && locked == LOCKED_STATE) return;

    console.log("firstTimePushAllNotificationSettings is running")

    this.notifyEventToggle("validator_balance_decreased")
    this.notifyEventToggle("validator_got_slashed")
    this.notifyClientUpdates()

    //const v3LockPresent = await this.storage.getItem("first_time_push_v3")
    //if (!v3LockPresent) {
    this.notifyEventToggle("validator_proposal_submitted")
    this.notifyEventToggle("validator_proposal_missed")
    // }

    this.notifyEventToggle("validator_attestation_missed")

    this.storage.setItem(LOCK_KEY, LOCKED_STATE)
  }

  private getNotifySettingName(eventName: string): string {
    switch (eventName) {
      case "validator_balance_decreased": return SETTING_NOTIFY_DECREASED
      case "validator_got_slashed": return SETTING_NOTIFY_SLASHED
      case "validator_proposal_submitted": return SETTING_NOTIFY_PROPOSAL_SUBMITTED
      case "validator_proposal_missed": return SETTING_NOTIFY_PROPOSAL_MISSED
      case "validator_attestation_missed": return SETTING_NOTIFY_ATTESTATION_MISSED
      default: return null
    }
  }

  private getToggleFromEvent(eventName) {
    switch (eventName) {
      case "validator_balance_decreased": return this.notifyDecreased
      case "validator_got_slashed": return this.notifySlashed
      case "validator_proposal_submitted": return this.notifyProposalsSubmitted
      case "validator_proposal_missed": return this.notifyProposalsMissed
      case "validator_attestation_missed": return this.notifyAttestationsMissed
      default: return false
    }
  }

  async notifyEventToggle(eventName) {
    console.log("notifyEventToggle", this.lockedToggle)
    if (this.lockedToggle) {
      return;
    }

    this.sync.changeNotifyEvent(
      this.getNotifySettingName(eventName),
      eventName,
      this.getToggleFromEvent(eventName)
    )
  }

  rateApp() {
    if (this.platform.is("android")) {
      window.open('market://details?id=in.beaconcha.mobile', '_system', 'location=yes');
    } else {
      window.open('itms-apps://itunes.apple.com/app/id1541822121', '_system', 'location=yes');
    }
  }

  changeUpdateChannel() {
    if (this.lockedToggle) {
      return;
    }

    this.updateUtils.setUpdateChannel(this.updateChannel)
    this.updateUtils.checkUpdates()
  }

  async changeETH2Client() {
    if (this.lockedToggle) {
      return;
    }

    this.sync.changeETH2Client(this.eth2client)
    this.updateUtils.checkUpdates()
  }

  async changeETH1Client() {
    if (this.lockedToggle) {
      return;
    }

    this.sync.changeETH1Client(this.eth1client)
    this.updateUtils.checkUpdates()
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

  async openBrowser(link, native: boolean = false) {
    if (native) {
      window.open(link, '_system', 'location=yes');
    } else {
      await Browser.open({ url: link, toolbarColor: "#2f2e42" });
    }
  }

  async logout() {
    this.alerts.confirmDialog(
      'Confirm logout',
      'Notifications will stop working if you sign out. Continue?',
      'Logout',
      () => { this.confirmLogout() }
    );
  }

  count = 0;
  rememberme() {
    this.count++;
    if (this.count % 3 != 0) return;
    window.open('https://www.youtube.com/watch?v=eTOKcxIujgE', '_system', 'location=yes');
  }

  confirmLogout() {
    this.storage.removeAuthUser();
    this.storage.setItem(LOCK_KEY, "")
    this.authUser = null
    Toast.show({
      text: 'Logged out'
    });
  }

  async changeNetwork() {
    const newConfig = findConfigForKey(this.network)
    await this.sync.fullSync()
    await this.storage.setNetworkPreferences(newConfig)
    await this.api.updateNetworkConfig()
    await this.loadNotifyToggles()
    this.validatorUtils.notifyListeners()
  }

  async openIconCredit() {
    const alert = await this.alertController.create({
      cssClass: 'my-custom-class',
      header: 'App Icon Credit',
      message: 'Satellite dish by Font Awesome.<br/>Licensed under the Creative Commons Attribution 4.0 International.<br/><a href="https://fontawesome.com/license">https://fontawesome.com/license</a>',
      buttons: ['OK']
    });

    await alert.present();
  }

  async openUpgrades() {
    const modal = await this.modalController.create({
      component: SubscribePage,
      cssClass: 'my-custom-class',
    });
    return await modal.present();
  }

  async openFAQ() {
    const modal = await this.modalController.create({
      component: HelppagePage,
      cssClass: 'my-custom-class',
    });
    return await modal.present();
  }

  async openOpenSource() {
    const modal = await this.modalController.create({
      component: LicencesPage,
      cssClass: 'my-custom-class',
    });
    return await modal.present();
  }

  ionViewDidLeave() {
    this.sync.syncAllSettings()
  }

  manageSubs() {
    this.merchant.manageSubscriptions()
  }

  async partialStake() {
    const validatorCount = await this.validatorUtils.localValidatorCount()
    const shares = await this.storage.getStakingShare()

    const minShareStake = 0.01 * validatorCount
    const maxStakeShare = 32 * validatorCount
    
    const alert = await this.alertController.create({
      cssClass: 'my-custom-class',
      header: 'Define stake share',
      message: 'If you own partial amounts of a validator, specify the amount of ether for a custom dashboard.',
      inputs: [
        {
          name: 'share',
          type: 'number',
          placeholder: minShareStake + ' - ' + maxStakeShare + " Ether",
          value: shares
        }
      ],
      buttons: [
        {
          text: 'Remove',
          handler: async (_) => {
            this.stakingShare = null
            await this.storage.setStakingShare(this.stakingShare)
            this.validatorUtils.notifyListeners()
          }
        }, {
          text: 'Save',
          handler: async (alertData) => {
            const shares = alertData.share
            if (shares < minShareStake) {
              Toast.show({
                text: 'Share must be at least ' + minShareStake + ' ETH or more'
              });
              return
            }

            if (shares > maxStakeShare) {
              Toast.show({
                text: 'Share amount is higher than all of your added validators.'
              });
              return
            }
            console.log("save staking_share", alertData.share)
            this.stakingShare = new BigNumber(alertData.share).decimalPlaces(4)
            await this.storage.setStakingShare(this.stakingShare)
            this.validatorUtils.notifyListeners()
          }
        }
      ]
    });

    await alert.present();
  }


  // --- Development methods ---

  clearSyncQueue() {
    this.sync.developDeleteQueue()
    Toast.show({
      text: 'Queue cleared'
    });
  }

  forceSync() {
    this.sync.fullSync()
  }

  updateFirebaseToken() {
    this.firebaseUtils.pushLastTokenUpstream(true)
  }

  permanentDevMode() {
    this.storage.setObject("dev_mode", { enabled: true })
    Toast.show({
      text: 'Permanent dev mode enabled'
    });
  }

  triggerToggleTest() {
    this.toggleTest = true
  }

  toggleTest = false
  toggleTestChange() {
    if (this.lockedToggle) {
      this.lockedToggle = false
      return;
    }
    setTimeout(() => this.changeToggleSafely(() => { this.toggleTest = false }), 500)
    setTimeout(() =>
      this.alerts.showInfo("Success", "Toggle test was successfull if this alert only appears once and toggle returns to disabled"),
      650
    )
  }

  restartApp() {
    this.merchant.restartApp()
  }

  toggleSnow() {
    this.theme.toggleWinter(this.snowing)
  }

  async changeAccessToken() {
    const alert = await this.alertController.create({
      cssClass: 'my-custom-class',
      header: 'Access Token',
      inputs: [
        {
          name: 'token',
          type: 'text',
          placeholder: 'Access token'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {

          }
        }, {
          text: 'Ok',
          handler: (alertData) => {
            this.storage.setAuthUser({
              accessToken: alertData.token,
              refreshToken: "-",
              expiresIn: Number.MAX_SAFE_INTEGER
            })
          }
        }
      ]
    });

    await alert.present();
  }

}



