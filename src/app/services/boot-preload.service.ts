import { Injectable } from '@angular/core'
import { ValidatorUtils } from '../utils/ValidatorUtils'
import ClientUpdateUtils from '../utils/ClientUpdateUtils'
import { BlockUtils } from '../utils/BlockUtils'

@Injectable({
	providedIn: 'root',
})
export class BootPreloadService {
	constructor(private validatorUtils: ValidatorUtils, private clientUpdateUtils: ClientUpdateUtils, private blockUtils: BlockUtils) {}

	preload() {
		try {
			this.validatorUtils.getAllMyValidators()
			this.clientUpdateUtils.checkAllUpdates()
			this.blockUtils.getMyBlocks(0) // preload blocks
		} catch (e) {
			console.warn('can not preload', e)
		}
	}
}
