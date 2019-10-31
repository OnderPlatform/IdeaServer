import { IsNull } from "typeorm";
import * as mqtt_cl from "../../mqtt/Mqtt_client";
import { NodeDatabaseRepositories } from "./NodeDatabaseRepositories";
import { EthAddresses } from "../../mockData/config";

export class MQTTService extends NodeDatabaseRepositories {
  public readonly mqtt_cl: mqtt_cl.ClientMQTT

  constructor() {
    super();
    this.mqtt_cl = new mqtt_cl.ClientMQTT()
    EthAddresses.forEach(async (value, index) => {
      await this.cellRepository.update({
        ethAddress: value
      }, {
        mqttAlias: `Agent${index+1}`
      })
    })
  }

  async updateTransactionState(from: string, to: string, approved: boolean) {
    const fromCell = await this.cellRepository.findOneOrFail({
      where: {
        mqttAlias: from
      }
    })
    const toCell = await this.cellRepository.findOneOrFail({
      where: {
        mqttAlias: to
      }
    })
    await this.transactionRepository.update({
      from: fromCell,
      to: toCell
    }, {
      approved: approved
    })
  }

  async newTransactionStateFromMQTT(topic: string, message: string) {
    console.log("Receive new message from handler - %o ", message)
    if (topic.endsWith("finance")) {
      console.log("finance - mqtt_cl")
      const splitTopic: string[] = topic.split('/')
      const index: number = splitTopic.findIndex(value => value.includes('enode'))
      const nodeNumerArray: string[] | null = splitTopic[index].match(/\d+/)
      if (nodeNumerArray !== null && nodeNumerArray.length) {
        const nodeNumer: number = +nodeNumerArray[0]
        try {
          await this.cellRepository.update({
            ethAddress: EthAddresses[nodeNumer-1],
          }, {
            balance: JSON.parse(message).value
          })
        } catch (e) {
          console.log(e);
        }
      } else {
        throw new Error(`topic format is incorrect: ${topic}`)
      }
    }

    if (topic.endsWith("progress")) {
      console.log("progress - mqtt_cl")
      const splitTopic = topic.split('/')
      const index = splitTopic.findIndex(value => value.includes('enode'))
      const nodeNumerArray = splitTopic[index].match(/\d+/)
      if (nodeNumerArray !== null && nodeNumerArray.length) {
        try {
          const parsedMessage = JSON.parse(message)
          const seller = await this.cellRepository.findOneOrFail({
            where: {
              mqttAlias: parsedMessage.seller
            }
          })
          const contragent = await this.cellRepository.findOneOrFail({
            where: {
              mqttAlias: parsedMessage.contragent
            }
          })
          await this.transactionRepository.update({
            from: seller,
            to: contragent,
            sentToMqtt: true,
            approved: IsNull()
          }, {
            approved: parsedMessage.payment_state
          })
        } catch (e) {
          console.log(e);
        }
      } else {
        throw new Error(`topic format is incorrect: ${topic}`)
      }

      // if (topic.includes('enode1')) {
      //   let obj = JSON.parse(message);
      //   for (const value of newTransactions) {
      //     // вытащить данны из переменной value и отправить в publishProgress
      //     if (obj.seller == value.from && obj.contragent == value.to) {
      //       await this.transactionRepository.update({
      //         id: value.id
      //       }, {
      //         approved: obj.payment_state
      //       })
      //     }
      //   }
      // }
    }
  }

  async sendNewTransactionToMQTT() {
    const newTransaction = await this.transactionRepository.findOne({
      where: {
        sentToMqtt: false
      },
      relations: ['from', 'to']
    })

    if (!newTransaction)
      return
    // вытащить данны из переменной value и отправить в publishProgress
    if (!newTransaction.from.mqttAlias || !newTransaction.to.mqttAlias)
      throw new Error('mqttAlias is null')
    if (newTransaction.from.mqttAlias.match(/\d+/) === null || newTransaction.to.mqttAlias.match(/\d+/) === null)
      throw new Error('no digits in mqttAlias of node')

    // @ts-ignore
    this.mqtt_cl.publishProgress(+newTransaction.from.mqttAlias.match(/\d+/)[0], 1, newTransaction.amount, newTransaction.to.mqttAlias, newTransaction.from.mqttAlias, newTransaction.price, newTransaction.amount)
    // @ts-ignore
    this.mqtt_cl.publishProgress(+newTransaction.to.mqttAlias.match(/\d+/)[0], 1, newTransaction.amount, newTransaction.to.mqttAlias, newTransaction.from.mqttAlias, newTransaction.price, newTransaction.amount)

    await this.transactionRepository.update({
      id: newTransaction.id
    }, {
      sentToMqtt: true
    })
  }
}
