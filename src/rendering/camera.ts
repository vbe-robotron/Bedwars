import * as THREE from 'three';

export class CameraController {
  private yaw = 0;
  private pitch = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly sensitivity = 0.002,
  ) {
    camera.rotation.order = 'YXZ';
  }

  look(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * this.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - deltaY * this.sensitivity, -Math.PI / 2, Math.PI / 2);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  setFov(fov: number): void {
    this.camera.fov = THREE.MathUtils.clamp(fov, 50, 120);
    this.camera.updateProjectionMatrix();
  }

  get rotation(): Readonly<{ yaw: number; pitch: number }> {
    return { yaw: this.yaw, pitch: this.pitch };
  }
}
