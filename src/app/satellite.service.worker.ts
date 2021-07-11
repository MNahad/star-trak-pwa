/// <reference lib="webworker" />

import { Service } from "../assets/wasm/star_trak";

let service: Service | undefined;

addEventListener('message', (
  { data: { gpElements, coords, period } }: MessageEvent<TrackerData>
) => {
  if (!service && gpElements) {
    import("../assets/wasm/star_trak").then(({ Service }) => {
      service = new Service(JSON.stringify(gpElements), coords[0], coords[1], coords[2]);
      setInterval(() => {
        postMessage(service?.update());
      }, period ?? 1000);
    });
  } else if (service) {
    service.update_observer(coords[0], coords[1], coords[2]);
  }
});

type TrackerData = { coords: number[] } & Partial<{ gpElements: object; period: number }>;
