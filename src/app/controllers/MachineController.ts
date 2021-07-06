/* 
 *  // Copyright (C) 2020 - 2021 Bitfly GmbH
 *  // Manuel Caspari (manuel@bitfly.at)
 *  // 
 *  // This file is part of Beaconchain Dashboard.
 *  // 
 *  // Beaconchain Dashboard is free software: you can redistribute it and/or modify
 *  // it under the terms of the GNU General Public License as published by
 *  // the Free Software Foundation, either version 3 of the License, or
 *  // (at your option) any later version.
 *  // 
 *  // Beaconchain Dashboard is distributed in the hope that it will be useful,
 *  // but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  // GNU General Public License for more details.
 *  // 
 *  // You should have received a copy of the GNU General Public License
 *  // along with Beaconchain Dashboard.  If not, see <http://www.gnu.org/licenses/>.
 */

import { HDD_THRESHOLD, StorageService } from "../services/storage.service";

const OFFLINE_THRESHOLD = 8 * 60 * 1000


export default class MachineController {

    constructor(private store: StorageService) {
        
    }

    selectionTimeFrame: number = 180

    public addBytesConfig(perS: boolean = false) {
        return {
            config: {
                tooltip: {
                    style: {
                        color: 'var(--text-color)',
                        fontWeight: 'bold'
                      },
                    pointFormatter: function () {
                      var point = this;
                      return '<span style="color:' + point.color + '">\u25CF</span> ' + point.series.name + ': <b>' + bytes(point.y, true, true) + (perS ? "/s" : "") + "</b>"
                    }
                },
                yAxis: {
                    
                    labels: {
                        x: -5,
                        formatter: function() {
                            return bytes(this.value, true, this.isFirst, 0) + (perS ? "/s" : "");
                        }
                    }
                },
            }
        }
    }

    public addAbsoluteConfig(postFix = "") {
        return {
            config: {
                tooltip: {
                    style: {
                        color: 'var(--text-color)',
                        fontWeight: 'bold'
                      },
                    pointFormatter: function () {
                      var point = this;
                      return '<span style="color:' + point.color + '">\u25CF</span> ' + point.series.name + ': <b>' + point.y.toFixed(0) + postFix + "</b>"
                    }
                },
                yAxis: 
                    {
                    labels: {
                        x: -5,
                        formatter: function () {
                          return this.value
                        },
            
                      }
                    }
                  ,
            }
        }
    }


    public doMemoryCharts(current): any[] {
        const chartData = []

        if (current && current.system) {
            chartData.push(
                {
                    name: 'Memory: System',
                    color: '#7cb5ec',
                    data: this.timeAxisChanges(current.system, (value) => { return value.memory_node_bytes_total }),
                    pointWidth: 25,
                }
            )
        }

        if (current && current.node) {
            chartData.push(
                {
                    name: 'Memory: Beaconnode',
                    color: '#Dcb5ec',
                    data: this.timeAxisChanges(current.node, (value) => { return value.memory_process_bytes }),
                    pointWidth: 25,
                }
            )
        }

        if (current && current.validator) {
            chartData.push(
                {
                    name: 'Memory: Validator',
                    color: '#3FF5ec',
                    data: this.timeAxisChanges(current.validator, (value) => { return value.memory_process_bytes }),
                    pointWidth: 25,
                }
            )
        }

        chartData.push(this.addBytesConfig())

        return chartData
    }

    public doCPUCharts(current): any[] {
        const chartData = []

        if (!current) return chartData
        if (!current.system) return ["system_missing"] 

        let cpuSystemTotal = this.timeAxisChanges(current.system, (value) => { return value.cpu_node_system_seconds_total }, true)

        if (current && current.validator) {
            let cpuValidator = this.timeAxisChanges(current.validator, (value) => { return value.cpu_process_seconds_total }, true)
            chartData.push(
                {
                    name: 'CPU: Validator',
                    color: '#7cb5ec',
                    data: this.timeAxisRelative(cpuSystemTotal, cpuValidator, false, 100), //this.timeAxisChanges(current.validator, (value) => { return value.cpu_process_seconds_total }, true),
                    pointWidth: 25,
                }
            )
        }

        if (current && current.node) {
            let cpuNode = this.timeAxisChanges(current.node, (value) => { return value.cpu_process_seconds_total }, true)
            chartData.push(
                {
                    name: 'CPU: Beaconnode',
                    color: '#Dcb5ec',
                    data: this.timeAxisRelative(cpuSystemTotal, cpuNode, false), //this.timeAxisChanges(current.node, (value) => { return value.cpu_process_seconds_total }, true),
                    pointWidth: 25,
                }
            )
        }

       /* if (current && current.system) {
            chartData.push(
                {
                    name: 'CPU: System',
                    color: '#3FF5ec',
                    data: this.timeAxisChanges(current.system, (value) => { return value.cpu_node_system_seconds_total }, true),
                    pointWidth: 25,
                }
            )
        }*/

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
 /*

    }*/

        return chartData
    }

    public getFallbackConfigurations(data: ProcessedStats): FallbackConfigurations {
        if (!data) {
            return {
                eth1Configured: false,
                eth2Configured: false
            }
        }
        let isLighthouse = data.client == "lighthouse"
        /*
            TODO:
            Workaround Lighthouse: lighthouse sync_eth2_fallback_connected & sync_eth1_fallback_connected
            are currently reflecting the sync_eth2_fallback_configured flag. This is a known issue,
            we are excluding this sync attention data
        */

        let eth2FallbackConfigured = this.getLastFrom(data.node, (array) => array.sync_eth2_fallback_configured)
        let eth1FallbackConfigured = this.getLastFrom(data.node, (array) => array.sync_eth1_fallback_configured)
        return {
            eth1Configured: eth1FallbackConfigured && !isLighthouse,
            eth2Configured: eth2FallbackConfigured && !isLighthouse
        }
    }

    public doSyncCharts(current): any[] {
        const chartData = []

        let fallbacks = this.getFallbackConfigurations(current)
         
        if (current && current.node && fallbacks.eth1Configured) {
            chartData.push(
                {
                    name: 'ETH1 Fallback',
                    color: '#ffcc9c',
                    data: this.timeAxisChanges(current.node, (value) => { return value.sync_eth1_fallback_connected ? 1 : 0 }, false),
                    pointWidth: 25,
                }
            )
        }

        if (current && current.validator && fallbacks.eth2Configured) {
            chartData.push(
                {
                    name: 'ETH2 Fallback',
                    color: '#Dcb5ec',
                    data: this.timeAxisChanges(current.validator, (value) => { return value.sync_eth2_fallback_connected ? 1.1 : 0 }, false),
                    pointWidth: 25,
                }
            )
        }

        if (current && current.node) {
            chartData.push(
                {
                    name: 'ETH1 Connected',
                    color: '#3335FF',
                    data: this.timeAxisChanges(current.node, (value) => { return value.sync_eth1_connected ? 1.2 : 0 }, false),
                    pointWidth: 25,
                }
            )
        }

        if (current && current.node) {
            chartData.push(
                {
                    name: 'ETH2 Synced',
                    color: '#3FF5ec',
                    data: this.timeAxisChanges(current.node, (value) => { return value.sync_eth2_synced ? 1.3 : 0 }, false), 
                    pointWidth: 25,
                }
            )
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
                      return '<span style="color:' + point.color + '">\u25CF</span> ' + point.series.name + ': <b>' + (point.y ? "True" : "False") + "</b>"
                    }
                },
                yAxis: 
                {
                    allowDecimals: false,
                    labels: {
                            x: -5,
                        step: 1,
                        formatter: function () {
                          return this.value >= 1 ? "True" : "False"
                        },
            
                      }
                    }
                  ,
            }
        })

        return chartData
    }

    isBuggyPrysmVersion(data: ProcessedStats): boolean {
        return data.client == "prysm" && (!data.system || data.system.length <= 2 || data.system[0].cpu_cores == 0)
    }

    async getAnyAttention(data: ProcessedStats) {
        let sync = this.getSyncAttention(data)
        if (sync) return sync
        return await this.getDiskAttention(data)
    }

    protected async getDiskAttention(data: ProcessedStats): Promise<string> {
        if(!data || !data.system) return null
        let freePercentage = this.getLastFrom(data.system, (array) => array.disk_node_bytes_free / array.disk_node_bytes_total)
        const threshold = 100 -(await this.store.getSetting(HDD_THRESHOLD, 90))
        console.log("HDD threshold", threshold)

        if (freePercentage < threshold/100) {
            return "Your disk is almost full. There's less than " + threshold + "% free space available."
        }
        
        return null
    }

    async getOnlineState(data: ProcessedStats) {
        if (!data || !data.formattedDate) return "offline";
        const now = Date.now()
        const diff = now - data.formattedDate.getTime()
        if (diff > OFFLINE_THRESHOLD) return "offline"
    
        if (await this.getAnyAttention(data) != null) {
          return "attention"
        }
        return "online"
      }

    protected getSyncAttention(data: ProcessedStats): string {
        let synced = this.getLastFrom(data.node, (array) => array.sync_eth2_synced)
        let eth1Connected = this.getLastFrom(data.node, (array) => array.sync_eth1_connected)

        let fallbacksConfigured = this.getFallbackConfigurations(data)
        let eth2Fallback = this.getLastFrom(data.node, (array) => array.sync_eth2_fallback_connected)
        let eth1Fallback = this.getLastFrom(data.node, (array) => array.sync_eth1_fallback_connected)

        if (!data.node) {
            return "No beaconnode data found. If you wish to track this data, make sure to configure metric tracking on your beaconnode machine too. <a target='_blank' href='https://kb.beaconcha.in/mobile-app-less-than-greater-than-beacon-node'>Learn more here</a>."
        } else if (!eth1Connected) {
            return "No ETH1 connection, make sure you have configured an ETH1 endpoint and it is currently active and synced."
        } else if (eth2Fallback && fallbacksConfigured.eth2Configured) {
            return "Main ETH2 node is not reachable, you are currently connected via a fallback connection."
        } else if (eth1Fallback && fallbacksConfigured.eth1Configured) {
            return "Main ETH1 is not reachable, you are currently connected via a fallback connection."
        } else if (!synced) {
            return "Your beaconnode is currently syncing. It might take some time to get fully synced."
        } else if (!data.validator) {
            return "No validator data found. If you wish to track this data, make sure to configure metric tracking on your validator machine too. <a target='_blank' href='https://kb.beaconcha.in/mobile-app-less-than-greater-than-beacon-node'>Learn more here</a>."
        }
        return null
    }

    protected getLastN(dataArray: any[], callbackValue: (array) => any, isDiffPair: boolean = false, depth = 10) {
        var erg = []
        if (!dataArray) return null
        const length = Math.min(dataArray.length, depth)
        if (length <= 0) return null

        if (isDiffPair && length <= 2) return null
        
        for (var i = 1; i < length; i++) {
            if (isDiffPair) {
                erg[i-1] = callbackValue(dataArray[dataArray.length - i]) - callbackValue(dataArray[dataArray.length - (i+1)])
            } else {
                erg[i-1] = callbackValue(dataArray[dataArray.length - i])
            }
        }

        return erg
    }


    protected getAvgFrom(dataArray: any[], callbackValue: (array) => any, isDiffPair: boolean = false, depth = 10): any {
        let data = this.getLastN(dataArray, callbackValue, isDiffPair, depth)
        if (!data) return null
        
        let erg = data.reduce((sum, cur) => sum + cur)
       
        return Math.round((erg / (depth -1)) * 100) / 100
    }

    protected getAvgRelativeFrom(data1LastN: any[], data2LastN: any[], callback: (val1, val2) => any) {
        if(!data1LastN || ! data2LastN) return null
        const length = Math.min(data1LastN.length, data2LastN.length)
        
        var erg = 0
        for (var i = 0; i < length; i++){
            let second = data2LastN[i]
            if (second == 0) continue;
            erg += callback(data1LastN[i], second)
        }

        console.log("getAvgRelativeFrom",  Math.round((erg / length) * 10000) / 10000)
        return Math.round((erg / length) * 10000) / 10000
    }

    protected getLastFrom(dataArray: any[], callbackValue: (array) => any, isDiffPair: boolean = false): any {
        if (!dataArray || dataArray.length <= 0) return null
        if (isDiffPair) {
            if (dataArray.length <= 2) return null
            return callbackValue(dataArray[dataArray.length - 1]) - callbackValue(dataArray[dataArray.length - 2])
        } else {
            return callbackValue(dataArray[dataArray.length - 1])
        }
    }

    // --- Data helper functions ---

    getGapSize(dataSet: StatsBase[]) {
        return Math.abs(dataSet[dataSet.length - 2].row - dataSet[dataSet.length - 1].row)
    }

    normalizeTimeframeNumber(dataSet: StatsBase[]): number {
        let gapSize = this.getGapSize(dataSet)

        if(gapSize >= 5) return 5 * 60
        if(gapSize >= 4) return 4 * 60
        if(gapSize >= 3) return 3 * 60
        return 60
    }

    timeAxisRelative(max: any[], current: any[], inverted: boolean = false, rounding = 10) {
        var result = []
        /*if (max.length != current.length) {
            console.warn("timeAxisRelative max and current array is differently sized")
            return [] 
        }*/
        const gapSize = this.normalizeTimeframeNumber(max)

        var maxOffset = 0
        var currentOffest = 0

        while (true) {
            if (current.length <= currentOffest) break;
            if (max.length <=  maxOffset) break;
            var curV = current[currentOffest]
            var maxV = max[maxOffset]

            let drift = curV[0] - maxV[0]

            if (drift > gapSize * 1500) {
                maxOffset++

                if (drift > gapSize * 3000 ) {
                    result.push([maxV[0], 0])
                }
  
                continue;
            } else if (drift < gapSize * -1500) {
                currentOffest++;
                
                if (drift < gapSize * -3000 ) {
                    result.push([curV[0], 0])
                }

                continue;
            }

            let tempValue = maxV[1] == 0 ? 0 : Math.round((curV[1] / maxV[1]) * (100 * rounding)) / rounding
            let value = inverted ? Math.round((100 - tempValue) * 10) / 10 : tempValue 
            result.push([
                maxV[0],
                maxV[1] == 0 ? 0 : value
            ])

            maxOffset++
            currentOffest++
        }
        return result
    }

    public timeAxisChanges(data: StatsBase[], delegateValue: (value, timeDiff?) => number, accumilative: boolean = false) {
        var result = []
        var summedUp = -1
        var lastValue = 0
        var lastTimestamp = -1
        data.forEach((value) => {
            const current = delegateValue(value, value.timestamp - lastTimestamp)
            if (accumilative && current < summedUp) summedUp = 0
            
            const temp = accumilative ? Math.round((current - summedUp) * 100) / 100 : current

            if (lastTimestamp != -1 && lastTimestamp + this.selectionTimeFrame * 60 * 1000 < value.timestamp) {
                console.log("shorting selection: ", this.selectionTimeFrame)
                result = []
                summedUp = -1
            } else {
                
                if (lastTimestamp != -1 && lastTimestamp + 45 * 60 * 1000 < value.timestamp) {
                    console.log("filling empty plots with zeros: ", lastTimestamp, value.timestamp)

                    this.fillWithZeros(result, lastTimestamp, value.timestamp)

                    summedUp = -1
                }
            }

            if (summedUp != -1 || !accumilative) {
                if (!accumilative || summedUp * 25 > temp) {
                    result.push([
                        value.timestamp,
                        temp > 0 ? temp : 0
                    ])
                } else {
                    summedUp = temp
                }
                
            }

            lastTimestamp = value.timestamp
            lastValue = current
            if (accumilative) {
                
                summedUp = lastValue
            }
           
        })
        return result
    }

    fillWithZeros(array: any[], from: number, to: number): any[] {
        const interval = 60000
        for (var i: number = from + interval; i < to - interval; i += interval){
            array.push([
                i,
                0
            ])
        }
        return array
    }

    public combineByMachineName(validator: any[], node: any[], system: any[]) {
        const allKeys = this.findAllKeys(validator, node, system)
        var result: ProcessedStats[] = []
        for (var key in allKeys) {
            let sortedVal = this.sortData(validator[key]) as StatsValidator[]
            let sortedNode = this.sortData(node[key]) as StatsNode[]
            let sortedSystem = this.sortData(system[key]) as StatsSystem[]

            const unixTime = this.findAnyData(sortedVal, sortedNode, sortedSystem, (value) => { return value.timestamp })
            result[key] = {
                validator: sortedVal,
                node: sortedNode,
                system: sortedSystem,
                client: this.findAnyData(sortedVal, sortedNode, sortedSystem, (value) => { return value.client_name }),
                clientVersion: this.findAnyData(sortedVal, sortedNode, sortedSystem, (value) => { return value.client_version }),
                formattedDate: unixTime ? new Date(unixTime) : null,
                status: "ONLINE"
            }
        }
        
        return result
    }


    public sortData<Type extends StatsBase>(array: Type[]): Type[] {
        if(!array) return array
        return array.sort((n1, n2) => {
            if (n1.timestamp > n2.timestamp) return 1
            if (n1.timestamp < n2.timestamp) return -1
            return 0
        })
    }

    public findAnyData(validator: any[], node: any[], system: any[], dataCallback: (value) => any) {
        const result1 = this.findAnyDataIn(validator, dataCallback)
        const result3 = this.findAnyDataIn(node, dataCallback)
        const result4 = this.findAnyDataIn(system, dataCallback)
        return result1 != null ? result1 : result3 != null ? result3 : result4 != null ? result4 : null
    }

    public findAnyDataIn(current: any[], dataCallback: (value) => string) {
        if (!current || current.length <= 0) return null
        const result = dataCallback(current[current.length - 1])
        if (result && result != "") {
            return result
        }
        return null
    }

    public findAllKeys(validator: any[], node: any[], system: any[]) {
        var result = []
        for (var key in validator) { result[key] = true }
        for (var key in node) { result[key] = true }
        for (var key in system) { result[key] = true }
        return result
    }

    public filterMachines<Type extends StatsBase> (data: Type[]): Type[] {
        var result: Type[] = []
        for (let i = 0; i < data.length; i++) {
            if (result[data[i].machine] == null) {
                result[data[i].machine] = []
            }
            result[data[i].machine].push(data[i])
        }
        return result
    }

    public hashCode(string: string) {
        var hash = 0;
        for (var i = 0; i < string.length; i++) {
            var character = string.charCodeAt(i);
            hash = ((hash << 5) - hash) + character;
            hash = hash & hash;
        }
        return hash;
    }
}

export const bytes = (function(){

    var s = ['b', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'],
        tempLabel = [], 
        count;
    
    return function(bytes, label, isFirst, precision = 3) {
        var e, value;
        
        if (bytes == 0) 
            return 0;
        
        if( isFirst )
            count = 0;
        
        e = Math.floor(Math.log(bytes) / Math.log(1024));
        value = (bytes / Math.pow(1024, Math.floor(e))).toFixed(precision);

        tempLabel[count] = value;        
        if( count > 0 && Math.abs(tempLabel[count-1]-tempLabel[count])<0.0001 )
            value = (bytes / Math.pow(1024, Math.floor(--e))).toFixed(precision);
        
        e = (e < 0) ? (-e) : e;
        if (label) value += ' ' + s[e];
        
        count++;
        return value;
    }

})();

export interface ProcessedStats extends StatsResponse {
    client: string,
    clientVersion: string,
    formattedDate: Date,
    status: 'ONLINE' | 'OFFLINE'
}

export interface StatsBase {
    machine: string,
    timestamp: number
    row: number
}

export interface ProcessBase extends StatsBase {
    client_name: string,
    client_version: string,
    cpu_process_seconds_total: number,
    memory_process_bytes: number,
    sync_eth2_fallback_configured: boolean,
    sync_eth2_fallback_connected: boolean,
}

export interface StatsResponse {
    validator: StatsValidator[],
    node: StatsNode[],
    system: StatsSystem[]
}

export interface StatsValidator extends ProcessBase {
    validator_active: number,
    validator_total: number
}

export interface StatsNode extends ProcessBase {
    disk_beaconchain_bytes_total: number,
    network_libp2p_bytes_total_receive: number,
    network_libp2p_bytes_total_transmit: number,
    network_peers_connected: number,
    sync_eth1_connected: boolean,
    sync_eth2_synced: boolean,
    sync_beacon_head_slot: number
    sync_eth1_fallback_configured: boolean,
    sync_eth1_fallback_connected: boolean,
}

export interface StatsSystem extends StatsBase {
    cpu_cores: number,
    cpu_node_idle_seconds_total: number,
    cpu_node_iowait_seconds_total: number,
    cpu_node_system_seconds_total: number,
    cpu_node_user_seconds_total: number,
    cpu_threads: number,
    disk_node_bytes_free: number,
    disk_node_bytes_total: number,
    disk_node_io_seconds: number,
    disk_node_reads_total: number,
    disk_node_writes_total: number,
    memory_node_bytes_buffers: number,
    memory_node_bytes_cached: number,
    memory_node_bytes_free: number,
    memory_node_bytes_total: number,
    misc_node_boot_ts_seconds: number,
    misc_os: string,
    network_node_bytes_total_receive: number,
    network_node_bytes_total_transmit: number,
}

export interface FallbackConfigurations {
    eth1Configured: boolean,
    eth2Configured: boolean
}
