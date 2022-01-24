import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Object3D,
  Quaternion,
  Euler,
  Shape,
  ShapeGeometry,
  MeshBasicMaterial,
  DoubleSide,
  Mesh,
  Vector3,
  Matrix4,
  Frustum,
} from 'three';
import {
  SatelliteHorizontal,
  SatelliteService,
  SatelliteTopocentric,
} from '../satellite.service.js';
import { SensorService } from '../sensor.service.js';
import { PageStateService } from '../page-state.service.js';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-observer',
  templateUrl: './observer.component.html',
  styleUrls: ['./observer.component.css'],
})
export class ObserverComponent implements OnInit, OnDestroy {
  @ViewChild('observerContainer', { static: true })
  observerContainer: ElementRef<HTMLDivElement> | undefined;
  @ViewChild('videoElement', { static: true })
  videoElement: ElementRef<HTMLVideoElement> | undefined;
  @ViewChild('observerCanvas', { static: true })
  observerCanvas: ElementRef<HTMLCanvasElement> | undefined;
  observerEnabled = false;
  @ViewChild('hudCanvas', { static: true })
  hudCanvas: ElementRef<HTMLCanvasElement> | undefined;
  hudCtx: CanvasRenderingContext2D | null | undefined;

  private camSensorAvail = false;

  private subscribers: Record<string, Subscription>;

  private FOV = 45;

  private scene = new Scene();
  private camera = new PerspectiveCamera(
    this.FOV,
    window.innerWidth / window.innerHeight,
    0.000001,
    5000
  );
  private cameraMatrix = new Matrix4();
  private cameraFrustum = new Frustum();
  private renderer: WebGLRenderer | undefined;
  private orientationStates = {
    nineAxis: ObserverComponent.generateOrientationState(),
    sixAxis: ObserverComponent.generateOrientationState(),
  };
  private primaryOrientationSensor: keyof OrientationSensors = 'nineAxis';

  private sky = new Object3D();

  private satelliteShape = ObserverComponent.generateShape();
  private satelliteGeometry = new ShapeGeometry(this.satelliteShape);
  private satelliteMaterial = new MeshBasicMaterial({
    color: 0x00ff00,
    side: DoubleSide,
  });
  private satellites: Mesh[] = [];
  private directionVector = new Vector3();

  constructor(
    satelliteService: SatelliteService,
    sensorService: SensorService,
    pageStateService: PageStateService
  ) {
    sensorService.requestSensorActivation('nineAxis');
    sensorService.requestSensorActivation('sixAxis');
    sensorService.requestSensorActivation('geo');
    this.subscribers = {
      capabilitySubscriber: sensorService
        .getCapability$()
        .subscribe((capability) => {
          if (!this.camSensorAvail) {
            this.observerEnabled = false;
            return;
          }
          switch (capability) {
            case 'FULL':
              this.observerEnabled = true;
              break;
            case 'NO_HEADING':
              break;
            case 'NO_POSITION':
              break;
            case 'NO_ORIENTATION':
            case 'OFF':
            default:
              this.observerEnabled = false;
              break;
          }
        }),
      satelliteSubscriber: satelliteService.tracker$.subscribe(
        ({
          data: [, satellitesPositionData, satellitesVelocityData, names],
        }) => {
          this.updateSatellites(
            satellitesPositionData,
            satellitesVelocityData,
            names
          );
        }
      ),
      geoSubscriber: sensorService
        .getSensor$('geo')
        .pipe(filter(SensorService.isReading))
        .subscribe(({ reading: [lat_deg, lon_deg, alt_km] }) => {
          satelliteService.updateObserver({ lat_deg, lon_deg, alt_km });
        }),
      nineAxisSubscriber: sensorService
        .getSensor$('nineAxis')
        .pipe(filter(SensorService.isReading))
        .subscribe(({ reading }) => {
          this.updateOrientationState('nineAxis', reading);
        }),
      nineAxisStateSub: sensorService
        .getSensor$('nineAxis')
        .pipe(filter(SensorService.isState))
        .subscribe(({ state }) => {
          if (!state) {
            if (this.observerEnabled) {
              this.primaryOrientationSensor = 'sixAxis';
            }
          } else {
            this.primaryOrientationSensor = 'nineAxis';
          }
        }),
      sixAxisSubscriber: sensorService
        .getSensor$('sixAxis')
        .pipe(filter(SensorService.isReading))
        .subscribe(({ reading }) => {
          this.updateOrientationState(
            'sixAxis',
            [reading[0], reading[1], reading[2], reading[3]],
            reading[4]
          );
        }),
      pageStateSubscriber: pageStateService.go$.subscribe((ready) => {
        if (this.observerContainer) {
          this.observerContainer.nativeElement.style.display = ready
            ? 'grid'
            : 'none';
        }
      }),
    };
    satelliteService.updatePeriod(100);
    pageStateService.signalReady({ from: 'page', state: true });
  }

  ngOnInit(): void {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          frameRate: { ideal: 50 },
          facingMode: 'environment',
          height: { ideal: window.innerHeight },
        },
      })
      .then((stream) => {
        this.camSensorAvail = true;
        if (this.videoElement) {
          this.videoElement.nativeElement.addEventListener('resize', () => {
            this.renderer?.setSize(
              this.videoElement!.nativeElement.videoWidth,
              this.videoElement!.nativeElement.videoHeight
            );
            this.hudCanvas!.nativeElement.width = this.videoElement!.nativeElement.videoWidth;
            this.hudCanvas!.nativeElement.height = this.videoElement!.nativeElement.videoHeight;
            this.camera.aspect =
              this.videoElement!.nativeElement.videoWidth /
              this.videoElement!.nativeElement.videoHeight;
            this.camera.updateProjectionMatrix();
          });
          this.videoElement.nativeElement.srcObject = stream;
        }
      })
      .catch(() => {
        this.camSensorAvail = false;
        this.observerEnabled = false;
      });

    this.renderer = new WebGLRenderer({
      canvas: this.observerCanvas?.nativeElement,
      alpha: true,
    });
    this.hudCtx = this.hudCanvas?.nativeElement.getContext('2d');

    this.scene.add(this.sky);

    this.camera.position.set(0, 0, 0.000001);
    this.camera.up.set(0, 1, 0);

    this.updateObserverView();
  }

  ngOnDestroy(): void {
    Object.values(this.subscribers).forEach((subscriber) => {
      subscriber.unsubscribe();
    });
    this.renderer?.renderLists.dispose();
    this.renderer?.dispose();
  }

  private static generateShape(): Shape {
    const shape = new Shape();
    shape.lineTo(10, -5);
    shape.lineTo(0, 15);
    shape.lineTo(-10, -5);
    return shape;
  }

  private static generateOrientationState(): OrientationState {
    return {
      quaternion: new Quaternion(0, 0, 0, 0),
      euler: new Euler(0, 0, 0),
    };
  }

  private updateOrientationState(
    sensor: keyof OrientationSensors,
    reading: number[],
    offset?: number
  ): void {
    const quaternion = this.orientationStates[sensor].quaternion;
    const euler = this.orientationStates[sensor].euler;
    quaternion.fromArray(reading);
    euler.setFromQuaternion(quaternion);
    euler.set(euler.x - Math.PI / 2, euler.y - (offset ?? 0), euler.z);
    quaternion.setFromEuler(euler);
  }

  private updateSatellites(
    positionData: SatelliteHorizontal[],
    velocityData: SatelliteTopocentric[],
    names: string[]
  ): void {
    const satellites = positionData
      .map((position, idx) => ({
        position,
        velocity: velocityData[idx],
        name: names[idx],
      }))
      .filter(({ position: { elevation_deg } }) => elevation_deg > 0);
    this.syncSatelliteMeshes(satellites.length);
    satellites.forEach((target, idx) => {
      const sat = this.satellites[idx];
      const sphericalCoords = [
        -target.position.range_km,
        Math.PI / 2 + (target.position.elevation_deg * Math.PI) / 180,
        (-target.position.azimuth_deg * Math.PI) / 180,
      ] as const;
      sat.position.setFromSphericalCoords(...sphericalCoords);
      sat.lookAt(
        sat.position.x + target.velocity.east_km_s,
        sat.position.y + target.velocity.up_km_s,
        sat.position.z - target.velocity.north_km_s
      );
      sat.rotateX(Math.PI / 2);
      sat.rotateY(Math.PI / 2);
      sat.updateMatrix();
      if (!sat.userData.satellite) {
        sat.userData.satellite = {};
      }
      sat.userData.satellite.name = target.name;
      sat.userData.satellite.range = target.position.range_km;
    });
  }

  private syncSatelliteMeshes(newSatellitesLength: number): void {
    if (this.satellites.length > newSatellitesLength) {
      for (let i = this.satellites.length; i > newSatellitesLength; i--) {
        const sat = this.satellites.pop()!;
        this.sky.remove(sat);
      }
    } else if (this.satellites.length < newSatellitesLength) {
      for (let i = this.satellites.length; i < newSatellitesLength; i++) {
        const sat = new Mesh(this.satelliteGeometry, this.satelliteMaterial);
        sat.matrixAutoUpdate = false;
        sat.up.set(0, 1, 0);
        this.satellites.push(sat);
        this.sky.add(sat);
      }
    }
  }

  private updateHud(): void {
    if (!this.hudCtx) {
      return;
    }
    this.hudCtx.clearRect(
      0,
      0,
      this.hudCanvas!.nativeElement.width,
      this.hudCanvas!.nativeElement.height
    );
    this.hudCtx.fillStyle = 'rgb(0, 255, 0)';
    this.satellites.forEach((sat) => {
      if (!this.cameraFrustum.intersectsObject(sat)) {
        return;
      }
      this.directionVector.set(sat.position.x, sat.position.y, sat.position.z);
      this.directionVector.project(this.camera);
      const deltaX =
        (this.directionVector.x * this.hudCanvas!.nativeElement.width) / 2;
      const deltaY =
        (this.directionVector.y * this.hudCanvas!.nativeElement.height) / 2;
      const horizontal = deltaX + this.hudCanvas!.nativeElement.width / 2;
      const vertical = -deltaY + this.hudCanvas!.nativeElement.height / 2;
      this.hudCtx!.fillText(
        `
        ${
          sat.userData.satellite.name
        } RANGE: ${sat.userData.satellite.range.toFixed(3)} KM
      `,
        horizontal,
        vertical
      );
    });
  }

  private updateObserverView(): void {
    window.requestAnimationFrame(() => this.updateObserverView());
    this.cameraMatrix.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    this.cameraFrustum.setFromProjectionMatrix(this.cameraMatrix);
    this.camera.rotation.setFromQuaternion(
      this.orientationStates[this.primaryOrientationSensor].quaternion
    );
    this.renderer?.render(this.scene, this.camera);
    this.updateHud();
  }
}

interface OrientationState {
  quaternion: Quaternion;
  euler: Euler;
}

interface OrientationSensors {
  nineAxis: OrientationState;
  sixAxis: OrientationState;
}
