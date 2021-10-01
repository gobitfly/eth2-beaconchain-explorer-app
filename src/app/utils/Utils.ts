import { SETTING_NOTIFY_DECREASED, SETTING_NOTIFY_SLASHED, SETTING_NOTIFY_PROPOSAL_SUBMITTED, SETTING_NOTIFY_PROPOSAL_MISSED, SETTING_NOTIFY_ATTESTATION_MISSED, SETTING_NOTIFY_MACHINE_OFFLINE, SETTING_NOTIFY_CPU_WARN, SETTING_NOTIFY_HDD_WARN, SETTING_NOTIFY_MEMORY_WARN} from './Constants'


//
export function getNotifySettingName(eventName: string): string {
    switch (eventName) {
      case "validator_balance_decreased": return SETTING_NOTIFY_DECREASED
      case "validator_got_slashed": return SETTING_NOTIFY_SLASHED
      case "validator_proposal_submitted": return SETTING_NOTIFY_PROPOSAL_SUBMITTED
      case "validator_proposal_missed": return SETTING_NOTIFY_PROPOSAL_MISSED
      case "validator_attestation_missed": return SETTING_NOTIFY_ATTESTATION_MISSED
      case "monitoring_machine_offline": return SETTING_NOTIFY_MACHINE_OFFLINE
      case "monitoring_cpu_load": return SETTING_NOTIFY_CPU_WARN
      case "monitoring_hdd_almostfull": return SETTING_NOTIFY_HDD_WARN
      case "monitoring_memory_usage": return SETTING_NOTIFY_MEMORY_WARN
      default: return null
    }
  }

export function getToggleFromEvent(eventName: string): string {

    switch (eventName) {
      case "validator_balance_decreased": return this.notifyDecreased
      case "validator_got_slashed": return this.notifySlashed
      case "validator_proposal_submitted": return this.notifyProposalsSubmitted
      case "validator_proposal_missed": return this.notifyProposalsMissed
      case "validator_attestation_missed": return this.notifyAttestationsMissed
      case "monitoring_machine_offline": return this.notifyMachineOffline
      case "monitoring_cpu_load": return this.notifyMachineCpuLoad
      case "monitoring_hdd_almostfull": return this.notifyMachineDiskFull
      case "monitoring_memory_usage": return this.notifyMachineMemoryLoad
      default: return null
    }
}