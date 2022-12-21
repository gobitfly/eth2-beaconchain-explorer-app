import { Component, OnInit, Input } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import AdUtils, { AdLocation } from 'src/app/utils/AdUtils'

@Component({
	selector: 'app-ad',
	templateUrl: './ad.component.html',
	styleUrls: ['./ad.component.scss'],
})
export class AdComponent implements OnInit {
	info: AdLocation = 'info'

	@Input() location: AdLocation

	adHtml: SafeHtml

	constructor(private adUtils: AdUtils, private sanitizer: DomSanitizer) {}

	ngOnInit() {
		this.adUtils.get(this.location).then((data) => {
			if (data && data.html && data.html.length > 10) {
				this.adHtml = this.sanitizer.bypassSecurityTrustHtml(
					data.html
						.replace('alt', 'alt style="height:auto;display: block;margin:auto;"') //image-rendering: pixelated;
						.replace('a h', 'a style="color: var(--x-toolbar-title-color) !important;text-decoration: none;" h')
				)
			}
		})
	}
}
