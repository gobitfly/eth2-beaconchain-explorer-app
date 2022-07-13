import { ThrowStmt } from '@angular/compiler';
import { Component, OnInit, Input, ViewChild, ElementRef } from '@angular/core';
import { Animation, AnimationController, ModalController } from '@ionic/angular';
import { SubscribePage } from 'src/app/pages/subscribe/subscribe.page';
import { AdSeenRequest, CoinzillaAdResponse } from 'src/app/requests/requests';
import { ApiService } from 'src/app/services/api.service';
import AdUtils, { AdLocation, BEACONCHAIN_AD_ACTION } from 'src/app/utils/AdUtils';

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
    private adUtils: AdUtils,
    private modalController: ModalController,
    private api: ApiService
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
        this.titleContainer.nativeElement.style.fontSize = this.calculateTextSize(this.text)
        DELAY_SPEED = 7500
      } else if (this.currentDisplay == 1) {
        this.text = this.ad.description_short
        this.titleContainer.nativeElement.style.fontSize = this.calculateTextSize(this.text)
      } else {
        this.text = this.ad.description
        this.titleContainer.nativeElement.style.fontSize = this.calculateTextSize(this.text)
      }

      this.inAnimation.play()
      setTimeout(() => {
        this.inAnimation.stop()
        this.animateTitleChange()
      }, DELAY_SPEED)

    }, TRANSITION_SPEED)
  }

  private calculateTextSize(text: string) {
    if (text && text.length > 70) {
      if (text.length > 110) return "13px"
      return "14px"
    }
    return "16px"
  }

  openAd() {
    if (this.ad.url && this.ad.url == BEACONCHAIN_AD_ACTION) {
      this.openUpgrades()
    } else {
      window.open(this.ad.url, '_system', 'location=yes');
    }
  }

  async openUpgrades() {
    const modal = await this.modalController.create({
      component: SubscribePage,
      cssClass: 'my-custom-class',
    });
    return await modal.present();
  }

  async sendImpression() {

    if (!this.ad.impressionUrl) return;
    
    const result = await this.api.execute(new AdSeenRequest(this.ad.impressionUrl))
    console.log("ad impression response", result)
      
  }

}
