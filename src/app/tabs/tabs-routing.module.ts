/*
 *  // Copyright (C) 2020 - 2021 bitfly explorer GmbH
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
import { RouterModule, Routes } from '@angular/router'
import { TabsPage } from './tabs.page'

const routes: Routes = [
	{
		path: 'tabs',
		component: TabsPage,
		children: [
			{
				path: 'dashboard',
				loadChildren: () => import('../tab-dashboard/tab-dashboard.module').then((m) => m.Tab1PageModule),
			},
			{
				path: 'validators',
				loadChildren: () => import('../tab-validators/tab-validators.module').then((m) => m.Tab2PageModule),
			},
			{
				path: 'preferences',
				loadChildren: () => import('../tab-preferences/tab-preferences.module').then((m) => m.Tab3PageModule),
			},
			{
				path: 'machines',
				loadChildren: () => import('../pages/machines/machines.module').then((m) => m.MachinesPageModule),
			},
			{
				path: 'blocks',
				loadChildren: () => import('../tab-blocks/tab-blocks.module').then((m) => m.TabBlocksPageModule),
			},
			{
				path: '',
				redirectTo: '/tabs/dashboard',
				pathMatch: 'full',
			},
		],
	},
	{
		path: '',
		redirectTo: '/tabs/dashboard',
		pathMatch: 'full',
	},
]

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class TabsPageRoutingModule {}
