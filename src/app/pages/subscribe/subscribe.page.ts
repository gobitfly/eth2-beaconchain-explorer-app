import { Component, OnInit } from '@angular/core';
import { ModalController, Platform } from '@ionic/angular';
import { fromEvent, Subscription } from 'rxjs';
import { StorageService } from 'src/app/services/storage.service';
import { MerchantUtils, Package } from 'src/app/utils/MerchantUtils';
import { OAuthUtils } from 'src/app/utils/OAuthUtils';

import { Plugins } from '@capacitor/core';
import { AlertService } from 'src/app/services/alert.service';

const { Toast } = Plugins;

@Component({
  selector: 'app-subscribe',
  templateUrl: './subscribe.page.html',
  styleUrls: ['./subscribe.page.scss'],
})
export class SubscribePage implements OnInit {

  currentY = 0

  private backbuttonSubscription: Subscription;
  selectedPackage: Package = this.merchant.PACKAGES[2]
  activeUserPackageName = "standard"
  isiOS = false

  constructor(
    private modalCtrl: ModalController,
    public merchant: MerchantUtils,
    private storage: StorageService,
    private oauth: OAuthUtils,
    private alertService: AlertService,
    private platform: Platform
  ) { }

  ngOnInit() {
    const event = fromEvent(document, 'backbutton');
    this.backbuttonSubscription = event.subscribe(async () => {
      this.modalCtrl.dismiss();
    });

    this.merchant.getCurrentPlanConfirmed().then((result) => {
      this.activeUserPackageName = result
    });

    this.isiOS = this.platform.is("ios")
  }

  onScroll($event) {
    this.currentY = $event.detail.currentY
  }

  ngOnDestroy() {
    this.backbuttonSubscription.unsubscribe();
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  async purchaseIntern() {
    const loggedIn = await this.storage.isLoggedIn()
    if (loggedIn) this.merchant.purchase(this.selectedPackage.purchaseKey)
    else {
      this.alertService.confirmDialog("Login", "You need to login to your beaconcha.in account first. Continue?", "Login", () => {
        this.oauth.login().then(async () => {
          const loggedIn = await this.storage.isLoggedIn()
          if (loggedIn) this.merchant.purchase(this.selectedPackage.purchaseKey)
        })
      })
    }
  }

  purchase() {
    this.purchaseIntern()
  }

  trial() {
    this.purchaseIntern()
  }

  async restore() {
    const loggedIn = await this.storage.isLoggedIn()
    if (!loggedIn) {
      await this.oauth.login()
    } else {
      await this.merchant.restore()
    }

    const currentPackage = await this.merchant.getCurrentPlanConfirmed()
    if (currentPackage != "standard") {
      Toast.show({
        text: 'Purchase restored'
      })
      this.closeModal()
    } else {
      Toast.show({
        text: 'No purchases found on this account'
      })
    }
  }

}

