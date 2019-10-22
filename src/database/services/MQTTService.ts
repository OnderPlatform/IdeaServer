import { IsNull } from "typeorm";
import * as mqtt_cl from "../../mqtt/Mqtt_client";
import { NodeDatabaseRepositories } from "./NodeDatabaseRepositories";
import { EthAddresses } from "../../mockData/config";

export class MQTTService extends NodeDatabaseRepositories {
  public readonly mqtt_cl: mqtt_cl.ClientMQTT

  constructor() {
    super();
    this.mqtt_cl = new mqtt_cl.ClientMQTT()
  }

  async updateTransactionState(from: string, to: string, approved: boolean) {
    const fromCell = await this.cellRepository.findOneOrFail({
      where: {
        name: from
      }
    })
    const toCell = await this.cellRepository.findOneOrFail({
      where: {
        name: to
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
            ethAddress: EthAddresses[nodeNumer],
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
              name: parsedMessage.seller
            }
          })
          const contragent = await this.cellRepository.findOneOrFail({
            where: {
              name: parsedMessage.contragent
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

  async sendNewTransactionsToMQTT() {
    console.log('Started sending new transactions...');
    const newTransaction = await this.transactionRepository.findOne({
      where: {
        sentToMqtt: false
      },
      relations: ['from', 'to']
    })

    console.log('Found new trans...');

    if (!newTransaction)
      return
    // вытащить данны из переменной value и отправить в publishProgress
    if (newTransaction.from.name.match(/\d+/) === null || newTransaction.to.name.match(/\d+/) === null)
      throw new Error('no digits in name of node')

    console.log('Going to publish progress....');
    // @ts-ignore
    this.mqtt_cl.publishProgress(+newTransaction.from.name.match(/\d+/)[0], 1, newTransaction.amount, newTransaction.from.name, newTransaction.to.name, newTransaction.price, newTransaction.cost)
    // @ts-ignore
    this.mqtt_cl.publishProgress(+newTransaction.to.name.match(/\d+/)[0], 1, newTransaction.amount, newTransaction.from.name, newTransaction.to.name, newTransaction.price, newTransaction.cost)
    console.log('Published');


    await this.transactionRepository.update({
      id: newTransaction.id
    }, {
      sentToMqtt: true
    })
  }
}
