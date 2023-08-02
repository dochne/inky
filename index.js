import i2c from 'i2c-bus';
import bufferpack from 'bufferpack'
import {Gpio} from 'onoff';
import spi from 'spi-device';
import Jimp from 'jimp'
import {exit} from 'process';

const EEP_ADDRESS = 0x50;


const lut = [
    0b01001000, 0b10100000, 0b00010000, 0b00010000, 0b00010011, 0b00000000, 0b00000000,
    0b01001000, 0b10100000, 0b10000000, 0b00000000, 0b00000011, 0b00000000, 0b00000000,
    0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000,
    0b01001000, 0b10100101, 0b00000000, 0b10111011, 0b00000000, 0b00000000, 0b00000000,
    0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000, 0b00000000,
    0x10, 0x04, 0x04, 0x04, 0x04,
    0x10, 0x04, 0x04, 0x04, 0x04,
    0x04, 0x08, 0x08, 0x10, 0x10,
    0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00,
];

// console.log(lut);

async function wait(milliseconds) {
    return new Promise(res => {
        setTimeout(() => {
        res(null)
        }, milliseconds)
    })
}

(async () => {

    // getPixelColor
    const pika = await Jimp.read("image.png")
    // const scaled = await pika.scaleToFit(400, 300, HORIZONTAL_ALIGN_CENTER);
    const contain = await pika.contain(400, 300, Jimp.HORIZONTAL_ALIGN_CENTER);
    
    // await contain.write('contain.png');
    let buffer = [];

    const colors = {};

    console.log(pika);

    
    let bheight = pika.bitmap.height;
    let bwidth = pika.bitmap.width;

    // return;
    // console.log(contain);
    for (let y=0; y<bheight; y++) {
        for (let x=0; x<bwidth; x++) {
            const colour = Jimp.intToRGBA(contain.getPixelColour(x, y));
            colors[colour] = colors[colour] !== undefined ? colors[colour] + 1 : 1;
            // colors[contain.getPixelColour(x, y)] = colors[contain.getPixelColour(x, y)] 
            // console.log(colour);
            buffer += colour.r === 255 || colour.a === 0 ? '1' : '0';
            // buffer += (colour.slice(colour.length - 2) === 'ff' ? '0' : '1');

        }
    }

    


    let sortable = [];
    for (let color in colors) {
        sortable.push([color, colors[color]]);
    }

    sortable.sort(function(a, b) {
        return b[1] - a[1];
    });

    // console.log(sortable);



    // for (let y=0; y<bheight; y++) {
    //     console.log(buffer.slice(y * bwidth, (y * bwidth) + bwidth));
    // }
    // return;
        // for (let x=0; x<400; x++) {


            


    // console.log(colors);

    const asDrawing = [];
    for (let i = 0; i < buffer.length; i += 8) {
        asDrawing.push(parseInt(buffer.slice(i, i + 8), 2));
        // asDrawing.push(0);
    }

    console.log(asDrawing);
    
    // pika
//   lenna
//     .resize(256, 256) // resize
//     .quality(60) // set JPEG quality
//     .greyscale() // set greyscale
//     .write("lena-small-bw.jpg"); // save
// });


    // return;
    const opened = await i2c.openPromisified(1)

    const wbuf = Buffer.from([0x00])
    const rbuf = Buffer.alloc(29);


    await opened.writeI2cBlock(EEP_ADDRESS, 0x00, wbuf.length, wbuf)
    const read = await opened.readI2cBlock(EEP_ADDRESS, 0x00, rbuf.length, rbuf)

    const unpacked = bufferpack.unpack('<HHBBB22s', read.buffer);
    console.log(unpacked);

    const [width, height, color, pcp_variant, display_variant, eeprom_write_time] = unpacked;

    // const Gpio = require('onoff').Gpio;


    // # GPIO pins required by BCM number
    const resetPin = new Gpio(27, 'out');
    const busyPin = new Gpio(17, 'in');
    const dcPin = new Gpio(22, 'out');
    // const DC_PIN = 22


    async function busyWait(message) {
        while (await busyPin.readSync() == 1) {
            console.log("Waiting...", message || '');
            await wait(100);
        }
    }


    // SPI channel for device 0
    const CS0 = 0
    const spiBus = await spi.openSync(0, CS0, {
        speedHz: 488000
    });

    async function sendCommand(command, data = []) {
        await dcPin.writeSync(0);
        await transfer([command]);
        if (data.length > 0) {
            await sendData(data);
        }
        // console.log(array.length);
        // return await spiBus.transferSync(arrays.map((arr) => ({byteLength: arr.length, sendBuffer: Buffer.from(arr)})));
        // return await spiBus.transferSync([{byteLength: array.length, sendBuffer: Buffer.from(array)}]);
    }

    async function sendData(data = []) {
        await dcPin.writeSync(1);
        
        const chunkSize = 4096;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            await transfer(chunk);
        }
    }

    async function transfer(array)
    {
        await spiBus.transferSync([{byteLength: array.length, sendBuffer: Buffer.from(array)}]);
    }


    await resetPin.writeSync(1);
    await wait(1000);
    await resetPin.writeSync(0);
    await wait(1000);
    await resetPin.writeSync(1);
    await wait(1000);

    // structuredClone.pack
    const packedHeight = [44, 1];
    // const width = 400;

    // const message = {byteLength: 1, sendBuffer: Buffer.from([0x12])};
    await sendCommand(0x12);
    // console.log(await spiBus.transferSync([message]));
    await busyWait("Waiting post reset pin");

    await sendCommand(0x74, [0x54])  // Set Analog Block Control
    await sendCommand(0x7e, [0x3b])  // Set Digital Block Control

    await sendCommand(0x01, [...packedHeight, 0x00])  // Gate setting

    await sendCommand(0x03, [0x17])  // Gate Driving Voltage
    await sendCommand(0x04, [0x41, 0xAC, 0x32])  // Source Driving Voltage

    await sendCommand(0x3a, [0x07])  // Dummy line period
    await sendCommand(0x3b, [0x04])  // Gate line width
    await sendCommand(0x11, [0x03])  // Data entry mode setting 0x03 = X/Y increment

    await sendCommand(0x2c, [0x3c])  // VCOM Register, 0x3c = -1.5v?

    await sendCommand(0x3c, [0b00000000])

    // // It's 'cause we're a black inky! 
    // await sendCommand([0x3c, 0b00000000])
    // This is if we want a whiteBorder - this is controlled by the device apparently
    await sendCommand(0x3c, [0b00110001])  // GS Transition Define A + VSH2 + LUT1



    await sendCommand(0x32, lut)  // Set LUTs

    // (self.cols // 8) - 1]

    await sendCommand(0x44, [0x00, (width / 8) - 1])  // Set RAM X Start/End
    await sendCommand(0x45, [0x00, 0x00, ...packedHeight])  // Set RAM Y Start/End


    await sendCommand(0x4e, [0x00])  // Set RAM X Pointer Start
    await sendCommand(0x4f, [0x00, 0x00])  // Set RAM Y Pointer Start

    const val = [...Array(400 * 300 / 8)].map(_ => 85);
    await sendCommand(0x24, asDrawing);

    await busyWait("Pre update")
    await wait(1000);
    
  

    await sendCommand(0x22, [0xC7])  // Display Update Sequence
    await sendCommand(0x20)  // Trigger Display Update

    await busyWait("Post Trigger Display");

    await sendCommand(0x10, [0x01]); // Enter deep sleep
})();


