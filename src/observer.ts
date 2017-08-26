
import {MqttClient} from "mqtt";
import {CoapClient as coap, CoapResponse} from "node-coap-client";
import * as dbgModule from "debug";
let debug = dbgModule("tradfri-observer");

export declare type Opts = {
    mqtt: MqttClient,
    coapUrl: string,
    pingInterval?: number,
    pingTimeout?: number,
    sendTimeout?: number,
    dequeInterval?: number,
}

export default class Observer {

    private mqtt: MqttClient;
    private baseUrl: string;
    private pingInterval: number;
    private pingTimeout: number;
    private sendTimeout: number;
    private dequeInterval: number;
    private observers: {[url:string]: boolean} = {};
    private queue: (() => Promise<any>)[] = [];
    private queueTimer: NodeJS.Timer|0;


    constructor(opts: Opts) {
        this.mqtt = opts.mqtt;
        this.pingTimeout = opts.pingTimeout || 30000;
        this.sendTimeout = opts.sendTimeout || 2000;
        this.pingInterval = opts.pingInterval || 120000;
        this.dequeInterval = opts.dequeInterval || 100;
        if (this.pingInterval <= this.pingTimeout) {
            throw new Error("pingInterval must be more than pingTimeout")
        }
        this.pingInterval = this.pingInterval - this.pingTimeout;
        this.baseUrl = opts.coapUrl;
        this.reset();
        this.ping();
    }

    public enqueue (f:() => Promise<any>) {
        this.queue.push(f);
        if (typeof this.queueTimer === "undefined") {
            this.deque();
        }
    };

    public reset() {
        coap.reset();
        this.queue = [];
        if (this.queueTimer !== 0 && typeof this.queueTimer !== "undefined") {
            clearTimeout(this.queueTimer);
        }
        this.queueTimer = undefined;
        this.observers = {};
        this.observe("15001");
        this.observe("15004");
        this.observe("15005");
        this.observe("15006");
        this.observe("15011/15012");
    };

    public url(): string {
        return this.baseUrl;
    }

    private ping() {
        let done = false;
        setTimeout(() => {
            setTimeout(() => { this.ping(); }, this.pingInterval);
            if (!done) {
                console.warn("Timed out, resetting session");
                this.reset();
            }
        }, this.pingTimeout);
        let once = false;
        this.enqueue(async () => {
            if (once) return;
            once = true;
            debug(`Sending ping`);
            let ret = await coap.request(`${this.baseUrl}status`, "get");
            debug(`Ping response: ${ret.code} ${ret.payload.toString()}`);
            done = true;
        });
    };

    private deque() {
        this.queueTimer = 0;
        let len = this.queue.length;

        if (len == 0) {
            debug(`No jobs in queue, pausing`);
            this.queueTimer = undefined;
            return;
        }
        debug(`Dequeing, ${len} objects remaining`);

        let f = this.queue.shift();
        let timeout = setTimeout(() => {
            timeout = undefined;
            console.error(`Timeout in queue, re-queueing and pausing for 10s`);
            this.queue.push(f);
            if (typeof this.queueTimer !== "undefined" && this.queueTimer !== 0) {
                clearTimeout(this.queueTimer);
            }
            this.queueTimer = setTimeout(() => { this.deque(); }, 10000);

        }, 20000);
        let next = (i?:number) => {
            next = undefined;
            if (typeof timeout === "undefined") {
                return;
            }
            clearTimeout(timeout);
            timeout = undefined;
            this.queueTimer = setTimeout(() => { this.deque(); }, i ? i*1000 : this.dequeInterval);
        };
        let onErr = (err) => {
            if (typeof next !== "undefined") {
                console.error(`Error from callback, re-queuing and delaying queue 10s: ${err}`);
                this.enqueue(f);
                next(10);
            }
        };
        f().then(
            (s) => {
                debug(`Done`);
                if (typeof next !== "undefined") {
                    debug(`Calling next()`);
                    next();
                }
            },
            onErr)
            .catch(onErr);
    };


    private onUpdate(url: string, r: CoapResponse) {
        let payload = r.payload.toString();
        this.mqtt.publish("tradfri-raw/" + url, payload, {qos: 1, retain: true, dup: false}, undefined);
        if (url === "15001" || url === "15004" || url === "15005") {
            // Contents should be an array of sub id:s
            let arr: number[] = JSON.parse(payload);
            for (let i in arr) {
                this.observe(url + "/" + arr[i]);
            }
        }
        if (url.substr(0, 6) == "15005/") {
            let sp = url.split("/");
            if (sp.length == 2) {
                let arr: number[] = JSON.parse(payload);
                for (let i in arr) {
                    this.observe(url + "/" + arr[i]);
                }
            }
        }
    }

    private observe(url: string) {
        if (typeof this.observers[url] !== "undefined") {
            return
        }
        this.observers[url] = false;
        this.enqueue(async () => {
            debug("Observing " + url);
            let full = `${this.baseUrl}${url}`;
            await coap.observe(full, "get", (r: CoapResponse) => {
                this.onUpdate(url, r);
            });
            this.observers[url] = true;
        });
    };

}