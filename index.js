#!/usr/bin/env node

import noble from "@abandonware/noble";
import { plot, blue, green } from "asciichart";
import figlet from 'figlet';
const { textSync } = figlet;

const HRM_SERVICE_UUID = "180D";
const HRM_CHARACTERISTIC_UUID = "2A37";
const MAX_WINDOW_WIDTH = 300;
const HORIZONTAL_PADDING = 20;
const VERTICAL_PADDING = 10;
const DISPLAY_PADDING = '\u0020\u0020\u0020\u0020\u0020\u0020'; // 6 spaces
const CONSOLE_RESET = '\u001b[3J\u001b[1J';
const TITLE = textSync('HRM Live', { horizontalLayout: 'full' }) + '\u2661\n';
const Y_LABEL = 'BPM (Blue) / HRV (Green)\n';

let windowHeight = process.stdout.rows;
let windowWidth = process.stdout.columns;

const plotConfig = {
  height: windowHeight - VERTICAL_PADDING,
  colors: [blue, green]
}

process.stdout.on('resize', () => {
  // getWindowSize() returns [width, height]
  ({ [0]: windowWidth, [1]: windowHeight } = process.stdout.getWindowSize());
  plotConfig.height = windowHeight - VERTICAL_PADDING;
});

const main = async () => {
  let connected = false;
  let heartRates = [];
  let rrIntervals = [];
  let rrIntervalDiffSquares = [];
  let heartRateVariabilities = [];
  let displayHeartRates = [];
  let displayHeartRateVariabilities = [];

  noble.on("stateChange", async (state) => {
    if (state === "poweredOn") {
      console.log("Finding your heart rate monitor...");
      await noble.startScanningAsync([HRM_SERVICE_UUID], false);
    }
  });

  noble.on("discover", async (peripheral) => {
    if (peripheral.connectable && !connected) {
      await peripheral.connectAsync();
      const { characteristics } =
        await peripheral.discoverSomeServicesAndCharacteristicsAsync([HRM_SERVICE_UUID], [HRM_CHARACTERISTIC_UUID]);
      if (characteristics.length) {
        console.log(`Connected to ${peripheral.advertisement.localName}!`);
        connected = true;
        await noble.stopScanningAsync();
        const characteristic = characteristics[0];
        characteristic.subscribe();
        characteristic.on("data", (data) => {
          
          // Update heartRates array
          const heartRate = parseHeartRate(data);
          heartRates.push(heartRate);
          if (heartRates.length > MAX_WINDOW_WIDTH) {
            heartRates.shift();
          }
          
          // Update rrIntervals array
          const rrInterval = parseRrInterval(data);
          rrIntervals.push(rrInterval);
          if (rrIntervals.length > MAX_WINDOW_WIDTH) {
            rrIntervals.shift();
          }

          // Update rrIntervalDiffSquares array
          const prevRrInterval = rrIntervals[rrIntervals.length - 2];
          const rrIntervalDiffSquare = calculateRrIntervalDiffSquare(rrInterval, prevRrInterval);
          rrIntervalDiffSquares.push(rrIntervalDiffSquare);
          if (rrIntervalDiffSquares.length > MAX_WINDOW_WIDTH) {
            rrIntervalDiffSquares.shift();
          }

          // Update heartRateVariabilities array
          const heartRateVariability = calculateHeartRateVariability(rrIntervalDiffSquares);
          heartRateVariabilities.push(heartRateVariability);
          if (heartRateVariabilities.length > MAX_WINDOW_WIDTH) {
            heartRateVariabilities.shift();
          }

          // Select display values
          displayHeartRates = selectDisplayValues(heartRates);
          displayHeartRateVariabilities = selectDisplayValues(heartRateVariabilities);

          // Update display
          console.clear();
          console.log(CONSOLE_RESET + TITLE + DISPLAY_PADDING + Y_LABEL + plot([displayHeartRates, displayHeartRateVariabilities], plotConfig));
        });
      } else {
        await peripheral.disconnectAsync();
      }
    }
  });

  setTimeout(() => {
    if (!connected) {
      console.log("Heart rate monitor either not in range or not ready-to-pair.");
      process.exit(0);
    }
  }, 60000);
};

const parseHeartRate = (data) => {
  const flag = data[0].toString(2).charAt(0);
  if (flag === "0") {
    // HR is Uint8Array at index 1
    return parseInt(data[1])
  } else {
    // HR is Uint16Array at index 1 and 2
    // Todo: handle this accordingly
    return parseInt(data[1])
  }
}

const parseRrInterval = (data) => {
  const flag = data[0].toString(2).charAt(0);
  if (flag === "0") {
    return null
  } else {
    return parseInt(data[2])
  }
}

const selectDisplayValues = (values) => {
  if (values.length > windowWidth - HORIZONTAL_PADDING) {
    return values.slice(values.length - windowWidth + HORIZONTAL_PADDING);
  } else {
    return values;
  }
}

const calculateRrIntervalDiffSquare = (rrInterval, prevRrInterval = 0) => {
  return Math.pow(rrInterval - prevRrInterval, 2);
}

const calculateHeartRateVariability = (rrIntervalDiffSquares) => {
  const mean = rrIntervalDiffSquares.reduce((a, b) => a + b, 0) / rrIntervalDiffSquares.length;
  return Math.log(Math.sqrt(mean)) * 10; // 10 puts the magnitude in the range of 0-100
}

main();