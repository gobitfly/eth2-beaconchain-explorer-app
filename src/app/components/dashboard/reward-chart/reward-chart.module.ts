import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { NgxEchartsModule } from 'ngx-echarts'
import { IonicModule } from '@ionic/angular'
import { RewardChartComponent } from './reward-chart.component'

@NgModule({
	imports: [CommonModule, NgxEchartsModule, IonicModule],
	declarations: [RewardChartComponent],
	exports: [RewardChartComponent],
})
export class RewardChartModule {}
