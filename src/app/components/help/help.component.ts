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

import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import { Plugins } from '@capacitor/core';
import { StorageService } from 'src/app/services/storage.service';
import { OAuthUtils } from 'src/app/utils/OAuthUtils';
import { ValidatorUtils } from 'src/app/utils/ValidatorUtils';

const { Browser } = Plugins;

@Component({
  selector: 'app-help',
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.scss'],
})
export class HelpComponent implements OnInit {

  @Input() onlyGuides: any;
  isAlreadyLoggedIn: boolean = false

  constructor(
    private oauthUtils: OAuthUtils,
    private validator: ValidatorUtils,
    private storage: StorageService,
    private router: Router
  ) { }

  ngOnInit() {
    this.storage.isLoggedIn().then((result) => {
      this.isAlreadyLoggedIn = result
    });
  }

  async openBrowser(link) {
    await Browser.open({ url: link, toolbarColor: "#2f2e42" });
  }

  async login() {
    await this.oauthUtils.login()
    const loggedIn = await this.storage.isLoggedIn()

    if (loggedIn) {
      this.isAlreadyLoggedIn = true
      const hasValidators = await this.validator.hasLocalValdiators()
      if (!hasValidators) this.router.navigate(['/tabs/validators'])
    }
  }

}
