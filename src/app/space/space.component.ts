import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  TextureLoader,
  Object3D,
  SphereGeometry,
  BufferGeometry,
  MeshBasicMaterial,
  Material,
  Mesh,
  BackSide,
  Vector3,
  Matrix4,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { SatelliteService } from '../satellite.service';
import { BreakpointObserver } from '@angular/cdk/layout';

@Component({
  selector: 'app-space',
  templateUrl: './space.component.html',
  styleUrls: ['./space.component.css']
})
export class SpaceComponent implements OnInit {
  private EARTH_RADIUS_KM = 6371;

  @ViewChild('loadingContainer')
  private loadingContainer: ElementRef | undefined;

  @ViewChild('rendererContainer')
  private rendererContainer: ElementRef | undefined;

  private scene = new Scene();
  private camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 200);
  private renderer = new WebGLRenderer();
  private loader = new TextureLoader();

  private space = new Object3D();

  private earth = new Mesh(new SphereGeometry(this.EARTH_RADIUS_KM, 32, 32));

  private sky = new Mesh(new SphereGeometry(100, 8, 8));

  private satVector = new Vector3();
  private satMatrix = new Matrix4();
  private satGeometry = new SphereGeometry(10, 1, 1);
  private satsGeometry = this.satGeometry.clone();
  private sats = new Mesh(this.satsGeometry);

  private controls = new OrbitControls(this.camera, this.renderer.domElement);

  private timingFrame = 0;
  private timingClock = 0;

  constructor(
    private satelliteService: SatelliteService.SatelliteService,
    private breakpointObserver: BreakpointObserver,
  ) {
    Promise.all([
      this.loader.loadAsync('../assets/land_ocean_ice_8192.png').then(texture => {
        (this.earth.material as Material).dispose();
        (this.earth.material as Material) = new MeshBasicMaterial({
          map: texture,
        });
      }),
      this.loader.loadAsync('../assets/starmap_2020_4k.png').then(texture => {
        (this.sky.material as Material).dispose();
        (this.sky.material as Material) = new MeshBasicMaterial({
          map: texture,
          side: BackSide,
        });
      }),
    ]).then(() => this.display());
  }

  animate(timestampMs: number): void {
    window.requestAnimationFrame((timestamp: number) => this.animate(timestamp));
    this.earth.rotateY(2 * Math.PI / (24 * 3600 * 1000) * (timestampMs - this.timingFrame));
    this.timingFrame = timestampMs;
    this.controls.update();

    if (timestampMs - this.timingClock >= 1000) {
      this.satelliteService.setAllSats();
      this.updateSatMesh();
      this.timingClock = timestampMs;
    }
    this.renderer.render(this.scene, this.camera);
  }

  ngOnInit(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene.add(this.space);

    this.earth.scale.set(0.001, 0.001, 0.001);
    this.space.add(this.earth);

    this.sky.rotateY(Math.PI / 2);
    this.space.add(this.sky);

    this.earth.add(this.sats);

    this.camera.position.set(36, 0, 0);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);

    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.maxDistance = 36;
    this.controls.minDistance = 12;
    this.controls.update();

    this.animate(0);
  }

  private display(): void {
    if (this.rendererContainer) {
      this.loadingContainer?.nativeElement.remove();
      this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);
      this.breakpointObserver.observe([
        '(orientation: portrait)',
        '(orientation: landscape)',
      ]).subscribe(() => {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
      });
    }
  }

  private updateSatMesh(): void {
    this.satsGeometry.dispose();
    const satellites = this.satelliteService.getAllSats();
    const satsArray: BufferGeometry[] = [];
    satellites.forEach(satellite => {
      this.satMatrix.setPosition(this.satVector.setFromSphericalCoords(
        this.EARTH_RADIUS_KM + satellite.alt_km,
        (Math.PI / 2) - (satellite.lat_deg * Math.PI / 180),
        (satellite.lon_deg * Math.PI / 180) + (Math.PI / 2),
      ));
      const geometry = this.satGeometry.clone();
      geometry.applyMatrix4(this.satMatrix);
      satsArray.push(geometry);
    });
    if (satsArray.length) {
      this.satsGeometry = BufferGeometryUtils.mergeBufferGeometries(satsArray);
      this.sats.geometry.dispose();
      this.sats.geometry = this.satsGeometry;
    }
  }
}
