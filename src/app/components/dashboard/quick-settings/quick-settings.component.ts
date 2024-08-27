import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { IonicModule } from '@ionic/angular'
import { DashboardItemComponent } from '../../dashboard-item/dashboard-item.component'
import { StorageService } from 'src/app/services/storage.service'
import { ModalController } from '@ionic/angular/standalone'
import { OverviewData2 } from 'src/app/controllers/OverviewController'
import { Aggregation, Period } from 'src/app/requests/v2-dashboard'
import { MerchantUtils } from 'src/app/utils/MerchantUtils'

@Component({
	selector: 'app-quick-settings',
	standalone: true,
	imports: [CommonModule, IonicModule, DashboardItemComponent],
	templateUrl: './quick-settings.component.html',
	styleUrl: './quick-settings.component.scss',
})
export class QuickSettingsComponent {
	@Input() data: OverviewData2

	allDataPeriods: OptionType[] = [
		{ label: 'All Time', value: Period.AllTime, disabled: false },
		{ label: 'Last 24h', value: Period.Last24h, disabled: false },
		{ label: 'Last 7d', value: Period.Last7d, disabled: false },
		{ label: 'Last 30d', value: Period.Last30d, disabled: false },
	]

	allChartHistoryAggregations: OptionType[] = null

	constructor(private storage: StorageService, private modalCtrl: ModalController, private merchant: MerchantUtils) {
		this.init()
	}

	async init() {
		await this.merchant.getUserInfo(false)
	}

	initChartHistoryAggregations() {
		const temp = [
			{ label: 'Epoch', value: Aggregation.Epoch, disabled: false },
			{ label: 'Hourly', value: Aggregation.Hourly, disabled: false },
			{ label: 'Daily', value: Aggregation.Daily, disabled: false },
			{ label: 'Weekly', value: Aggregation.Weekly, disabled: false },
		]

		// this.allDataPeriods = temp.map((item) => {
		//   item.disabled = this.merchant.userInfo().premium_perks.char
		//   return item
		// })
	}

	changeTimeframe(event) {
		//const currentValue = event.target.value
	}

	cancel() {
		return this.modalCtrl.dismiss(null, 'cancel')
	}

	openUpgrades() {
		// todo
	}
}

interface OptionType {
	label: string
	value: unknown
	disabled: boolean
}
