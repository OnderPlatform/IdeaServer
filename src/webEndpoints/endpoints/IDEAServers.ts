import { EthAddresses } from "../../mockData/config";

const commonHost = 'service'
const commonPort = 4000

export const IDEAServers = EthAddresses.map((value, index) => {
  return {
    host: `seller${index+1}-${commonHost}`,
    port: commonPort,
    uri: `meters/${value}`
  }
})

export const IDEAURLs = IDEAServers.map(value => {
  return {
    url: `http://${value.host}${value.port ? `:${value.port}` : ''}/${value.uri ? value.uri : ''}`
  }
})

export const mapEthAddressToURL = (ethAddress: string) => {
  const url = IDEAURLs.find(value => value.url.includes(ethAddress))
  if (!url)
    throw new Error('mapping error')
  return url.url
}
