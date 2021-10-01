import { Component, OnInit, ViewChild } from '@angular/core';
import { IonRange, ModalController, Platform } from '@ionic/angular';
import { AlertService } from 'src/app/services/alert.service';
import { ApiService } from 'src/app/services/api.service';
import { StorageService } from 'src/app/services/storage.service';
import { SyncService } from 'src/app/services/sync.service';
import { NotificationBase } from 'src/app/tab-preferences/notification-base';
import FirebaseUtils from 'src/app/utils/FirebaseUtils';
import MachineUtils, { UNSUPPORTED_PRYSM } from 'src/app/utils/MachineUtils';
import { MerchantUtils } from 'src/app/utils/MerchantUtils';
import { SubscribePage } from '../subscribe/subscribe.page';
import { CPU_THRESHOLD, HDD_THRESHOLD, RAM_THRESHOLD, } from '../../utils/Constants'
import { ValidatorUtils } from '../../utils/ValidatorUtils';


@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
})
export class NotificationsPage extends NotificationBase implements OnInit {

  network: string = "main"
  authUser = null

  storageThreshold = 90
  cpuThreshold = 60
  memoryThreshold = 80

  canCustomizeThresholds = false

  initialized = false

  allMachines: Promise<string[]>
  noMachines: boolean = true

  unsupportedPrysm: boolean = false

  constructor(
    protected api: ApiService,
    protected storage: StorageService,
    protected firebaseUtils: FirebaseUtils,
    protected platform: Platform,
    protected alerts: AlertService,
    protected sync: SyncService,
    private merchantUtils: MerchantUtils,
    private modalController: ModalController,
    private machineUtils: MachineUtils,
    protected validatorUtil: ValidatorUtils,
  ) {
    super(api, storage, firebaseUtils, platform, alerts, sync, validatorUtil, machineUtils )
  }

  handleLockedClick() {
    if (this.canCustomizeThresholds) return
    
    this.openUpgrades()
  }

  async ionViewWillEnter() {
    this.initialized = false

    this.storage.getBooleanSetting(UNSUPPORTED_PRYSM, false).then((result) => { this.unsupportedPrysm = result })
    
    this.storage.getAuthUser().then((result) => this.authUser = result)
    this.api.getNetworkName().then((result) => {
      this.network = this.api.capitalize(result)
    })
    this.merchantUtils.hasCustomizeableNotifications().then((result) => {
      this.canCustomizeThresholds = result
    })

    this.cpuThreshold = await this.storage.getSetting(CPU_THRESHOLD, 60)
    this.storageThreshold = await this.storage.getSetting(HDD_THRESHOLD, 90)
    this.memoryThreshold = await this.storage.getSetting(RAM_THRESHOLD, 80)
    await this.loadNotifyToggles()
    setTimeout(() => { this.initialized = true }, 400)
  }

  changeDiskNotification() {
    if (!this.initialized) return
    this.storage.setSetting(HDD_THRESHOLD, this.storageThreshold)
    const thresholdConv = (100 - this.storageThreshold) / 100 // endpoint takes in percantage of free space available
    this.notifyEventToggleAllMachines('monitoring_hdd_almostfull', thresholdConv)
  }

  changeCPUNotification() {
    if (!this.initialized) return
    this.storage.setSetting(CPU_THRESHOLD, this.cpuThreshold)
    const thresholdConv = this.cpuThreshold / 100
    this.notifyEventToggleAllMachines('monitoring_cpu_load', thresholdConv)
  }

  changeMemoryNotification() {
    if (!this.initialized) return
    this.storage.setSetting(RAM_THRESHOLD, this.memoryThreshold)
    const thresholdConv = this.memoryThreshold / 100
    this.notifyEventToggleAllMachines('monitoring_memory_usage', thresholdConv)
  }

  async notifyEventToggleAllMachines(event: string, threshold: number = null) {
    let array = await this.allMachines
    array.forEach(machine => {
      this.notifyEventFilterToggle(event, machine, threshold)
    });
  }

  async ngOnInit() {
    this.allMachines = this.machineUtils.getAllMachineNames()
    let result = await this.allMachines
    console.log('got all machine names: ', result)
    this.noMachines = result.length == 0
  }

  changeStorageThreshold($event){
    this.storageThreshold =  $event.detail.value;
  }
  
  changeCPUThreshold($event){
    this.cpuThreshold =  $event.detail.value;
  }
  
  async openUpgrades() {
    const modal = await this.modalController.create({
      component: SubscribePage,
      cssClass: 'my-custom-class',
    });
    return await modal.present();
  }

  ionViewWillLeave() {

  }

}
