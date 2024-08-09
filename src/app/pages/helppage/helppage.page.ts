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

import { Component, OnInit } from '@angular/core'
import { ModalController } from '@ionic/angular'
import { fromEvent, Subscription } from 'rxjs'

@Component({
	selector: 'app-helppage',
	templateUrl: './helppage.page.html',
	styleUrls: ['./helppage.page.scss'],
})
export class HelppagePage implements OnInit {
	private backbuttonSubscription: Subscription

	constructor(private modalCtrl: ModalController) {}

	ngOnInit() {
		const event = fromEvent(document, 'backbutton')
		this.backbuttonSubscription = event.subscribe(() => {
			this.modalCtrl.dismiss()
		})
	}

	ngOnDestroy() {
		this.backbuttonSubscription.unsubscribe()
	}

	closeModal() {
		this.modalCtrl.dismiss()
	}
}
