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

  // used to set initial state of toggles, not meant to be changed via code
  toggleStateLighthouse: boolean
  toggleStateLodestar: boolean
  toggleStatePrysm: boolean
  toggleStateNimbus: boolean
  toggleStateTeku: boolean
  toggleStateBesu: boolean
  toggleStateErigon: boolean
  toggleStateGeth: boolean
  toggleStateNethermind: boolean

  @Input() clientIdentifier: string = ""

  constructor(
    private modalCtrl: ModalController,
    protected updateUtils: ClientUpdateUtils,
    protected sync: SyncService,
    public notificationBase: NotificationBase
  ) { }

  ngOnInit() {
    this.updateUtils.getClient("LIGHTHOUSE").then((result) => {
      this.toggleStateLighthouse = (result && result != "null")
    })
    this.updateUtils.getClient("LODESTAR").then((result) => {
      this.toggleStateLodestar = (result && result != "null")
    })
    this.updateUtils.getClient("PRYSM").then((result) => {
      this.toggleStatePrysm = (result && result != "null")
    })
    this.updateUtils.getClient("NIMBUS").then((result) => {
      this.toggleStateNimbus = (result && result != "null")
    })
    this.updateUtils.getClient("TEKU").then((result) => {
      this.toggleStateTeku = (result && result != "null")
    })
    this.updateUtils.getClient("BESU").then((result) => {
      this.toggleStateBesu = (result && result != "null")
    })
    this.updateUtils.getClient("ERIGON").then((result) => {
      this.toggleStateErigon = (result && result != "null")
    })
    this.updateUtils.getClient("GETH").then((result) => {
      this.toggleStateGeth = (result && result != "null")
    })
    this.updateUtils.getClient("NETHERMIND").then((result) => {
      this.toggleStateNethermind = (result && result != "null")
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