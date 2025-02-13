import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InfiniteScrollDataSource, sleep } from './InfiniteScrollDataSource'

interface Range {
	start: number
	end: number
}

import { Subject } from 'rxjs'

class FakeCollectionViewer {
	public viewChange = new Subject<Range>()
}
describe('InfiniteScrollDataSource', () => {
	let fakeLoadMore: ReturnType<typeof vi.fn>
	let dataSource: InfiniteScrollDataSource<number>
	let collectionViewer: FakeCollectionViewer

	beforeEach(() => {
		// A fake loadMore function that returns different data based on the cursor.
		fakeLoadMore = vi.fn((cursor: string) => {
			if (!cursor) {
				// First page
				return Promise.resolve({ data: [1, 2, 3, 4, 5], next_cursor: 'cursor1' })
			} else if (cursor === 'cursor1') {
				// Second page
				return Promise.resolve({ data: [6, 7, 8, 9, 10], next_cursor: null })
			}
			return Promise.resolve({ data: [], next_cursor: null })
		})

		// Set pageSize = 5 for easier math
		dataSource = new InfiniteScrollDataSource<number>(5, fakeLoadMore)
		collectionViewer = new FakeCollectionViewer()
	})

	it('should fetch the first page on connect when a viewChange event is emitted', async () => {
		// Connect the datasource to our fake collection viewer.
		const dataStream = dataSource.connect(collectionViewer)
		// Emit a viewChange event that covers items 0-4 (page 0).
		collectionViewer.viewChange.next({ start: 0, end: 4 })

		// Allow any async operations to finish.
		await sleep(10)

		// Verify that loadMore was called exactly once.
		expect(fakeLoadMore).toHaveBeenCalledTimes(1)

		// Check that the cached data (accessible via the public API) is as expected.
		expect(dataSource.getItems()).toEqual([1, 2, 3, 4, 5])

		// Also, subscribe to the data stream and verify it emits the updated data.
		let latestData: number[] | undefined
		dataStream.subscribe((data) => (latestData = data))
		expect(latestData).toEqual([1, 2, 3, 4, 5])
	})

	it('should fetch subsequent pages when the viewChange range spans multiple pages', async () => {
		// Emit a range that spans from item 0 to 9.
		// With a page size of 5, this covers pages 0 and 1. (A request for page 2 will be skipped because
		// the second page marks the end.)
		dataSource.connect(collectionViewer)
		collectionViewer.viewChange.next({ start: 0, end: 9 })
		await sleep(10)

		// Expect two calls:
		// - Page 0: loadMore(undefined)
		// - Page 1: loadMore('cursor1')
		expect(fakeLoadMore).toHaveBeenCalledTimes(2)

		// After page 0 and 1, cachedData should contain 10 items.
		expect(dataSource.getItems()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
	})

	it('reset should clear the data and fetch the first page again', async () => {
		// First, perform an initial fetch.
		dataSource.connect(collectionViewer)
		collectionViewer.viewChange.next({ start: 0, end: 4 })
		await sleep(10)
		expect(dataSource.getItems()).toEqual([1, 2, 3, 4, 5])

		// Call reset. This clears cachedData and fetchedPages, and then fetches page 0 again.
		await dataSource.reset()

		// Since reset calls fetchPage(0) after clearing, loadMore should have been called one more time.
		// (Depending on timing, the total calls count here is 2.)
		expect(fakeLoadMore).toHaveBeenCalledTimes(2)
		expect(dataSource.getItems()).toEqual([1, 2, 3, 4, 5])
	})

	it('should have correct behavior for hasItems, length, and getItems', async () => {
		// Initially, no items are loaded.
		expect(dataSource.hasItems()).toBe(false)
		expect(dataSource.length()).toBe(0)
		expect(dataSource.getItems()).toEqual([])

		// Trigger a load.
		dataSource.connect(collectionViewer)
		collectionViewer.viewChange.next({ start: 0, end: 4 })
		await sleep(10)

		// Now, items should be present.
		expect(dataSource.hasItems()).toBe(true)
		expect(dataSource.length()).toBe(5)
		expect(dataSource.getItems()).toEqual([1, 2, 3, 4, 5])
	})

	it('should mark reachedMax as true when loadMore returns no next_cursor', async () => {
		// Connect and request a range that will fetch two pages.
		dataSource.connect(collectionViewer)
		collectionViewer.viewChange.next({ start: 0, end: 9 })
		await sleep(10)
		collectionViewer.viewChange.next({ start: 9, end: 10 })
		await sleep(10)

		// The second page returns next_cursor as undefined.
		expect(dataSource.hasReachedEnd()).toBe(true)
	})

	it('setLoadFrom should change the loadMore function used by the data source', async () => {
		// Do an initial load with the original fakeLoadMore.
		dataSource.connect(collectionViewer)
		collectionViewer.viewChange.next({ start: 0, end: 4 })
		await sleep(10)
		expect(dataSource.getItems()).toEqual([1, 2, 3, 4, 5])

		// Define a new loadMore function.
		const newLoadMore = vi.fn().mockResolvedValue({ data: [11, 12, 13], next_cursor: undefined })
		dataSource.setLoadFrom(newLoadMore)

		// Reset the datasource; it will now use newLoadMore for page 0.
		await dataSource.reset()
		expect(newLoadMore).toHaveBeenCalled()
		expect(dataSource.getItems()).toEqual([11, 12, 13])
	})

	it('disconnect should unsubscribe from viewChange events', async () => {
		dataSource.connect(collectionViewer)
		// Trigger a fetch.
		collectionViewer.viewChange.next({ start: 0, end: 4 })
		await sleep(10)
		expect(fakeLoadMore).toHaveBeenCalledTimes(1)

		// Disconnect the datasource.
		dataSource.disconnect()

		// Emit a new viewChange event. Since the datasource is disconnected,
		// no new loadMore call should be triggered.
		collectionViewer.viewChange.next({ start: 5, end: 9 })
		await sleep(10)
		expect(fakeLoadMore).toHaveBeenCalledTimes(1)
	})
})
