import { Component, OnInit } from '@angular/core';
import { ApiService } from 'src/app/services/api.service';
import { AlertController, ModalController } from '@ionic/angular';
import { MachineDetailPage } from '../machine-detail/machine-detail.page';
import MachineController, { ProcessedStats, StatsResponse } from '../../controllers/MachineController'
import { runCommandLine } from 'cordova-res';
import { AlertService } from 'src/app/services/alert.service';
import { GetMyMachinesRequest } from 'src/app/requests/requests';
import { Plugins } from '@capacitor/core';
import { MerchantUtils } from 'src/app/utils/MerchantUtils';

const OFFLINE_THRESHOLD = 8 * 60 * 1000 

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
  showData = false
  selectedTimeFrame = "3h"

  hasHistoryPremium = false;

  cpuDelegate = (data) => { return this.doCPUCharts(data) }
  memoryDelegate = (data) => { return this.doMemoryCharts(data) }
  syncDelegate = (data) => { return this.doSyncCharts(data) }
  clientFormatter = (data) => { return this.formatClientText(data) }
  onlineStateDelegate = (data) => { return this.getOnlineState(data) }

  // TODO: Apply subscription node limit here (with upgrade dialog)
  // only show X machines depending on subscription

  constructor(
    private api: ApiService,
    private modalController: ModalController,
    private alertService: AlertService,
    private merchant: MerchantUtils
  ) {
    super()

    this.merchant.hasMachineHistoryPremium().then((result) => {
      this.hasHistoryPremium = result
    });
  }

  ngOnInit() {
    this.getAndProcessData()
  }

  delegater(func) {
    return () => { return func }
  }

  formatClientText(data: ProcessedStats) {
    var result = null
    if (data.client) result = data.client
    if (!result) return result

    if (data.clientVersion) result += " v" + data.clientVersion
    return result
  }

  getOnlineState(data: ProcessedStats) {
    if (!data || !data.formattedDate) return "offline";
    const now = Date.now()
    const diff = now - data.formattedDate.getTime()
    if (diff > OFFLINE_THRESHOLD) return "offline"
    return "online"
  }

  openTimeSelection() {
    if (!this.hasHistoryPremium) {
      this.alertService.showInfo("Premium Feature", "For more machine history upgrade to a premium version.")
      return
    }

    // TODO: only for premium users
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
      }
    ], (data) => {
      if (data) {
        if (data != this.selectedChart) {
          this.selectedTimeFrame = data
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
    }
    return 180
  }

  async getAndProcessData() {
    const data = await this.getData()
    console.log("machine data", data)
    if (data == null) {
      this.data = []
      return
    }
    this.data = this.combineByMachineName(
      this.filterMachines(data.validator),
      this.filterMachines(data.node),
      this.filterMachines(data.system)
    )

    this.showData = Object.keys(this.data).length > 0
  }

  async openMachineDetail(key) {
    const modal = await this.modalController.create({
      component: MachineDetailPage,
      cssClass: 'my-custom-class',
      componentProps: {
        'data': this.data[key],
        'key': key
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

  private async getData(): Promise<StatsResponse> {
    const request = new GetMyMachinesRequest(0, this.getTimeSelectionLimit())
    const response = await this.api.execute(request)
    const result = request.parse(response)
    return result[0]
  }

}

