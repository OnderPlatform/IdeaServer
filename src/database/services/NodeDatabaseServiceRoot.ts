import { NodeDatabaseRepositories } from "./NodeDatabaseRepositories";
import { REIDS_UI } from "./REIDS_UI";
import { AMIGO } from "./AMIGO";
import { MocksService } from "./MocksService";
import { MQTTService } from "./MQTTService";
import { NotarizationService } from "./NotarizationService";

const DEFAULT_BALANCE = -1
const DEFAULT_MARGIN = 5
const DEFAULT_OPCOEF = 4
const DEFAULT_INITPRICE = [0,	1,	2,	3,	4]
const DEFAULT_INITPOWER = [0,	3,	5,	7,	9]


export class NodeDatabaseServiceRoot {
  public amigo: AMIGO
  public mocks: MocksService
  public mqtt: MQTTService
  public notarization: NotarizationService
  public reidsUI: REIDS_UI
  public repositories: NodeDatabaseRepositories

  constructor() {
    this.amigo = new AMIGO()
    this.mocks = new MocksService()
    this.mqtt = new MQTTService()
    this.notarization = new NotarizationService()
    this.reidsUI = new REIDS_UI()
    this.repositories = new NodeDatabaseRepositories()
  }
}
