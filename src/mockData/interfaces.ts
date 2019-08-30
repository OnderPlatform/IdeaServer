// Interfaces related to AMIGO
import * as ts from 'typescript/lib/tsserverlibrary'
import createInstallTypingsRequest = ts.server.createInstallTypingsRequest

export interface ProducerData {
  time: Date,
  energy: number,
  power: number,
  producerId: string
}

export interface ConsumerData {
  time: Date,
  energy: number,
  consumerId: string
}

export interface ProsumerData {
  time: Date,
  energyIn: number,
  energyOut: number,
  prosumerId: string
}

export interface DataFromAMIGO {
  producers: Array<ProducerData>,
  consumers: Array<ConsumerData>,
  prosumers: Array<ProsumerData>
}

// Interface related to UI
export interface DataFromUI {
  initEnergy: number,
  initPrice: number,
  margin: number
}

// Interfaces related to algorithm
export interface TransactionEntry {
  time: Date,
  from: string,
  to: string,
  price: number,
  amount: number,
  cost: number,
  approved: boolean
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
