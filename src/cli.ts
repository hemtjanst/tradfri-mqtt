import {CoapClient as coap} from "node-coap-client";
import {connect} from "mqtt";
import * as dbgModule from "debug";
import * as cliArgs from "command-line-args";
import * as cliUsage from "command-line-usage";
import Observer from "./observer";
import Command from "./command";
import {TradfriAuth} from "./tradfri";
let debug = dbgModule("tradfri-mqtt");

let version = "0.0.3";

let opts = [
    {
        name: 'gateway',
        alias: 'g',
        type: String,
        description: "IP-address of Trådfri gateway",
        typeLabel: "[underline]{192.168.0.99}"
    },
    {
        name: 'psk',
        alias: 'p',
        type: String,
        description: "Pre-shared key printed under the Trådfri gateway",
        typeLabel: "[underline]{abcd...}"
    },
    {
        name: 'mqtt',
        alias: 'a',
        type: String,
        description: "MQTT address",
        typeLabel: 'tcp://[underline]{127.0.0.1}:1883'
    },
    {
        name: 'username',
        alias: 'u',
        type: String,
        description: "Trådfri authentication username",
        typeLabel: "[userline]{node-tradfri-mqtt}"
    },
    {
        name: 'token',
        alias: 't',
        type: String,
        description: "Trådfri authentication token",
        typeLabel: "[underline]{abcd...}"
    },
    {
        name: 'storage',
        alias: 's',
        type: String,
        description: "Path to store persistent data",
        typeLabel: '[underline]{/var/lib/tradfri-mqtt}'
    },
    {
        name: 'help',
        alias: 'h',
        type: Boolean,
        description: 'Show this help'
    }

];

let args = cliArgs(opts);

if (!args.gateway) {
    args.gateway = process.env["TRADFRI_GATEWAY"];
}
if (!args.psk) {
    args.psk = process.env["TRADFRI_PSK"];
}
if (!args.mqtt) {
    args.mqtt = process.env["MQTT_ADDRESS"];
}
if (!args.token) {
    args.token = process.env["TRADFRI_TOKEN"];
}
if (!args.username) {
    args.username = process.env["TRADFRI_USERNAME"];
}
if (!args.storage) {
    args.stop = process.env["TRADFRI_STORAGE"];
}

if (args.help || !args.gateway || !args.mqtt) {

    console.log(cliUsage([
        {
            header: `trådfri-mqtt ${version}`,
            content: "Relays messages between Trådfri gateway and MQTT:\n" +
                "* Subscribe to tradfri-raw/# to receive updates from Trådfri.\n" +
                "* Publish to tradfri-cmd to send commands to the gateway",
        },
        {
            header: `Usage`,
            content: `tradfri-mqtt -g [italic]{192.168.0.99} -p [italic]{abcd...} -a [italic]{tcp://127.0.0.1:1883}`,
        },
        {
            header: "Options",
            optionList: opts,
        }
    ]))
} else {

    TradfriAuth(args.gateway, {
        storage: args.storage,
        psk: args.psk,
        username: args.username,
        token: args.token
    }).then((auth) => {
        debug(`Got auth: ${auth}`);
        let mqtt = connect(args.mqtt, {
            keepalive: 30,
            clientId: `tradfri-mqtt-${args.gateway}`
        });
        let coapUrl = `coaps://${args.gateway}:5684/`;

        debug(`Starting Observer`);
        let observer = new Observer({
            mqtt: mqtt,
            coapUrl: coapUrl
        });
        let command = new Command(observer, mqtt);
    }, (err) => {
        console.log("Authentication rejected");
        console.error(err);
        process.exit(1);
    }).catch((err) => {
        console.log("Exception thrown in authentication process");
        console.error(err);
        process.exit(1);
    })
}