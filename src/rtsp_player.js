export {RTSP_CONFIG} from './config';
import {RTSPClientSM} from './rtsp/client';
import {RTSPWebsocketBackend} from './rtsp/connection';
import {RTSPConnection} from './rtsp/connection';
import {Url} from './util/url';

export class RTSPPlayer {
    constructor(player, url, ws_url) {
        this.player = player;
        this.url = url;
        this.ws_url = ws_url;
        this.isReplaced = url!==undefined;
        if (this.isReplaced) {
            let parsed = Url.parse(url);
            //this.ws_backend = new RTSPWebsocketBackend(this.ws_url);
            this.connection = new RTSPConnection(this.ws_url ,parsed.host, parsed.port, parsed.urlpath, {login: parsed.user, password: parsed.pass}, RTSPWebsocketBackend);
//            this.connection = new RTSPConnection(parsed.host, parsed.port, parsed.urlpath, {login: parsed.user, password: parsed.pass}, this.ws_backend);
            this.client = new RTSPClientSM(this.connection, this.player);
        }

    }

    setStream(url) {
        if (this.isReplaced) {
            this.url = url;
            let parsed = Url.parse(url);
            this.connection.setEndpoint(parsed);
            this.connection.reconnect().then(()=>{
                this.client.stop();
                this.client.reconnect();
            });
        } else {
            this.player.src = url;
        }
    }

    start() {
        if (this.isReplaced) {
            this.client.transitionTo(RTSPClientSM.STATE_OPTIONS);
        } else {
            this.player.play();
        }
    }

    stop() {
        if (this.isReplaced) {
            if (this.client.currentState.name!=RTSPClientSM.STATE_INITIAL) {
                this.client.transitionTo(RTSPClientSM.STATE_TEARDOWN);
            }
        } else {
            this.player.pause();
        }
    }

    started() {
        if (this.isReplaced) {
            return this.client.state != RTSPClientSM.STATE_INITIAL;
        } else {
            return !this.player.paused;
        }
    }
}
export function attach(player, ws_url) {
    // if (player.networkState == HTMLMediaElement.NETWORK_NO_SOURCE) {
        let rtsp_player = new RTSPPlayer(player, player.getAttribute('src'), ws_url);
        if (player.getAttribute('autoplay') !== null) {
            rtsp_player.start();
        }
        return rtsp_player;
    // }
    // return new RTSPPlayer(player);
}
