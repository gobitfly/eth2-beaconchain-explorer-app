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

package in.beaconcha.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.nikosdouvlis.navigationbar.NavigationBar;

import java.util.ArrayList;

import in.beaconcha.mobile.widget.WidgetService;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initializes the Bridge
        this.init(savedInstanceState, new ArrayList<Class<? extends Plugin>>() {{
            add(com.byteowls.capacitor.oauth2.OAuth2ClientPlugin.class);
            add(NavigationBar.class);
            //add(com.getcapacitor.community.admob.AdMob.class);
            // Additional plugins you've installed go here
            // Ex: add(TotallyAwesomePlugin.class);
        }});

        startWidgetService();
    }

    private void startWidgetService() {
        try {
            WidgetService service = new WidgetService();
            service.run(this);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
