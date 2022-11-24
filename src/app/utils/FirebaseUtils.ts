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

import { ApiService } from "../services/api.service";
import { StorageService } from "../services/storage.service";
import { UpdateTokenRequest } from "../requests/requests";
import { Injectable } from '@angular/core';
import { AlertController, Platform } from '@ionic/angular';

import { PushNotifications, PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
  
import { LocalNotifications } from '@capacitor/local-notifications';

const LOGTAG = "[FirebaseUtils]";

export const CURRENT_TOKENKEY = "firebase_token"
const NOTIFICATION_CONSENT_KEY = "notification_consent"

@Injectable({
  providedIn: 'root'
})
export default class FirebaseUtils {

  private alreadyRegistered = false;

  constructor(
    private api: ApiService,
    private storage: StorageService,
    private platform: Platform,
    private alertController: AlertController
  ) { }

  async hasSeenConsentScreenAndNotConsented() {
    const hasSeenConsent = await this.storage.getBooleanSetting(NOTIFICATION_CONSENT_KEY, false)

    if (hasSeenConsent) {
      return !(await this.hasNotificationConsent())
    }
    return false
  }

  async hasNotificationConsent(): Promise<boolean> {
    if (!this.platform.is("ios") && !this.platform.is("android")) { return  true}
    return ((await LocalNotifications.checkPermissions()).display) == 'granted'
  }

  async registerPush(iosTriggerConsent = false, onPermissionGranted: () => any = null) {
    if (!this.platform.is("ios") && !this.platform.is("android")) { return }
    console.log(LOGTAG + "registerPush", iosTriggerConsent)
    if (this.alreadyRegistered) return

    const hasConsent = await this.hasNotificationConsent()

    console.log("register push notification")

    // Request permission to use push notifications
    // Will prompt user and start notification service if granted, otherwise show
    // dialog for how to manually set the permission
    if (iosTriggerConsent){
      LocalNotifications.requestPermissions().then((result) => {
        this.storage.setBooleanSetting(NOTIFICATION_CONSENT_KEY, true)

        if (result.display == 'granted') {
          // Register with Apple / Google to receive push via APNS/FCM
          PushNotifications.register();
          this.alreadyRegistered = true;
          if (onPermissionGranted) {
            onPermissionGranted()
          }
        } else {
          if (this.platform.is("ios")) {
            this.alertIOSManuallyEnableNotifications()
          } else {
            this.alertAndroidManuallyEnableNotifications()
          }
       
        }
      });
    }

    if (hasConsent && !iosTriggerConsent) {
      PushNotifications.register();
      this.alreadyRegistered = true;
    }

    // On success, we should be able to receive notifications
    PushNotifications.addListener(
      "registration", async (token) => {
        console.log(LOGTAG + "register token", token.value)
        await this.storage.setItem(CURRENT_TOKENKEY, token.value)
        this.updateRemoteNotificationToken(token.value)
      }
    );

    // Some issue with our setup and push will not work
    PushNotifications.addListener("registrationError", (error: any) => {
      console.warn(LOGTAG + "Error on registration:" + JSON.stringify(error))
    });

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener(
      "pushNotificationReceived",
      (notification: PushNotificationSchema) => {
        this.inAppNotification(notification.title, notification.body)
      }
    );

    // Method called when tapping on a notification
    PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (notification: ActionPerformed) => {
        //alert("Push action performed: " + JSON.stringify(notification));
      }
    );

  }

  private async inAppNotification(title, message) {
    const alert = await this.alertController.create({
      header: title,
      message: message,
      buttons: [
        {
          text: 'OK',
          handler: () => { }
        }
      ]
    });

    await alert.present();
  }

  public async hasNotificationToken() {
    const token = await this.storage.getItem(CURRENT_TOKENKEY)
    return token != null && token.length > 10
  }

  async alertAndroidManuallyEnableNotifications() {
    const alert = await this.alertController.create({
      cssClass: 'my-custom-class',
      header: '',
      message: 'You need to manually enable notifications for this app. Go to your devices System Settings -> Apps -> Beaconchain Dashboard -> Permissions -> Allow Notifications',
      buttons: ['OK']
    });

    await alert.present();
  }

  async alertIOSManuallyEnableNotifications() {
    const alert = await this.alertController.create({
      cssClass: 'my-custom-class',
      header: '',
      message: 'You need to manually enable notifications for this app. Go to your devices System Settings -> Notifications -> Beaconchain Dashboard -> Allow Notifications',
      buttons: ['OK']
    });

    await alert.present();
  }

  async pushLastTokenUpstream(force: boolean) {
    this.updateRemoteNotificationToken(await this.storage.getItem(CURRENT_TOKENKEY), force)
  }

  private async updateRemoteNotificationToken(token: string, force = false) {
    console.log(
      LOGTAG +
      " updateRemoteNotificationToken called with token: " +
      token
    );

    const firebaseTokenKey = "last_firebase_token";
    const loggedIn = await this.storage.isLoggedIn();

    if (loggedIn && token != null) {
      const lastToken = await this.storage.getItem(
        firebaseTokenKey
      );

      console.log(
        LOGTAG + " user is logged in, last local token was: " + lastToken
      );
      if (force || token != lastToken) {
        const request = new UpdateTokenRequest(token);
        const result = await this.api.execute(request).catch((error) => { return false })
        if (request.wasSuccessfull(result)) {
          console.log(LOGTAG + " update on remote was successfull");
          this.storage.setItem(firebaseTokenKey, token);
        }
      }
    }
  }
}