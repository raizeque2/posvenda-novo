// Stub vazio — jsPDF importa html2canvas para o plugin .html() que não usamos.
// Isso evita que os 201 kB do html2canvas real entrem no bundle.
export default function html2canvas() {
  return Promise.resolve(document.createElement('canvas'))
}
