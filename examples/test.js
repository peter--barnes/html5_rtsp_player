import {LogLevel} from 'bp_logger';
import * as rtsp from 'rtsp/rtsp_player';

rtsp.RTSP_CONFIG['websocket.url'] = "ws://127.0.0.1:9010/ws";

document.addEventListener("DOMContentLoaded", function() {
    setTimeout(()=> {
        let player = rtsp.attach(document.getElementById('test_video'));
        if (!player.started()) {
            player.start();
        }
    }, 200);
});
