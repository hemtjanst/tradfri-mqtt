
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
    topicPrefix?: string,
}

export default class Observer {

    private mqtt: MqttClient;
    private baseUrl: string;
    private pingInterval: number;
    private pingFail: number = 0;
    private pingTimeout: number;
    private sendTimeout: number;
    private dequeInterval: number;
    private observers: {[url:string]: boolean} = {};
    private queue: (() => Promise<any>)[] = [];
    private queueTimer: NodeJS.Timer|0;
    private topicPrefix: string;


    constructor(opts: Opts) {
        this.mqtt = opts.mqtt;
        this.pingTimeout = opts.pingTimeout || 30000;
        this.sendTimeout = opts.sendTimeout || 2000;
        this.pingInterval = opts.pingInterval || 60000;
        this.dequeInterval = opts.dequeInterval || 100;
        this.topicPrefix = opts.topicPrefix || 'tradfri-raw';
        if (this.pingInterval <= this.pingTimeout) {
            throw new Error("pingInterval must be more than pingTimeout")
        }
        this.pingInterval = this.pingInterval - this.pingTimeout;
        this.baseUrl = opts.coapUrl;
        this.ping();
        this.init();
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
        this.init();
    };

    private init() {
        this.observe("15001");
        this.observe("15004");
        this.observe("15005");
        this.observe("15006");
        this.observe("15011/15012");
    }

    public url(): string {
        return this.baseUrl;
    }

    private ping() {
        let done = false;
        setTimeout(() => {
            setTimeout(() => { this.ping(); }, this.pingInterval);
            if (!done) {
                if (++this.pingFail > 2) {
                    console.warn("Timed out, resetting session");
                    this.reset();
                }
            } else {
                this.pingFail = 0
            }
        }, this.pingTimeout);
        let once = false;
        this.enqueue(async () => {
            if (once) return;
            once = true;
            try {
                debug(`Sending ping`);
                await coap.ping(this.baseUrl);
                done = true;
            } catch (err) {
                console.error(`Error while pinging target ${this.baseUrl}`);
                console.error(err);
            }
        });
    };

    private deque() {
        this.queueTimer = 0;
        let len = this.queue.length;

        if (len == 0) {
            this.queueTimer = undefined;
            return;
        }

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
                if (typeof next !== "undefined") {
                    next();
                }
            },
            onErr)
            .catch(onErr);
    };


    private onUpdate(url: string, r: CoapResponse) {
        let payload = r.payload.toString();
        debug(`Got update for ${url}: ${payload}`);
        this.mqtt.publish(this.topicPrefix + "/" + url, payload, {qos: 1, retain: true, dup: false}, undefined);
        if (url === "15001" || url === "15004" || url === "15005") {
            // Contents should be an array of sub id:s
            try {
                let arr: number[] = JSON.parse(payload);
                for (let i in arr) {
                    this.observe(url + "/" + arr[i]);
                }
            } catch (err) {
                console.error(`In observe ${url} response (${payload}):`);
                console.error(err);
            }
        }
        if (url.substr(0, 6) == "15005/") {
            let sp = url.split("/");
            if (sp.length == 2) {
                try {
                    let arr: number[] = JSON.parse(payload);
                    for (let i in arr) {
                        this.observe(url + "/" + arr[i]);
                    }
                } catch (err) {
                    console.error(`In observe ${url} response (${payload}):`);
                    console.error(err);
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
            }, undefined, {
                keepAlive: true,
                confirmable: true,
                retransmit: true
            });
            this.observers[url] = true;
        });
    };

}