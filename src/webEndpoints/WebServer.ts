import * as Koa from 'koa'
import * as http from "http";
import {BaseController} from "./controllers/BaseController";
import bodyParser = require("koa-bodyparser");
import koaLogger = require('koa-logger');

export default class WebServer {
    private readonly port: number
    private readonly host: string
    private readonly app: Koa
    private readonly server: http.Server

    constructor(port: number, host: string) {
        this.app = new Koa()
        this.port = port
        this.host = host

        this.configureRouters();

        this.app.use(koaLogger((str, args) => {
        }))
        this.app.use(bodyParser())

        this.server = http.createServer(this.app.callback())
    }

    private configureRouters (): void {
        const controller = new BaseController()
        const router = controller.router()
        this.app.use(router.routes()).use(router.allowedMethods())
    }

    async start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.server.listen(this.port, this.host, () => {
                resolve()
            })
        })
    }
}