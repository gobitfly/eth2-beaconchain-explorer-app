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

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'
import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing'

import { TabsPage } from './tabs.page'

describe('TabsPage', () => {
	let component: TabsPage
	let fixture: ComponentFixture<TabsPage>

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [TabsPage],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
		}).compileComponents()
	}))

	beforeEach(() => {
		fixture = TestBed.createComponent(TabsPage)
		component = fixture.componentInstance
		fixture.detectChanges()
	})

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
