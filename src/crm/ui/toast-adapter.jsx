import { useToast as useGlobalToast } from '../../hooks/useToast.jsx';

export function useToast() {
  let t = null;
  try {
    t = useGlobalToast();
  } catch (e) {
    // caso esteja fora do provider
  }

  return {
    success: (msg) => t?.sucesso ? t.sucesso(msg) : console.log("[Success]", msg),
    error: (msg) => t?.erro ? t.erro(msg) : console.error("[Error]", msg),
    info: (msg) => t?.info ? t.info(msg) : console.log("[Info]", msg),
  };
}
