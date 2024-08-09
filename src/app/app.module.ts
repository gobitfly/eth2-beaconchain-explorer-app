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

import { APP_INITIALIZER, Injectable, NgModule } from '@angular/core'
import { BrowserModule, HammerModule } from '@angular/platform-browser'
import { RouteReuseStrategy } from '@angular/router'

import { IonicModule, IonicRouteStrategy } from '@ionic/angular'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { PipesModule } from './pipes/pipes.module'
import { HammerGestureConfig, HAMMER_GESTURE_CONFIG } from '@angular/platform-browser'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import 'hammerjs'
import { ApiService } from './services/api.service'
import { BootPreloadService } from './services/boot-preload.service'
import { NgxEchartsModule, provideEcharts } from 'ngx-echarts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let Hammer: any
@Injectable()
export class MyHammerConfig extends HammerGestureConfig {
	buildHammer(element: HTMLElement) {
		const mc = new Hammer(element, {
			touchAction: 'auto',
		})
		return mc
	}
}

@NgModule({
	declarations: [AppComponent],
	imports: [
		BrowserAnimationsModule,
		BrowserModule,
		IonicModule.forRoot({ innerHTMLTemplatesEnabled: true }),
		AppRoutingModule,
		PipesModule,
		HammerModule,

		NgxEchartsModule.forRoot({
			/**
			 * This will import all modules from echarts.
			 * If you only need custom modules,
			 * please refer to [Custom Build] section.
			 */
			echarts: () => import('echarts'), // or import('./path-to-my-custom-echarts')
		}),
	],
	providers: [
		{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
		{
			// hammer instantion with custom config
			provide: HAMMER_GESTURE_CONFIG,
			useClass: MyHammerConfig,
		},
		{
			provide: APP_INITIALIZER,
			useFactory: initializeApp,
			multi: true,
			deps: [ApiService, BootPreloadService],
		},
		provideEcharts(),
	],
	bootstrap: [AppComponent],
})
export class AppModule {}

export function initializeApp(apiService: ApiService, bootPreloadService: BootPreloadService): () => Promise<void> {
	return async () => {
		// Initialize ApiService first
		await apiService.initialize()

		// Now that ApiService is initialized, you can preload using BootPreloadService
		bootPreloadService.preload()
	}
}
