import {CoapClient as coap, CompatOptions} from "node-coap-client";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as dbgModule from "debug";
let debug = dbgModule("tradfri-auth");

export declare type AuthOpts = {
    storage?: string,
    psk?: string,
    username?: string,
    token?: string
};

declare type AuthStorage = {
    [gateway:string]: {
        username: string
        token: string
    }
};

let rnd = Math.floor(Math.random()*1000000);

export function TradfriAuth(gateway: string, opts?: AuthOpts): Promise<{username: string, token: string}> {

    let coapUrl = `coaps://${gateway}:5684/`;
    let dirty = false;
    let cfg: AuthStorage = {};
    cfg[gateway] = {
        username: opts.username || (`${os.hostname()}-${rnd}`),
        token: opts.token
    };

    let psk = opts.psk;
    let authFile = opts.storage ? path.join(opts.storage, "auth.json") : undefined;

    let securityParams = (): {psk:{[user:string]:string}} => {
        if (cfg[gateway].username && cfg[gateway].token) {
            let t = {psk:{}};
            t.psk[cfg[gateway].username] = cfg[gateway].token;
            return t;
        }
        if (!psk) {
            throw new Error(`Either token or psk must be specified/stored`);
        }

        return {psk:{"Client_identity":psk}};
    };

    let compatOptions: CompatOptions = {
        resetAntiReplayWindowBeforeServerHello: true
    };

    let readConfig = () => {
        return new Promise<void>((resolve, reject) => {
            if (!authFile) {
                return resolve();
            }
            debug(`Reading configuration ${authFile}`);
            fs.exists(authFile, (v) => {
                if (!v) {
                    debug(`${authFile} doesn't exist`);
                    return resolve();
                }
                fs.readFile(authFile, (err, c) => {
                    debug(`Contents: ${c.toString()}`);
                    if (err) reject(err);
                    try {
                        let cc = JSON.parse(c.toString());
                        let myCfg = cfg[gateway];
                        cfg = cc;
                        if (typeof cfg[gateway] === "undefined") {
                            cfg[gateway] = myCfg;
                        }
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                })
            })
        })
    };

    let writeConfig = () => {
        return new Promise<void>((resolve, reject) => {
            if (!authFile) {
                return reject(`No storage path provided`);
            }
            fs.writeFile(authFile, JSON.stringify(cfg), (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    };

    let auth = async () => {
        coap.setSecurityParams(gateway, securityParams());
        coap.setCompatOptions(gateway, compatOptions);
        await coap.tryToConnect(coapUrl);
        let payload = new Buffer(
            JSON.stringify(
                { 9090: cfg[gateway].username }
            )
        );
        let resp = await coap.request(`${coapUrl}15011/9063`, "post", payload);

        if (resp.code.major != 2) {
            throw new Error(`Unable to authenticate to ${coapUrl}: ${resp.code.toString()} ${resp.payload.toString()}`);
        }
        let auth = JSON.parse(resp.payload.toString());
        if (auth && typeof auth["9091"] !== "undefined") {
            cfg[gateway].token = auth["9091"];
            dirty = true;
        } else {
            throw new Error(`Unable to authenticate to ${coapUrl}, response: ${resp.payload.toString()}`);
        }
    };

    let connect = async () => {
        coap.reset(gateway);
        coap.setSecurityParams(gateway, securityParams());
        coap.setCompatOptions(gateway, compatOptions);
        await coap.tryToConnect(coapUrl);
    };

    return new Promise((resolve, reject) => {
        readConfig()
            .then(() => {
                let res = () => {
                    resolve(cfg[gateway]);
                };
                let con = () => {
                    connect().then(() => {
                        if (dirty && authFile) {
                            writeConfig().then(() => {
                                res();
                            }, reject).then(reject);
                        } else {
                            res();
                        }
                    }, reject).catch(reject);
                };
                if (!cfg[gateway].token) {
                    auth().then(() => {
                        con();
                    }, reject).catch(reject);
                } else {
                    con();
                }
            }, reject).catch(reject);
    });
}
