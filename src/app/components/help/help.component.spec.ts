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

import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing'
import { RouterTestingModule } from '@angular/router/testing'
import { AngularDelegate, IonicModule } from '@ionic/angular'
import { StorageService } from 'src/app/services/storage.service'
import { OAuthUtils } from 'src/app/utils/OAuthUtils'
import { ValidatorUtils } from 'src/app/utils/ValidatorUtils'

import { HelpComponent } from './help.component'

describe('HelpComponent', () => {
	let component: HelpComponent
	let fixture: ComponentFixture<HelpComponent>

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [HelpComponent],
			imports: [IonicModule.forRoot(), RouterTestingModule.withRoutes([])],
			providers: [
				{ provide: OAuthUtils },
				{ provide: ValidatorUtils },
				{ provide: StorageService },
				{ provide: RouterTestingModule },
				{ provide: AngularDelegate },
			],
		}).compileComponents()

		fixture = TestBed.createComponent(HelpComponent)
		component = fixture.componentInstance
		fixture.detectChanges()
	}))

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
