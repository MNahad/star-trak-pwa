/// <reference lib="webworker" />

import { Service } from "../assets/wasm/star_trak";

import("../assets/wasm/star_trak").then(({ Service }) => {
  let service: Service | undefined;
  addEventListener('message', (
    { data: { gpElements, coords, duration } }: MessageEvent<MessageData>
  ) => {
    if (!service) {
      service = new Service(JSON.stringify(gpElements), coords[0], coords[1], coords[2]);
      setInterval(() => {
        postMessage(service?.update());
      }, duration);
    }
  });
});

type MessageData = {
  gpElements: object;
  coords: number[];
  duration: number;
};
