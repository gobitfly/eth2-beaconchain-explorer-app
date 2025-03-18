import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { NgxEchartsModule } from 'ngx-echarts'
import { SummaryChartComponent } from './summary-chart.component'
import { IonicModule } from '@ionic/angular'

@NgModule({
	imports: [CommonModule, NgxEchartsModule, IonicModule],
	declarations: [SummaryChartComponent],
	exports: [SummaryChartComponent],
})
export class SummaryChartModule {}
