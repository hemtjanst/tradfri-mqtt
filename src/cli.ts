import {connect} from "mqtt";
import * as dbgModule from "debug";
import * as cliArgs from "command-line-args";
import * as cliUsage from "command-line-usage";
import Observer from "./observer";
import Command from "./command";
import {TradfriAuth} from "./tradfri";
let debug = dbgModule("tradfri-mqtt");

let version = "0.1.1";

let opts = [
    {
        name: 'gateway',
        alias: 'g',
        type: String,
        description: "IP-address of Trådfri gateway",
        typeLabel: "{underline 192.168.0.99}"
    },
    {
        name: 'psk',
        alias: 'p',
        type: String,
        description: "Pre-shared key printed under the Trådfri gateway",
        typeLabel: "{underline abcd...}"
    },
    {
        name: 'mqtt',
        alias: 'a',
        type: String,
        description: "MQTT address",
        typeLabel: 'tcp://{underline 127.0.0.1}:1883'
    },
    {
        name: 'mqttUsername',
        alias: 'n',
        type: String,
        description: "MQTT username",
        typeLabel: 'foo'
    },
    {
        name: 'mqttPassword',
        alias: 'w',
        type: String,
        description: "MQTT password",
        typeLabel: 'bar'
    },
    {
        name: 'topicPrefix',
        alias: 'x',
        type: String,
        description: "MQTT Topic Prefix",
        typeLabel: '{underline tradfri-raw}'
    },
    {
        name: 'topicCommand',
        alias: 'c',
        type: String,
        description: "MQTT Topic for Commands",
        typeLabel: '{underline tradfri-cmd}'
    },
    {
        name: 'username',
        alias: 'u',
        type: String,
        description: "Trådfri authentication username",
        typeLabel: "{underline node-tradfri-mqtt}"
    },
    {
        name: 'token',
        alias: 't',
        type: String,
        description: "Trådfri authentication token",
        typeLabel: "{underline abcd...}"
    },
    {
        name: 'storage',
        alias: 's',
        type: String,
        description: "Path to store persistent data",
        typeLabel: '{underline /var/lib/tradfri-mqtt}'
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
if (!args.mqttUsername) {
    args.mqttUsername = process.env["MQTT_USERNAME"];
}
if (!args.mqttPassword) {
    args.mqttPassword = process.env["MQTT_PASSWORD"];
}
if (!args.topicPrefix) {
    args.topicPrefix = process.env["MQTT_TOPIC_PREFIX"] || "tradfri-raw";
}
if (!args.topicCommand) {
    args.topicCommand = process.env["MQTT_TOPIC_CMD"] || "tradfri-cmd";
}
if (!args.token) {
    args.token = process.env["TRADFRI_TOKEN"];
}
if (!args.username) {
    args.username = process.env["TRADFRI_USERNAME"];
}
if (!args.storage) {
    args.storage = process.env["TRADFRI_STORAGE"];
}

if (args.help || !args.gateway || !args.mqtt) {

    console.log(cliUsage([
        {
            header: `trådfri-mqtt ${version}`,
            content: "Relays messages between Trådfri gateway and MQTT:\n" +
                "* Subscribe to tradfri-raw/# to receive updates from Trådfri.\n" +
                "* Publish to tradfri-cmd to send commands to the gateway\n\n" +
                "See {blue.underline https://hemtjan.st/tradfri-mqtt} for more info and documentation",
        },
        {
            header: `Usage`,
            content: `tradfri-mqtt -g {italic 192.168.0.99} -p {italic abcd...} -a {italic tcp://127.0.0.1:1883}`,
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
        debug(`Got auth: ${auth.username} / ${auth.token}`);

        let opts = {
            keepalive: 30,
            clientId: `tradfri-mqtt-${args.gateway}`
        }
        if (args.mqttPassword) {
            opts['password'] = args.mqttPassword
        }
        if (args.mqttUsername) {
            opts['username'] = args.mqttUsername
        }

        let mqtt = connect(args.mqtt, opts);
        let coapUrl = `coaps://${args.gateway}:5684/`;

        debug(`Starting Observer`);
        let observer = new Observer({
            mqtt: mqtt,
            coapUrl: coapUrl,
            topicPrefix: args.topicPrefix
        });
        let command = new Command(observer, mqtt, args.topicCommand);
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
