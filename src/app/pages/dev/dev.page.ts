import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { AlertService } from 'src/app/services/alert.service';
import { StorageService } from 'src/app/services/storage.service';
import { SyncService } from 'src/app/services/sync.service';
import FirebaseUtils from 'src/app/utils/FirebaseUtils';
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

  ngOnInit() {
    this.disableToggleLock()
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

clearStorage() {
  this.storage.clear()
  Toast.show({
    text: 'Storage cleared'
  });
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

}
