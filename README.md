

# Beaconchain Dashboard App

Beaconchain Dashboard is an open source ethereum and gnosis validator performance tracker app for Android and iOS. It utilizes the beaconcha.in API. 


[![Get it on Google Play](https://beaconcha.in/img/android.png)](https://play.google.com/store/apps/details?id=in.beaconcha.mobile)
[![Get it App Store](https://beaconcha.in/img/ios.png)](https://apps.apple.com/app/beaconchain-dashboard/id1541822121)

## About

Beaconchain Dashboard is an Angular app written in Typescript, HTML & CSS. It utilizes the Ionic framework for mobile components and Ionic Capacitor as bridge for native code.

## Features

- Ethereum and Gnosis supported
- Keep track on your validators online status, balances, returns and more  
- Various notification alerts for your validators  
- Execution block rewards overview
- Machine monitoring (CPU usage, network usage and more)
- Rocketpool support
- Customize stake share if you only partially own a validator
- Combined dashboard view  
- Support for up to 280 validators  
- Ethereum client update notifications  
- Network warnings  
- Support for multiple currencies  
- Mainnet & Testnet support  
- Light Theme & Dark Theme  

## Device support

- iOS 13 or newer

### Getting started

1. Clone repo
2. Install dependencies
```
npm install -g @ionic/cli native-run cordova-res
npm i
```
  
NOTE: You need to provide your own google-services.json for Android and GoogleService-Info.plist for iOS.  


#### Livereload

Make sure port 8100 is accessable on your computer and use the following command to run a livereload server

`ionic cap run ios --livereload --external --host=192.168.1.64 --disableHostCheck --configuration=development`

Adapt the --host param to match your computers IP. 

#### Build for production

`npm run-script build-android-for-production`

#### Install via Android Studio
To install the app on a real device, follow this guide: https://developer.android.com/studio/run/device

Or to run it in an emulator, follow up here: https://developer.android.com/studio/run/emulator


### iOS
**Prerequisites**
* NodeJS 16
* macOS with macOS Monterey 12.5 newer
* Xcode 14.1 or newer

Build the the app at least once before proceeding:

`ionic build`

#### Livereload

Make sure port 8100 is accessable on your mac and use the following command to run a livereload server

`ionic cap run ios --livereload --external --host=192.168.1.64 --disableHostCheck --configuration=development`

Adapt the --host param to match your macs IP. 

#### Build for production

`npm run-script build-ios-for-production`

### Best Practices

* Use components when we need it for multiple pages.
* Use pipes for currency conversion or interpreting a value
* Keep in mind that the app can be used in light and dark theme, use css vars when styling. Global theme attributes can be found in src/app/theme/variables.scss and src/app/global.scss.

## License

This project is licensed under GPLv3. [LICENSE](LICENSE)
