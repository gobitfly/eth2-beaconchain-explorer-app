exports.config = {
    runner: 'local',
    specs: ['./test/specs/**/*.js'],
    maxInstances: 1,
    capabilities: [{
        platformName: 'Android', // :white_check_mark: Ensure this is present
        'appium:deviceName': 'emulator-5554',
        'appium:platformVersion': '15.0',
        'appium:automationName': 'UiAutomator2',
        'appium:appPackage': 'in.beaconcha.mobile',
        'appium:appActivity': '.MainActivity',
        "appium:fastReset": true,
        'appium:noReset': true,
        'appium:chromedriverAutodownload': true,

    }],
    logLevel: 'info',
    services: ['appium'],
    framework: 'mocha',
    reporters: ['spec'],
    mochaOpts: {
        timeout: 60000
    }
};

