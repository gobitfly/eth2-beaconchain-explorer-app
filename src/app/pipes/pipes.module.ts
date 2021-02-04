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

import { NgModule } from '@angular/core';

import { McurrencyPipe } from './mcurrency.pipe';
import { ValuestylePipe } from './valuestyle.pipe';
import { PercentageabsPipe } from './percentageabs.pipe';
import { FadeoutpipePipe } from './fadeoutpipe.pipe';
import { TimeagoModule, TimeagoFormatter } from 'ngx-timeago';
import { CustomTimeAgoFormatter } from '../utils/CustomTimeAgoFormatter'

@NgModule({
  imports: [
    TimeagoModule.forRoot(
      { formatter: { provide: TimeagoFormatter, useClass: CustomTimeAgoFormatter } }
    )
  ],
  declarations: [
    McurrencyPipe,
    ValuestylePipe,
    PercentageabsPipe,
    FadeoutpipePipe
  ],
  exports: [
    McurrencyPipe,
    ValuestylePipe,
    PercentageabsPipe,
    FadeoutpipePipe,
    TimeagoModule
  ]
})

export class PipesModule { }