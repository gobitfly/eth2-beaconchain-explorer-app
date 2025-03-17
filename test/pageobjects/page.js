const { browser } = require('@wdio/globals')

/**
* main page object containing all methods, selectors and functionality
* that is shared across all page objects
*/
module.exports = class Page {
    /**
    * Launches the app by opening the main activity.
    */
    open () {
        return browser.startActivity("in.beaconcha.mobile", ".MainActivity");
    }
}
