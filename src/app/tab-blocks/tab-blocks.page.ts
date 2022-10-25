import { Component, OnInit } from '@angular/core';
import { ModalController, Platform } from '@ionic/angular';
import { BlockDetailPage } from '../pages/block-detail/block-detail.page';
import { BlockResponse } from '../requests/requests';
import { AlertService } from '../services/alert.service';
import { ApiService } from '../services/api.service';
import { StorageService } from '../services/storage.service';
import { UnitconvService } from '../services/unitconv.service';
import { BlockUtils, Luck } from '../utils/BlockUtils';
import { MerchantUtils } from '../utils/MerchantUtils';
import ThemeUtils from '../utils/ThemeUtils';
import { ValidatorUtils } from '../utils/ValidatorUtils';

@Component({
  selector: 'app-tab-blocks',
  templateUrl: './tab-blocks.page.html',
  styleUrls: ['./tab-blocks.page.scss'],
})
export class TabBlocksPage implements OnInit {


  fadeIn = "invisible"

  static itemCount = 0

  items: BlockResponse[] = [];

  details: any

  loading = false

  initialized = false

  reachedMax = false

  luck : Luck = null

  constructor(
    public api: ApiService,
    private unit: UnitconvService,
    private blockUtils: BlockUtils,
    public modalController: ModalController,
    private validatorUtils: ValidatorUtils,
    private alertService: AlertService
  ) {
    this.validatorUtils.registerListener(() => {
      this.refresh()
    })
  }

  ngOnInit() {
    this.refresh()
  }

  loadData(event) {
    if (this.reachedMax) {
      event.target.disabled = true;
    }
      setTimeout(async () => {
        await this.loadMore(false)

        event.target.complete();

        if (this.reachedMax) {
          event.target.disabled = true;
        }
      }, 1500)
  }

  private async loadMore(initial: boolean) {
    if (this.reachedMax) {
      return
    }

    let blocks = await this.blockUtils.getMyBlocks(initial ? 0 : this.items.length)
    if (initial) {
      this.items = blocks
    } else {
      this.items = this.items.concat(blocks)
    }    
    this.luck = await this.blockUtils.getProposalLuck(this.items)
    
    TabBlocksPage.itemCount = this.items.length
    if (blocks.length < 25) {
      this.reachedMax = true
    }
  }

  private async refresh() {
    this.reachedMax = false
    this.setLoading(true)
    await this.loadMore(true)
    this.setLoading(false)
    if (this.fadeIn == "invisible") {
      this.fadeIn = "fade-in"
      setTimeout(() => {
        this.fadeIn = null
      }, 1500)
    }
  }

  private setLoading(loading: boolean) {
    if (loading) {
      // Reasoning: Don't show loading indicator if it takes less than 400ms (already cached locally but storage is slow-ish so we adjust for that)
      setTimeout(() => {
        if (!this.items || this.items.length <= 0) {
          this.loading = true
        }
      }, 200)
    } else {
      if (this.loading) {
        setTimeout(() => {
          this.initialized = true
          this.loading = false
        }, 350)
      } else {
        this.initialized = true
        this.loading = false
      }
    }
  }

  async clickBlock(item: BlockResponse) {
    const modal = await this.modalController.create({
      component: BlockDetailPage,
      cssClass: 'my-custom-class',
      componentProps: {
        'block': item,
      }
    });
    return await modal.present();

  }

  async doRefresh(event) {
    setTimeout(async () => {
      await this.loadMore(true)
      event.target.complete();
    }, 1500)
  }


  itemHeightFn(item, index) {
    if (index == TabBlocksPage.itemCount - 1) return 210;
    return 125;
  }


  switchCurrencyPipe() {
    if (this.unit.pref == "ETHER") {
      if (UnitconvService.currencyPipe == null) return
      this.unit.pref = UnitconvService.currencyPipe
    }
    else {
      UnitconvService.currencyPipe = this.unit.pref
      this.unit.pref = "ETHER"
    }
  }

  luckHelp() {
    if (!this.luck || this.luck.proposedBlocksInTimeframe < 2) {
      this.alertService.showInfo(
        "Proposal Luck",
        `Compares the number of your actual proposed blocks to the expected average blocks per validator during the last month. 
        You'll see your luck percentage once you have proposed two blocks or more.`
      )
    } else {
      this.alertService.showInfo(
        "Proposal Luck",
        `Compares the number of your actual proposed blocks to the expected average blocks per validator during the last ${this.luck.timeFrameName}. 
        <br/><br/>Your <strong>${this.luck.userValidators}</strong> validators are expected to produce <strong>${this.luck.expectedBlocksPerMonth.toFixed(2)}</strong> blocks per month on average with current network conditions.`
      )
    }
    
  }

}
