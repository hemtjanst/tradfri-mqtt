
import Observer from "./observer";
import {MqttClient, Packet} from "mqtt";
import {CoapClient as coap, RequestMethod} from "node-coap-client";

export declare type TfCommand = {
    // CoAP Method
    method: "get" | "post" | "put" | "delete" | "reset",
    // URL without any prefixes, i.e. "15001/65540"
    url: string,
    // Optional id of the request, will be included in the reply
    id?: string,
    // Replies will be sent to this MQTT topic
    replyTopic?: string,
    // Payload of the request (for POST or PUT)
    payload?: object|string,
}

export declare type TfReply = {
    // ID of the request as set in TfCommand
    id?: string,
    // Response code, for example "2.04"
    code: string,
    // Format of the response, 50 = json
    format: number,
    // Payload, if format is json the payload is decoded into an object,
    // otherwise it will be a raw string
    payload: string|object,
}

export default class Command {

    private observer: Observer;
    private mqtt: MqttClient;
    private commandTopic: string;

    constructor(observer: Observer, mqtt: MqttClient, commandTopic?: string) {
        this.observer = observer;
        this.mqtt = mqtt;
        this.commandTopic = commandTopic || "tradfri-cmd";
        mqtt.on("connect", () => {
                mqtt.subscribe(this.commandTopic);

                // Keep for compatability, reset should be sent to commandTopic with payload {"method":"reset"}
                mqtt.subscribe("tradfri-reset");
            })
            .on("message", (topic: string, payload: Buffer, packet: Packet) => {
                this.onMqttMessage(topic,payload,packet)
            });
    }

    private async onMqttMessage(topic: string, payload: Buffer, packet: Packet) {
        if (topic === "tradfri-reset") {
            return this.observer.reset();
        }
        if (topic !== this.commandTopic) {
            return;
        }
        try {
            let obj: TfCommand = JSON.parse(payload.toString());

            if (!obj.url) {
                throw new Error("No URL found");
            }
            if (!obj.method) {
                if (obj.payload) {
                    obj.method = "put";
                } else {
                    obj.method = "get";
                }
            }
            if (obj.method == "reset") {
                return this.observer.reset();
            }
            this.observer.enqueue(async () => {
                try {
                    let full = `${this.observer.url()}${obj.url}`;
                    let payload: Buffer;
                    if (obj.payload instanceof Buffer) {
                        payload = obj.payload;
                    } else {
                        if (typeof obj.payload === "string") {
                            payload = Buffer.from(obj.payload);
                        } else if (typeof obj.payload === "object") {
                            payload = Buffer.from(JSON.stringify(obj.payload));
                        }
                    }
                    const resp = await coap.request(full, obj.method, payload);
                    if (obj.replyTopic) {
                        this.mqtt.publish(obj.replyTopic, JSON.stringify({
                            id: obj.id ? obj.id : null,
                            code: resp.code.toString(),
                            format: resp.format,
                            payload: (
                                resp.format == 50 ?
                                    JSON.parse(resp.payload.toString()) :
                                    resp.payload.toString()
                            ),
                        }));
                    }
                } catch (err) {
                    console.error(`Error executing MQTT command: ${payload.toString()}`)
                    console.error(err);
                }
            });
        } catch (err) {
            console.error(`Error Parsing MQTT command: ${payload.toString()}`)
            console.error(err);
        }
    }

}