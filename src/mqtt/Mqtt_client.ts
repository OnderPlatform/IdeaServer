import mqtt = require('mqtt')

function makeid (length: number): string {
  let result = ''
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let charactersLength = characters.length
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

export class ClientMQTT {
  Client?: mqtt.MqttClient
private started: number
  private options: any
  private handler: any
  constructor() {
  //   this.options = {
  //   port: 80,
  //   host: "mqtt_cl-stage.rnd.rtsoft.ru",
  //   clientId: makeid(20),
  //   username: "user1",
  //   password: "jejcoilld7493",
  //   keepalive: 60,
  //   reconnectPeriod: 1000,
  //   rejectUnauthorized: true,
  //   protocol: 'mqtts'
  // }
    this.options = {
    // port: 80,
    // host: "35.224.129.238",
    // clientId: makeid(20),
    // username: "user1",
    // password: "jellyfish",
    // keepalive: 60,
    // reconnectPeriod: 1000,
    // rejectUnauthorized: false,
    // protocol: 'mqtt_cl'
    port: 8083,
    host: "mosquitto.onder.tech",
    clientId: makeid(20),
    username: "imseller",
    password: "C65A29d416FF8",
    keepalive: 60,
    reconnectPeriod: 1000,
    rejectUnauthorized: false,
    protocol: 'mqtt'
    }
    this.started = 0
  }

  topic_handler (topic: string, message: string): void {
    console.log('Received a new message from %o %o', topic.toString(), message.toString())
    this.handler(topic, message)
  }

  /*
  /testbed/enodeX/contracts/contractID/progress

  "Раз в 20 секунд
{
   id:""123"",
   port:1,
   mode:1
   amount:300,
   seller: ""AgentX"",
   contragent:""AgentY"",
   cost:24.4,
   ""timeStamp"": ""2011-12-03T10:15:30Z"",
   progress: 123.7, #в вт*ч
   delta: 12.5, #в вт*ч - разница между progress
   progress_percent: 0.3 #в о.е.
}"
  */

  publishProgress(enode: number,contractID: number,amount: number, seller: string, contragent: string,price:number,delta: number) {
    console.log("publishProgress is hooked")
    let topic = "/testbed/enode"+enode+"/contracts/"+contractID+"/progress"
    let payload = {
      id: contractID,
      port: 1,
      mode: 1,
      amount: amount,
      seller:seller,
      contragent: contragent,
      cost: price,
      timeStamp: new Date().toISOString(),
      progress: 1,
      delta: delta,
      progress_percent:50
    }
    this.Client!.publish(topic, JSON.stringify(payload))
  }

  connected() {
    this.started = 1
    console.log("Connected to the broker!")
    //TODO change to topic, # for
    this.Client!.subscribe("/testbed/+/contracts/+/progress")
    this.Client!.subscribe("/testbed/+/contracts/progress")
    this.Client!.subscribe("/testbed/+/finance")
    this.Client!.on('message', this.topic_handler.bind(this))
  }


  add_handler(handler: any) {
    this.handler = handler
  }

  start (): void {
      console.log('Starting MQTT client')
      this.Client! = mqtt.connect(this.options)
      this.Client!.on('connect', this.connected.bind(this))
    }

    stop (): void {
      this.Client!.end()
    }
}


export default ClientMQTT
