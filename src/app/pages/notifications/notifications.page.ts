import { Component, OnInit, ViewChild } from '@angular/core';
import { IonRange, ModalController, Platform } from '@ionic/angular';
import { AlertService } from 'src/app/services/alert.service';
import { ApiService } from 'src/app/services/api.service';
import { CPU_THRESHOLD, HDD_THRESHOLD, RAM_THRESHOLD, RPL_COLLATERAL_MAX_THRESHOLD, RPL_COLLATERAL_MIN_THRESHOLD, RPL_COMMISSION_THRESHOLD, StorageService } from 'src/app/services/storage.service';
import { SyncService } from 'src/app/services/sync.service';
import { NotificationBase } from 'src/app/tab-preferences/notification-base';
import FirebaseUtils from 'src/app/utils/FirebaseUtils';
import MachineUtils, { UNSUPPORTED_PRYSM } from 'src/app/utils/MachineUtils';
import { MerchantUtils } from 'src/app/utils/MerchantUtils';
import { SubscribePage } from '../subscribe/subscribe.page';

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


  commissionThreshold = 19
  maxCollateralThreshold = 100
  minCollateralThreshold = 0

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
    private machineUtils: MachineUtils
  ) {
    super(api, storage, firebaseUtils, platform, alerts, sync)
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

    this.commissionThreshold = await this.storage.getSetting(RPL_COMMISSION_THRESHOLD, 19)
    this.maxCollateralThreshold = await this.storage.getSetting(RPL_COLLATERAL_MAX_THRESHOLD, 100)
    this.minCollateralThreshold = await this.storage.getSetting(RPL_COLLATERAL_MIN_THRESHOLD, 0)
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


  changeRocketpoolCommission() {
    if (!this.initialized) return
    this.storage.setSetting(RPL_COMMISSION_THRESHOLD, this.commissionThreshold)
    const thresholdConv = this.commissionThreshold / 100
    this.notifyEventFilterToggle('rocketpool_commision_threshold', null, thresholdConv)
  }

  changeRocketpoolMaxCollateral() {
    if (!this.initialized) return
    this.storage.setSetting(RPL_COLLATERAL_MAX_THRESHOLD, this.maxCollateralThreshold)

    var thresholdConv = 0
    if (this.maxCollateralThreshold >= 0) {
      thresholdConv = 1 + ((this.maxCollateralThreshold - 100) / 1000)
    } else {
      thresholdConv = (1 - ((this.maxCollateralThreshold + 100) / 1000)) * -1
    }
     
    this.notifyEventFilterToggle('rocketpool_colleteral_max', null, thresholdConv)
  }

  changeRocketpoolMinCollateral() {
    if (!this.initialized) return
    this.storage.setSetting(RPL_COLLATERAL_MIN_THRESHOLD, this.minCollateralThreshold)
    const thresholdConv = 1 + this.minCollateralThreshold / 100
    this.notifyEventFilterToggle('rocketpool_colleteral_min', null, thresholdConv)
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
