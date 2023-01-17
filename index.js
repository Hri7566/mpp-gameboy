require('dotenv').config();

const serverboy = require('serverboy');
const MPPClient = require('mppclone-client');
// const MPPClient = require('mpp-client-xt');
const cmapi = require('mppclone-cmapi');
const Color = require('./Color');
const { readFileSync } = require('fs');

const MPPCLONE_TOKEN = process.env.MPPCLONE_TOKEN;

const cl = new MPPClient('wss://mppclone.com:8443', MPPCLONE_TOKEN);
// const cl = new MPPClient('wss://mpp.hri7566.info:8443');
const cm = new cmapi(cl);
const desiredChannel = `✧𝓓𝓔𝓥 𝓡𝓸𝓸𝓶✧`;

const FRAME_SKIP = 50;

cl.setChannel(desiredChannel);
cl.start();

let gb = new serverboy();
// gb.doFrame();

let filename = './roms/tetris.gb';

let argcheck = 1;

if (process.argv0 == 'node') {
    argcheck = 2;
}

if (process.argv[argcheck]) {
    filename = process.argv[argcheck];
}

// let rom = readFileSync('./roms/blue.gb');
let rom = readFileSync(filename);
// let rom = readFileSync('./roms/demo.gbc');
// let rom = readFileSync('./roms/zelda.gb');
gb.loadRom(rom);

const GB_WIDTH = 160;
const GB_HEIGHT = 144;
// const GB_WIDTH = 5;
// const GB_HEIGHT = 5;

let msgbuf = [{n: 'ldraw', v: 0}];

let bigbuf = [];
let prevbuf = [];

function stringToBytesFaster(str) {
    var ch, st, re = [], j=0;
    for (var i = 0; i < str.length; i++ ) {
        ch = str.charCodeAt(i);
        if(ch < 127){
        re[j++] = ch & 0xFF;
        } else {
        st = [];
        do {
            st.push(ch & 0xFF);
            ch = ch >> 8;
        } while (ch);
        st = st.reverse();
        for(var k=0;k<st.length; ++k)
            re[j++] = st[k];
        }
    }
    return re;
}

function clearBuffer() {
    prevbuf = [];
    prevbuf.push(...bigbuf);
    bigbuf = [];
}

// let finished = true;

// setInterval(() => {
//     gb.doFrame();
// }, 1000 / 60);

// let offsetX = 30;
// let offsetY = 30;
// let offsetX = 20;
// let offsetY = 20;
let offsetX = 75;
let offsetY = 10;

let t = Date.now();
let ot = Date.now();
let dt = 0;

function debounceDelta() {
    t = Date.now();
    dt = t - ot;
    if (dt < 22000) return false;
    console.log('resetting delta');
    ot = t;
    return true;
}

function drawScreen() {
    // if (finished == false) return;
    // finished = true;
    
    let screen = gb.getScreen();
    console.log('next frame');

    let pos = 0;
    let lastX = 0;
    let lastY = 0;
    let lastCol = '';
    let pushes = 0;

    for (let i = 0; i < screen.length; i += 4) {
        let x = (pos % GB_WIDTH);
        let y = Math.floor(pos / GB_WIDTH) * 1.5;

        // if (y % 2 == 1) continue;
        // else y = y / 2;

        let r = screen[i];
        let g = screen[i + 1];
        let b = screen[i + 2];
        let a = screen[i + 3];
        let col = new Color(r, g, b).toHexa();

        let prev = prevbuf[pushes];
        if (prev) {
            debounceDelta();
            if (dt < 10000) {
                let c = new Color("#" + prev.d.toString(16));
                let prevData = stringToBytesFaster(prev.n);
                if (c.r == r && c.g == g && c.b == b) {
                    lastX = x;
                    lastY = y;
                    lastCol = col;
                    pos += 1;
                    continue;
                }
            }
        }

        let lastmsg = bigbuf[bigbuf.length - 1];
        if (col == lastCol && y == lastY && lastmsg) {
            // optimize
            let data = stringToBytesFaster(lastmsg.n);
            let col2 = "#" + lastmsg.d.toString(16)
            data[2] += 1;
            bigbuf.splice(bigbuf.length - 1, 1);
            draw(data[0], data[1], data[2], data[3], 20, col2);
        } else {
            // draw((x + offsetX), (y * 2) + offsetY, ((x + 1) + offsetX), (y * 2) + offsetY, 5, col);
            draw((x + offsetX), (y) + offsetY, ((x + 1) + offsetX), (y) + offsetY, 20, col);
        }
        pushes++

        lastX = x;
        lastY = y;
        lastCol = col;
        pos++;
    }
}

cl.on('hi', msg => {
    console.log('Connected');
    cm.subscribe();

    drawScreen();
});

let currentFrameIndex = 0;

setInterval(() => {
    let t = Date.now();
    if (msgbuf !== 1) {
        if (msgbuf.length > 1) {
            cm.sendArray([{
                m: 'draw',
                t,
                n: msgbuf
            }], { mode: 'subscribed' });

            cl.sendArray([{
                m: 'n',
                t,
                n: msgbuf
            }]);
            // console.log(msgbuf);
        }
        msgbuf = [{n: 'ldraw', v: 0}, ...bigbuf.slice(currentFrameIndex, currentFrameIndex + 35)];
        let indexChanger = Math.min(30, bigbuf.length - currentFrameIndex);
        currentFrameIndex += indexChanger;
        if (indexChanger == bigbuf.length - currentFrameIndex) {
            currentFrameIndex = 0
            console.log('finished frame');
            for (let i = 0; i < FRAME_SKIP; i++) {
                gb.doFrame();
            }
            clearBuffer();
            drawScreen();
        }
        // console.log(msgbuf);
        // if (bigbuf.length == 0) {
            // finished = false;
            
        // }
    }
// }, 6000 / 15);
}, 1000 / 20);
// }, 1000 / 30);

function draw(x, y, x2, y2, s, color) {
    let a = new ArrayBuffer(4);
    let dv = new DataView(a);
    
    dv.setUint8(0, x);
    dv.setUint8(1, y);
    dv.setUint8(2, x2);
    dv.setUint8(3, y2);

    color = color || '#000000';
    // msgbuf.push({n: String.fromCharCode.apply(null, new Uint8Array(a)), v: s || 5, d: parseInt(color.slice(1), 16)});
    bigbuf.push({n: String.fromCharCode.apply(null, new Uint8Array(a)), v: s || 5, d: parseInt(color.slice(1), 16)});
}

function sendChat(str) {
    // cl.sendArray([{m: 'a', message: `\u034f${str}`}]);
}

cl.on('a', msg => {
    let args = msg.a.split(' ');
    let argcat = msg.a.substring(args[0].length).trim();

    if (msg.a.startsWith('!press')) {
        console.log('pressing ' + argcat);
        sendChat("Pressing " + argcat);
        gb.pressKey(argcat);
        for (let i = 0; i < FRAME_SKIP; i++) {
            gb.doFrame();
        }
        clearBuffer();
    }
    
    if (msg.a.startsWith('!skip')) {
        if (args[1]) {
            try {
                let num = parseInt(args[1]);
                console.log('skipping ' + num +  ' frames');
                sendChat("Skipping " + num + " frames...");
                for (let i = 0; i < num; i++) {
                    gb.doFrame();
                }
            } catch (err) {
                console.error(err);
            }
        } else {
            console.log('skipping frame');
            sendChat("Skipping frame...");
        }
        clearBuffer();
    }
});

cm.on('gb_press', msg => {
    if (!msg.button) return;
    console.log('pressing ' + msg.button);
    sendChat("Pressing " + msg.button);
    gb.pressKey(msg.button);
    for (let i = 0; i < FRAME_SKIP; i++) {
        gb.doFrame();
    }
    clearBuffer();
});

cm.on('gb_kill', () => {
    process.exit();
});
