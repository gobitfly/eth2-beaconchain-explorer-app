import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'

import { SubscribePageRoutingModule } from './subscribe-routing.module'

import { SubscribePage } from './subscribe.page'
import { PipesModule } from '../../pipes/pipes.module'
import { BoolCheckedComponent } from "../../components/bool-checked/bool-checked.component";
import { FullPageLoadingComponent } from "../../components/full-page-loading/full-page-loading.component";
import { FullPageOfflineComponent } from "../../components/full-page-offline/full-page-offline.component";

@NgModule({
	imports: [CommonModule, FormsModule, IonicModule, SubscribePageRoutingModule, PipesModule, BoolCheckedComponent, FullPageLoadingComponent, FullPageOfflineComponent],
	declarations: [SubscribePage],
})
export class SubscribePageModule {}
