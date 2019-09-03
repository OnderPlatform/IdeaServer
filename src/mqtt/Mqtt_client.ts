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
    this.options = {
      port: 8883,
      host: "mqtt-stage.rnd.rtsoft.ru",
      clientId: makeid(20),
      username: "user1",
      password: "jejcoilld7493",
      keepalive: 60,
      reconnectPeriod: 1000,
      rejectUnauthorized: true,
      protocol: 'mqtts'
    }
    this.started = 0
  }

  topic_handler (topic: string, message: string): void {
    console.log('Received a new message from %o', topic.toString())
    this.handler(topic, message)
  }

  // publish113(value: number) {
  //   console.log("publish113 is hooked " + value)
  //   let topic = "/testbed/amigo/case_id"
  //   let payload = {
  //     value: value,
  //     timeStamp: new Date().toISOString()
  //   }
  //   this.Client.publish(topic, JSON.stringify(payload))
  // }

  connected() {
    this.started = 1
    console.log("Connected to the broker!")
    //TODO change to topic, # for
    this.Client!.subscribe("/testbed/+/+")
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
