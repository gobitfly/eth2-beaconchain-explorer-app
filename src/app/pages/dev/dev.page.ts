import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { AlertService } from 'src/app/services/alert.service';
import { DEBUG_SETTING_OVERRIDE_PACKAGE, StorageService } from 'src/app/services/storage.service';
import { SyncService } from 'src/app/services/sync.service';
import FirebaseUtils, { CURRENT_TOKENKEY } from 'src/app/utils/FirebaseUtils';
import { MerchantUtils } from 'src/app/utils/MerchantUtils';
import ThemeUtils from 'src/app/utils/ThemeUtils';
import { Plugins } from '@capacitor/core';
import { Tab3Page } from 'src/app/tab-preferences/tab-preferences.page';
const { Toast } = Plugins;

@Component({
  selector: 'app-dev',
  templateUrl: './dev.page.html',
  styleUrls: ['./dev.page.scss'],
})
export class DevPage extends Tab3Page implements OnInit {

  packageOverride: string = "default"
  firebaseToken: string = ""

  ngOnInit() {
    this.notificationBase.disableToggleLock()
    this.storage.getSetting(DEBUG_SETTING_OVERRIDE_PACKAGE, "default").then((result) => {
      this.packageOverride = result
    })
    
    this.storage.getItem(CURRENT_TOKENKEY).then((result) => {
     this.firebaseToken = result
    })
    
    
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
    if (this.notificationBase.lockedToggle) {
      this.notificationBase.lockedToggle = false
      return;
    }
    setTimeout(() => this.notificationBase.changeToggleSafely(() => { this.toggleTest = false }), 500)
    setTimeout(() =>
      this.alerts.showInfo("Success", "Toggle test was successfull if this alert only appears once and toggle returns to disabled"),
      650
    )
  }

  restartApp() {
    this.merchant.restartApp()
  }

  clearStorage() {
    this.alerts.confirmDialog("Clear Storage", "All app data will be removed, continue?", "OK", () => {
      this.storage.clear()
      Toast.show({
        text: 'Storage cleared'
      });
    })
  }

  changePackage() {
    this.storage.setSetting(DEBUG_SETTING_OVERRIDE_PACKAGE, this.packageOverride)
    this.alerts.confirmDialog("Restart", "Requires restart to take affect, restart?", "OK", () => { this.restartApp() })
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
        },
        {
          name: 'refreshtoken',
          type: 'text',
          placeholder: 'Refresh token'
        },
        {
          name: 'expires',
          type: 'number',
          placeholder: 'Expires in'
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
              refreshToken: alertData.refreshtoken,
              expiresIn: alertData.expires
            })
          }
        }
      ]
    });

    await alert.present();
  }

  async restoreAuthUser() {
    let result = await this.storage.restoreAuthUser()
    this.alerts.confirmDialog("Success", "Restart app with restored user?", "OK", () => { this.restartApp() })
  }

  async backupAuthUser() {
    let result = await this.storage.backupAuthUser()
    console.log("backup success")
    Toast.show({
      text: 'Backup successfull'
    });
  }

}
