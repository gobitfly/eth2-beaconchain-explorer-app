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

import { NgModule } from '@angular/core'
import { PreloadAllModules, RouterModule, Routes } from '@angular/router'

const routes: Routes = [
	{
		path: '',
		loadChildren: () => import('./tabs/tabs.module').then((m) => m.TabsPageModule),
	},
	{
		path: 'helppage',
		loadChildren: () => import('./pages/helppage/helppage.module').then((m) => m.HelppagePageModule),
	},
	{
		path: 'licences',
		loadChildren: () => import('./pages/licences/licences.module').then((m) => m.LicencesPageModule),
	},
	{
		path: 'subscribe',
		loadChildren: () => import('./pages/subscribe/subscribe.module').then((m) => m.SubscribePageModule),
	},
	{
		path: 'machine-detail',
		loadChildren: () => import('./pages/machine-detail/machine-detail.module').then((m) => m.MachineDetailPageModule),
	},
	{
		path: 'dev',
		loadChildren: () => import('./pages/dev/dev.module').then((m) => m.DevPageModule),
	},
	{
		path: 'logview',
		loadChildren: () => import('./pages/logview/logview.module').then((m) => m.LogviewPageModule),
	},
	{
		path: 'tab-blocks',
		loadChildren: () => import('./tab-blocks/tab-blocks.module').then((m) => m.TabBlocksPageModule),
	},
	{
		path: 'block-detail',
		loadChildren: () => import('./pages/block-detail/block-detail.module').then((m) => m.BlockDetailPageModule),
	},
	{
		path: 'clients',
		loadChildren: () => import('./pages/clients/clients.module').then((m) => m.ClientsPageModule),
	},
]
@NgModule({
	imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
	exports: [RouterModule],
})
export class AppRoutingModule {}
