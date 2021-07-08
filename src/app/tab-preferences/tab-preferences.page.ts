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
import { StorageService } from '../services/storage.service';
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

import FirebaseUtils from '../utils/FirebaseUtils';
import { Platform } from '@ionic/angular';
import { AlertService } from '../services/alert.service';
import { SyncService } from '../services/sync.service';
import { LicencesPage } from '../pages/licences/licences.page';
import { SubscribePage } from '../pages/subscribe/subscribe.page';
import { MerchantUtils, PRODUCT_STANDARD } from '../utils/MerchantUtils';
import { NotificationBase, LOCK_KEY } from './notification-base';
import { Router } from '@angular/router';

const { Device } = Plugins;
const { Browser } = Plugins;
const { Toast } = Plugins;

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab-preferences.page.html',
  styleUrls: ['tab-preferences.page.scss']
})
export class Tab3Page {

  fadeIn = "invisible"

  darkMode: boolean

  eth1client: string
  eth2client: string

  network: string = "main"

  allTestNetworks: string[][]

  authUser

  updateChannel: string

  allCurrencies

  appVersion: string

  debug = false

  snowing: boolean

  stakingShare = null

  themeColor: string
  //widgetThemeColor: string
  currentPlan: string

  premiumLabel: string = ""

  constructor(
    protected api: ApiService,
    protected oauth: OAuthUtils,
    public theme: ThemeUtils,
    public unit: UnitconvService,
    protected storage: StorageService,
    protected updateUtils: ClientUpdateUtils,
    protected validatorUtils: ValidatorUtils,
    protected modalController: ModalController,
    protected alertController: AlertController,
    protected firebaseUtils: FirebaseUtils,
    public platform: Platform,
    protected alerts: AlertService,
    protected sync: SyncService,
    protected merchant: MerchantUtils,
    protected notificationBase: NotificationBase,
    private router: Router
  ) { }

  ngOnInit() {
    
    this.theme.isDarkThemed().then((result) => this.darkMode = result)
    this.theme.getThemeColor().then((result) => this.themeColor = result)

    this.updateUtils.getETH1Client().then((result) => this.eth1client = result)
    this.updateUtils.getETH2Client().then((result) => this.eth2client = result)
    this.updateUtils.getUpdateChannel().then((result) => this.updateChannel = result)

    this.theme.isWinterEnabled().then((result) => this.snowing = result)

    this.allCurrencies = this.getAllCurrencies()
    this.api.getAllTestNetNames().then(result => {
      this.allTestNetworks = result
    })

    Device.getInfo().then((result) => this.appVersion = result.appVersion)

    this.storage.getStakingShare().then((result) => this.stakingShare = result)

    this.merchant.getCurrentPlanConfirmed().then((result) => {
      this.currentPlan = result
      if (this.currentPlan != PRODUCT_STANDARD) {
        this.premiumLabel = " - " + this.api.capitalize(this.currentPlan)
      }

    })
    this.notificationBase.disableToggleLock()

    this.fadeIn = "fade-in"
    setTimeout(() => {
      this.fadeIn = null
    }, 1500)
  }

  changeWidgetTheme() {
    
  }

  gotoNotificationPage() {
    this.router.navigate(['/notifications'])
  }

  themeColorLock = false
  changeThemeColor() {
    this.themeColorLock = true;
    this.theme.undoColor()
    setTimeout(() => {
      this.theme.toggle(this.darkMode, true, this.themeColor)
      this.themeColorLock = false;
    }, 250)
  }

  widgetSetupInfo() {
    if (this.currentPlan == 'standard' || this.currentPlan == 'plankton') {
      this.openUpgrades()
      return;
    }

    var tutorialText = "MISSINGNO"
    if (this.platform.is("ios")) {
      tutorialText =
        "1. Go to your homescreen<br/>" +
        "2. Hold down on an empty space<br/>" +
        "3. On the top right corner, click the + symbol<br/>" +
        "4. Scroll down and select Beaconchain Dashboard and chose your widget<br/>" +
        "<br/>You can configure your widget by holding down on the widget.<br/><br/>" +
        "Widgets are only available on iOS 14 or newer<br/><br/>" +
        "If you just purchased a premium package and the widget does not show any data, try deleting it and adding the widget again."
    } else {
      tutorialText = "1. Go to your homescreen<br/>" +
        "2. Hold down on an empty space<br/>" +
        "3. Click on 'Widgets'<br/>" +
        "4. Scroll down and select Beaconchain Dashboard and chose your widget<br/><br/>" +
        "If you just purchased a premium package and the widget does not show any data, try deleting it and adding the widget again."
    }

    this.alerts.showInfo(
      "Widget Setup",
      tutorialText,
      "bigger-alert"
    )
  }

  ionViewWillEnter() {
    this.storage.getAuthUser().then((result) => this.authUser = result)
    this.debug = this.api.debug
    this.api.getNetworkName().then((result) => {
      this.network = result
    })
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

  rateApp() {
    if (this.platform.is("android")) {
      window.open('market://details?id=in.beaconcha.mobile', '_system', 'location=yes');
    } else {
      window.open('itms-apps://itunes.apple.com/app/id1541822121', '_system', 'location=yes');
    }
  }

  changeUpdateChannel() {
    if (this.notificationBase.lockedToggle) {
      return;
    }

    this.updateUtils.setUpdateChannel(this.updateChannel)
    this.updateUtils.checkUpdates()
  }

  async changeETH2Client() {
    if (this.notificationBase.lockedToggle) {
      return;
    }

    this.sync.changeETH2Client(this.eth2client)
    this.updateUtils.checkUpdates()
  }

  async changeETH1Client() {
    if (this.notificationBase.lockedToggle) {
      return;
    }

    this.sync.changeETH1Client(this.eth1client)
    this.updateUtils.checkUpdates()
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
    await this.notificationBase.loadNotifyToggles()
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

  toggleSnow() {
    this.theme.toggleWinter(this.snowing)
  }

}



