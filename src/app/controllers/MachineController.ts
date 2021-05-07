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

const bytes = (function(){

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


export default class MachineController {

    public chartErrors: boolean[] = []

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

    public addAbsoluteConfig() {
        return {
            config: {
                tooltip: {
                    style: {
                        color: 'var(--text-color)',
                        fontWeight: 'bold'
                      },
                    pointFormatter: function () {
                      var point = this;
                      return '<span style="color:' + point.color + '">\u25CF</span> ' + point.series.name + ': <b>' + point.y.toFixed(0)  + "</b>"
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
                    name: 'Memory: Node',
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

        let cpuSystemTotal = this.timeAxisChanges(current.system, (value) => { return value.cpu_node_system_seconds_total }, true)
        let cpuValidator = this.timeAxisChanges(current.validator, (value) => { return value.cpu_process_seconds_total }, true)
        let cpuNode = this.timeAxisChanges(current.node, (value) => { return value.cpu_process_seconds_total }, true)
        

        if (current && current.validator) {
            chartData.push(
                {
                    name: 'CPU: Validator',
                    color: '#7cb5ec',
                    data: this.timeAxisRelative(cpuSystemTotal, cpuValidator, true), //this.timeAxisChanges(current.validator, (value) => { return value.cpu_process_seconds_total }, true),
                    pointWidth: 25,
                }
            )
        }

        if (current && current.node) {
            chartData.push(
                {
                    name: 'CPU: Node',
                    color: '#Dcb5ec',
                    data: this.timeAxisRelative(cpuSystemTotal, cpuNode, true), //this.timeAxisChanges(current.node, (value) => { return value.cpu_process_seconds_total }, true),
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
 /*

    }*/

        return chartData
    }

    public doSyncCharts(current): any[] {
        const chartData = []

        if (current && current.node) {
            chartData.push(
                {
                    name: 'ETH1 Fallback',
                    color: '#ffcc9c',
                    data: this.timeAxisChanges(current.node, (value) => { return value.sync_eth1_fallback_connected ? 1 : 0 }, false),
                    pointWidth: 25,
                }
            )
        }

        if (current && current.validator) {
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

    // --- Data helper functions ---

    timeAxisRelative(max: any[], current: any[], inverted: boolean = false) {
        var result = []
        /*if (max.length != current.length) {
            console.warn("timeAxisRelative max and current array is differently sized")
            return []
        }*/

        var maxOffset = 0
        var currentOffest = 0

        for (var i = 0; i < max.length; i++) {
            if (current.length <= i + currentOffest) break;
            if (max.length <= i + maxOffset) break;
            var curV = current[i + currentOffest]
            var maxV = max[i + maxOffset]

            let drift = curV[0] - maxV[0]
            if (drift > 60000) {
                currentOffest++;
                if (current.length <= i + currentOffest) break;
                curV = current[i + currentOffest]
            } else if (drift < 60000) {
                maxOffset++
                if (max.length <= i + maxOffset) break;
                maxV = max[i + currentOffest];
            }

            let value = Math.round((curV[1] / maxV[1]) * 1000) / 10
            result.push([
                maxV[0],
                inverted ? 100 - value : value 
            ])
        }
        return result
    }

    public timeAxisChanges(data: StatsBase[], delegateValue: (value) => number, accumilative: boolean = false) {
        var result = []
        var summedUp = -1
        var lastValue = 0
        var lastTimestamp = -1
        data.forEach((value) => {
            const current = delegateValue(value)
            if (accumilative && current < summedUp) summedUp = 0
            
            const temp = accumilative ? current - summedUp : current

            if (lastTimestamp != -1 && lastTimestamp + 24 * 60 * 60 * 1000 < value.timestamp) {
                result = []
            }

            if (summedUp != -1 || !accumilative) {
                result.push([
                    value.timestamp,
                    temp > 0 ? temp : 0
                ])
            }

            lastTimestamp = value.timestamp
            lastValue = current
            if (accumilative) {
                
                summedUp = lastValue
            }
           
        })
        return result
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


export interface ProcessedStats extends StatsResponse {
    client: string,
    clientVersion: string,
    formattedDate: Date,
    status: 'ONLINE' | 'OFFLINE'
}

export interface StatsBase {
    machine: string,
    timestamp: number
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