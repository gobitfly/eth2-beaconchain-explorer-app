/*
 *  // Copyright (C) 2020 - 2024 bitfly explorer GmbH
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

import { BehaviorSubject, Observable, Subscription } from 'rxjs'
import { CollectionViewer, DataSource } from '@angular/cdk/collections'

export type loadMoreType<T> = (cursor: string) => Promise<{ data: T[]; next_cursor: string }>
export class InfiniteScrollDataSource<T> extends DataSource<T> {
	public static ALL_ITEMS_AT_ONCE = 0

	private pageSize = 100
	cachedData: T[] = []
	private fetchedPages = new Set<number>()
	private dataStream = new BehaviorSubject<T[]>(this.cachedData)
	private subscription = new Subscription()

	private loadMore: loadMoreType<T>
	private reachedMax = false

	private cursor: string = undefined

	constructor(pageSize: number, loadMore: loadMoreType<T>) {
		super()
		this.pageSize = pageSize
		this.loadMore = loadMore
	}

	connect(collectionViewer: CollectionViewer): Observable<T[]> {
		this.subscription.add(
			collectionViewer.viewChange.subscribe((range) => {
				const startPage = this.getPageForIndex(range.start)
				const endPage = this.getPageForIndex(range.end + 1)
				for (let i = startPage; i <= endPage; i++) {
					this.fetchPage(i)
				}
			})
		)
		return this.dataStream
	}

	disconnect(): void {
		this.subscription.unsubscribe()
	}

	private getPageForIndex(index: number): number {
		if (this.pageSize == InfiniteScrollDataSource.ALL_ITEMS_AT_ONCE) return 0
		return Math.floor(index / this.pageSize)
	}

	private async fetchPage(page: number) {
		if (this.fetchedPages.has(page) || this.reachedMax) {
			return
		}
		this.fetchedPages.add(page)

		const newEntries = await this.loadMore(this.cursor)
		if (!newEntries.data) {
			return Promise.resolve()
		}
		this.cursor = newEntries.next_cursor
		if (!this.cursor) {
			this.reachedMax = true
		}

		let deleteAmount = this.pageSize
		if (this.pageSize == InfiniteScrollDataSource.ALL_ITEMS_AT_ONCE) {
			deleteAmount = this.cachedData.length
		}

		this.cachedData.splice(page * this.pageSize, deleteAmount, ...newEntries.data)
		this.dataStream.next(this.cachedData)

		// if (newEntries.data.length < this.pageSize) {
		// 	this.reachedMax = true
		// }
		return Promise.resolve()
	}

	public async reset() {
		this.fetchedPages.clear()
		this.cachedData = []
		this.cursor = undefined
		this.dataStream.next(this.cachedData)
		this.reachedMax = false
		return await this.fetchPage(0)
	}

	public hasItems(): boolean {
		return this.length() > 0
	}

	public length(): number {
		return this.cachedData.length
	}

	public getItems(): T[] {
		return this.cachedData
	}

	public hasReachedEnd(): boolean {
		return this.reachedMax
	}

	public setLoadFrom(loadMore: loadMoreType<T>) {
		this.loadMore = loadMore
	}
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
