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

import { NgModule } from '@angular/core'
import { BrowserModule, HammerModule } from '@angular/platform-browser'
import { RouteReuseStrategy } from '@angular/router'

import { IonicModule, IonicRouteStrategy } from '@ionic/angular'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { PipesModule } from './pipes/pipes.module'
import { InAppPurchase2 } from '@awesome-cordova-plugins/in-app-purchase-2/ngx'
import { HammerGestureConfig, HAMMER_GESTURE_CONFIG } from '@angular/platform-browser'
import 'hammerjs'

declare var Hammer: any
export class MyHammerConfig extends HammerGestureConfig {
	buildHammer(element: HTMLElement) {
		let mc = new Hammer(element, {
			touchAction: 'auto',
		})
		return mc
	}
}

@NgModule({
	declarations: [AppComponent],
	entryComponents: [],
	imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule, PipesModule, HammerModule],
	providers: [
		{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
		InAppPurchase2,
		{
			// hammer instantion with custom config
			provide: HAMMER_GESTURE_CONFIG,
			useClass: MyHammerConfig,
		},
	],
	bootstrap: [AppComponent],
})
export class AppModule {}
