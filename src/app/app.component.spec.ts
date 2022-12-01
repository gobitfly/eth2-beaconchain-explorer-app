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

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'
import { TestBed, async } from '@angular/core/testing'

import { AngularDelegate, ModalController, Platform } from '@ionic/angular'
import { SplashScreen } from '@awesome-cordova-plugins/splash-screen/ngx'

import { AppComponent } from './app.component'
import { platformBrowserTesting } from '@angular/platform-browser/testing'

describe('AppComponent', () => {
	let splashScreenSpy
	let platformReadySpy
	let platformSpy

	beforeEach(async(() => {
		splashScreenSpy = jasmine.createSpyObj('SplashScreen', ['hide'])
		platformReadySpy = Promise.resolve()
		platformSpy = jasmine.createSpyObj('Platform', { ready: platformReadySpy })

		TestBed.configureTestingModule({
			declarations: [AppComponent],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
			providers: [
				{ provide: SplashScreen, useValue: splashScreenSpy },
				{ provide: Platform, useClass: PlatformMock },
				{ provide: ModalController },
				{ provide: AngularDelegate },
			],
		}).compileComponents()
	}))

	it('should create the app', () => {
		const fixture = TestBed.createComponent(AppComponent)
		const app = fixture.debugElement.componentInstance
		expect(app).toBeTruthy()
	})

	/* it('should initialize the app', async () => {
    TestBed.createComponent(AppComponent);
    await platformReadySpy;
    expect(platformSpy.ready).toHaveBeenCalled();
    
    //expect(splashScreenSpy.hide).toHaveBeenCalled();
  });*/

	// TODO: add more tests!
})

export class PlatformMock {
	public ready(): Promise<{ String }> {
		return new Promise((resolve) => {
			resolve()
		})
	}

	public registerBackButtonAction(fn: Function, priority?: number): Function {
		return () => true
	}

	public hasFocus(ele: HTMLElement): boolean {
		return true
	}

	public doc(): HTMLDocument {
		return document
	}

	is(platformName: any): boolean {
		return true
	}

	public getQueryParam() {
		return true
	}

	public getElementComputedStyle(container: any): any {
		return {
			paddingLeft: '10',
			paddingTop: '10',
			paddingRight: '10',
			paddingBottom: '10',
		}
	}

	public onResize(callback: any) {
		return callback
	}

	public registerListener(
		ele: any,
		eventName: string,
		callback: any
	): Function {
		return () => true
	}

	public win(): Window {
		return window
	}

	public raf(callback: any): number {
		return 1
	}

	public timeout(callback: any, timer: number): any {
		return setTimeout(callback, timer)
	}

	public cancelTimeout(id: any) {
		// do nothing
	}

	public getActiveElement(): any {
		return document['activeElement']
	}
}
