#!/usr/bin/env node

import noble from "@abandonware/noble";

const BAR = "\u2588"
const HEART = "\u2665"
const FG_RED = "\x1b[31m";
const FG_RESET = "\x1b[0m";

const HRM_SERVICE_UUID = "180D";
const HRM_CHARACTERISTIC_UUID = "2A37";

const main = async () => {
  let connected = false;

  noble.on("stateChange", async (state) => {
    if (state === "poweredOn") {
      console.log("Finding to your heart rate monitor...");
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
          const flag = data[0].toString(2).charAt(0);
          if (flag === "0") {
            // HR is Uint8Array at index 1
            const heartRate = data[1]
            console.log(BAR.repeat(heartRate), FG_RED, heartRate, "bpm", HEART, FG_RESET);
          } else {
            // HR is Uint16Array at index 1 and 2
            // Todo: handle this accordingly
            const heartRate = data[1].toString()
            console.log(BAR.repeat(heartRate), FG_RED, heartRate, "bpm", HEART, FG_RESET);
          }
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

main();