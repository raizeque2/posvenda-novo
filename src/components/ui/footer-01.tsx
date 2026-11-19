import { Link } from "react-router-dom";
import useStore from "../../store.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { podeAcessar } from "../../data/permissoes.js";
import "./footer-01.css";

// Rodapé no modelo do footer-01 (sem Tailwind/shadcn: CSS próprio). Trocas em relação ao modelo:
// marca "Pós-Venda"; colunas com as telas do sistema (só as que o perfil pode abrir); sem
// formulário de e-mail, redes sociais e "All systems operational", que não têm nada real por trás.
const colunas = [
  { titulo: "Operacional", links: [["Faturamento", "/dashboard"], ["Meu desempenho", "/desempenho"], ["Meu painel", "/painel"], ["Estoque", "/estoque"], ["Canais", "/canais"], ["Análise geográfica", "/geografico"]] },
  { titulo: "Conferências", links: [["Monitor de O.S.", "/monitor-os"], ["Requisições", "/monitor-requisicoes"], ["Reservas", "/monitor-reservas"], ["Atacado", "/atacado"]] },
  { titulo: "Gestão", links: [["Organograma", "/organograma"], ["Equipes", "/equipes"], ["Metas", "/metas"], ["Comissões", "/comissoes"], ["Colaboradores", "/colaboradores"]] },
  { titulo: "Administração", links: [["Resumo mensal", "/resumo-mensal"], ["Importar dados", "/upload"], ["Regras", "/regras"], ["Acessos", "/acesso"]] },
];

export default function Footer01({ children }: { children?: React.ReactNode }) {
  const { role, setor } = useAuth() as { role?: string; setor?: string };
  const permissoes = useStore((s: { permissoes: unknown }) => s.permissoes);
  const visiveis = colunas
    .map(c => ({ ...c, links: c.links.filter(([, rota]) => podeAcessar(role, rota, permissoes, setor)) }))
    .filter(c => c.links.length);

  return (
    <footer className="rodape no-print">
      <div className="rodape-container">
        <div className="rodape-topo">
          <div className="rodape-marca">
            <Link to="/" className="rodape-logo">
              <img src="/icon.png" alt="" width={22} height={22} />
              Pós-Venda
            </Link>
            <p>Faturamento, metas, comissões e estoque das lojas em um só lugar, atualizados a cada importação.</p>
          </div>
          {visiveis.length > 0 && (
            <nav aria-label="Rodapé" className="rodape-colunas">
              {visiveis.map(c => (
                <div key={c.titulo}>
                  <h3>{c.titulo}</h3>
                  <ul>
                    {c.links.map(([rotulo, rota]) => (
                      <li key={rota}><Link to={rota}>{rotulo}</Link></li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          )}
        </div>
        <div className="rodape-base">
          <span>© {new Date().getFullYear()} Pós-Venda</span>
          <div className="rodape-status">{children}</div>
        </div>
      </div>
      <div className="rodape-container rodape-marca-grande" aria-hidden="true">
        <p>Pós-Venda</p>
      </div>
    </footer>
  );
}
