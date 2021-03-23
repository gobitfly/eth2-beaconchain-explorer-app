import { Component, OnInit } from '@angular/core';
import { ApiService } from 'src/app/services/api.service';
import { AlertController, ModalController } from '@ionic/angular';
import { MachineDetailPage } from '../machine-detail/machine-detail.page';
import MachineController, { ProcessedStats, StatsResponse } from '../../controllers/MachineController'
import { runCommandLine } from 'cordova-res';
import { AlertService } from 'src/app/services/alert.service';

const OFFLINE_THRESHOLD = 5 * 60 * 1000 // 5 minutes

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
    private alertService: AlertService
  ) {
    super()
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
        name: "14timed",
        label: "14d",
        value: "14d",
        type: "radio"
      }
    ], (data) => {
      console.log("select data", data)
      this.selectedTimeFrame = data
    })
  }

  getAndProcessData() {
    const data = this.mockStatsResponse()
    if (data == null) {
      this.data = []
      return
    }
    this.data = this.combineByMachineName(
      this.filterMachines(data.validator),
      this.filterMachines(data.slasher),
      this.filterMachines(data.node),
      this.filterMachines(data.system)
    )


    this.showData = Object.keys(this.data).length > 0

    /* const allKeys = Object.keys(this.data)
 
     for (let key of allKeys) {
       const current = this.data[key]
       this.doCPUCharts(key, current)
       this.doMemoryCharts(key, current)
       this.doSyncCharts(key, current)
     }
     
 
     
 
     setTimeout(() => {
       console.log("all data", this.data)
       const allKeys = Object.keys(this.data)
 
       for (let key of allKeys) {
         const current = this.data[key]
         this.doCPUCharts(key, current)
         this.doMemoryCharts(key, current)
         this.doSyncCharts(key, current)
       }
     }, 700); */

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

  private mockStatsResponse(): StatsResponse {

    return JSON.parse(`{

          "validator": [
              {
                  "client_name": "lighthouse",
                  "client_version": "1.1.2",
                  "cpu_process_seconds_total": 4,
                  "machine": "Manu",
                  "memory_process_bytes": 354321,
                  "sync_eth1_fallback_configured": true,
                  "sync_eth1_fallback_connected": false,
                  "sync_eth2_fallback_configured": false,
                  "sync_eth2_fallback_connected": false,
                  "timestamp": 16154603000,
                  "validator_active": 2,
                  "validator_total": 3
              },
              {
                "client_name": "lighthouse",
                "client_version": "1.1.2",
                "cpu_process_seconds_total": 15,
                "machine": "Manu",
                "memory_process_bytes": 454321,
                "sync_eth1_fallback_configured": true,
                "sync_eth1_fallback_connected": false,
                "sync_eth2_fallback_configured": false,
                "sync_eth2_fallback_connected": false,
                "timestamp": 161546063000,
                "validator_active": 2,
                "validator_total": 3
            },
            {
              "client_name": "lighthouse",
              "client_version": "1.1.2",
              "cpu_process_seconds_total": 38,
              "machine": "Manu",
              "memory_process_bytes": 154321,
              "sync_eth1_fallback_configured": true,
              "sync_eth1_fallback_connected": false,
              "sync_eth2_fallback_configured": false,
              "sync_eth2_fallback_connected": false,
              "timestamp": 161546123000,
              "validator_active": 2,
              "validator_total": 3
          },
          {
            "client_name": "lighthouse",
            "client_version": "1.1.2",
            "cpu_process_seconds_total": 89,
            "machine": "Manu",
            "memory_process_bytes": 654321,
            "sync_eth1_fallback_configured": true,
            "sync_eth1_fallback_connected": false,
            "sync_eth2_fallback_configured": false,
            "sync_eth2_fallback_connected": false,
            "timestamp": 161546183000,
            "validator_active": 2,
            "validator_total": 3
        }
        ,
          {
            "client_name": "lighthouse",
            "client_version": "1.1.2",
            "cpu_process_seconds_total": 160,
            "machine": "Manu",
            "memory_process_bytes": 454321,
            "sync_eth1_fallback_configured": true,
            "sync_eth1_fallback_connected": false,
            "sync_eth2_fallback_configured": false,
            "sync_eth2_fallback_connected": false,
            "timestamp": 161546243000,
            "validator_active": 2,
            "validator_total": 3
        }
          ],
          "slasher": [
            {
              "client_name": "lighthouse",
              "client_version": "1.1.2",
              "cpu_process_seconds_total": 9,
              "machine": "Manu",
              "memory_process_bytes": 354321,
              "sync_eth1_fallback_configured": true,
              "sync_eth1_fallback_connected": false,
              "sync_eth2_fallback_configured": false,
              "sync_eth2_fallback_connected": false,
              "timestamp": 16154603000,
              "validator_active": 2,
              "validator_total": 3
          },
          {
            "client_name": "lighthouse",
            "client_version": "1.1.2",
            "cpu_process_seconds_total": 14,
            "machine": "Manu",
            "memory_process_bytes": 254321,
            "sync_eth1_fallback_configured": true,
            "sync_eth1_fallback_connected": false,
            "sync_eth2_fallback_configured": false,
            "sync_eth2_fallback_connected": false,
            "timestamp": 161546063000,
            "validator_active": 2,
            "validator_total": 3
        },
        {
          "client_name": "lighthouse",
          "client_version": "1.1.2",
          "cpu_process_seconds_total": 28,
          "machine": "Manu",
          "memory_process_bytes": 554321,
          "sync_eth1_fallback_configured": true,
          "sync_eth1_fallback_connected": false,
          "sync_eth2_fallback_configured": false,
          "sync_eth2_fallback_connected": false,
          "timestamp": 161546123000,
          "validator_active": 2,
          "validator_total": 3
      },
      {
        "client_name": "lighthouse",
        "client_version": "1.1.2",
        "cpu_process_seconds_total": 49,
        "machine": "Peter",
        "memory_process_bytes": 454321,
        "sync_eth1_fallback_configured": true,
        "sync_eth1_fallback_connected": false,
        "sync_eth2_fallback_configured": false,
        "sync_eth2_fallback_connected": false,

        "validator_active": 2,
        "validator_total": 3
    }
          ],
          "node": [
            {
              "client_name": "lighthouse",
              "client_version": "1.1.2",
              "cpu_process_seconds_total": 10,
              "machine": "Manu",
              "memory_process_bytes": 654321,
              "sync_eth1_fallback_configured": true,
              "sync_eth1_fallback_connected": false,
              "sync_eth2_fallback_configured": false,
              "sync_eth2_fallback_connected": false,
              "timestamp": 16154603000,
              "validator_active": 2,
              "validator_total": 3,
              "sync_eth1_connected": true,
              "sync_eth2_synced": true,
              "network_peers_connected": 52,
              "sync_beacon_head_slot": 4444
            },
            {
              "client_name": "lighthouse",
              "client_version": "1.1.2",
              "cpu_process_seconds_total": 80,
              "machine": "Manu",
              "memory_process_bytes": 654321,
              "sync_eth1_fallback_configured": true,
              "sync_eth1_fallback_connected": false,
              "sync_eth2_fallback_configured": false,
              "sync_eth2_fallback_connected": false,
              "timestamp": 161546063000,
              "validator_active": 2,
              "validator_total": 3,
              "sync_eth1_connected": true,
              "sync_eth2_synced": false,
              "network_peers_connected": 54,
              "sync_beacon_head_slot": 4444
          },
          {
            "client_name": "lighthouse",
            "client_version": "1.1.2",
            "cpu_process_seconds_total": 200,
            "machine": "Manu",
            "memory_process_bytes": 654321,
            "sync_eth1_fallback_configured": true,
            "sync_eth1_fallback_connected": false,
            "sync_eth2_fallback_configured": false,
            "sync_eth2_fallback_connected": false,
            "timestamp": 161546123000,
            "validator_active": 2,
            "validator_total": 3,
            "sync_eth1_connected": true,
            "sync_eth2_synced": true,
            "network_peers_connected": 52,
            "sync_beacon_head_slot": 4445
        }
          ],
          "system": [
              {
                  "cpu_cores": 2,
                  "cpu_node_idle_seconds_total": 2547282,
                  "cpu_node_iowait_seconds_total": 654394,
                  "cpu_node_system_seconds_total": 200,
                  "cpu_node_user_seconds_total": 200,
                  "cpu_threads": 4,
                  "disk_node_bytes_free": 7777770,
                  "disk_node_bytes_total": 9999900,
                  "disk_node_io_seconds": 231232132,
                  "disk_node_reads_total": 929292,
                  "disk_node_writes_total": 6666,
                  "machine": "Manu",
                  "memory_node_bytes_buffers": 99999,
                  "memory_node_bytes_cached": 577777,
                  "memory_node_bytes_free": 4545454,
                  "memory_node_bytes_total": 798908,
                  "misc_node_boot_ts_seconds": 999,
                  "misc_os": "lin",
                  "network_node_bytes_total_receive": 1222,
                  "network_node_bytes_total_transmit": 1333,
                  "timestamp": 16154603000
              },
              {
                  "cpu_cores": 2,
                  "cpu_node_idle_seconds_total": 2547282,
                  "cpu_node_iowait_seconds_total": 654394,
                  "cpu_node_system_seconds_total": 287,
                  "cpu_node_user_seconds_total": 287,
                  "cpu_threads": 4,
                  "disk_node_bytes_free": 8777770,
                  "disk_node_bytes_total": 10999900,
                  "disk_node_io_seconds": 231232132,
                  "disk_node_reads_total": 1229292,
                  "disk_node_writes_total": 136666,
                  "machine": "Manu",
                  "memory_node_bytes_buffers": 99999,
                  "memory_node_bytes_cached": 577777,
                  "memory_node_bytes_free": 4545454,
                  "memory_node_bytes_total": 798908,
                  "misc_node_boot_ts_seconds": 999,
                  "misc_os": "lin",
                  "network_node_bytes_total_receive": 1444,
                  "network_node_bytes_total_transmit": 1666,
                  "timestamp": 161546063000
              }
          ]
    
  }`);
  }

}

