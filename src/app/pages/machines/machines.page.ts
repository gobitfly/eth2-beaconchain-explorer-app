import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {  ModalController } from '@ionic/angular';
import { MachineDetailPage } from '../machine-detail/machine-detail.page';
import MachineController, { ProcessedStats } from '../../controllers/MachineController'
import { AlertService } from 'src/app/services/alert.service';
import { Plugins } from '@capacitor/core';
import { MerchantUtils } from 'src/app/utils/MerchantUtils';
import { ValidatorUtils } from 'src/app/utils/ValidatorUtils';
import { StorageService } from 'src/app/services/storage.service';
import { OAuthUtils } from 'src/app/utils/OAuthUtils';
import MachineUtils from 'src/app/utils/MachineUtils';

const { Browser } = Plugins;

@Component({
  selector: 'app-machines',
  templateUrl: './machines.page.html',
  styleUrls: ['./machines.page.scss'],
})
export class MachinesPage extends MachineController implements OnInit {

  data: ProcessedStats[] = null
  scrolling: boolean = false
  selectedChart = "cpu"
  showData = true
  selectedTimeFrame = "3h"

  hasHistoryPremium = false;
  loggedIn = false

  orderedKeys: String[] = []

  cpuDelegate = (data) => { return this.doCPUCharts(data) }
  memoryDelegate = (data) => { return this.doMemoryCharts(data) }
  syncDelegate = (data) => { return this.doSyncCharts(data) }
  clientFormatter = (data) => { return this.formatClientText(data) }
  onlineStateDelegate = async (data) => { return await this.getOnlineState(data) }
  machineClickDelegate = (data) => { return () => { return this.openMachineDetail(data) } }

  constructor(
    private modalController: ModalController,
    private alertService: AlertService,
    private merchant: MerchantUtils,
    private validatorUtils: ValidatorUtils,
    private storage: StorageService,
    private oauthUtils: OAuthUtils,
    private machineUtils: MachineUtils,
    private ref: ChangeDetectorRef
  ) {
    super(storage)
  }

  ngOnInit() {
    

    this.validatorUtils.registerListener(() => {
      this.getAndProcessData()
    })

    this.merchant.hasMachineHistoryPremium().then((result) => {
      this.hasHistoryPremium = result
    });
  }

  async doRefresh(event) {
    await this.getAndProcessData()
    setTimeout(() => {
      event.target.complete();
      this.ref.detectChanges();
    }, 500)
  }

  ionViewWillEnter() {
    this.getAndProcessData()
  }

  delegater(func) {
    return () => { return func }
  }

  async login() {
    await this.oauthUtils.login()
    this.loggedIn = await this.storage.isLoggedIn()
  }

  formatClientText(data: ProcessedStats) {
    var result = null
    if (data.client) result = data.client
    if (!result) return result

    if (data.clientVersion) result += " v" + data.clientVersion
    return result
  }

  openTimeSelection() {
    if (!this.hasHistoryPremium) {
      this.alertService.showInfo("Premium Feature", "For more machine history upgrade to a premium version.")
      return
    }

    this.alertService.showSelect("Time", [
      {
        name: "time",
        label: "3h",
        value: "3h",
        type: "radio"
      },
      {
        name: "time",
        label: "12h",
        value: "12h",
        type: "radio"
      },
      {
        name: "time",
        label: "24h",
        value: "24h",
        type: "radio"
      },
      {
        name: "time",
        label: "2d",
        value: "2d",
        type: "radio"
      },
      {
        name: "time",
        label: "7d",
        value: "7d",
        type: "radio"
      },
      {
        name: "time",
        label: "14d",
        value: "14d",
        type: "radio"
      },
      {
        name: "time",
        label: "30d",
        value: "30d",
        type: "radio"
      }
    ], (data) => {
      if (data) {
        if (data != this.selectedChart) {
          this.selectedTimeFrame = data
          this.selectionTimeFrame = this.getTimeSelectionLimit()
          this.data = null
          this.getAndProcessData()
        }
      }
    })
  }

  getTimeSelectionLimit(): number {
    switch (this.selectedTimeFrame) {
      case "3h": return 180
      case "12h": return 720
      case "24h": return 1440
      case "2d": return 2880
      case "7d": return 10080
      case "14d": return 20160
      case "30d": return 43200
    }
    return 180
  }

  async getAndProcessData() {
    this.loggedIn = await this.storage.isLoggedIn()
    if (!this.loggedIn) {
      this.data = []
      this.orderedKeys = []
      this.showData = false
      return
    }

    this.data = await this.machineUtils.getAndProcessData(this.getTimeSelectionLimit())
    this.orderedKeys = await this.getOrderedKeys(this.data)
    this.showData = Object.keys(this.data).length > 0
  }

  private async getOrderedKeys(data: ProcessedStats[]): Promise<string[]> {
    var online = []
    var attention = []
    var offline = []

    for (var key in data) {
      const it = data[key]
      const status = await this.getOnlineState(it)
      if (status == 'online') {
        online.push(key)
      } else if(status == 'offline'){
        offline.push(key)
      } else {
        attention.push(key)
      }
    }
    
    // sorting arrays
    online.sort((a, b) => a.localeCompare(b))
    attention.sort((a, b) => a.localeCompare(b))
    offline.sort((a, b) => a.localeCompare(b))

    // concating keys
    const result = online.concat(attention).concat(offline)

    return result
  }

  async openMachineDetail(key) {
    let attention = this.getSyncAttention(this.data[key])
    let diskAttention = await this.getDiskAttention(this.data[key])

    const modal = await this.modalController.create({
      component: MachineDetailPage,
      cssClass: 'my-custom-class',
      componentProps: {
        'data': this.data[key],
        'key': key,
        'timeframe': this.selectionTimeFrame,
        'selectedTab': attention ? "sync" : diskAttention ? "disk" : "cpu"
      }
    });
    return await modal.present();
  }

  onScrollStarted() {
    this.scrolling = true
  }

  onScrollEnded() {
    this.scrolling = false
  }

  count = 0;
  easterEgg() {
    this.count++;
    if (this.count % 3 != 0) return;
    window.open('https://www.youtube.com/watch?v=lt-udg9zQSE', '_system', 'location=yes');
  }
 
  async openBrowser(link) {
    await Browser.open({ url: link, toolbarColor: "#2f2e42" });
  }

}

