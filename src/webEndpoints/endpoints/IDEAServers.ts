import { EthAddresses } from "../../mockData/config";

const commonHost = 'localhost'
const commonPort = 8880

export const IDEAServers = EthAddresses.map((value, index) => {
  return {
    host: commonHost,
    port: commonPort+index+1,
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
