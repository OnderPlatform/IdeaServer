export function mapCellTypeToPurposeKey(type: "generatingUnit" | "energyStoragingUnit" | "energyConsumer") {
  switch (type) {
    case "generatingUnit":
    case "energyConsumer":
    case "energyStoragingUnit":
      return 'FACT'
    default:
      throw new Error(`unknown cell type ${type}`)
  }
}

export function mapCellTypeToEndpoint(type: "generatingUnit" | "energyStoragingUnit" | "energyConsumer") {
  switch (type) {
    case "energyConsumer":
    case "energyStoragingUnit":
    case "generatingUnit":
      return 'cost/row'
    default:
      throw new Error(`unknown cell type ${type}`)
  }
}

export function converCellTypeToAMIGOCellType(type: "producer" | "consumer" | "prosumer" | "operator"| "admin") {
  switch (type) {
    case "prosumer":
      return "energyStoragingUnit"
    case "producer":
      return "generatingUnit"
    case "consumer":
      return "energyConsumer"
    default:
      throw new Error(`unknown cell type: ${type}`)
  }
}
