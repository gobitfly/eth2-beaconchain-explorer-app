/*
 *  // Copyright (C) 2020 - 2021 Bitfly GmbH
 *  // Manuel Caspari (manuel@bitfly.at)
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

import { async, ComponentFixture, TestBed } from '@angular/core/testing'
import { IonicModule } from '@ionic/angular'
import { AlertService } from 'src/app/services/alert.service'
import { UnitconvService } from 'src/app/services/unitconv.service'
import { MEMORY, ValidatorState, ValidatorUtils } from 'src/app/utils/ValidatorUtils'

import { ValidatorComponent } from './validator.component'
import { PipesModule } from '../../pipes/pipes.module'
import BigNumber from 'bignumber.js'

describe('ValidatorComponent', () => {
	let component: ValidatorComponent
	let fixture: ComponentFixture<ValidatorComponent>

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ValidatorComponent],
			imports: [IonicModule.forRoot(), PipesModule],
			providers: [{ provide: UnitconvService }, { provide: AlertService }, { provide: ValidatorUtils }],
		}).compileComponents()

		fixture = TestBed.createComponent(ValidatorComponent)
		component = fixture.componentInstance
		component.setInput({
			index: 0,
			pubkey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
			name: '',
			storage: MEMORY,
			synced: true,
			version: 1,
			data: {
				activationeligibilityepoch: 1,
				activationepoch: 1,
				balance: new BigNumber(1000000000000000),
				effectivebalance: new BigNumber(1000000000000000),
				exitepoch: 9999,
				lastattestationslot: 1,
				name: '',
				pubkey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
				slashed: false,
				validatorindex: 0,
				withdrawableepoch: 9999,
				withdrawalcredentials: 'BBBBBBB',
			},
			state: ValidatorState.ACTIVE,
			attrEffectiveness: 100,
		})
		fixture.detectChanges()
	}))

	it('should create', () => {
		expect(component).toBeTruthy()
	})
})
