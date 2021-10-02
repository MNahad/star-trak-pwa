import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Object3D,
  Vector3,
  Matrix4,
  Quaternion,
  Euler,
  Shape,
  ShapeGeometry,
  MeshBasicMaterial,
  DoubleSide,
  Mesh,
} from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { SatelliteHorizontal, SatelliteService } from '../satellite.service';
import { SensorService } from '../sensor.service';
import { PageStateService } from '../page-state.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-observer',
  templateUrl: './observer.component.html',
  styleUrls: [ './observer.component.css' ]
})
export class ObserverComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement', { static: true })
  videoElement: ElementRef<HTMLVideoElement> | undefined;
  @ViewChild('observerCanvas', { static: true })
  observerCanvas: ElementRef<HTMLCanvasElement> | undefined;
  observerEnabled = false;

  private camSensorAvail = false;

  private satellitesData: [SatelliteHorizontal, string][] = [];
  private subscribers: Record<string, Subscription>;
  
  private scene = new Scene();
  private camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
  private renderer: WebGLRenderer | undefined;
  private quaternion = new Quaternion(0, 0, 0, 0);
  private euler = new Euler(0, 0, 0);

  private sky = new Object3D();

  private vector3 = new Vector3();
  private matrix4 = new Matrix4();
  private satelliteShape = ObserverComponent.generateShape();
  private satelliteGeometry = new ShapeGeometry(this.satelliteShape);
  private satelliteMaterial = new MeshBasicMaterial({ color: 0x006400, side: DoubleSide });
  private satellitesGeometry = this.satelliteGeometry.clone();
  private satellites = new Mesh(this.satellitesGeometry, this.satelliteMaterial);

  constructor(
    satelliteService: SatelliteService,
    sensorService: SensorService,
    pageStateService: PageStateService,
  ) {
    sensorService.requestSensorActivation("geo");
    this.subscribers = {
      capabilitySubscriber: sensorService.getCapability$().subscribe(capability => {
        if (!this.camSensorAvail) {
          this.observerEnabled = false;
          return;
        }
        switch (capability) {
          case "FULL":
            this.observerEnabled = true;
            break;
          case "NO_HEADING":
            break;
          case "NO_POSITION":
            break;
          case "NO_ORIENTATION":
          case "OFF":
          default:
            this.observerEnabled = false;
            break;
        }
      }),
      satelliteSubscriber: satelliteService.tracker$.subscribe(({ data: [_, satellitesData] }) => {
        this.satellitesData = satellitesData;
        this.updateSatellites();
      }),
      geoSubscriber: sensorService.getSensor$("geo").pipe(
        filter(SensorService.isReading),
      ).subscribe(({ reading: [lat_deg, lon_deg, alt_km] }) => {
        satelliteService.updateObserver({ lat_deg, lon_deg, alt_km });
      }),
      nineAxisSubscriber: sensorService.getSensor$("nineAxis").pipe(
        filter(SensorService.isReading),
      ).subscribe(({ reading: quaternion }) => {
        this.quaternion.fromArray(quaternion);
        this.euler.setFromQuaternion(this.quaternion);
        this.euler.set(this.euler.x - Math.PI / 2, this.euler.y, this.euler.z);
        this.quaternion.setFromEuler(this.euler);
      }),
      sixAxisSubscriber: sensorService.getSensor$("sixAxis").pipe(
        filter(SensorService.isReading),
      ).subscribe(({ reading: quaternion }) => {

      }),
      pageStateSubscriber: pageStateService.go$.subscribe(ready => {

      }),
    };
    pageStateService.signalReady({ from: "page", state: true });
  }

  ngOnInit(): void {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          frameRate: 50,
          facingMode: "environment",
          width: { ideal: window.innerWidth },
          height: { ideal: window.innerHeight },
        },
      })
      .then(stream => {
        this.camSensorAvail = true;
        if (this.videoElement) {
          this.videoElement.nativeElement.srcObject = stream;
        }
      })
      .catch(() => {
        this.camSensorAvail = false;
        this.observerEnabled = false;
      });

    this.renderer = new WebGLRenderer({ canvas: this.observerCanvas?.nativeElement, alpha: true });

    this.scene.add(this.sky);
    this.sky.add(this.satellites);

    this.camera.position.set(0, 0, 0.001);
    this.camera.up.set(0, 1, 0);

    this.updateObserverView();
  }

  ngOnDestroy(): void {
    Object.values(this.subscribers).forEach(subscriber => {
      subscriber.unsubscribe();
    });
  }

  private static generateShape(): Shape {
    const shape = new Shape();
    shape.lineTo(10, 0);
    shape.lineTo(0, 20);
    shape.lineTo(-10, 0);
    return shape;
  }

  private updateSatellites(): void {
    const satellitesArray: ShapeGeometry[] = [];
    this.satellitesData.forEach(([target, name]) => {
      const geometry = this.satelliteGeometry.clone();
      this.matrix4.setPosition(
        this.vector3.setFromSphericalCoords(
          -target.range_km,
          Math.PI / 2 + (target.elevation_deg * Math.PI / 180),
          -target.azimuth_deg * Math.PI / 180,
        ),
      );
      geometry.applyMatrix4(this.matrix4);
      satellitesArray.push(geometry);
    });
    if (satellitesArray.length) {
      this.satellitesGeometry.dispose();
      this.satellitesGeometry = BufferGeometryUtils.mergeBufferGeometries(satellitesArray);
      this.satellites.geometry = this.satellitesGeometry;
      satellitesArray.forEach(sat => sat.dispose());
    }
  }

  private updateObserverView(): void {
    window.requestAnimationFrame(() => this.updateObserverView());
    if (!(this.observerCanvas && this.videoElement)) {
      return;
    }
    this.observerCanvas.nativeElement.style.width = this.videoElement.nativeElement.videoWidth.toString() + "px";
    this.observerCanvas.nativeElement.style.height = this.videoElement.nativeElement.videoHeight.toString() + "px";
    this.camera.rotation.setFromQuaternion(this.quaternion);
    this.renderer?.render(this.scene, this.camera);
  }
}
