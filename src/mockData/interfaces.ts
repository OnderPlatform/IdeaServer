// Interfaces related to AMIGO


export interface ProducerData {
  time: Date,
  energy: number,
  power: number,
  producerEthAddress: string
}

export interface ConsumerData {
  time: Date,
  energy: number,
  consumerEthAddress: string
}

export interface ProsumerData {
  time: Date,
  energyIn: number,
  energyOut: number,
  prosumerEthAddress: string
}

export interface CellRealData {
  "timeStamp": string,
  "measurementValueQuality": {
    "validity": string,
    "source": string
  },
  "value": number
}

export interface Cell {
  name: string
  ethAddress: string
  mrid: string
}


export interface InitDataFromAMIGO {
  producers: Array<Cell>
  consumers: Array<Cell>
  prosumers: Array<Cell>
}

export interface DataFromAMIGO {
  producers: Array<ProducerData>,
  consumers: Array<ConsumerData>,
  prosumers: Array<ProsumerData>
}

export interface AMIGOCell {
  mrid: string
  name: string
  cimID: number
}

// Interface related to UI
export interface DataFromUI {
  initEnergy: number,
  initPrice: number,
  margin: number
}

// Interfaces related to algorithm
export interface TransactionEntry {
  cost: number,
  time: string,
  price: number,
  amount: number,
  from: string,
  to: string,
  approved: boolean | undefined
}

export interface TradeProsumerEntry {
  time: Date,
  prosumerId: string,
  energyIn: number,
  energyOut: number,
  price: number,
  pay: number,
  pip: boolean
}

export interface TradeConsumerEntry {
  time: Date,
  consumerId: string,
  energy: number,
  price: number,
  pay: number
}

export interface TradeProducerEntry {
  time: Date,
  producerId: string,
  price: number,
  energy: number,
  power: number
}

interface ProsumerAndHisEnergyInAll {
  prosumerId: string
  energyInAll: number
}

export interface AlgorithmResult {
  tradeTables: {
    consumers: Array<TradeConsumerEntry>,
    producers: Array<TradeProducerEntry>,
    prosumers: Array<TradeProsumerEntry>
  },
  prosumersEnergyAll: Array <ProsumerAndHisEnergyInAll>,
  transactionTable: Array <TransactionEntry>,
}

interface ConsumerHashingInfo {
  date: number
  consumer: Array<{
    email: string
    energy: number
  }>
}

interface ProducerHashingInfo {
  date: number
  producer: Array<{
    email: string
    energy: number
    power: number
  }>
}

interface ProsumerHashingInfo {
  date: number
  prosumer: Array<{
    email: string
    energyIn: number
    energyOut: number
  }>
}

export interface HashingInfo {
  producer: ProducerHashingInfo
  consumer: ConsumerHashingInfo
  prosumer: ProsumerHashingInfo
}

export interface AdminTransactions {
  transaction: Array<{
    time: string
    from: string
    to: string
    price: number
    transfer_energy: number
    transfer_coin: number
  }>
}

export interface AdminConsumptions {
  "minEnergy": number,
  "maxEnergy": number,
  "averageEnergy": number,
  "minPrice": number,
  "maxPrice": number,
  "averagePrice": number,
  "energy_today": Array<{
    "date": string,
    "energy": number
  }>
  "energy_30_day": Array<{
    "date": string,
    "energy": number
  }>
  "price_today": Array<{
    "date": string,
    "price": number
  }>
  "price_30_day": Array<{
    "date": string,
    "price": number
  }>
  "consumption_peers": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>
}

export interface AdminProductions {
  "production_peers": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "sold": number,
    "price": number
  }>
}

export interface AdminAnchor {
  "anchors": Array<{
    "date": string,
    "participant": string,
    "id": string,
    "address": string
  }>
}

export interface Authorization {
  login: string
  password: string
}

export interface UserMargin {
  margin: number
}

export interface UserConsumption {
  "minEnergy": number,
  "maxEnergy": number,
  "averageEnergy": number,
  "minPrice": number,
  "maxPrice": number,
  "averagePrice": number,
  "energy_today": Array<{
    "date": string,
    "energy": number
  }>
  "energy_30_day": Array<{
    "date": string,
    "energy": number
  }>
  "price_today": Array<{
    "date": string,
    "price": number
  }>
  "price_30_day": Array<{
    "date": string,
    "price": number
  }>
  "consumption_peers": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>
}

export interface UserProduction {
  "minEnergy": number,
  "maxEnergy": number,
  "averageEnergy": number,
  "minPrice": number,
  "maxPrice": number,
  "averagePrice": number,
  "energy_today": Array<{
    "date": string,
    "energy": number
  }>
  "energy_30_day": Array<{
    "date": string,
    "energy": number
  }>
  "price_today": Array<{
    "date": string,
    "price": number
  }>
  "price_30_day": Array<{
    "date": string,
    "price": number
  }>
  "production_peers": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "sold": number,
    "price": number
  }>
}

export interface UserTransactions {
  "transaction": Array<{
    "time": string,
    "from": string,
    "to": string,
    "price": number,
    "transfer_energy": number,
    "transfer_coin": number
  }>
}

export interface UserAnchor {
  "anchors": Array<{
    "data": string,
    "participant": string,
    "hashId": string,
    "address": string
  }>
}

export interface UserPrices {
  "prices": Array<{
    "amount": number,
    "price": number
  }>
}

