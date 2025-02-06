import { ScrollingModule } from '@angular/cdk/scrolling'
import { CommonModule } from '@angular/common'
import { Component, signal, WritableSignal } from '@angular/core'
import { Toast } from '@capacitor/toast'
import { IonicModule } from '@ionic/angular'
import { APIRequest, APIUnauthorizedError } from 'src/app/requests/requests'
import {
	NotificationClientsTableRow,
	NotificationDashboardsTableRow,
	NotificationMachinesTableRow,
	NotificationNetworksTableRow,
} from 'src/app/requests/types/notifications'
import { V2NotificationsClients, V2NotificationsDashboard, V2NotificationsMachines, V2NotificationsNetworks } from 'src/app/requests/v2-notifications'
import { ApiService } from 'src/app/services/api.service'
import { InfiniteScrollDataSource, loadMoreType } from 'src/app/utils/InfiniteScrollDataSource'
import { eventTypeBadge, HistoryDataTypes, NotificationHistoryItemComponent } from './validator-history-item/validator-history-item.component'
import { formatMonthLong } from 'src/app/utils/TimeUtils'
import { AlertService } from 'src/app/services/alert.service'
import { FullPageLoadingComponent } from '@components/full-page-loading/full-page-loading.component'
import { FullPageOfflineComponent } from '@components/full-page-offline/full-page-offline.component'
import { FormsModule } from '@angular/forms'
import { getDay, getTs } from './base-history-item/base-history-item.component'
import { formatNetworkHistoryType, NetworkHistoryItemComponent } from './network-history-item/network-history-item.component'
import { formatMachineHistoryType, MachineHistoryItemComponent } from './machine-history-item/machine-history-item.component'
import { ClientHistoryItemComponent } from './client-history-item/client-history-item.component'

const PAGE_SIZE = 25
const ASSOCIATED_CACHE_KEY = 'notification-history'

type Tab = 'validator-dashboard' | 'network' | 'machines' | 'eth-clients'

@Component({
	selector: 'app-notification-history',
	imports: [
		CommonModule,
		IonicModule,
		FormsModule,
		ScrollingModule,
		NotificationHistoryItemComponent,
		FullPageLoadingComponent,
		FullPageOfflineComponent,
		NetworkHistoryItemComponent,
		MachineHistoryItemComponent,
		ClientHistoryItemComponent,
	],
	templateUrl: './notification-history.component.html',
	styleUrl: './notification-history.component.scss',
})
export class NoticationHistoryComponent {
	tabs = [
		{ title: 'Dashboard', key: 'validator-dashboard' as Tab },
		{ title: 'Network', key: 'network' as Tab },
		{ title: 'Machines', key: 'machines' as Tab },
		{ title: 'Updates', key: 'eth-clients' as Tab },
	]

	dataSources: Map<Tab, WritableSignal<InfiniteScrollDataSource<HistoryDataTypes>>> = new Map()
	loadMore: boolean = true
	online: boolean = true
	initialLoadings: Map<Tab, WritableSignal<boolean>> = new Map()

	visibleMonth: string = ''
	filter: string = ''
	currentScrollIndex: number = 0

	selectedTab: Tab = 'validator-dashboard'

	constructor(
		private api: ApiService,
		private alerts: AlertService
	) {
		this.tabs.forEach((tab) => {
			this.dataSources.set(tab.key, signal(undefined))
			this.initialLoadings.set(tab.key, signal(true))
		})
	}

	async ionViewWillEnter() {
		await this.update()
		this.onScrolledIndexChange(0)
	}

	tabChange() {
		this.ionViewWillEnter()
	}

	async update() {
		let dataRetriever: InfiniteScrollDataSource<HistoryDataTypes>
		switch (this.selectedTab) {
			case 'validator-dashboard':
				dataRetriever = new InfiniteScrollDataSource<NotificationDashboardsTableRow>(
					PAGE_SIZE,
					this.getDefaultDataRetriever(V2NotificationsDashboard)
				)
				break
			case 'machines':
				dataRetriever = new InfiniteScrollDataSource<NotificationMachinesTableRow>(PAGE_SIZE, this.getDefaultDataRetriever(V2NotificationsMachines))
				break
			case 'network':
				dataRetriever = new InfiniteScrollDataSource<NotificationNetworksTableRow>(PAGE_SIZE, this.getDefaultDataRetriever(V2NotificationsNetworks))
				break
			case 'eth-clients':
				dataRetriever = new InfiniteScrollDataSource<NotificationClientsTableRow>(PAGE_SIZE, this.getDefaultDataRetriever(V2NotificationsClients))
				break
		}

		this.dataSources.get(this.selectedTab).set(dataRetriever)
		console.log('dataSources', this.selectedTab, this.dataSources, dataRetriever)
		await dataRetriever.reset()
	}

	private getDefaultDataRetriever<T extends new (cursor: string, limit: number) => APIRequest<E[]>, E>(constructor: T): loadMoreType<E> {
		return async (cursor) => {
			this.loadMore = !!cursor
			const result = await this.api.execute(new constructor(cursor, PAGE_SIZE), ASSOCIATED_CACHE_KEY)
			if (result.error) {
				Toast.show({
					text: 'Could not load blocks',
					duration: 'long',
				})
				if (!(result.error instanceof APIUnauthorizedError)) {
					// todo change to just if timeout?
					this.online = false
				}
				this.initialLoadings.get(this.selectedTab).set(false)

				console.error('Could not load history', result.error)
				return {
					data: undefined,
					next_cursor: null,
				}
			}
			this.loadMore = false
			this.initialLoadings.get(this.selectedTab).set(false)

			return {
				data: result.data as E[],
				next_cursor: result.paging?.next_cursor,
			}
		}
	}

	onScrolledIndexChange(index: number): void {
		this.currentScrollIndex = index
		const itemsArray = this.dataSources.get(this.selectedTab)()?.getItems()
		const item = itemsArray?.[this.currentScrollIndex]
		if (!item) return

		// if last item in infinite scroller is also on the same day as the current one, display a "+" sign
		// to indicate that there might be even more entries if the user scrolls down
		let more = ''
		const lastItemIsAlsoOnSameDay = isSameDay(new Date(getTs(itemsArray[itemsArray.length - 1])), new Date(getTs(item)))
		if (lastItemIsAlsoOnSameDay && !this.dataSources.get(this.selectedTab)().hasReachedEnd()) {
			more = '+'
		}

		const countSameDayNotifications = this.getSameDayItems(item).length
		this.visibleMonth = getDay(item) + ' ' + getMonth(item) + ' (' + countSameDayNotifications + more + ')'
	}

	getSameDayItems(firstItem: HistoryDataTypes) {
		return this.dataSources
			.get(this.selectedTab)()
			.getItems()
			?.filter((notification) => isSameDay(new Date(getTs(notification)), new Date(getTs(firstItem))))
	}

	async showDayDetails() {
		const item = this.dataSources.get(this.selectedTab)().getItems()[this.currentScrollIndex]
		const eventsOnSameDay = countEventTypes(this.getSameDayItems(item))

		let alertText = `
      <div>
        <strong>${getDay(item)} ${getMonth(item)} ${getYear(item)}</strong><br/>
    `

		eventsOnSameDay.forEach((event) => {
			const badge = eventTypeBadge(event.eventType)
			// badge is just for validator dashboard history, otherwise use format methods below
			if (badge.short) {
				alertText += `
        		${event.count}x ${badge.short} Alert${event.count > 1 ? 's' : ''}<br/>
      `
			} else {
				const formattedText = formatMachineHistoryType(event.eventType) || formatNetworkHistoryType(event.eventType) || event.eventType
				alertText += `
				${event.count}x ${formattedText}<br/>
	  `
			}
		})

		alertText += `</div>`

		await this.alerts.showInfo('Day Summary', alertText)
	}
}

function getMonth(data: HistoryDataTypes): string {
	return formatMonthLong(new Date(getTs(data)).getMonth())
}

function getYear(data: HistoryDataTypes): number {
	return new Date(getTs(data)).getUTCFullYear()
}

function isSameDay(date1: Date, date2: Date) {
	return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate()
}

export interface EventCount {
	eventType: string
	count: number
}

function countEventTypes(rows: HistoryDataTypes[]) {
	// Use a Map to store event type counts
	const eventTypeCounts = new Map<string, number>()

	// Iterate over each row in the input array
	rows.forEach((row) => {
		if ('event_types' in row) {
			row.event_types.forEach((eventType) => {
				// Increment count for each event type
				eventTypeCounts.set(eventType.toString(), (eventTypeCounts.get(eventType.toString()) || 0) + 1)
			})
		} else if ('event_type' in row) {
			// Increment count for each event type
			eventTypeCounts.set(row.event_type.toString(), (eventTypeCounts.get(row.event_type.toString()) || 0) + 1)
		} else if ('client_name' in row) {
			// Increment count for each event type
			eventTypeCounts.set(row.client_name.toString(), (eventTypeCounts.get(row.client_name.toString()) || 0) + 1)
		}
	})

	// Convert Map to an array of objects
	return Array.from(eventTypeCounts, ([eventType, count]) => ({ eventType, count }) as EventCount)
}
