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

import { ModalController, Platform } from '@ionic/angular';
import ThemeUtils from './utils/ThemeUtils';
import { Plugins } from '@capacitor/core';
const { SplashScreen } = Plugins;
const { AdMob } = Plugins;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private theme: ThemeUtils,
    private modalController: ModalController
  ) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {

      this.theme.init(() => {
        SplashScreen.hide()
      }); // just initialize the theme service

      this.setAndroidBackButtonBehavior();

      AdMob.initialize({
        requestTrackingAuthorization: false,
        testingDevices: []
      });
    });
  }

  private setAndroidBackButtonBehavior(): void {
    if (this.platform.is("android")) {
      this.platform.backButton.subscribe(async () => {
        const isModalOpened = await this.modalController.getTop();
        if (window.location.pathname.startsWith("/tabs") && !isModalOpened) {
          navigator['app'].exitApp();
        }
      });
    }
  }

}

