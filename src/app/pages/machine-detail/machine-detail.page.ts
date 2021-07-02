import { Component, OnInit, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { fromEvent, Subscription } from 'rxjs';
import { StorageService } from 'src/app/services/storage.service';
import MachineController, { ProcessedStats, bytes, FallbackConfigurations } from '../../controllers/MachineController'

@Component({
  selector: 'app-machine-detail',
  templateUrl: './machine-detail.page.html',
  styleUrls: ['./machine-detail.page.scss'],
})
export class MachineDetailPage extends MachineController implements OnInit {

  @Input() key: string
  @Input() data: ProcessedStats
  @Input() timeframe: number
  @Input() selectedTab = "cpu"

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

  headslot: number = 0
  coreCount: number = 0
  threadCount: number = 0
  uptime: number = 0
  os: string
  stateSynced: String
  fallbacks: FallbackConfigurations = {
    eth1Configured: false,
    eth2Configured: false
}

  validatorLabelActive: string = ""
  validatorLabelTotal: string = ""
  diskLabel: string = ""
  diskFullEst: number = 0
  beaconchainLabel: string = ""
  peerLabel: string = ""
  networkLabelRx: string = ""
  networkLabelTx: string = ""
  memoryLabelFree: string = ""
  memoryLabelTotal: string = ""
  memoryProcessLabelNode: string = ""
  memoryProcessLabelVal: string = ""
  cpuProcessLabelNode: string = ""
  cpuProcessLabelVal: string = ""
  cpuLabelTotal: string = ""
  diskUsageLabelReads: string = ""
  diskUsageLabelWrites: string = ""

  syncAttention: string = null
  diskAttention: string = null
  syncLabelState: string = ""
  syncLabelEth1Connected: string = ""

  isBuggyPrismVersion = false

  magicGapNumber = 60

  private backbuttonSubscription: Subscription;


  constructor(private modalCtrl: ModalController,
    storage: StorageService) {
    super(storage)
  }

  async ngOnInit() {
    this.selectionTimeFrame = this.timeframe
    const event = fromEvent(document, 'backbutton');
    this.backbuttonSubscription = event.subscribe(async () => {
      this.modalCtrl.dismiss();
    });

    if (this.data) {
      this.magicGapNumber = this.normalizeTimeframeNumber(this.data.system)
      this.os = this.formatOS(this.getLastFrom(this.data.system, (array) => array.misc_os))
      this.uptime = this.getLastFrom(this.data.system, (array) => array.misc_node_boot_ts_seconds) * 1000
      this.threadCount = this.getLastFrom(this.data.system, (array) => array.cpu_threads)
      this.coreCount = this.getLastFrom(this.data.system, (array) => array.cpu_cores)

      this.headslot = this.getLastFrom(this.data.node, (array) => array.sync_beacon_head_slot)

      let synced = this.getLastFrom(this.data.node, (array) => array.sync_eth2_synced)
      this.stateSynced = synced ? "Synced" : "Syncing"

      this.validatorLabelActive = "Active: " + this.getLastFrom(this.data.validator, (array) => array.validator_active)
      this.validatorLabelTotal = "Total: " + this.getLastFrom(this.data.validator, (array) => array.validator_total)

      this.diskLabel = "Free Space: " + bytes(this.getLastFrom(this.data.system, (array) => array.disk_node_bytes_free), true, true, 3)
      this.beaconchainLabel = "Size: " + bytes(this.getLastFrom(this.data.node, (array) => array.disk_beaconchain_bytes_total), true, true, 3)
    
      this.peerLabel = "Peers: " + this.getLastFrom(this.data.node, (array) => array.network_peers_connected)
    
      this.networkLabelRx = "Receive: " + bytes(this.getAvgFrom(this.data.system, (array) => array.network_node_bytes_total_receive / this.magicGapNumber, true), true, true, 2) + "/s"
      this.networkLabelTx = "Transmit: " +  bytes(this.getAvgFrom(this.data.system, (array) => array.network_node_bytes_total_transmit / this.magicGapNumber, true), true, true, 2)+"/s"
    
      this.memoryLabelFree = "Free: " + bytes(this.getLastFrom(this.data.system, (array) => array.memory_node_bytes_free), true, true, 1)
      this.memoryLabelTotal = "Total: " + bytes(this.getLastFrom(this.data.system, (array) => array.memory_node_bytes_total), true, true, 1)
   
      this.memoryProcessLabelNode = "Node: " + bytes(this.getLastFrom(this.data.node, (array) => array.memory_process_bytes), true, true, 2)
      this.memoryProcessLabelVal = "Validator: " + bytes(this.getLastFrom(this.data.validator, (array) => array.memory_process_bytes), true, true, 2)
    
      this.cpuProcessLabelNode = "Node: " +
        (this.getAvgRelativeFrom(
          this.getLastN(this.data.node, (array) => array.cpu_process_seconds_total, true),
          this.getLastN(this.data.system, (array) => array.cpu_node_system_seconds_total, true),
          (val1, val2) => { return val1 / val2 }
        ) * 100).toFixed(1) + "%"
      
        this.cpuProcessLabelVal = "Validator: " +
        (this.getAvgRelativeFrom(
          this.getLastN(this.data.validator, (array) => array.cpu_process_seconds_total, true, 180),
          this.getLastN(this.data.system, (array) => array.cpu_node_system_seconds_total, true, 180),
          (val1, val2) => { return val1 / val2 }
        ) * 100).toFixed(2) + "%"
      
      this.cpuLabelTotal = "Current usage: " +
          (100.0 - (this.getAvgRelativeFrom(
          this.getLastN(this.data.system, (array) => array.cpu_node_idle_seconds_total, true),
          this.getLastN(this.data.system, (array) => array.cpu_node_system_seconds_total, true),
          (val1, val2) => { return val1 / val2 }
        ) * 100)).toFixed(1) + "%"
      
      this.diskUsageLabelReads = "Reads: " + Math.round(this.getAvgFrom(this.data.system, (array) => array.disk_node_reads_total / this.magicGapNumber, true)) + " iops"
      this.diskUsageLabelWrites = "Writes: " + Math.round(this.getAvgFrom(this.data.system, (array) => array.disk_node_writes_total / this.magicGapNumber, true)) + " iops"
    
      let eth1Connected = this.getLastFrom(this.data.node, (array) => array.sync_eth1_connected)
      this.syncLabelEth1Connected = eth1Connected ? "ETH1 Connected" : "ETH1 Offline"

      let fulylSynced =  this.getLastFrom(this.data.node, (array) => array.sync_eth2_synced)
      this.syncLabelState = fulylSynced ? "Synced" : "Syncing..."

      this.syncAttention = this.getSyncAttention(this.data)
      this.diskAttention = await this.getDiskAttention(this.data)

      this.fallbacks = this.getFallbackConfigurations(this.data)

      this.isBuggyPrismVersion = this.isBuggyPrysmVersion(this.data)
      
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

    if (!current) return chartData;
    if (!current.system) return ["system_missing"]

    if (current && current.system) {
      const data = this.timeAxisChanges(current.system, (value) => { return value.disk_node_bytes_free }, false)
      this.diskFullEst = this.getDiskFullTimeEstimate(data)
      chartData.push(
        {
          name: 'Free Space',
          color: '#7cb5ec',
          data: data,
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

    let absolute = this.addAbsoluteConfig()
    let special = {
      config: {
        yAxis: {
          allowDecimals: false
        }
      }
    }
    const mergedConfig = Object.assign(absolute, special);
    chartData.push(mergedConfig)

    return chartData
  }

  public doDiskIoUsageCharts(current): any[] {
    const chartData = []

    if (!current) return chartData;
    if (!current.system) return ["system_missing"] 

    if (current && current.system) {
      chartData.push(
        {
          name: 'Reads',
          color: '#Dcb5ec',
          data: this.timeAxisChanges(current.system, (value) => { return value.disk_node_reads_total / this.magicGapNumber }, true),
          pointWidth: 25,
        }
      )
      chartData.push(
        {
          name: 'Writes',
          color: '#7cb5ec',
          data: this.timeAxisChanges(current.system, (value) => { return value.disk_node_writes_total / this.magicGapNumber }, true),
          pointWidth: 25,
        }
      )
    }

    chartData.push(this.addAbsoluteConfig(" iops"))

    return chartData
  }

  public doNetworkCharts(current): any[] {
    const chartData = []

    if (!current) return chartData;
    if (!current.system) return ["system_missing"] 

    if (current && current.system) {
      console.log("system", current.system)
      chartData.push(
        {
          name: 'Receive',
          color: '#7cb5ec',
          data: this.timeAxisChanges(current.system, (value, timeDiff) => {
            let secondsDiff = (timeDiff / 1000)
            return value.network_node_bytes_total_receive / this.magicGapNumber
          }, true),
          pointWidth: 25,
        }
      )
      chartData.push(
        {
          name: 'Transmit',
          color: '#Dcb5ec',
          data: this.timeAxisChanges(current.system, (value, timeDiff) => {
            let secondsDiff = (timeDiff / 1000)
            return value.network_node_bytes_total_transmit / this.magicGapNumber
          }, true),
          pointWidth: 25,
        }
      )
    }

    chartData.push(this.addBytesConfig(true))

    return chartData
  }

  public doCPUSystemCharts(current): any[] {
    const chartData = []

    if (!current) return chartData;
    if (!current.system) return ["system_missing"] 

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
          data: this.timeAxisRelative(cpuSystemTotal, io, false, 100),
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
          pointFormatter: function () {
            var point = this;
            return '<span style="color:' + point.color + '">\u25CF</span> ' + point.series.name + ': <b>' + point.y.toFixed(2) + "%" + "</b>"
          }
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

    if (!current) return chartData;
    if (!current.system) return ["system_missing"] 

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

  getDiskFullTimeEstimate(data: any[]): number {
    const amount = data[data.length - 1][1] - data[0][1]
    const tsDiff = Math.abs(data[data.length - 1][0] - data[0][0])
    if(amount > 0) return 0 
    return Date.now() + (data[0][1] / Math.abs(amount)) * tsDiff
  }

}