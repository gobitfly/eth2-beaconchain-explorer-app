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

package in.beaconcha.mobile;
import android.app.Activity;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.io.File;

public class MainActivity extends BridgeActivity {

    @Override
    public void onStart() {
        // reset bundle to locally shipped
        /*var prefs = this.getApplicationContext().getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE);
        var editor = prefs.edit();
        editor.putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, new File("public").getPath());

        editor.commit();*/

        super.onStart();
        // Disable the rubber-band over-scroll effect that causes the app UI to get stretched.
        WebView v = getBridge().getWebView();
        v.setOverScrollMode(v.OVER_SCROLL_NEVER);
    }
}
