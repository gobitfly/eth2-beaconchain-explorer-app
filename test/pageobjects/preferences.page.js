import { $ } from '@wdio/globals';
import Page from './page';


class PreferencesPage extends Page {

    get inputUsername () {
        return $('//android.webkit.WebView[@text="Mainnet Ethereum Sign in - Open Source Ethereum Blockchain Explorer - beaconcha.in - 2025"]/android.view.View/android.view.View/android.view.View[2]/android.view.View/android.view.View[1]/android.widget.EditText');
    }

    get inputPassword () {
        return $('//android.webkit.WebView[@text="Mainnet Ethereum Sign in - Open Source Ethereum Blockchain Explorer - beaconcha.in - 2025"]/android.view.View/android.view.View/android.view.View[2]/android.view.View/android.view.View[2]/android.widget.EditText');
    }

    get btnSubmit () {
        return $('//android.widget.Button[@text="Log in"]');
    }

    get loginSuccessfulPopUp () {
        return $('//android.widget.TextView[@resource-id="alert-2-hdr"]');
    }

    get btnRestartApp () {
        return $('//android.widget.Button[@text="RESTART APP"]');
    }

    get preferencesTab () {
        return $('//android.webkit.WebView[@text="beaconcha.in"]/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View/android.widget.TabWidget/android.view.View[5]/android.view.View/android.widget.Image');
    }

    get btnLogout () {
        return $('//android.view.View[contains(@text, "Logout")]');
    }

    get confirmLogout () {
        return $('///android.widget.Button[contains(@text, "LOGOUT")]');
    }

    get btnLogin () {
        return $('//android.widget.TextView[@text="Login to Receive Notifications"]');
    }


    async login (username, password) {
        await this.preferencesTab.click();
        await this.btnLogin.click();
        await this.inputUsername.setValue(username);
        await this.inputPassword.setValue(password);
        await this.btnSubmit.click();
        await browser.pause(3000);
        await this.loginSuccessfulPopUp.waitForDisplayed({ timeout: 10000 });
        expect(await this.loginSuccessfulPopUp.isDisplayed()).toBe(true);
        await this.btnRestartApp.click()

    }

    open () {
        return super.open('login');
    }
}

export default new PreferencesPage();
