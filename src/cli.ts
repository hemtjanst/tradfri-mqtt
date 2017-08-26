import {CoapClient as coap} from "node-coap-client";
import {connect} from "mqtt";
import * as dbgModule from "debug";
import * as cliArgs from "command-line-args";
import * as cliUsage from "command-line-usage";
import Observer from "./observer";
import Command from "./command";
let debug = dbgModule("tradfri-mqtt");

let version = "0.0.1";

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
        name: 'help',
        alias: 'h',
        type: Boolean,
        description: 'Show this help'
    }

];

let args = cliArgs(opts);

if (args.help || !args.gateway || !args.psk || !args.mqtt) {

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
    let mqtt = connect(args.mqtt, {keepalive: 30});
    let coapUrl = `coaps://${args.gateway}:5684/`;
    coap.setSecurityParams(args.gateway, {psk: {"Client_identity": args.psk}});

    let observer = new Observer({
        mqtt: mqtt,
        coapUrl: coapUrl
    });
    let command = new Command(observer, mqtt);
}