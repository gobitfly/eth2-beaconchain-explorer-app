import { ThrowStmt } from '@angular/compiler';
import { Component, OnInit, Input, ViewChild, ElementRef } from '@angular/core';
import { Animation, AnimationController } from '@ionic/angular';
import { CoinzillaAdResponse } from 'src/app/requests/requests';
import AdUtils, { AdLocation } from 'src/app/utils/AdUtils';

const TRANSITION_SPEED = 650
var DELAY_SPEED = 5000

@Component({
  selector: 'app-text-ad',
  templateUrl: './text-ad.component.html',
  styleUrls: ['./text-ad.component.scss'],
})
export class TextAdComponent implements OnInit {

  @ViewChild('titleContainer', { read: ElementRef }) titleContainer: ElementRef;

  @Input() location: AdLocation;

  text = ""

  outAnimation: Animation;
  inAnimation: Animation;

  ad: CoinzillaAdResponse

  constructor(
    private animationCtrl: AnimationController,
    private adUtils: AdUtils
  ) { }

  ngOnInit() {

    this.adUtils.get(this.location).then((data) => {
      this.ad = data;
      if (!this.ad) return
      this.text = this.ad.title
      this.sendImpression()

      setTimeout(() => {
        this.animateTitleChange()
      }, DELAY_SPEED + 1000)
    })
  }

  currentDisplay = 0
  animateTitleChange() {

    if (!this.outAnimation) {
      this.outAnimation = this.animationCtrl.create()
        .addElement(this.titleContainer.nativeElement)
        .easing('ease-out')
        .duration(TRANSITION_SPEED)
        .fromTo('opacity', '1.0', '0.0');
    }
    if (!this.inAnimation) {
      this.inAnimation = this.animationCtrl.create()
        .addElement(this.titleContainer.nativeElement)
        .duration(TRANSITION_SPEED)
        .easing('ease-in')
        .fromTo('opacity', '0.0', '1.0');
    }

    this.outAnimation.play()
    setTimeout(() => {
      this.outAnimation.stop()

      this.currentDisplay = (this.currentDisplay + 1) % 3
      if (this.currentDisplay == 0) {
        this.text = this.ad.title
        DELAY_SPEED = 7500
      } else if (this.currentDisplay == 1) {
        this.text = this.ad.description_short
      } else {
        this.text = this.ad.description
      }

      this.inAnimation.play()
      setTimeout(() => {
        this.inAnimation.stop()
        this.animateTitleChange()
      }, DELAY_SPEED)

    }, TRANSITION_SPEED)
  }

  openAd() {
    window.open(this.ad.url, '_system', 'location=yes');
  }

  async sendImpression() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', this.ad.impressionUrl, true);
      xhr.onload = function () {
        console.log("ad impression reported")
      };
      xhr.send(null);
    } catch (e) {
      console.warn("ad impression reporting failed", e)
    }
  }

}
