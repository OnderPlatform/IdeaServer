import { initialMockData } from "../../mockData/config";
import { NodeDatabaseRepositories } from "./NodeDatabaseRepositories";

export class MocksService extends NodeDatabaseRepositories {
  async initMockData() {
    console.log('Initializing mock data...');
    if (!(await this.cellRepository.find({})).length) {
      await Promise.all(initialMockData.consumers.map(value => {
        return this.cellRepository.insert({
          ethAddress: value.ethAddress,
          name: value.name,
          type: 'consumer'
        })
      }))
      await this.cellRepository.insert({
        name: initialMockData.operator.name,
        ethAddress: initialMockData.operator.ethAddress,
        opCoef: initialMockData.operator.opCoef,
        type: 'operator'
      })

      await Promise.all(initialMockData.producers.map(value => {
        return this.cellRepository.insert({
          ethAddress: value.ethAddress,
          name: value.name,
          initPower: value.initPower,
          initPrice: value.initPrice,
          type: 'producer'
        })
      }))
      initialMockData.prosumers.map(value => {
        return this.cellRepository.insert({
          ethAddress: value.ethAddress,
          name: value.name,
          margin: value.margin,
          type: 'prosumer'
        })
      })

      console.log('Mock data for cells was added');
    }

    if (!(await this.userRepository.find({})).length) {
      await Promise.all(initialMockData.users.map(async value => {
        const cell = await this.cellRepository.findOneOrFail({
          where: {
            ethAddress: value.cellId
          }
        })
        return this.userRepository.insert({
          email: value.email,
          password: value.password,
          cell: cell
        })
      }))
      console.log('Mock data for users was added.');
    }
    console.log('Mock data initialization ended.');
  }
}
