import { Component, Input, ViewChild } from '@angular/core'
import { InfiniteScrollDataSource, loadMoreType } from '@utils/InfiniteScrollDataSource'
import {
	ArrayComputer,
	DataTypes,
	getExternalLink,
	getExtra,
	getImageSeed,
	getTitle,
	getTitlePrefix,
} from '../accordion-indexslot/accordion-indexslot.component'
import { IonicModule, ModalController, SearchbarCustomEvent } from '@ionic/angular'
import { CommonModule } from '@angular/common'
import { NotificationValidator } from '../notification-item/notification-item.component'
import { ScrollingModule } from '@angular/cdk/scrolling'
import { IonSearchbar } from '@ionic/angular/standalone'
import { AlertService } from '@services/alert.service'
import { ApiService } from '@services/api.service'

const PAGE_SIZE = 25

type Sort = 'index:asc' | 'index:desc' | 'extra:asc' | 'extra:desc'

@Component({
	selector: 'app-more',
	imports: [CommonModule, IonicModule, NotificationValidator, ScrollingModule],
	templateUrl: './more.component.html',
	styleUrl: './more.component.scss',
})
export class MoreComponent {
	@Input() title: string
	@Input() data: DataTypes[]
	@Input() extraName: string

	filteredData: DataTypes[]

	dataSource: InfiniteScrollDataSource<DataTypes>

	loadMore: boolean

	sort: Sort = 'index:asc'

	@ViewChild('searchbarRef', { static: true }) searchbarRef: IonSearchbar

	ac = new ArrayComputer()

	constructor(
		private modalCtrl: ModalController,
		private alerts: AlertService,
		private api: ApiService
	) {}

	ngOnInit() {
		this.dataSource = new InfiniteScrollDataSource<DataTypes>(PAGE_SIZE, this.getDefaultDataRetriever())
	}

	async ionViewDidEnter() {
		this.filteredData = this.data
		await this.dataSource.reset()
	}

	selectSort() {
		const options = [
			{
				name: 'sort',
				label: 'Index Ascending',
				value: 'index:asc' as Sort,
				type: 'radio',
				checked: this.sort == 'index:asc',
			},
			{
				name: 'sort',
				label: 'Index Descending',
				value: 'index:desc' as Sort,
				type: 'radio',
				checked: this.sort == 'index:desc',
			},
		]

		if (this.extraName) {
			options.push({
				name: 'sort',
				label: this.extraName + ' Ascending',
				value: 'extra:asc' as Sort,
				type: 'radio',
				checked: this.sort == 'extra:asc',
			})
			options.push({
				name: 'sort',
				label: this.extraName + ' Descending',
				value: 'extra:desc' as Sort,
				type: 'radio',
				checked: this.sort == 'extra:desc',
			})
		}

		this.alerts.showSelect('Sort by', options, (data) => {
			if (data) {
				if (data != this.sort) {
					this.sort = data as Sort
					this.doSort(this.sort)
				}
			}
		})
	}

	getSortFunction(sort: Sort) {
		// prefer number sort if it is a number, otherwise use string sort
		function compareNumberOrString(a: string, b: string) {
			if (!isNaN(Number(a)) && !isNaN(Number(b))) {
				return Number(a) - Number(b)
			} else {
				return a.localeCompare(b)
			}
		}

		switch (sort) {
			case 'index:asc':
				return (a: DataTypes, b: DataTypes) => {
					return compareNumberOrString(getTitle(a), getTitle(b))
				}
			case 'index:desc':
				return (a: DataTypes, b: DataTypes) => {
					return compareNumberOrString(getTitle(b), getTitle(a))
				}
			case 'extra:asc':
				return (a: DataTypes, b: DataTypes) => {
					return compareNumberOrString(getExtra(a), getExtra(b))
				}
			case 'extra:desc':
				return (a: DataTypes, b: DataTypes) => {
					return compareNumberOrString(getExtra(b), getExtra(a))
				}
			default:
				throw new Error(`Unsupported sort type: ${sort}`)
		}
	}

	async doSort(sort: Sort) {
		try {
			const sortFn = this.getSortFunction(sort)
			this.filteredData.sort((a, b) => {
				return sortFn(a, b)
			})
			await this.dataSource.reset()
		} catch (e) {
			console.error(e)
		}
	}

	cancelSearch() {
		this.filteredData = this.data
		this.doSort(this.sort)
	}

	searchEvent(event: SearchbarCustomEvent) {
		this.filteredData = this.data.filter((item) => {
			return (
				getTitle(item).toLowerCase().includes(event.detail.value.toLowerCase()) ||
				getExtra(item).toLowerCase().includes(event.detail.value.toLowerCase())
			)
		})
		this.dataSource.reset()
	}

	private getDefaultDataRetriever(): loadMoreType<DataTypes> {
		return (cursor) => {
			return new Promise((resolve) => {
				let offset = parseInt(cursor)
				if (isNaN(offset)) {
					offset = 0
				}

				const subset = this.filteredData.slice(offset, offset + PAGE_SIZE)
				const nextOffset = offset + subset.length
				if (nextOffset < this.filteredData.length) {
					resolve({
						data: subset,
						next_cursor: nextOffset + '',
					})
				} else {
					resolve({
						data: subset,
						next_cursor: null,
					})
				}
			})
		}
	}

	closeModal() {
		this.modalCtrl.dismiss()
	}

	getExternalLink = (data: DataTypes) => {
		return getExternalLink(data, this.api)
	}
	getTitlePrefix = getTitlePrefix
	getImageSeed = getImageSeed
	getTitle = (data: DataTypes) => {
		return getTitle(data, this.searchbarRef.value)
	}
	getExtra = (data: DataTypes) => {
		return getExtra(data, this.searchbarRef.value)
	}
}
