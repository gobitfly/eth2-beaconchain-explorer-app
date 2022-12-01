import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'

import { MergeChecklistPageRoutingModule } from './merge-checklist-routing.module'

import { MergeChecklistPage } from './merge-checklist.page'

@NgModule({
	imports: [CommonModule, FormsModule, IonicModule, MergeChecklistPageRoutingModule],
	declarations: [MergeChecklistPage],
})
export class MergeChecklistPageModule {}
