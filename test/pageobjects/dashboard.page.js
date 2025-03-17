import { $ } from '@wdio/globals';
import Page from './page';


class DashboardPage extends Page {

    get btnLogin () {
        return $('//android.widget.TextView[@text="Or login with beaconcha.in"]');
    }

    get dashboardHeader () {
        return $('//android.widget.TextView[@text="Dashboard"]');
    }

    get btnDashboard () {
        return $('//android.webkit.WebView[@text="beaconcha.in"]/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View/android.widget.TabWidget/android.view.View[1]/android.view.View/android.widget.Image');
    }

    get grandNotificationPermission () {
        return $('//android.widget.TextView[@text="Grant Notification Permission"]');
    }

    get btnManageDashboards () {
        return  $('//android.webkit.WebView[@text="beaconcha.in"]/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View[1]/android.view.View/android.view.View/android.view.View[1]/android.widget.Image');
    }

    get btnAddDashboard () {
        return  $('//android.app.Dialog/android.view.View/android.view.View[1]/android.view.View[2]/android.view.View/android.view.View/android.widget.Image');
    }

    get btnAddToEth() {
        return  $('//android.widget.Button[@text="Add on Ethereum"]');
    }

    get btnAddToGno() {
        return  $('//android.widget.Button[@text="Add on Gnosis"]');
    }

    get modalMaxDashboardReached() {
        return  $('//android.widget.TextView[@resource-id="alert-9-hdr"]');
    }

    get modalMaxDashboardReachedGno() {
        return  $('//android.widget.TextView[@resource-id="alert-10-hdr"]');
    }

    async clickLoginBtn () {
        await this.btnLogin.click();
    }

    async navigatetoDashboardPage () {
        await this.btnDashboard.click();
    }

    async clickManageDashboards () {
        await this.btnManageDashboards.click();
    }
    
    async clickAddDashboard () {
        await this.btnAddDashboard.click();
    }

    async clickAddDashboardToEth () {
        await this.btnAddToEth.click();
    }

    async clickAddDashboardToGno () {
        await this.btnAddToGno.click();
    }
}



export default new DashboardPage();
