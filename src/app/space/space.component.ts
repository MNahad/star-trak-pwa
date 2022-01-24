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
  TextureLoader,
  Object3D,
  SphereGeometry,
  BufferGeometry,
  MeshBasicMaterial,
  Texture,
  Material,
  Mesh,
  Side,
  FrontSide,
  BackSide,
  Vector3,
  Matrix4,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { SatelliteService, SatelliteGeodetic } from '../satellite.service.js';
import { BreakpointObserver } from '@angular/cdk/layout';
import { PageStateService } from '../page-state.service.js';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-space',
  templateUrl: './space.component.html',
  styleUrls: ['./space.component.css'],
})
export class SpaceComponent implements OnInit, OnDestroy {
  private EARTH_RADIUS_KM = 6371;

  @ViewChild('rendererCanvas', { static: true })
  private rendererCanvas: ElementRef<HTMLCanvasElement> | undefined;

  private pageStateSubscriber: Subscription | undefined;
  private satelliteServiceSubscriber: Subscription;
  private breakpointSubscriber: Subscription;

  private scene = new Scene();
  private camera = new PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    200
  );
  private renderer: WebGLRenderer | undefined;
  private loader = new TextureLoader();

  private space = new Object3D();

  private earthGeometry = new SphereGeometry(this.EARTH_RADIUS_KM, 32, 32);
  private earth = new Mesh(this.earthGeometry);

  private skyGeometry = new SphereGeometry(100, 8, 8);
  private sky = new Mesh(this.skyGeometry);

  private satVector = new Vector3();
  private satMatrix = new Matrix4();
  private satGeometry = new SphereGeometry(10, 1, 1);
  private satsGeometry = this.satGeometry.clone();
  private sats = new Mesh(this.satsGeometry);

  private controls: OrbitControls | undefined;

  private timingFrame = 0;

  constructor(
    private pageStateService: PageStateService,
    breakpointObserver: BreakpointObserver,
    satelliteService: SatelliteService
  ) {
    const updateMaterial = (mesh: Mesh, texture: Texture, side: Side) => {
      (mesh.material as Material).dispose();
      (mesh.material as Material) = new MeshBasicMaterial({
        map: texture,
        side,
      });
    };
    Promise.all([
      this.loader
        .loadAsync('./assets/land_ocean_ice_2048.jpg')
        .then((texture) => {
          updateMaterial(this.earth, texture, FrontSide);
        }),
      this.loader
        .loadAsync('./assets/starmap_2020_4k_print.jpg')
        .then((texture) => {
          updateMaterial(this.sky, texture, BackSide);
        }),
    ])
      .then(() =>
        this.pageStateService.signalReady({ from: 'page', state: true })
      )
      .then(() =>
        Promise.all([
          this.loader
            .loadAsync('./assets/land_ocean_ice_8192.png')
            .then((texture) => {
              updateMaterial(this.earth, texture, FrontSide);
            }),
          this.loader
            .loadAsync('./assets/starmap_2020_4k.png')
            .then((texture) => {
              updateMaterial(this.sky, texture, BackSide);
            }),
        ])
      );

    satelliteService.updatePeriod(1000);
    this.satelliteServiceSubscriber = satelliteService.tracker$.subscribe(
      ({ data: [satellites] }) => {
        this.updateSatMesh(satellites);
      }
    );
    this.breakpointSubscriber = breakpointObserver
      .observe(['(orientation: portrait)', '(orientation: landscape)'])
      .subscribe(() => {
        this.renderer?.setSize(window.innerWidth, window.innerHeight);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
      });

    this.createUniverse();
    this.animate(0);
  }

  ngOnInit(): void {
    this.renderer = new WebGLRenderer({
      canvas: this.rendererCanvas?.nativeElement,
    });

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.maxDistance = 36;
    this.controls.minDistance = 12;
    this.controls.update();

    this.pageStateSubscriber = this.pageStateService.go$.subscribe((ready) => {
      ready && this.display();
    });
  }

  ngOnDestroy(): void {
    this.controls?.dispose();
    this.satsGeometry.dispose();
    this.satGeometry.dispose();
    this.sats.geometry.dispose();
    (this.sats.material as Material).dispose();
    this.skyGeometry.dispose();
    this.sky.geometry.dispose();
    (this.sky.material as Material).dispose();
    this.earthGeometry.dispose();
    this.earth.geometry.dispose();
    (this.earth.material as Material).dispose();
    this.renderer?.dispose();
    this.breakpointSubscriber.unsubscribe();
    this.pageStateSubscriber?.unsubscribe();
    this.satelliteServiceSubscriber.unsubscribe();
  }

  private createUniverse(): void {
    this.scene.add(this.space);

    this.earth.scale.set(0.001, 0.001, 0.001);
    this.space.add(this.earth);

    this.sky.rotateY(Math.PI / 2);
    this.space.add(this.sky);

    this.earth.add(this.sats);

    this.camera.position.set(36, 0, 0);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
  }

  private display(): void {
    if (this.rendererCanvas) {
      this.rendererCanvas.nativeElement.style.display = 'grid';
    }
    this.renderer?.setSize(window.innerWidth, window.innerHeight);
  }

  private animate(timestampMs: number): void {
    window.requestAnimationFrame((timestamp: number) =>
      this.animate(timestamp)
    );
    this.earth.rotateY(
      ((2 * Math.PI) / (24 * 3600 * 1000)) * (timestampMs - this.timingFrame)
    );
    this.timingFrame = timestampMs;
    this.controls?.update();
    this.renderer?.render(this.scene, this.camera);
  }

  private updateSatMesh(satellites: SatelliteGeodetic[]): void {
    const satsArray: BufferGeometry[] = [];
    satellites.forEach((satellite) => {
      this.satMatrix.setPosition(
        this.satVector.setFromSphericalCoords(
          this.EARTH_RADIUS_KM + satellite.alt_km,
          Math.PI / 2 - (satellite.lat_deg * Math.PI) / 180,
          (satellite.lon_deg * Math.PI) / 180 + Math.PI / 2
        )
      );
      const geometry = this.satGeometry.clone();
      geometry.applyMatrix4(this.satMatrix);
      satsArray.push(geometry);
    });
    if (satsArray.length) {
      this.satsGeometry.dispose();
      this.satsGeometry = BufferGeometryUtils.mergeBufferGeometries(satsArray);
      this.sats.geometry.dispose();
      this.sats.geometry = this.satsGeometry;
      satsArray.forEach((geometry) => geometry.dispose());
    }
  }
}
