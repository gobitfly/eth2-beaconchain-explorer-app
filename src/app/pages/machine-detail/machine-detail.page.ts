import { Component, OnInit, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { fromEvent, Subscription } from 'rxjs';
import MachineController, { ProcessedStats, StatsResponse } from '../../controllers/MachineController'

@Component({
  selector: 'app-machine-detail',
  templateUrl: './machine-detail.page.html',
  styleUrls: ['./machine-detail.page.scss'],
})
export class MachineDetailPage extends MachineController implements OnInit {

  @Input() key: string
  @Input() data: ProcessedStats

  cpuDelegate = (data) => { return this.doCPUCharts(data) }
  cpuSystemDelegate = (data) => { return this.doCPUSystemCharts(data) }
  memoryDelegate = (data) => { return this.doMemoryCharts(data) }
  syncDelegate = (data) => { return this.doSyncCharts(data) }
  diskDelegate = (data) => { return this.doDiskCharts(data) }
  diskIoDelegate = (data) => { return this.doDiskIoUsageCharts(data) }
  networkDelegate = (data) => { return this.doNetworkCharts(data) }
  memorySystemDelegate = (data) => { return this.doMemorySystemCharts(data) }
  peerDelegate = (data) => { return this.doPeerCharts(data) }
  beaconchainSizeDelegate = (data) => { return this.doBeaconchainSizeChart(data) }
  validatorDelegate = (data) => { return this.doValidatorChart(data) }

  scrolling: boolean = false
  selectedTab = "cpu"

  headslot: number = 0
  coreCount: number = 0
  threadCount: number = 0
  uptime: number = 0
  os: string
  stateSynced: String

  private backbuttonSubscription: Subscription;
  constructor(private modalCtrl: ModalController) {
    super()
  }

  ngOnInit() {
    const event = fromEvent(document, 'backbutton');
    this.backbuttonSubscription = event.subscribe(async () => {
      this.modalCtrl.dismiss();
    });

    if (this.data) {
      this.os = this.formatOS(this.getLastFrom(this.data.system, (array) => array.misc_os))
      this.uptime = this.getLastFrom(this.data.system, (array) => array.misc_node_boot_ts_seconds) * 1000
      this.threadCount = this.getLastFrom(this.data.system, (array) => array.cpu_threads)
      this.coreCount = this.getLastFrom(this.data.system, (array) => array.cpu_cores)

      this.headslot = this.getLastFrom(this.data.node, (array) => array.sync_beacon_head_slot)

      let synced = this.getLastFrom(this.data.node, (array) => array.sync_eth2_synced)
      this.stateSynced = synced ? "Synced" : "Syncing"
    }

  }

  private formatOS(os: string) {
    switch (os) {
      case "lin": return "Linux"
      case "win": return "Windows"
      case "mac": return "macOS"
      default: return "Unknown"
    }
  }

  private getLastFrom(dataArray: any[], callbackValue: (array) => any): any {
    if (!dataArray || dataArray.length <= 0) return null
    return callbackValue(dataArray[dataArray.length - 1])
  }

  ngOnDestroy() {
    this.backbuttonSubscription.unsubscribe();
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  onScrollStarted() {
    this.scrolling = true
  }

  onScrollEnded() {
    this.scrolling = false
  }

  public doBeaconchainSizeChart(current): any[] {
    const chartData = []

    if (current && current.node) {
      chartData.push(
        {
          name: 'Beaconchain Size',
          color: '#7cb5ec',
          data: this.timeAxisChanges(current.node, (value) => { return value.disk_beaconchain_bytes_total }),
          pointWidth: 25,
        }
      )
    }

    chartData.push(this.addBytesConfig())

    return chartData
  }

  public doPeerCharts(current): any[] {
    const chartData = []

    if (current && current.node) {
      chartData.push(
        {
          name: 'Connected Peers',
          color: '#7cb5ec',
          data: this.timeAxisChanges(current.node, (value) => { return value.network_peers_connected }, false),
          pointWidth: 25,
        }
      )
    }

    chartData.push(this.addAbsoluteConfig())

    return chartData
  }

  public doDiskCharts(current): any[] {
    const chartData = []

    if (current && current.system) {
      chartData.push(
        {
          name: 'Free Space',
          color: '#7cb5ec',
          data: this.timeAxisChanges(current.system, (value) => { return value.disk_node_bytes_free }, false),
          pointWidth: 25,
        }
      )
    }
    chartData.push(this.addBytesConfig())

    return chartData
  }

  public doValidatorChart(current): any[] {
    const chartData = []

    if (current && current.validator) {
      chartData.push(
        {
          name: 'Total',
          color: '#7cb5ec',
          data: this.timeAxisChanges(current.validator, (value) => { return value.validator_total }, false),
          pointWidth: 25,
        }
      )
      chartData.push(
        {
          name: 'Active',
          color: '#Dcb5ec',
          data: this.timeAxisChanges(current.validator, (value) => { return value.validator_active }, false),
          pointWidth: 25,
        }
      )
    }

    chartData.push(this.addAbsoluteConfig())

    return chartData
  }

  public doDiskIoUsageCharts(current): any[] {
    const chartData = []

    if (current && current.system) {
      chartData.push(
        {
          name: 'Reads',
          color: '#Dcb5ec',
          data: this.timeAxisChanges(current.system, (value) => { return value.disk_node_reads_total }, true),
          pointWidth: 25,
        }
      )
      chartData.push(
        {
          name: 'Writes',
          color: '#7cb5ec',
          data: this.timeAxisChanges(current.system, (value) => { return value.disk_node_writes_total }, true),
          pointWidth: 25,
        }
      )
    }

    chartData.push(this.addAbsoluteConfig())

    return chartData
  }

  public doNetworkCharts(current): any[] {
    const chartData = []

    const lighthouseBitsBytesConvFix = current.client == "lighthouse" ? 8 : 1

    if (current && current.system) {
      console.log("system", current.system)
      chartData.push(
        {
          name: 'Receive',
          color: '#7cb5ec',
          data: this.timeAxisChanges(current.system, (value) => { return value.network_node_bytes_total_receive / lighthouseBitsBytesConvFix }, true),
          pointWidth: 25,
        }
      )
      chartData.push(
        {
          name: 'Transmit',
          color: '#Dcb5ec',
          data: this.timeAxisChanges(current.system, (value) => { return value.network_node_bytes_total_transmit/ lighthouseBitsBytesConvFix}, true),
          pointWidth: 25,
        }
      )
    }

    chartData.push(this.addBytesConfig(true))

    return chartData
  }

  public doCPUSystemCharts(current): any[] {
    const chartData = []

    let cpuSystemTotal = this.timeAxisChanges(current.system, (value) => { return value.cpu_node_system_seconds_total }, true)
    let idle = this.timeAxisChanges(current.system, (value) => { return value.cpu_node_idle_seconds_total }, true)
    let user = this.timeAxisChanges(current.system, (value) => { return value.cpu_node_user_seconds_total }, true)
    let io = this.timeAxisChanges(current.system, (value) => { return value.cpu_node_iowait_seconds_total }, true)

    if (current && current.system) {
      chartData.push(
        {
          name: 'Total Usage',
          color: '#7cb5ec',
          data: this.timeAxisRelative(cpuSystemTotal, idle, true),
          pointWidth: 25,
        }
      )
      chartData.push(
        {
          name: 'User',
          color: '#Dcb5ec',
          data: this.timeAxisRelative(cpuSystemTotal, user, false),
          pointWidth: 25,
        }
      )
      chartData.push(
        {
          name: 'IO Wait',
          color: '#3335FF',
          data: this.timeAxisRelative(cpuSystemTotal, io, false),
          pointWidth: 25,
        }
      )
      /*chartData.push(
        {
          name: 'Idle',
          color: '#3FF5ec',
          data: idle,
          pointWidth: 25,
        }
      )*/
    }

    chartData.push({
      config: {
          tooltip: {
              style: {
                  color: 'var(--text-color)',
                  fontWeight: 'bold'
                },
              valueSuffix: "%"
        },
        yAxis: 
          {
          labels: {
            x: -5,
              formatter: function () {
                return this.value + "%"
              },
  
            }
          }
        ,
      }
  })

    return chartData
  }

  public doMemorySystemCharts(current): any[] {
    const chartData = []

    if (current && current.system) {
      chartData.push(
        {
          name: 'Total',
          color: '#7cb5ec',
          data: this.timeAxisChanges(current.system, (value) => { return value.memory_node_bytes_total }),
          pointWidth: 25,
        }
      )

      chartData.push(
        {
          name: 'Cached',
          color: '#3335FF',
          data: this.timeAxisChanges(current.system, (value) => { return value.memory_node_bytes_cached }),
          pointWidth: 25,
        }
      )
      chartData.push(
        {
          name: 'Buffer',
          color: '#3FF5ec',
          data: this.timeAxisChanges(current.system, (value) => { return value.memory_node_bytes_buffers }),
          pointWidth: 25,
        }
      )
      chartData.push(
        {
          name: 'Free',
          color: '#Dcb5ec',
          data: this.timeAxisChanges(current.system, (value) => { return value.memory_node_bytes_free }),
          pointWidth: 25,
        }
      )
    }

    chartData.push(this.addBytesConfig())

    return chartData
  }


}
