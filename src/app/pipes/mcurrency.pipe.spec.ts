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

import { McurrencyPipe } from './mcurrency.pipe';
import { UnitconvService } from '../services/unitconv.service';
import { StorageService } from '../services/storage.service';
import { ApiService } from '../services/api.service';

describe('McurrencyPipe', () => {
  let service: UnitconvService;
  beforeEach(() => {
    let storage = new StorageService()
    service = new UnitconvService(storage, new ApiService(storage));
  });

  it('create an instance', () => {
   
    const pipe = new McurrencyPipe(service);
    expect(pipe).toBeTruthy();

    
  });
});
