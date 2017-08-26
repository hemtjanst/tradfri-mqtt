# Trådfri-MQTT


## Install

```bash
npm install -g tradfri-mqtt
```

## Usage

To start the service:
```bash
# 192.168.0.99 = Your trådfri gateway
# abcdefgh = The pre-shared key printed under the gateway
# tcp://127.0.0.1:1883 = Address to MQTT

tradfri-mqtt -g 192.168.0.99 -p abcdefgh -a tcp://127.0.0.1:1883
```

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
    method: "get" | "post" | "put" | "delete",
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

### Sample request
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

```json
{
  "method": "get",
  "url": "15004/162515",
  "id": "group-get",
  "replyTopic": "tradfri-reply/xyz"
}
```

### Sample response
Received from the `tradfri-reply/xyz` topic:
```json
{
  "id": "group-set-on",
  "code": "2.04",
  "format": null,
  "payload": ""
}
```

```json
{
  "id": "group-get",
  "code": "2.05",
  "format": 50,
  "payload": {
    "5850": 1,
    "5851": 0,
    "9001": "Office",
    "9002": 1498068278,
    "9003": 162515,
    "9018": {
      "15002": {
        "9003": [65546]
      }
    },
    "9039": 220248
  }
}
```