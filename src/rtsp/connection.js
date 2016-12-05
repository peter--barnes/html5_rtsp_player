//import {RTSP_CONFIG, MessageBuilder} from './../config';
import {Log} from 'bp_logger';
import {WebSocketProxy} from './../util/websocket_proxy';
import {RTSPClientSM as RTSPClient} from './client';
import {EventEmitter} from 'bp_event';

export class RTSPWebsocketBackend {
    constructor(ws_url, host, port, auth) {
        this.rtp_handler= ()=>{};
        this.response_queue=[];

        this.ws_url = ws_url;
        this.setEndpoint({host, port, auth});
        this.eventSource = new EventEmitter();

        this.ready = this.connect();
        this.rtp_channels = new Set();
    }

    setEndpoint({host, port, auth}) {
        this.host = host;
        this.port = port;
        this.auth = auth;
    }

    reconnect() {
        return this.disconnect().then(()=>{
            return this.connect();
        });
    }

    connect() {
        this.rtpproxy = null;
        this.proxy = new WebSocketProxy(this.ws_url, {host: this.host, port: this.port, auth:this.auth});
        console.log("ws_url is:"+this.ws_url);
//        this.proxy = new WebSocketProxy(RTSP_CONFIG['websocket.url'], {host: this.host, port: this.port, auth:this.auth});
        this.proxy.set_message_handler((ev)=>{
            let item = this.response_queue.shift();
            item.resolve(ev.data);
        });
        this.proxy.set_disconnect_handler(()=>{
            if (this.rtpproxy) {
                this.rtpproxy.set_disconnect_handler(()=>{});
                this.rtpproxy.close();
            }
            this.eventSource.dispatchEvent('disconnected');
            setTimeout(()=>{
                this.ready = this.connect();
            }, 3000);
        });

        return this.proxy.connect("rtsp").then((id)=>{
            if (id==-1) {
                throw new Error("failed to connect");
            }
            this.rtpproxy = new WebSocketProxy(this.ws_url, {sock_id: id});
//            this.rtpproxy = new WebSocketProxy(RTSP_CONFIG['websocket.url'], {sock_id: id});
            this.rtpproxy.set_message_handler((ev)=>{
                let channel = new DataView(ev.data).getUint8(1);
                if (this.rtp_channels.has(channel)) {
                    this.rtp_handler({packet: new Uint8Array(ev.data, 4), type: channel});
                }
            });
            this.rtpproxy.set_disconnect_handler(()=>{
                if (this.proxy) {
                    this.proxy.close();
                }
            });
            return this.rtpproxy.connect('rtp').then(()=>{
                this.eventSource.dispatchEvent('connected');
            });
        });
    }

    disconnect() {
        let promises = [this.proxy.close()];
        if (this.rtpproxy) {
            promises.push(this.rtpproxy.close());
        }
        return Promise.all(promises);
    }

    socket() {
        return this.proxy;
    }


    send(_data) {
        return new Promise((resolve, reject)=>{
            this.response_queue.push({resolve, reject});
            this.proxy.write(_data, true);
        });
    }

    setRtpHandler(handler){
        this.rtp_handler = handler;
    }

    useRTPChannel(channel) {
        this.rtp_channels.add(channel);
    }

    forgetRTPChannel(channel) {
        this.rtp_channels.delete(channel);
    }
}

export class RTPError {
    constructor(message, file, line){
        //super(message, file, line);
    }
};

export class RTSPConnection {

    constructor( _ws_url ,_host, _port=554, _uri, {login='', password=''}, backend) {
        let auth = login?`${login}:${password}@`:'';
        this.url = `rtsp://${auth}${_host}:${_port}${_uri}`;
        this.requests = {};
        this.ws_url = _ws_url;
//        console.log("ws_url is:"+this.ws_url);
        this.host = _host;
        this.port = _port;
        this.login = login;
        this.password = password;
        this.backend_constructor = backend;
        this.connect();
    }

    get connected() {
        return this._backend;
    }

    connect() {
        this._backend = new this.backend_constructor(this.ws_url, this.host, this.port, {login: this.login, password: this.password});
        this.eventSource = this._backend.eventSource;
        this.cSeq = 0;
        return this._backend.ready;
    }

    disconnect() {
        this.cSeq = 0;
        this._backend.disconnect();
    }

    setEndpoint({host, port, urlpath, auth}) {
        this.url = urlpath;
        this._backend.setEndpoint({host, port, auth});
    }

    reconnect() {
        this.cSeq = 0;
        return this._backend.reconnect();
    }

    get backend() {
        return this._backend;
    }

    parse(_data) {
        Log.debug(_data);
        let d=_data.split('\r\n\r\n');
        let parsed =  MessageBuilder.parse(d[0]);
        let len = Number(parsed.headers['content-length']);
        if (len) {
            let d=_data.split('\r\n\r\n');
            parsed.body = d[1];
        } else {
            parsed.body="";
        }
        return parsed
    }

    sendRequest(_cmd, _host, _params={}, _payload=null) {
        this.cSeq++;
        Object.assign(_params, {
            CSeq: this.cSeq,
            'User-Agent': RTSPClient.USER_AGENT
        });
        if (_host != '*') {
            // TODO: add auth header
        }
        return this.send(this.cSeq, MessageBuilder.build(_cmd, _host, _params, _payload));
    }

    send(_seq, _data) {
        return this._backend.ready.then(()=> {
            return this._backend.send(_data).then(this.parse.bind(this)).then((parsed)=> {
                // TODO: parse status codes
                if (parsed.code>=300) {
                    Log.error(parsed.statusLine);
                    throw new Error(`RTSP error: ${parsed.code} ${parsed.message}`);
                }
                return parsed;
            });
        });
    }
}
