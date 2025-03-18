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

import { NgModule, inject, provideAppInitializer } from '@angular/core'
import { BrowserModule } from '@angular/platform-browser'
import { RouteReuseStrategy } from '@angular/router'

import { IonicModule, IonicRouteStrategy } from '@ionic/angular'

import { AppRoutingModule } from './app-routing.module'
import { AppComponent } from './app.component'
import { PipesModule } from './pipes/pipes.module'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { ApiService } from './services/api.service'
import { BootPreloadService } from './services/boot-preload.service'
import { NgxEchartsModule, provideEcharts } from 'ngx-echarts'

@NgModule({
	declarations: [AppComponent],
	imports: [
		BrowserAnimationsModule,
		BrowserModule,
		IonicModule.forRoot({ innerHTMLTemplatesEnabled: true }),
		AppRoutingModule,
		PipesModule,
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
		provideAppInitializer(() => {
			const initializerFn = initializeApp(inject(ApiService), inject(BootPreloadService))
			return initializerFn()
		}),
		provideEcharts(),
		//provideExperimentalZonelessChangeDetection() // experimental zoneless
	],
	bootstrap: [AppComponent],
})
export class AppModule {}

export function initializeApp(apiService: ApiService, bootPreloadService: BootPreloadService): () => Promise<void> {
	return async () => {
		bootPreloadService.preload(await apiService.initialize())
	}
}
