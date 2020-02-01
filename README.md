# Trådfri-MQTT
This project mirrors most of the Trådfri gateways endpoints into MQTT and can be
used to send commands to the Trådfri gateway over MQTT

See [hemtjan.st/tradfri-mqtt](https://hemtjan.st/tradfri-mqtt) for more information

## Using NPM
Installing via NPM:

```bash
npm install -g tradfri-mqtt
```

To start the service:
```bash
# 192.168.0.99 = Your trådfri gateway
# abcdefgh = The pre-shared key printed under the gateway
# tcp://127.0.0.1:1883 = Address to MQTT

tradfri-mqtt -g 192.168.0.99 -p abcdefgh -a tcp://127.0.0.1:1883
```

## Using docker

```bash
docker volume create tradfri-mqtt-data
docker run -d \
  --name tradfri-mqtt \
  --volume tradfri-mqtt-data:/data \
  --env TRADFRI_GATEWAY=192.168.0.99 \
  --env TRADFRI_PSK=abcdefgh \
  --env MQTT_ADDRESS=tcp://127.0.0.1:1883 \
  hemtjanst/tradfri-mqtt
```

For armv7 (i.e. raspberry pi 3+), use hemtjanst/tradfri-mqtt:arm7

## Arguments

|Argument                       |Alias|Environment Var  |Description                                |Default      |
|-------------------------------|-----|-----------------|-------------------------------------------|-------------|
|`--gateway <ip>`               |`-g` |TRADFRI_GATEWAY  |IP Address of Trådfri Gateway              |**Required** |
|`--psk <key>`                  |`-p` |TRADFRI_PSK      |Pre-shared key of gateway                  |             |
|`--mqtt tcp://mqtt-broker:1883`|`-a` |MQTT_ADDRESS     |Address of MQTT broker                     |**Required** |
|`--mqttUsername foo`           |`-n` |MQTT_USERNAME    |Username of MQTT broker                    |             |
|`--mqttPassword bar`           |`-w` |MQTT_PASSWORD    |Password of MQTT broker                    |             |
|`--topicPrefix <topic>`        |`-x` |MQTT_TOPIC_PREFIX|Topic prefix                               |`tradfri-raw`|
|`--topicCommand <topic>`       |`-c` |MQTT_TOPIC_CMD   |Topic for commands                         |`tradfri-cmd`|
|`--username <username>`        |`-u` |TRADFRI_USERNAME |Username for authentication token          |             |
|`--token <token>`              |`-t` |TRADFRI_TOKEN    |Authentication token (not the same as PSK!)|             |
|`--storage <path>`             |`-s` |TRADFRI_STORAGE  |Path to store data in                      |             |


## Getting updates

tradfri-mqtt will try to observe everything that's being published from the gateway, and mirror the messages into
MQTT with the prefix `tradfri-raw/`.

For example, if the trådfri pushes and update for the lightbulb `65554`, the raw json message will be published
to the MQTT topic `tradfri-raw/15001/65554`.

Subscribing to `tradfri-raw/#` will give you all messages, `tradfri-raw/15001/#` all accessory
updates and `tradfri-raw/15004/#` all group updates.

## Sending commands

Commands to the trådfri gateway can be sent by publishing them to the MQTT topic `tradfri-cmd`.
The payload should be a json-encoded string matching the definition:

```typescript
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
```

If `replyTopic` is set, a reply will be sent to that topic. The definition of the reply:
```typescript
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
```

### Sample requests

#### Put request
Sent to the `tradfri-cmd` topic:
```json
{
  "method": "put",
  "url": "15004/162515",
  "id": "group-set-on",
  "replyTopic": "tradfri-reply/xyz",
  "payload": {
    "5850": 1
  }
}
```

Received from the `tradfri-reply/xyz` topic:
```json
{
  "id": "group-set-on",
  "code": "2.04",
  "format": null,
  "payload": ""
}
```

#### Get request

Sent to the `tradfri-cmd` topic:
```json
{
  "method": "get",
  "url": "15004/162515",
  "id": "group-get",
  "replyTopic": "tradfri-reply/xyz"
}
```

Received from the `tradfri-reply/xyz` topic:
```json
{
  "id": "group-get",
  "code": "2.05",
  "format": 50,
  "payload": {
    "5850": 1,
    "5851": 0,
    "9001": "Name of group",
    "9002": 1498068278,
    "9003": 162515,
    "9018": {
      "15002": {
        "9003": [65546,65547,65548]
      }
    },
    "9039": 220248
  }
}
```
