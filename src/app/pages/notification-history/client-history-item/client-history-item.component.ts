import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common'
import { IonicModule } from '@ionic/angular'
import { NotificationClientsTableRow } from 'src/app/requests/types/notifications'
import { BaseHistoryItemComponent } from '../base-history-item/base-history-item.component'
import { Toast } from '@capacitor/toast'
@Component({
	selector: 'app-client-history-item',
	imports: [CommonModule, IonicModule, BaseHistoryItemComponent],
	templateUrl: './client-history-item.component.html',
	styleUrl: './client-history-item.component.scss',
})
export class ClientHistoryItemComponent {
	@Input() data: NotificationClientsTableRow
	@Input() first: boolean
	@Input() last: boolean

	open() {
		Toast.show({
			text: 'Coming soon', // todo wait for api to return this
		})
		return
		//Browser.open({ url: this.data.url, toolbarColor: '#2f2e42' })
	}
}
