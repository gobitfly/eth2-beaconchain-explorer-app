import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { highChartOptions } from 'src/app/utils/HighchartOptions';
import * as HighCharts from 'highcharts';
import * as Highstock from "highcharts/highstock";


@Component({
  selector: 'app-machinechart',
  templateUrl: './machinechart.component.html',
  styleUrls: ['./machinechart.component.scss'],

})
export class MachinechartComponent implements OnInit {

  @Input() title?: string = null
  @Input() subtitleLeft?: string
  @Input() subtitleRight?: string
  @Input() icon?: string
  @Input() priority: boolean = false
  @Input() clickAction = () => { }

  @Input() chartData: [] = []
  @Input() key: string

  id: string = ""
  chartError: boolean = false
  specificError: string = null

  constructor() { }

  doClick() {
    this.clickAction()
  }

  ngOnChanges(changes: SimpleChanges) {
    if(changes['chartData']){
      this.updateCharts()
    }
  }

  private updateCharts() {
     // just so we don't load everything at the same time
     const priorityDelay = this.priority ? 0 : 80 + Math.random() * 200

     setTimeout(() => {
       try {
         // @ts-ignore
         if (this.chartData && this.chartData.length == 1 && this.chartData[0] == "system_missing") {
           this.specificError = "system_missing"
           this.chartError = true
           return
         }
         this.doChart(this.key, this.id, this.chartData)
         //@ts-ignore
         this.chartError = this.chartData.length <= 0 || this.chartData[0].data.length <= 1
       } catch (e) {
         this.chartError = true
       }
     }, 400 + priorityDelay)
  }

  ngOnInit() {
    highChartOptions(Highstock)
    this.id = makeid(6)
  }

  public doChart(key, type = "", data) {
    const id = 'machinechart_' + type + "_" + this.hashCode(key)

    var overrideConfig = {}
    if (data[data.length - 1].hasOwnProperty("config")) {
      overrideConfig = data[data.length - 1].config
      data.pop()
    }

    const baseConfig = {
      chart: {
        type: 'area',
        marginLeft: 0,
        marginRight: 0,
        spacingLeft: 0,
        spacingRight: 0
      },
      legend: {
        enabled: true
      },
      title: {
        text: '' //Balance History for all Validators
      },
      colors: ["#ff835c", "#e4a354", "#2b908f", "#7cb5ec", "#f45b5b", "#91e8e1"],
      xAxis: {
        lineWidth: 0,
        tickColor: '#e5e1e1', 
        type: 'datetime',
        minPadding: 0,
        maxPadding: 0,
        ordinal: false
      },
      yAxis: {
          allowDecimals: false,
          opposite: false,
          minPadding: 0,
          maxPadding: 0,
        labels: {
          x: -5,
          }
        }
      ,
      tooltip: {
        style: {
          color: 'var(--text-color)',
          fontWeight: 'bold'
        }
      },
      plotOptions: {
        series: {
        }
      },
      series: data,
      rangeSelector: {
        enabled: false
      },
      scrollbar: {
        enabled: false
      },
      navigator: {
        enabled: false
      }
    }
    const mergedConfig = Object.assign(baseConfig, overrideConfig);

    // @ts-ignore     ¯\_(ツ)_/¯
    const chart = Highstock.stockChart(id, mergedConfig)

  }

  public hashCode(string: string) {
    var hash = 0;
    for (var i = 0; i < string.length; i++) {
      var character = string.charCodeAt(i);
      hash = ((hash << 5) - hash) + character;
      hash = hash & hash;
    }
    return hash;
  }

}

function makeid(length) {
  var result = '';
  var characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}