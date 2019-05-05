export type LexerFunc = (end?: boolean) => void|LexerFunc;

export class Lexer {

    private _start: number = 0;
    private _pos: number = 0;

    constructor(private _msg: string) {
    }

    pos(): number {
        return this._pos;
    }

    done(offset?: number): boolean {
        return ((offset||0) + this._pos) >= this._msg.length;
    }

    peek(n?: number): string|null {
        if (this.done()) return null;
        return this._msg.substr(this._pos,n||1);
    }

    backup(n?: number): null {
        this._pos -= n||1;
        if (this._pos < this._start) this._pos = this._start;
        return null;
    }

    next(): string|null {
        if (this.done()) return null;
        return this._msg.substr(this._pos++, 1);
    }

    expect(str: string): boolean {
        if (this._msg.substr(this._pos, str.length) !== str) {
            return false;
        }
        this._pos += str.length;
        return true;
    }

    expect_i(str: string): boolean {
        if (this._msg.substr(this._pos, str.length).toLowerCase() !== str.toLowerCase()) {
            return false;
        }
        this._pos += str.length;
        return true;
    }

    accept(ch: string): string|null {
        let n = this.next();
        if (n === null) return null;
        if (ch.indexOf(n) >= 0) return n;
        return this.backup();
    }

    acceptRun(ch: string): string {
        let buf = '';
        let k;
        while (null !== (k = this.accept(ch))) {
            buf = buf + k;
        }
        return buf;
    }

    acceptRunWs() {
        return this.acceptRun("\r\n\t ");
    }

    acceptCRLF(): boolean {
        let ch = this.next();
        if (ch === "\r") {
            if (this.peek() === "\n") {
                this.next();
                return true;
            }
            this.backup();
            return false;
        } else if (ch === "\n") {
            return true;
        }
        this.backup();
        return false;
    }

    acceptUntil(ch: string): string {
        let buf = '';
        let k;
        while (null !== (k = this.next())) {
            if (ch.indexOf(k) >= 0) {
                this.backup();
                break;
            }
            buf = buf + k;
        }
        return buf;
    }

    acceptUntilWs() {
        return this.acceptUntil("\r\n\t ");
    }

    value(): string {
        if (this._pos <= this._start) return "";
        return this._msg.substr(this._start, this._pos - this._start);
    }

    take(): string {
        let val = this.value();
        this._start = this._pos;
        return val;
    }

    takeNext(): string {
        this.next();
        return this.take();
    }

    run(fn: LexerFunc|void) {
        let rounds = 1e9;
        while (this._pos < this._msg.length && fn && rounds-- > 0) {
            fn = fn();
        }
        if (fn) {
            let last: LexerFunc|void = fn;
            do {
                last = last();
            } while (last && last != fn && rounds-- > 0);
        }
        if (rounds <= 0) {
            console.error('broke out of loop after 10^9 rounds');
        }
    }

}
