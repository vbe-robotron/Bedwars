export function loadLegacyScripts(sources, mountedScripts, shouldContinue = () => true) {
  return sources.reduce((chain, source) => chain.then(() => new Promise((resolve, reject) => {
    if (!shouldContinue()) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.async = false;
    if (source.src) {
      script.src = source.src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`外部スクリプトを読み込めません: ${source.src}`));
      mountedScripts.push(script);
      document.body.appendChild(script);
    } else {
      script.textContent = source.text;
      mountedScripts.push(script);
      document.body.appendChild(script);
      resolve();
    }
  })), Promise.resolve());
}

export function disposeLegacyRuntime(mountedScripts) {
  mountedScripts.forEach((script) => script.remove());
}
