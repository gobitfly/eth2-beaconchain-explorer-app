<p align="center">
  <img src=".github/banner.png" alt="Beaconchain Dashboard" width="100%">
</p>

<p align="center">
  <a href="https://play.google.com/store/apps/details?id=in.beaconcha.mobile">
    <img src=".github/assets/android.png" alt="Get it on Google Play" height="60">
  </a>
  <a href="https://apps.apple.com/app/beaconchain-dashboard/id1541822121">
    <img src=".github/assets/ios.png" alt="Download on App Store" height="60">
  </a>
</p>

# Beaconchain Dashboard App

[![Build](https://github.com/gobitfly/eth2-beaconchain-explorer-app/actions/workflows/build.yaml/badge.svg)](https://github.com/gobitfly/eth2-beaconchain-explorer-app/actions/workflows/build.yaml)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-brightgreen)](https://beaconcha.in/mobile)
[![License: GPLv3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

**Open‑source validator performance tracker for Ethereum and Gnosis** – built with Angular, Ionic, Capacitor.  
Uses the [beaconcha.in API](https://beaconcha.in).

## 📖 Table of Contents
- [About](#about)
- [Features](#features)
- [Device Support](#device-support)
- [Development](#development)
  - [Getting Started](#getting-started)
  - [Browser](#browser)
  - [Android](#android)
  - [iOS](#ios)
  - [Best Practices](#best-practices)
- [License](#license)

## About

Beaconchain Dashboard is an Angular app written in TypeScript, HTML & CSS. It utilizes the Ionic framework for mobile components and Ionic Capacitor as bridge for native code.

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

- Android 5.1 or newer
- iOS 13 or newer

## Development

### Getting started

1. Clone repo
2. Install dependencies

```bash
npm install -g @ionic/cli native-run cordova-res
npm i
