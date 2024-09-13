// magic-snowflakes.d.ts

declare module 'magic-snowflakes' {
	interface SnowflakeOptions {
		color?: string // Default: "#5ECDEF"
		count?: number // Default: 50
		minOpacity?: number // From 0 to 1. Default: 0.6
		maxOpacity?: number // From 0 to 1. Default: 1
		minSize?: number // Default: 8
		maxSize?: number // Default: 18
		rotation?: boolean // Default: true
		speed?: number // Default: 1
		wind?: boolean // Default: true
	}

	interface SnowflakeInstance {
		destroy: () => void
	}

	function Snowflakes(options?: SnowflakeOptions): SnowflakeInstance

	export = Snowflakes
}
