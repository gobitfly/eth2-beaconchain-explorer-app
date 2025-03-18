export function getSummaryChartGroupColors(theme: string) {
	const colorsLight = [
		'#ffaa31',
		'#7db5ec',
		'#b2df27',
		'#5d78dc',
		'#ffdb58',
		'#f067e9',
		'#57bd64',
		'#a448c0',
		'#dc2a7f',
		'#e6beff',
		'#87ceeb',
		'#438d61',
		'#e7416a',
		'#6be4d8',
		'#fabebe',
		'#90d9a5',
		'#ff6a00',
		'#ffbe7c',
		'#bcb997',
		'#deb244',
		'#dda0dd',
		'#fa8072',
		'#d2b48c',
		'#6b8e23',
		'#0e8686',
		'#9a6324',
		'#932929',
		'#808000',
		'#30308e',
		'#708090',
	]
	const colorsDark = [
		'#ffaa31',
		'#7db5ec',
		'#c3f529',
		'#5d78dc',
		'#ffdb58',
		'#f067e9',
		'#57bd64',
		'#a448c0',
		'#dc2a7f',
		'#e6beff',
		'#87ceeb',
		'#438d61',
		'#e7416a',
		'#6be4d8',
		'#fabebe',
		'#aaffc3',
		'#ff6a00',
		'#ffd8b1',
		'#fffac8',
		'#deb244',
		'#dda0dd',
		'#fa8072',
		'#d2b48c',
		'#6b8e23',
		'#0e8686',
		'#9a6324',
		'#932929',
		'#808000',
		'#30308e',
		'#708090',
	]

	return theme === 'light' ? colorsLight : colorsDark
}

export function getChartTextColor(): null {
	return null // keep default
	// const styles = getComputedStyle(document.body)
	// return styles.getPropertyValue('--ion-text-color-lighter')
}

export function getChartTooltipBackgroundColor() {
	const styles = window.getComputedStyle(document.body)
	return styles.getPropertyValue('--ion-item-background')
}

export function getRewardsChartLineColor() {
	const styles = window.getComputedStyle(document.body)
	return styles.getPropertyValue('--ion-text-color-lighter')
}

export function getRewardChartColors() {
	return {
		cl: '#7DB5EC',
		el: '#ffaa31',
	}
}
