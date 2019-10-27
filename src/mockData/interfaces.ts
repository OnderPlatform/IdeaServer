export interface ProducerData {
  time: string,
  energy: number,
  power: number,
  producerEthAddress: string
}

export interface ConsumerData {
  time: string,
  energy: number,
  consumerEthAddress: string
}

export interface ProsumerData {
  time: string,
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
  time: Date,
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
  prosumersEnergyAll: Array<ProsumerAndHisEnergyInAll>,
  transactionTable: Array<TransactionEntry>,
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

export interface AdminConsumptions {
  today: {
    "minEnergy": number,
    "maxEnergy": number,
    "averageEnergy": number,
    "minPrice": number,
    "maxPrice": number,
    "averagePrice": number,
  },
  30: {
    "minEnergy": number,
    "maxEnergy": number,
    "averageEnergy": number,
    "minPrice": number,
    "maxPrice": number,
    "averagePrice": number,
  }
  "energy_today": Array<{
    "date": Date,
    "energy": number
  }>
  "energy_30_day": Array<{
    "date": Date,
    "energy": number
  }>
  "price_today": Array<{
    "date": Date,
    "price": number
  }>
  "price_30_day": Array<{
    "date": Date,
    "price": number
  }>
  "peers_today": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>
  "peers_30_days": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>
}

export interface AdminProductions {
  today: {
    "minEnergy": number,
    "maxEnergy": number,
    "averageEnergy": number,
    "minPrice": number,
    "maxPrice": number,
    "averagePrice": number,
  },
  30: {
    "minEnergy": number,
    "maxEnergy": number,
    "averageEnergy": number,
    "minPrice": number,
    "maxPrice": number,
    "averagePrice": number,
  }
  "energy_today": Array<{
    "date": Date,
    "energy": number
  }>
  "energy_30_day": Array<{
    "date": Date,
    "energy": number
  }>
  "price_today": Array<{
    "date": Date,
    "price": number
  }>
  "price_30_day": Array<{
    "date": Date,
    "price": number
  }>
  "peers_today": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "sold": number,
    "price": number
  }>
  "peers_30_days": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "sold": number,
    "price": number
  }>
}

export interface AdminAnchor {
  "anchors": Array<{
    "data": number,
    "participant": string,
    "hashId": string,
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

export interface OperatorConsumption {
  "peers_today": Array<{
    "total": string,
    "id": string,
    "balance": number,
    // "bought": number,
    "price": number
  }>
  "peers_30_days": Array<{
    "total": string,
    "id": string,
    "balance": number,
    // "bought": number,
    "price": number
  }>
}

export interface UserConsumption {
  today: {
    "minEnergy": number,
    "maxEnergy": number,
    "averageEnergy": number,
    "minPrice": number,
    "maxPrice": number,
    "averagePrice": number,
  },
  30: {
    "minEnergy": number,
    "maxEnergy": number,
    "averageEnergy": number,
    "minPrice": number,
    "maxPrice": number,
    "averagePrice": number,
  }
  "energy_today": Array<{
    "date": Date,
    "energy": number
  }>
  "energy_30_day": Array<{
    "date": Date,
    "energy": number
  }>
  "price_today": Array<{
    "date": Date,
    "price": number
  }>
  "price_30_day": Array<{
    "date": Date,
    "price": number
  }>
  "peers_today": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>
  "peers_30_days": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "bought": number,
    "price": number
  }>
}

export interface OperatorProduction {
  "peers_today": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "price": number
  }>
  "peers_30_days": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "price": number
  }>
}

export interface UserProduction {
  today: {
    "minEnergy": number,
    "maxEnergy": number,
    "averageEnergy": number,
    "minPrice": number,
    "maxPrice": number,
    "averagePrice": number,
  },
  30: {
    "minEnergy": number,
    "maxEnergy": number,
    "averageEnergy": number,
    "minPrice": number,
    "maxPrice": number,
    "averagePrice": number,
  }
  "energy_today": Array<{
    "date": Date,
    "energy": number
  }>
  "energy_30_day": Array<{
    "date": Date,
    "energy": number
  }>
  "price_today": Array<{
    "date": Date,
    "price": number
  }>
  "price_30_day": Array<{
    "date": Date,
    "price": number
  }>
  "peers_today": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "sold": number,
    "price": number
  }>
  "peers_30_days": Array<{
    "total": string,
    "id": string,
    "balance": number,
    "sold": number,
    "price": number
  }>
}

export interface Transaction {
  "time": Date,
  "from": string,
  "to": string,
  "price": number,
  "transfer_energy": number,
  "transfer_coin": number
}

export interface UserTransactions {
  // "transaction": Array<Transaction>
  "transaction_today": Array<Transaction>
  "transaction_30_days": Array<Transaction>
}

export interface UserAnchor {
  "anchors": Array<{
    "data": number,
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

export interface PricesForAMIGO {
  ethAddress: string,
  price: number,
  time: string
}

export interface OnInitPriceInitPowerChanged {
  ethAddress: string,
  initPower: number[],
  initPrice: number[],
  whenChanged: string
}


export interface PostDataToAMIGOProps {
  ethAddress: string
  cellType: "generatingUnit" | "energyStoragingUnit" | "energyConsumer",
  value: number
  timeStamp: string
}
