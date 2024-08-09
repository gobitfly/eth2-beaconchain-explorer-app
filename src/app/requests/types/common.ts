// Code generated by tygo. DO NOT EDIT.
/* eslint-disable */

//////////
// source: common.go

export interface Paging {
  prev_cursor?: string;
  next_cursor?: string;
  total_count?: number /* uint64 */;
}
export interface ApiResponse {
  paging?: Paging;
  data: any;
}
export interface ApiErrorResponse {
  error: string;
}
export interface ApiDataResponse<T extends any> {
  data: T;
}
export interface ApiPagingResponse<T extends any> {
  paging: Paging;
  data: T[];
}
export type PubKey = string;
export type Hash = string; // blocks, txs etc.
export interface Address {
  hash: Hash;
  ens?: string;
}
export interface LuckItem {
  percent: number /* float64 */;
  expected: string /* time.Time */;
  average: any /* time.Duration */;
}
export interface Luck {
  proposal: LuckItem;
  sync: LuckItem;
}
export interface StatusCount {
  success: number /* uint64 */;
  failed: number /* uint64 */;
}
export interface ClElValue<T extends any> {
  el: T;
  cl: T;
}
export interface PeriodicValues<T extends any> {
  all_time: T;
  last_24h: T;
  last_7d: T;
  last_30d: T;
}
export interface PercentageDetails<T extends any> {
  percentage: number /* float64 */;
  min_value: T;
  max_value: T;
}
export interface ChartSeries<I extends number /* int */ | string, D extends number /* float64 */ | string /* decimal.Decimal */> {
  id: I; // id may be a string or an int
  property?: string; // for stacking bar charts
  data: D[]; // y-axis values
}
export interface ChartData<I extends number /* int */ | string, D extends number /* float64 */ | string /* decimal.Decimal */> {
  categories: number /* uint64 */[]; // x-axis
  series: ChartSeries<I, D>[];
}
export interface ValidatorHistoryEvent {
  status: 'success' | 'partial' | 'failed';
  income: string /* decimal.Decimal */;
}
export interface ValidatorHistoryProposal {
  status: 'success' | 'partial' | 'failed';
  el_income: string /* decimal.Decimal */;
  cl_attestation_inclusion_income: string /* decimal.Decimal */;
  cl_sync_inclusion_income: string /* decimal.Decimal */;
  cl_slashing_inclusion_income: string /* decimal.Decimal */;
}
export interface ValidatorHistoryDuties {
  attestation_source?: ValidatorHistoryEvent;
  attestation_target?: ValidatorHistoryEvent;
  attestation_head?: ValidatorHistoryEvent;
  sync?: ValidatorHistoryEvent;
  slashing?: ValidatorHistoryEvent;
  proposal?: ValidatorHistoryProposal;
  sync_count?: number /* uint64 */; // count of successful sync duties for the epoch
}
export interface ChainConfig {
  chain_id: number /* uint64 */;
  name: string;
}
export interface SearchResult {
  type: string;
  chain_id: number /* uint64 */;
  hash_value?: string;
  str_value?: string;
  num_value?: number /* uint64 */;
}
export type InternalPostSearchResponse = ApiDataResponse<SearchResult[]>;
export interface VDBPublicId {
  public_id: string;
  name?: string;
  share_settings: {
    share_groups: boolean;
  };
}
export interface ChartHistorySeconds {
  epoch: number /* uint64 */;
  hourly: number /* uint64 */;
  daily: number /* uint64 */;
  weekly: number /* uint64 */;
}
export interface IndexBlocks {
  index: number /* uint64 */;
  blocks: number /* uint64 */[];
}