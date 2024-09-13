import { Component, Input } from '@angular/core'
import { Browser } from '@capacitor/browser'
import { StorageService } from 'src/app/services/storage.service'
import { AlertService } from 'src/app/services/alert.service'
import { ModalController } from '@ionic/angular'

@Component({
	selector: 'app-merge-checklist',
	templateUrl: './merge-checklist.page.html',
	styleUrls: ['./merge-checklist.page.scss'],
})
export class MergeChecklistPage {
	@Input() fromSettings = false

	public todo = [
		{ val: 'Run your own execution client', isChecked: false, key: 'cl_own_client', timing: 'Timing: Do this now' },
		{ val: 'Update execution & consensus client', isChecked: false, key: 'cl_update', timing: 'Timing: Do this after TTD client releases' },
		{ val: 'JWT authentication for Engine API', isChecked: false, key: 'cl_auth', timing: 'Timing: Do this after TTD client releases' },
		{ val: 'Set fee recipient address', isChecked: false, key: 'cl_fee_recipient', timing: 'Timing: Do this after TTD client releases' },
		{
			val: 'Remove external execution client fallbacks like Infura.',
			isChecked: false,
			key: 'cl_no_ext_fallbacks',
			timing: 'Timing: Do this after TTD client releases',
		},
	]

	public optional = [
		{ val: 'Prune execution client', isChecked: false, key: 'cl_prune' },
		{ val: 'Setup MEV Boost', isChecked: false, key: 'cl_mevboost' },
	]

	constructor(private modalCtrl: ModalController, private storage: StorageService, private alerts: AlertService) {
		this.loadCheckedState(this.todo)
		this.loadCheckedState(this.optional)
	}

	async loadCheckedState(array: { key: string; isChecked: boolean }[]) {
		for (let i = 0; i < array.length; i++) {
			array[i].isChecked = await this.getChecked(array[i])
		}
	}

	closeModal() {
		this.modalCtrl.dismiss()
	}

	async openBrowser(link: string) {
		await Browser.open({ url: link, toolbarColor: '#2f2e42' })
	}

	async getChecked(entry: { key: string; isChecked: boolean }) {
		return await this.storage.getBooleanSetting(entry.key, false)
	}

	change(entry: { detail: { value: { key: string; isChecked: boolean } } }) {
		if (!entry || !entry.detail) return
		this.storage.setBooleanSetting(entry.detail.value.key, entry.detail.value.isChecked)
	}

	dismissChecklist() {
		this.alerts.confirmDialog(
			'Hide Checklist',
			'You are about to hide the checklist from your dashboard. You can still find it in the settings page.',
			'OK',
			() => {
				this.storage.setBooleanSetting('merge_list_dismissed', true)
				this.closeModal()
			}
		)
	}
}
