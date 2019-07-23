import { Lexer } from './lexer';

export declare type CoreLinks = {
    [url:string]: {
        [param:string]: boolean|string
    }
};

export function parseCoreLinks(data: string|Buffer): CoreLinks {
    let r: CoreLinks = {};
    if (typeof data !== 'string') {
        data = data.toString();
    }
    const lex = new Lexer(data);
    let err: Error = null;

    let url: string;
    let params: {[param:string]: boolean|string};
    let paramName: string;
    let paramValue: string;

    const ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const DIGIT = "0123456789";
    const PARAMCHAR = ALPHA + DIGIT + "!#$&+-.^_`|~";
    const TOKENCHAR = ALPHA + DIGIT + "!#$%&'()*+-./:<=>?@[]^_`{|}~";

    const lexUrl = () => {
        if (lex.acceptUntil('>') === '') {
            err = Error(`empty url at position ${lex.pos()}`);
            return;
        }
        if (lex.done()) {
            err = Error(`unexpected end at position ${lex.pos()}`);
            return;
        }
        url = lex.take();
        lex.takeNext();
        return lexParamEnd;
    };

    const lexParamEnd = () => {
        if (typeof paramName !== 'undefined') {
            params[paramName] = typeof paramValue === 'undefined' ? true : paramValue;
            paramName = undefined;
            paramValue = undefined;
        }
        if (lex.peek() === ';') {
            lex.takeNext();
            return lexParam;
        }
        if (typeof url !== 'undefined') {
            r[url] = params;
        }
        if (lex.done()) return;
        if (lex.peek() === ',') {
            lex.takeNext();
            return lexStart;
        }
        err = Error(`unexpected character at position ${lex.pos()}: ${lex.peek()}`);
    };

    const lexQuotedValue = () => {
        let value = "";
        while (true) {
            lex.acceptUntil('"\\');
            value = value + lex.take();
            if (lex.peek() === '\\') {
                // Skip escape character
                lex.takeNext();
                // Take any character (including quote)
                value = value + lex.takeNext();
            } else {
                break;
            }
        }
        if (lex.done()) {
            err = Error(`unexpected end inside quoted string`);
            return;
        }
        paramValue = value;
        lex.takeNext();
        return lexParamEnd;
    };

    const lexParamVal = () => {
        if (lex.peek() === '"') {
            lex.takeNext();
            return lexQuotedValue;
        }
        lex.acceptRun(TOKENCHAR);
        paramValue = lex.take();
        return lexParamEnd;
    };

    const lexParam = () => {
        if (lex.acceptRun(PARAMCHAR) === '') {
            err = Error(`unexpected character at position ${lex.pos()}: ${lex.peek()}`);
            return;
        }
        paramName = lex.take();

        // RFC-2231-profiled extensions ends with *
        if (lex.peek() === '*') {
            paramName += lex.takeNext();
        }

        if (lex.peek() === '=') {
            lex.takeNext();
            return lexParamVal;
        }
        return lexParamEnd;
    };

    const lexStart = () => {
        lex.acceptRunWs();
        if (lex.done()) return;
        params = {};
        url = undefined;

        if (lex.accept('<') === null) {
            err = Error(`unexpected character at position ${lex.pos()}: ${lex.peek()}`);
            return;
        }
        lex.take();
        return lexUrl;
    };

    lex.run(lexStart);
    if (err !== null) {
        throw err;
    }

    return r;
}
