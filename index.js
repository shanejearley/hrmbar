#!/usr/bin/env node

import noble from "@abandonware/noble";
import { plot } from "asciichart";

const HRM_SERVICE_UUID = "180D";
const HRM_CHARACTERISTIC_UUID = "2A37";

const main = async () => {
  let connected = false;
  let heartRates = [];
  let displayHeartRates = [];
  let windowHeight = process.stdout.rows;
  let windowWidth = process.stdout.columns;
  const maxWindowWidth = 300;

  const plotConfig = {
    height: windowHeight - 5,
  }

  process.stdout.on('resize', () => {
    // getWindowSize() returns [width, height]
    ({ [0]: windowWidth, [1]: windowHeight } = process.stdout.getWindowSize());
    plotConfig.height = windowHeight - 5;
  });

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

          const heartRate = parseHeartRate(data);

          // Fill an empty heartrates array
          if (!heartRates.length) {
            heartRates = new Array(maxWindowWidth).fill(heartRate);
          }

          // Cycle heartrates array
          heartRates.push(heartRate);
          heartRates.shift();
          displayHeartRates = heartRates.slice(heartRates.length - windowWidth + 25);

          // Update display
          console.clear();
          console.log('\u001b[3J\u001b[1J' + plot(displayHeartRates, plotConfig));
        });
      } else {
        await peripheral.disconnectAsync();
      }
    }
  });

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

  setTimeout(() => {
    if (!connected) {
      console.log("Heart rate monitor either not in range or not ready-to-pair.");
      process.exit(0);
    }
  }, 60000);
};

main();