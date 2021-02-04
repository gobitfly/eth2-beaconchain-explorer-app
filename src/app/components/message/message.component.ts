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

import { Component, OnInit, Input } from '@angular/core';
import { Plugins, StoragePlugin } from '@capacitor/core';
import { textChangeRangeIsUnchanged } from 'typescript';
import { AlertController } from '@ionic/angular';
import { StorageService } from 'src/app/services/storage.service';
import confetti from 'canvas-confetti';

const { Browser } = Plugins;

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss'],
})
export class MessageComponent implements OnInit {

  @Input() title: string
  @Input() icon: any
  @Input() iconStyle: any
  @Input() openUrl: any
  @Input() openUrlExternal: boolean = false
  @Input() dismissAble: boolean = false
  @Input() dismissKey: string
  @Input() msgTitle: any
  @Input() msgText: any
  @Input() confettiOnClick: boolean = false

  notDismissed: boolean = true

  constructor(
    private alertController: AlertController,
    private storage: StorageService
  ) { }

  ngOnInit() {
    if (this.openUrl && this.openUrl.startsWith("http")) {
      if (!this.openUrlExternal) {
        Browser.prefetch({ urls: [this.openUrl] })
      }
    }

    if (this.dismissAble) {
      if (!this.dismissKey) this.dismissKey = this.defaultDismissKey()
      this.storage.getBooleanSetting(this.dismissKey, false).then((dismissed) => {
        this.notDismissed = !dismissed
      })
    }
  }

  async openInfo() {
    if (this.confettiOnClick) {
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.41 }
      });
      return
    }
    if (this.msgTitle && this.msgText) {
      this.showDialog(this.msgTitle, this.msgText)
    } else if (this.openUrl) {
      if (this.openUrlExternal) {
        window.open(this.openUrl, '_system', 'location=yes');
      } else {
        await Browser.open({ url: this.openUrl, toolbarColor: "#2f2e42" });
      }
    }
  }

  async showDialog(title, text) {
    const alert = await this.alertController.create({
      header: title,
      message: text,
      buttons: ["OK"]
    });

    await alert.present();
  }

  private defaultDismissKey() {
    return "dismissed_msg_" + window.btoa(this.title)
  }

  dismiss() {
    this.notDismissed = false;
    this.storage.setBooleanSetting(this.dismissKey, true)
  }

}
