import { EthAddresses } from "../../mockData/config";

const commonHost = 'reids.onder.tech'
const commonPort = 8880

export const IDEAServers = EthAddresses.map((value, index) => {
  return {
    host: `agent${index+1}.${commonHost}`,
    port: null,
    uri: `meters/${value}`
  }
})

export const IDEAURLs = IDEAServers.map(value => {
  return {
    url: `https://${value.host}${value.port ? `:${value.port}` : ''}/${value.uri ? value.uri : ''}`
  }
})

export const mapEthAddressToURL = (ethAddress: string) => {
  const url = IDEAURLs.find(value => value.url.includes(ethAddress))
  if (!url)
    throw new Error('mapping error')
  return url.url
}
