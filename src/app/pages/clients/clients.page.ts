import { Component, OnInit, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import ClientUpdateUtils from '../../utils/ClientUpdateUtils';
import { NotificationBase } from '../../tab-preferences/notification-base';
import { SyncService } from '../../services/sync.service';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.page.html',
  styleUrls: ['./clients.page.scss'],
})
export class ClientsPage implements OnInit {

  @Input() clientIdentifier: string = ""

  constructor(
    private modalCtrl: ModalController,
    protected updateUtils: ClientUpdateUtils,
    protected sync: SyncService,
    public notificationBase: NotificationBase
  ) { }

  ngOnInit() {
    this.updateUtils.getClient("LIGHTHOUSE").then((result) => {
      this.notificationBase.setLocalClientToggle("Lighthouse", (result && result != "null"))
    })
    this.updateUtils.getClient("LODESTAR").then((result) => {
      this.notificationBase.setLocalClientToggle("Lodestar", (result && result != "null"))
    })
    this.updateUtils.getClient("PRYSM").then((result) => {
      this.notificationBase.setLocalClientToggle("Prysm", (result && result != "null"))
    })
    this.updateUtils.getClient("NIMBUS").then((result) => {
      this.notificationBase.setLocalClientToggle("Nimbus", (result && result != "null"))
    })
    this.updateUtils.getClient("TEKU").then((result) => {
      this.notificationBase.setLocalClientToggle("Teku", (result && result != "null"))
    })
    this.updateUtils.getClient("BESU").then((result) => {
      this.notificationBase.setLocalClientToggle("Besu", (result && result != "null"))
    })
    this.updateUtils.getClient("ERIGON").then((result) => {
      this.notificationBase.setLocalClientToggle("Erigon", (result && result != "null"))
    })
    this.updateUtils.getClient("GETH").then((result) => {
      this.notificationBase.setLocalClientToggle("Geth", (result && result != "null"))
    })
    this.updateUtils.getClient("NETHERMIND").then((result) => {
      this.notificationBase.setLocalClientToggle("Nethermind", (result && result != "null"))
    })
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  async toggleClient(clientKey: string, event: any) {
    if (event.target.checked) {
      this.sync.changeClient(clientKey, clientKey)
    } else {
      this.sync.changeClient(clientKey, null)
    }
    this.updateUtils.checkClientUpdate(clientKey)
  }
}