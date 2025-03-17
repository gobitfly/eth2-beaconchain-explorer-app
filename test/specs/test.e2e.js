/* eslint-disable no-undef */
import { expect } from '@wdio/globals';
import { config } from '../../test/user-auth/auth.js'
import PreferencesPage from '../pageobjects/preferences.page.js'
import DashboardPage from '../pageobjects/dashboard.page.js';


describe('My Login application', () => {
    const guppyPassword = config.userAuth.guppy.password
    const guppyEmail = config.userAuth.guppy.email
    const orcaPassword = config.userAuth.orca.password
    const orcaEmail = config.userAuth.orca.email

    beforeEach(async () => {
        await driver.execute("mobile: clearApp", { appId: "in.beaconcha.mobile" });
        await PreferencesPage.open();
    });

    it('should login with valid credentials from the Preference page', async () => {
        await PreferencesPage.login(guppyEmail, guppyPassword);

    });

    it('should login successfully from Dashboard Page', async () => {
        await browser.pause(3000);
        await DashboardPage.clickLoginBtn();
        await PreferencesPage.inputPassword.setValue(guppyPassword);
        await PreferencesPage.inputUsername.setValue(guppyEmail);
        await PreferencesPage.btnSubmit.click();
        await PreferencesPage.loginSuccessfulPopUp.waitForDisplayed({ timeout: 10000 });
        expect(await PreferencesPage.loginSuccessfulPopUp.isDisplayed()).toBe(true);
        await PreferencesPage.btnRestartApp.click();
        await DashboardPage.navigatetoDashboardPage();
        await browser.pause(3000);
        expect(await DashboardPage.dashboardHeader.isDisplayed()).toBe(true);
        await DashboardPage.grandNotificationPermission.waitForDisplayed({ timeout: 5000 });
        expect(await DashboardPage.grandNotificationPermission.isDisplayed()).toBe(true)
    });

    it('verify there is an error when user tries to add the dashboard to Ethereum if limit is reached', async () => {
        await PreferencesPage.login(orcaEmail, orcaPassword);
        await DashboardPage.navigatetoDashboardPage();
        await DashboardPage.clickManageDashboards();
        await DashboardPage.clickAddDashboard()
        await browser.pause(3000)
        await DashboardPage.clickAddDashboardToEth()
        await DashboardPage.modalMaxDashboardReached.waitForDisplayed({ timeout: 5000 });
    });

    it('verify there is an error when user tries to add the dashboard to Gnosis if limit is reached', async () => {
        await browser.pause(3000);
        await PreferencesPage.login(orcaEmail, orcaPassword);
        await DashboardPage.navigatetoDashboardPage();
        await DashboardPage.clickManageDashboards();
        await DashboardPage.clickAddDashboard()
        await browser.pause(5000)
        await DashboardPage.clickAddDashboardToGno()
        await DashboardPage.modalMaxDashboardReachedGno.waitForDisplayed({ timeout: 5000 });
    });
});


