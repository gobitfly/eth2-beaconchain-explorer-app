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
    this.updateUtils.getETHClient("LIGHTHOUSE").then((result) => {
      this.toggleStateLighthouse = (result != "null")
    })
    this.updateUtils.getETHClient("LODESTAR").then((result) => {
      this.toggleStateLodestar = (result != "null")
    })
    this.updateUtils.getETHClient("PRYSM").then((result) => {
      this.toggleStatePrysm = (result != "null")
    })
    this.updateUtils.getETHClient("NIMBUS").then((result) => {
      this.toggleStateNimbus = (result != "null")
    })
    this.updateUtils.getETHClient("TEKU").then((result) => {
      this.toggleStateTeku = (result != "null")
    })
    this.updateUtils.getETHClient("BESU").then((result) => {
      this.toggleStateBesu = (result != "null")
    })
    this.updateUtils.getETHClient("ERIGON").then((result) => {
      this.toggleStateErigon = (result != "null")
    })
    this.updateUtils.getETHClient("GETH").then((result) => {
      this.toggleStateGeth = (result != "null")
    })
    this.updateUtils.getETHClient("NETHERMIND").then((result) => {
      this.toggleStateNethermind = (result != "null")
    })
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  async toggleETHClient(clientKey: string, event: any) {
    if (event.target.checked) {
      this.sync.changeETHClient(clientKey, clientKey)
    } else {
      this.sync.changeETHClient(clientKey, null)
    }
    this.updateUtils.checkETHClientUpdate(clientKey)
  }
}