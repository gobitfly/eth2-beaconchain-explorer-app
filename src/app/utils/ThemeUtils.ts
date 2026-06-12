/*
 *  // Copyright (C) 2020 - 2021 bitfly explorer GmbH
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

import { StorageService } from '../services/storage.service'
import { Injectable } from '@angular/core'
import { NavigationBarPlugin } from 'capacitor-navigationbarnx'
import { Capacitor, Plugins } from '@capacitor/core'
import { Platform } from '@ionic/angular'
import * as Snowflakes from 'magic-snowflakes'
import confetti from 'canvas-confetti'

import { StatusBar, Style } from '@capacitor/status-bar'
const NavigationBar = Plugins.NavigationBar as NavigationBarPlugin

enum Theme {
	DARK,
	LIGHT,
}

interface ThemeStorage {
	theme: Theme
}

const STORAGE_KEY = 'theme'

@Injectable({
	providedIn: 'root',
})
export default class ThemeUtils {
	userPreference: Theme
	currentThemeColor = ''
	private lock: Promise<void | ThemeStorage>

	private snowFlakes

	private currentStatusBarColor = null

	constructor(private storage: StorageService, private platform: Platform) {}

	init(splashScreenCallback: () => void) {
		this.lock = this.storage.getObject(STORAGE_KEY).then((preferenceDarkMode) => {
			this.internalInit(preferenceDarkMode as StoredTheme)
			setTimeout(() => {
				splashScreenCallback()
				this.applyColorInitially()
			}, 10)
			return preferenceDarkMode as StoredTheme
		})
	}

	// We can close the new android 12 splashscreen but it has a fadeout animation of 200ms
	// Status bar color won't adjust on Splashscreen since we change it via MainActivity context not Splashscreencontext
	// and splashscreen won't instantly close either. So we retry setting the status bar color a couple times a few
	// milliseconds apart so the color change won't blob in too late and annoy the user nor won't it change at all
	// and annoy the user either ¯\_(ツ)_/¯
	private applyColorInitially(count = 0) {
		if (count >= 17) return
		setTimeout(
			() => {
				this.colorHandler()
				this.applyColorInitially(++count)
			},
			count == 0 ? 210 : 25
		) // fade out duration = 200ms
	}

	private internalInit(preferenceDarkMode) {
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')
		if (preferenceDarkMode) {
			this.userPreference = preferenceDarkMode.theme
			this.currentThemeColor = preferenceDarkMode.themeColor
		} else {
			this.userPreference = prefersDark.matches ? Theme.DARK : Theme.LIGHT
		}

		this.toggle(this.userPreference == Theme.DARK, false, this.currentThemeColor)

		if (this.isSilvester()) {
			setTimeout(() => {
				this.silvesterFireworks()
			}, 3200)
		}
	}

	undoColor(themeColor: string = this.currentThemeColor) {
		if (themeColor && themeColor != '') document.body.classList.remove(themeColor)
	}

	async toggle(darkModeEnabled: boolean, setColorHandler = true, themeColor: string = this.currentThemeColor) {
		document.body.classList.toggle('dark', darkModeEnabled)
		if (themeColor && themeColor != '') document.body.classList.toggle(themeColor, true)
		if (setColorHandler) this.colorHandler()
		const themeString = darkModeEnabled ? Theme.DARK : Theme.LIGHT
		this.storage.setObject(STORAGE_KEY, { theme: themeString, themeColor: themeColor } as StoredTheme)
		this.userPreference = themeString
		this.currentThemeColor = themeColor
		this.toggleWinter(await this.isWinterEnabled(), false)
	}

	resetTheming() {
		this.undoColor()
		this.colorHandler()
		this.storage.setObject(STORAGE_KEY, { theme: this.userPreference, themeColor: '' } as StoredTheme)
	}

	async isWinterEnabled() {
		if (!this.isWinterSeason()) return false
		const temp = await this.storage.getBooleanSetting('snow_enabled', true)
		return temp
	}

	isWinterSeason() {
		const d = new Date()
		return d.getMonth() == 11 && d.getDate() >= 24 && d.getDate() <= 24
	}

	isSilvester() {
		const d = new Date()
		const silvesterday = d.getMonth() == 11 && d.getDate() == 31 && d.getHours() == 23
		const januaryFirst = d.getMonth() == 0 && d.getDate() == 1 && d.getHours() == 0
		return silvesterday || januaryFirst
	}

	// TODO: Should start thinking about increasing the minimum system requirements for this app ¯\_(ツ)_/¯
	silvesterFireworks() {
		const duration = 10 * 1000
		const animationEnd = Date.now() + duration
		const defaults = { startVelocity: 30, spread: 100, ticks: 70, zIndex: 0 }

		function randomInRange(min, max) {
			return Math.random() * (max - min) + min
		}

		const interval = setInterval(function () {
			const timeLeft = animationEnd - Date.now()

			if (timeLeft <= 0) {
				return clearInterval(interval)
			}

			const particleCount = 20 * (timeLeft / duration)

			confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }))
			confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }))
		}, 350)
	}

	toggleWinter(enabled, saveWinterSetting = true) {
		this.stopSnow(this.snowFlakes)
		if (this.isWinterSeason() && saveWinterSetting) this.storage.setBooleanSetting('snow_enabled', enabled)

		if (!enabled) return
		this.snowFlakes = this.winterSeason(this.userPreference == Theme.DARK)
	}

	async getThemeColor() {
		await this.lock
		return this.currentThemeColor
	}

	async isDarkThemed() {
		await this.lock
		return this.userPreference == Theme.DARK
	}

	private async colorHandler() {
		const color = getComputedStyle(document.body).getPropertyValue('--ion-toolbar-background')
		const isDarkThemed = await this.isDarkThemed()
		this.changeStatusBarColor(color, isDarkThemed)
		this.changeNavigationBarColor(isDarkThemed)
	}

	/**
	 *
	 * @param isDarkThemed Android bottom button bar
	 * @returns
	 */
	private async changeNavigationBarColor(isDarkThemed) {
		if (!Capacitor.isPluginAvailable('StatusBar')) return
		try {
			const themeColor = await this.getThemeColor()
			if (themeColor == 'ethpool') {
				if (isDarkThemed) NavigationBar.setBackgroundColor({ color: '#24201f' })
				else NavigationBar.setBackgroundColor({ color: '#e1d8d8' })
			} else if (themeColor == 'rocketpool') {
				if (isDarkThemed) NavigationBar.setBackgroundColor({ color: '#1a1a1a' })
				else NavigationBar.setBackgroundColor({ color: '#f76f75' })
			} else {
				if (isDarkThemed) NavigationBar.setBackgroundColor({ color: '#000000' })
				else NavigationBar.setBackgroundColor({ color: '#f7f7f7' })
			}
		} catch (e) {
			console.warn('error setting navigation bar color', e)
		}
	}

	private async changeStatusBarColor(color: string, isDarkThemed) {
		let darker = isDarkThemed ? '#000000' : color.trim() //this.shadeColor(color, -12)
		if (this.platform.is('android')) {
			const themeColor = await this.getThemeColor()
			if (themeColor == 'ethpool') {
				darker = isDarkThemed ? '#262327' : '#e1d8d8'
			}
			if (themeColor == 'rocketpool') {
				darker = isDarkThemed ? '#262327' : '#fd9967'
			}

			this.setStatusBarColor(darker)
			this.currentStatusBarColor = darker
		}
	}

	setStatusBarColor(color) {
		try {
			if (Capacitor.isPluginAvailable('StatusBar')) {
				StatusBar.setStyle({
					style: Style.Dark,
				})
				StatusBar.setBackgroundColor({
					color: color,
				})
			} else {
				console.info('Statusbar is not available on this platform')
			}
		} catch (e) {
			console.warn('error setting status bar color', e)
		}
	}

	revertStatusBarColor() {
		this.setStatusBarColor(this.currentStatusBarColor)
	}

	private getSnowFlakeColor(darkTheme: boolean) {
		return darkTheme ? '#fff' : '#5ECDEF'
	}

	private winterSeason(darkTheme: boolean) {
		if (!this.isWinterSeason()) return false
		return this.snow(darkTheme)
	}

	public snow(darkTheme: boolean = this.userPreference == Theme.DARK) {
		return Snowflakes({
			color: this.getSnowFlakeColor(darkTheme), // Default: "#5ECDEF"
			count: 14, // 100 snowflakes. Default: 50
			minOpacity: 0.1, // From 0 to 1. Default: 0.6
			maxOpacity: 0.95, // From 0 to 1. Default: 1
			minSize: 8, // Default: 8
			maxSize: 15, // Default: 18
			rotation: true, // Default: true
			speed: 1, // The property affects the speed of falling. Default: 1
			wind: false, // Without wind. Default: true
		})
	}

	public stopSnow(snow) {
		if (snow) {
			try {
				snow.destroy()
			} catch (error) {
				console.warn('error in stopSnow()', error)
			}
		}
	}
}

interface StoredTheme {
	theme: Theme
	themeColor: string
}
