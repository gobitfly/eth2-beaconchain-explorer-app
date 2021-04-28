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

export default class MachineController {

    public chartErrors: boolean[] = []


    public doMemoryCharts(current): any[] {
        const chartData = []

        if (current && current.validator) {
            chartData.push(
                {
                    name: 'Memory: Validator',
                    color: '#7cb5ec',
                    data: this.timeAxisChanges(current.validator, (value) => { return value.memory_process_bytes }),
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

        if (current && current.system) {
            chartData.push(
                {
                    name: 'Memory: System',
                    color: '#3FF5ec',
                    data: this.timeAxisChanges(current.system, (value) => { return value.memory_node_bytes_total }),
                    pointWidth: 25,
                }
            )

        }

        return chartData
    }

    public doCPUCharts(current): any[] {
        const chartData = []

        if (current && current.validator) {
            chartData.push(
                {
                    name: 'CPU: Validator',
                    color: '#7cb5ec',
                    data: this.timeAxisChanges(current.validator, (value) => { return value.cpu_process_seconds_total }, true),
                    pointWidth: 25,
                }
            )
           
        }

        if (current && current.node) {
            chartData.push(
                {
                    name: 'CPU: Node',
                    color: '#Dcb5ec',
                    data: this.timeAxisChanges(current.node, (value) => { return value.cpu_process_seconds_total }, true),
                    pointWidth: 25,
                }
            )
        }

        if (current && current.system) {
            chartData.push(
                {
                    name: 'CPU: System',
                    color: '#3FF5ec',
                    data: this.timeAxisChanges(current.system, (value) => { return value.cpu_node_system_seconds_total }, true),
                    pointWidth: 25,
                }
            )

        }

        return chartData
    }

    public doSyncCharts(current): any[] {
        const chartData = []

        if (current && current.node) {
            chartData.push(
                {
                    name: 'ETH1 Fallback',
                    color: '#7cb5ec',
                    data: this.timeAxisChanges(current.node, (value) => { return value.sync_eth1_fallback_connected }, false),
                    pointWidth: 25,
                }
            )
        }

        if (current && current.validator) {
            chartData.push(
                {
                    name: 'ETH2 Fallback',
                    color: '#Dcb5ec',
                    data: this.timeAxisChanges(current.validator, (value) => { return value.sync_eth2_fallback_connected }, false),
                    pointWidth: 25,
                }
            )
        }

        if (current && current.node) {
            chartData.push(
                {
                    name: 'ETH1 Connected',
                    color: '#3335FF',
                    data: this.timeAxisChanges(current.node, (value) => { return value.sync_eth1_connected }, false),
                    pointWidth: 25,
                }
            )
        }

        if (current && current.node) {
            chartData.push(
                {
                    name: 'ETH2 Synced',
                    color: '#3FF5ec',
                    data: this.timeAxisChanges(current.node, (value) => { return value.sync_eth2_synced }, false),
                    pointWidth: 25,
                }
            )

        }

        return chartData
    }

    // --- Data helper functions ---

    public timeAxisChanges(data: StatsBase[], delegateValue: (value) => number, accumilative: boolean = false) {
        var result = []
        var summedUp = 0
        var lastValue = 0
        data.forEach((value) => {
            const current = delegateValue(value)
            if (accumilative && current > summedUp) summedUp = 0
            if (accumilative) console.log("accu", summedUp, lastValue, current)
            
            const temp = accumilative ? summedUp - current : current
            result.push([
                value.timestamp,
                temp > 0 ? temp: 0
            ])

            lastValue = current
            if (accumilative) {
                
                summedUp = lastValue
            }
           
        })
        return result
    }

    public combineByMachineName(validator: [], node: [], system: []) {
        const allKeys = this.findAllKeys(validator, node, system)
        var result: ProcessedStats[] = []
        for (var key in allKeys) {
            const unixTime = this.findAnyData(validator[key], node[key], system[key], (value) => { return value.timestamp })
            console.log("unixTime", unixTime)
            result[key] = {
                validator: validator[key],
                node: node[key],
                system: system[key],
                client: this.findAnyData(validator[key], node[key], system[key], (value) => { return value.client_name }),
                clientVersion: this.findAnyData(validator[key], node[key], system[key], (value) => { return value.client_version }),
                formattedDate: unixTime ? new Date(unixTime) : null,
                status: "ONLINE"
            }
        }
        return result
    }

    public findAnyData(validator: [], node: [], system: [], dataCallback: (value) => any) {
        const result1 = this.findAnyDataIn(validator, dataCallback)
        const result3 = this.findAnyDataIn(node, dataCallback)
        const result4 = this.findAnyDataIn(system, dataCallback)
        return result1 != null ? result1 : result3 != null ? result3 : result4 != null ? result4 : null
    }

    public findAnyDataIn(current: [], dataCallback: (value) => string) {
        if (!current || current.length <= 0) return null
        const result = dataCallback(current[current.length - 1])
        if (result && result != "") {
            return result
        }
        return null
    }

    public findAllKeys(validator: [], node: [], system: []) {
        var result = []
        for (var key in validator) { result[key] = true }
        for (var key in node) { result[key] = true }
        for (var key in system) { result[key] = true }
        return result
    }

    public filterMachines(data: StatsBase[]) {
        var result: [] = []
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