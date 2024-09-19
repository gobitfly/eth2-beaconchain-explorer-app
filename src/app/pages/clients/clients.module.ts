import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'

import { ClientsPageRoutingModule } from './clients-routing.module'

import { ClientsPage } from './clients.page'
import { FullPageLoadingComponent } from "../../components/full-page-loading/full-page-loading.component";
import { FullPageOfflineComponent } from "../../components/full-page-offline/full-page-offline.component";

@NgModule({
	imports: [CommonModule, FormsModule, IonicModule, ClientsPageRoutingModule, FullPageLoadingComponent, FullPageOfflineComponent],
	declarations: [ClientsPage],
})
export class ClientsPageModule {}
