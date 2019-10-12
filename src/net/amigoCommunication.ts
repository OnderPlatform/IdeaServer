import axios from 'axios'

const AMIGO_HOST = 'localhost'
const AMIGO_PORT = 8888


interface DataFromAMIGO {
  timeStamp: string
  measurementValueQuality: {
    validity: string
    source: string
  }
  value: number
}

const example = {
  timeStamp: "2019-10-08T13:51:42Z",
  measurementValueQuality:
    {
      validity: "GOOD",
      source: "DERIVED"
    },
  value: 32.71669006347656
}

export function amigoCommunication(): Promise<DataFromAMIGO[]> {
  return new Promise((resolve, reject) => {
    resolve([example])
  })
}

interface PostDataToAMIGOProps {
  ethAddress: string
  cellType: "generatingUnit" | "energyStoragingUnit" | "energyConsumer",
  value: number
  timeStamp: string
}

function mapCellTypeToPurposeKey(type: "generatingUnit" | "energyStoragingUnit" | "energyConsumer") {
  switch (type) {
    case "generatingUnit":
      return 'TMMM'
    case "energyStoragingUnit":
      throw new Error('not imlemented yet') // todo not implemented
    case "energyConsumer":
      return 'FACT'
    default:
      throw new Error(`unknown cell type ${type}`)
  }
}

function mapCellTypeToEndpoint(type: "generatingUnit" | "energyStoragingUnit" | "energyConsumer") {
  switch (type) {
    case "energyConsumer":
      return 'cost/row'
    case "energyStoragingUnit":
      throw new Error('post data for prosumer is not implemented yet')
    case "generatingUnit":
      return 'cost'
    default:
      throw new Error(`unknown cell type ${type}`)
  }
}

// todo: it is working incorrect
export async function postPricesToAMIGO({ethAddress, cellType, value, timeStamp}: PostDataToAMIGOProps) {
  if (cellType === "energyStoragingUnit") // todo: implement for prosumer
    return
  const url = `http://${AMIGO_HOST}${AMIGO_PORT ? AMIGO_PORT : ''}/api/${cellType}/${ethAddress}/${mapCellTypeToEndpoint(cellType)}?purposeKey=${mapCellTypeToPurposeKey(cellType)}`
  const response = await axios.post(url, [{
    timeStamp,
    measurementValueQuality:
      {
        validity: "GOOD",
        source: "DERIVED"
      },
    value
  }])
  console.log(response);
  return response
}
