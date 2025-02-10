// src/typings/cordova-plugin-purchase.d.ts

declare global {
	namespace CdvPurchase {
		namespace Validator {
			namespace Request {
				type Body = any // Replace with actual type if available.
			}
			namespace Response {
				type Payload = any
				// Optionally define SuccessPayload if you use it.
				type SuccessPayload = any
			}
		}
		interface Callback<T> {
			(result: T): void
		}
		interface VerifiedPurchase {
			// Define properties as needed.
		}
		namespace Platform {
			const GOOGLE_PLAY: string
			const APPLE_APPSTORE: string
		}
		enum ProductType {
			PAID_SUBSCRIPTION,
			// Add additional types if needed.
		}
		interface IRegisterProduct {
			id: string
			platform: string
			type: ProductType
		}
		interface PricingPhase {
			price: string
			priceMicros: number
			currency: string
		}
		// You may want to add additional interfaces for properties like "store"
		interface Store {
			validator: any // refine as needed
			products: Array<{
				id: string
				offers: Array<{
					pricingPhases: PricingPhase[]
				}>
			}>
			register(product: IRegisterProduct): void
			initialize(): Promise<void>
			get(productId: string): { getOffer(): any } | null
			order(offer: any): Promise<void>
			restorePurchases(): Promise<void>
			when(): {
				approved(callback: (p: any) => any): this
				verified(callback: (p: any) => any): this
			}
			manageSubscriptions(): void
		}
		// And that the global has a "store" property:
		const store: Store
	}
}

declare module 'cordova-plugin-purchase' {
	export as namespace CdvPurchase
	const _default: typeof CdvPurchase
	export default _default
}
