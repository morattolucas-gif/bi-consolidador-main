export function carregarScript(url: string, integrity: string | null = null): Promise<void> {
  return new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = url;
    if (integrity) {
      s.integrity = integrity;
      s.crossOrigin = 'anonymous';
    }
    s.onload = () => ok();
    s.onerror = () => falha(new Error('Não foi possível carregar a biblioteca externa. Verifique a internet ou integridade SRI.'));
    document.head.appendChild(s);
  });
}
