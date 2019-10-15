import axios from 'axios'

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
    case "energyConsumer":
    case "energyStoragingUnit":
      return 'TMMM'
    default:
      throw new Error(`unknown cell type ${type}`)
  }
}

function mapCellTypeToEndpoint(type: "generatingUnit" | "energyStoragingUnit" | "energyConsumer") {
  switch (type) {
    case "energyConsumer":
    case "energyStoragingUnit":
    case "generatingUnit":
      return 'cost/row'
    default:
      throw new Error(`unknown cell type ${type}`)
  }
}


