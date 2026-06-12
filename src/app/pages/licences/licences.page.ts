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

import { Component, OnInit } from '@angular/core'
import { ModalController } from '@ionic/angular'
import { fromEvent, Subscription } from 'rxjs'

@Component({
	selector: 'app-licences',
	templateUrl: './licences.page.html',
	styleUrls: ['./licences.page.scss'],
})
export class LicencesPage implements OnInit {
	private backbuttonSubscription: Subscription
	constructor(private modalCtrl: ModalController) {}

	ngOnInit() {
		this.populatePre('./3rdpartylicenses.txt')
		const event = fromEvent(document, 'backbutton')
		this.backbuttonSubscription = event.subscribe(() => {
			this.modalCtrl.dismiss()
		})
	}

	populatePre(url) {
		const xhr = new XMLHttpRequest()
		xhr.onload = function () {
			document.getElementById('contents').textContent += this.responseText
		}
		xhr.open('GET', url)
		xhr.send()
	}

	ngOnDestroy() {
		this.backbuttonSubscription.unsubscribe()
	}

	closeModal() {
		this.modalCtrl.dismiss()
	}
}
