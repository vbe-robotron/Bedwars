export class GameShell {
  readonly frame: HTMLIFrameElement;

  constructor(private readonly root: HTMLElement) {
    this.frame = document.createElement('iframe');
    this.frame.src = '/Bed%20Wars%20v32.5.html';
    this.frame.title = 'BedWars Ultimate';
    this.frame.style.cssText = 'display:block;width:100vw;height:100vh;border:0;background:#000';
    this.root.append(this.frame);
    document.body.style.cssText = 'margin:0;overflow:hidden;background:#000';
  }

  dispose(): void {
    this.frame.remove();
  }
}
