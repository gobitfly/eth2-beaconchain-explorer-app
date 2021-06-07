/* 
 *  // Copyright (C) 2020 - 2021 Bitfly GmbH
 *  // Manuel Caspari (manuel@bitfly.at)
 *  // 
 *  // This file is part of Beaconchain Dashboard.
 *  // 
 *  // Beaconchain Dashboard is free software: you can redistribute it and/or modify
 *  // it under the terms of the GNU General Public License as published by
 *  // the Free Software Foundation, either version 3 of the License, or
 *  // (at your option) any later version.
 *  // 
 *  // Beaconchain Dashboard is distributed in the hope that it will be useful,
 *  // but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  // GNU General Public License for more details.
 *  // 
 *  // You should have received a copy of the GNU General Public License
 *  // along with Beaconchain Dashboard.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Component, OnInit, Input, SimpleChange } from '@angular/core';
import { UnitconvService } from '../../services/unitconv.service';
import { ApiService } from '../../services/api.service';
import { DasboardDataRequest, EpochResponse } from '../../requests/requests';
import * as HighCharts from 'highcharts';
import * as Highstock from "highcharts/highstock";
import BigNumber from "bignumber.js";
import { Plugins } from '@capacitor/core';
import { OverviewData } from '../../controllers/OverviewController';
import { Release } from '../../utils/ClientUpdateUtils';
import ThemeUtils from 'src/app/utils/ThemeUtils';
import { highChartOptions } from 'src/app/utils/HighchartOptions';
import { StorageService } from 'src/app/services/storage.service';
import confetti from 'canvas-confetti';
import { NumberSymbol } from '@angular/common';
const { Browser } = Plugins;

@Component({
  selector: 'app-validator-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  @Input() data?: OverviewData;
  @Input() updates?: Release[];
  @Input() currentY: number;
  @Input() scrolling: boolean;

  fadeIn = "invisible"

  beaconChainUrl: string = null
  finalizationIssue = false
  awaitGenesis = false
  earlyGenesis = false
  utilizationAvg: number = -1

  chartData
  chartDataProposals
  chartError = false
  currencyPipe = null

  readonly randomChartId

  rankPercentMode = false

  selectedChart = "chartIncome"

  showFirstProposalMsg = false
  firstCelebrate = true

  doneLoading = false
  proposals: Proposals = null

  constructor(
    public unit: UnitconvService,
    public api: ApiService,
    public theme: ThemeUtils,
    private storage: StorageService
  ) {
    this.randomChartId = getRandomInt(Number.MAX_SAFE_INTEGER)
  }

  async ngOnChanges(event) {
    if (event.data && event.data instanceof SimpleChange) {
      if (event.data.currentValue) {
        this.chartError = false
        this.chartData = null
        this.doneLoading = this.data != null
        if (this.data != null) {
          if (this.fadeIn == "invisible") {
            this.fadeIn = "fade-in"
            setTimeout(() => {
              this.fadeIn = null
            }, 1500)
          }
        }

        this.drawBalanceChart()
        this.drawProposalChart()
        this.beaconChainUrl = await this.getBaseBrowserUrl()

        if (!this.data.foreignValidator) {
          this.checkForFinalization()
          this.checkForGenesisOccured()
        }
      }
    }
  }

  ngOnInit() {
    this.doneLoading = false
    this.storage.getBooleanSetting("rank_percent_mode", false).then((result) => this.rankPercentMode = result)
    highChartOptions(HighCharts)
    highChartOptions(Highstock)
  }

  async checkForGenesisOccured() {
    if (!this.data || !this.data.currentEpoch) return
    const currentEpoch = this.data.currentEpoch as EpochResponse
    this.awaitGenesis = currentEpoch.epoch == 0 && currentEpoch.proposedblocks <= 1
    this.earlyGenesis = !this.awaitGenesis && !this.finalizationIssue && currentEpoch.epoch <= 7
  }

  async checkForFinalization() {
    if (!this.data || !this.data.currentEpoch) return
    const currentEpoch = this.data.currentEpoch as EpochResponse
    this.finalizationIssue = new BigNumber(currentEpoch.globalparticipationrate).isLessThan("0.664") && currentEpoch.epoch > 7
  }

  async getChartData(data: ('balance' | 'proposals')) {
    if (!this.data || !this.data.lazyChartValidators) return null
    const chartReq = new DasboardDataRequest(data, this.data.lazyChartValidators)
    const response = await this.api.execute(chartReq).catch((error) => { return null })
    if (!response) {
      this.chartError = true
      return null
    }
    return chartReq.parse(response)
  }


  switchCurrencyPipe() {
    if (this.unit.pref == "ETHER") {
      if (this.currencyPipe == null) return
      this.unit.pref = this.currencyPipe
    }
    else {
      this.currencyPipe = this.unit.pref
      this.unit.pref = "ETHER"
    }
  }

  async drawProposalChart() {
    this.chartDataProposals = await this.getChartData("proposals")

    if (!this.chartDataProposals || this.chartDataProposals.length < 1) {
      this.chartDataProposals = false
      return
    }

    var proposed = []
    var missed = []
    var orphaned = []
    this.chartDataProposals.map(d => {
      if (d[1] == 1) proposed.push([d[0] * 1000, 1])
      else if (d[1] == 2) missed.push([d[0] * 1000, 1])
      else if (d[1] == 3) orphaned.push([d[0] * 1000, 1])
    })

    this.proposals = {
      good: proposed.length,
      bad: missed.length + orphaned.length
    }

    this.checkForFirstProposal(proposed)

    this.createProposedChart(proposed, missed, orphaned)
  }

  private async checkForFirstProposal(chartData) {
    if (this.data.foreignValidator) return
    const foundAtLeasOne = chartData.length >= 1 && chartData.length <= 2
    const noPreviousFirstProposal = await this.storage.getBooleanSetting("first_proposal_executed", false)
    if (foundAtLeasOne && !noPreviousFirstProposal) {
      this.showFirstProposalMsg = true

      if (this.firstCelebrate) {
        setTimeout(() => {
          confetti({
            particleCount: 30,
            spread: 50,
            origin: { y: 0.41 }
          });
        }, 800)

      }
      this.firstCelebrate = false
    }
  }

  async drawBalanceChart() {
    this.chartData = await this.getChartData("balance")

    if (!this.chartData || this.chartData.length <= 3) {
      this.chartError = true;
      this.doneLoading = true
      return
    }

    this.chartError = false;

    var balance = new Array(this.chartData.length)
    var effectiveBalance = new Array(this.chartData.length)
    var validatorCount = new Array(this.chartData.length)
    var utilization = new Array(this.chartData.length)
    for (var i = 0; i < this.chartData.length; i++) {
      var res = this.chartData[i]
      validatorCount[i] = [res[0], res[1]]
      balance[i] = [res[0], res[2]]
      effectiveBalance[i] = [res[0], res[3]]
      utilization[i] = [res[0], res[3] / (res[1] * 32)]
    }

    this.utilizationAvg = this.averageUtilization(utilization)
    setTimeout(() => { this.doneLoading = true }, 50)


    this.createBalanceChart(this.calculateIncomeData(balance))
  }


  private calculateIncomeData(balance) {
    var income = new Array(14);
    var lastDay = -1;
    var count = 0;
    var endDayBalance = 0;
    var endTs = 0;
    for (var i = balance.length - 1; i >= 0; i--) {
      let tsDate = new Date(balance[i][0]);
      let day = tsDate.getDate()
      if (lastDay == -1) {
        endTs = balance[i][0];
        endDayBalance = balance[i][1];
        lastDay = day;
      }

      if (lastDay != day) {
        const middleOfDay = new Date(endTs)
        middleOfDay.setHours(0)
        var dayIncome = endDayBalance - balance[i][1];
        while(dayIncome > 32) {
          dayIncome = dayIncome - 32;
        }

        let color = dayIncome < 0 ? "#ff835c" : "var(--chart-default)";

        income[count] = { x: middleOfDay.getTime(), y: dayIncome, color: color };

        endTs = balance[i][0];
        endDayBalance = balance[i][1];
        lastDay = day;
        count++;
      }
      if (count >= 14) break;

    }
    income[count] = [endTs + 24 * 3600 * 1000, 0];
    return income;
  }

  private averageUtilization(data: number[]) {
    if (!data || data.length <= 0) return -1
    var sum = 0

    data.forEach((item) => {
      sum += item[1]
    })
    const avg = sum * 100 / data.length

    return avg
  }

  switchRank() {
    this.rankPercentMode = !this.rankPercentMode
    this.storage.setBooleanSetting("rank_percent_mode", this.rankPercentMode)
  }

  createProposedChart(proposed, missed, orphaned) {
    // @ts-ignore     ¯\_(ツ)_/¯
    const chart = Highstock.stockChart('highchartsBlocks' + this.randomChartId, {
      chart: {
        type: 'column',
      },
      legend: {
        enabled: true
      },
      title: {
        text: '' //Balance History for all Validators
      },
      colors: ["var(--chart-default)", "#ff835c", "#e4a354", "#2b908f", "#f45b5b", "#91e8e1"],
      xAxis: {
        lineWidth: 0,
        tickColor: '#e5e1e1',
        type: 'datetime',
        range: 60 * 24 * 60 * 60 * 1000,
      },
      yAxis: [
        {
          title: {
            text: ''
          },
          allowDecimals: false,
          opposite: false
        }
      ],
      tooltip: {
        style: {
          color: 'var(--text-color)',
          fontWeight: 'bold'
        }
      },
      plotOptions: {
        series: {

          dataGrouping: {
            units: [
              ["day", [1]]
            ],
            forced: true,
            enabled: true,
            groupAll: true
          }
        }
      },
      series: [
        {
          name: 'Proposed',
          color: 'var(--chart-default)',
          data: proposed,
          pointWidth: 5,
        },
        {
          name: 'Missed',
          color: '#ff835c',
          data: missed,
          pointWidth: 5,
        },
        {
          name: 'Orphaned',
          color: '#e4a354',
          data: orphaned,
          pointWidth: 5,
        }
      ],
      rangeSelector: {
        enabled: false
      },
      scrollbar: {
        enabled: false
      },
      navigator: {
        enabled: false
      }
    })
  }

  async createBalanceChart(income) {
    const genesisTs = (await this.api.networkConfig).genesisTs

    // @ts-ignore     ¯\_(ツ)_/¯
    Highstock.stockChart('highcharts' + this.randomChartId, {

      exporting: {
        scale: 1
      },
      rangeSelector: {
        enabled: false
      },
      scrollbar: {
        enabled: false
      },
      navigator: {
        enabled: false
      },
      chart: {
        type: 'column',
      },
      legend: {
        enabled: true
      },
      title: {
        text: '' //Balance History for all Validators
      },
      xAxis: {

        tickInterval: 24 * 3600 * 1000,
        //tickmarkPlacement: 'on',

        range: 9 * 24 * 60 * 60 * 1000,
        type: 'datetime',
      },
      tooltip: {
        style: {
          color: 'var(--text-color)',
          fontWeight: 'bold'
        },
        formatter: (tooltip) => {
          const value = new BigNumber(tooltip.chart.hoverPoint.y);

          return `Income: ${value.toFormat(6)} Ether<br/><span style="font-size:11px;">${this.unit.convertToPref(value, "ETHER")}</span>`
        }
      },
      yAxis: [
        {
          title: {
            text: ''
          },
          opposite: false,
          labels: {
            formatter: function () {
              return this.value.toFixed(2)
            },

          }
        }
      ],
      series: [
        {
          pointWidth: 25,
          name: 'Income',
          data: income
        }
      ]
    })
  }


  async openBrowser() {
    await Browser.open({ url: await this.getBrowserURL(), toolbarColor: "#2f2e42" });
  }

  async getBrowserURL(): Promise<string> {
    if (this.data.foreignValidator) {
      return (await this.getBaseBrowserUrl()) + "/validator/" + this.data.foreignValidatorItem.pubkey
    } else {
      return (await this.getBaseBrowserUrl()) + "/dashboard?validators=" + this.data.lazyChartValidators
    }
  }

  async getBaseBrowserUrl() {
    const net = (await this.api.networkConfig).net
    return "https://" + net + "beaconcha.in"
  }

}

function timeToEpoch(genesisTs, ts) {
  var gts = genesisTs
  var sps = 12
  var spe = 32
  var slot = Math.floor((ts / 1000 - gts) / sps)
  var epoch = Math.floor(slot / spe)
  if (epoch < 0) return 0
  return epoch
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

interface Proposals {
  good: number
  bad: number
}