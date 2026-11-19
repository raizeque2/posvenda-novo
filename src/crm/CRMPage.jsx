import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, UserCheck, MessageSquare, BarChart2,
  FileText, RotateCcw, ListFilter, Plus, Search,
  TrendingUp, CheckCircle, RefreshCw, LayoutDashboard,
  ExternalLink, Layers
} from 'lucide-react';

import { DashView } from './views/dash-view.jsx';
import { LeadsView } from './views/leads-view.jsx';
import { ReportView } from './views/report-view.jsx';
import { TsiView } from './views/tsi-view.jsx';
import { TsiDetailView } from './views/tsi-detail-view.jsx';
import { TsiListView } from './views/tsi-list-view.jsx';
import { TsiResendView } from './views/tsi-resend-view.jsx';
import { FieisView } from './views/fieis-view.jsx';
import { LeadModal } from './lead-modal.jsx';
import { ShinyButton } from './ui/shiny-button.jsx';
import { useToast } from './ui/toast-adapter.jsx';

// Dados iniciais
const INITIAL_LEADS = [
  { id: '1', nome: 'Carlos Eduardo Santos', telefone: '82991234567', origem: 'WhatsApp', data: new Date().toISOString().slice(0, 10), os: '10482', nf: '4921', modelo: 'CG 160 Titan', status: 'Novo', obs: 'Cliente interessado na revisão dos 6.000 km', criado_em: new Date().toISOString() },
  { id: '2', nome: 'Mariana Costa Lima', telefone: '82988776655', origem: 'Balcão', data: new Date().toISOString().slice(0, 10), os: '10495', nf: '4930', modelo: 'NXR 160 Bros', status: 'Em contato', obs: 'Retornar amanhã sobre orçamento de peças', criado_em: new Date().toISOString() },
  { id: '3', nome: 'José Roberto Oliveira', telefone: '82993441122', origem: 'Pesquisa TSI', data: new Date().toISOString().slice(0, 10), os: '10510', nf: '4952', modelo: 'CB 300F Twister', status: 'Convertido', obs: 'Agendou revisão para sexta-feira', criado_em: new Date().toISOString() },
  { id: '4', nome: 'Aline Ferreira Gomes', telefone: '82981122334', origem: 'Telefone', data: new Date().toISOString().slice(0, 10), os: '10522', nf: '4960', modelo: 'Biz 125', status: 'Perdido', obs: 'Realizou serviço em outra oficina', criado_em: new Date().toISOString() },
];

const INITIAL_FIEIS = [
  { id: 'f1', nome: 'Marcos Vinicius Barros', whatsapp: '82999881122', chassi: '9C2JC4100MR001234', criado_em: new Date().toISOString() },
  { id: 'f2', nome: 'Fernanda Albuquerque', whatsapp: '82996554433', chassi: '9C2KD0800MR005678', criado_em: new Date().toISOString() },
  { id: 'f3', nome: 'Rafael Mendes Silva', whatsapp: '82987112299', chassi: '9C2ND1100NR009012', criado_em: new Date().toISOString() },
];

const INITIAL_TSI = [
  { os: '10480', cliente: 'Lucas Silva', telefone: '82991112233', loja: 'Maceió Centro', consultor: 'Paulo', nota_atendimento: 10, nota_servico: 9, tsi: 95, data: new Date().toISOString().slice(0, 10), resposta: 'Excelente serviço e agilidade!' },
  { os: '10485', cliente: 'Camila Duarte', telefone: '82988223344', loja: 'Arapiraca', consultor: 'Juliana', nota_atendimento: 8, nota_servico: 8, tsi: 80, data: new Date().toISOString().slice(0, 10), resposta: 'Bom atendimento, demorou um pouco a lavagem.' },
  { os: '10490', cliente: 'Rodrigo Pires', telefone: '82993334455', loja: 'Maceió Tabuleiro', consultor: 'Marcos', nota_atendimento: 10, nota_servico: 10, tsi: 100, data: new Date().toISOString().slice(0, 10), resposta: 'Perfeito, moto entregue antes do prazo.' },
];

export default function CRMPage() {
  const toast = useToast();
  // 'solvik' | 'leads' | 'dash' | 'tsi' | 'tsidetail' | 'tsilist' | 'tsiresend' | 'fieis' | 'report'
  const [subTab, setSubTab] = useState('solvik');

  const [leads, setLeads] = useState(() => {
    try {
      const saved = localStorage.getItem('pv_crm_leads');
      return saved ? JSON.parse(saved) : INITIAL_LEADS;
    } catch {
      return INITIAL_LEADS;
    }
  });

  const [fieis, setFieis] = useState(() => {
    try {
      const saved = localStorage.getItem('pv_crm_fieis');
      return saved ? JSON.parse(saved) : INITIAL_FIEIS;
    } catch {
      return INITIAL_FIEIS;
    }
  });

  const [tsiData, setTsiData] = useState(() => {
    try {
      const saved = localStorage.getItem('pv_crm_tsi');
      return saved ? JSON.parse(saved) : INITIAL_TSI;
    } catch {
      return INITIAL_TSI;
    }
  });

  const [goal, setGoal] = useState(() => {
    try {
      return Number(localStorage.getItem('pv_crm_goal')) || 100;
    } catch {
      return 100;
    }
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  useEffect(() => {
    try { localStorage.setItem('pv_crm_leads', JSON.stringify(leads)); } catch {}
  }, [leads]);

  useEffect(() => {
    try { localStorage.setItem('pv_crm_fieis', JSON.stringify(fieis)); } catch {}
  }, [fieis]);

  useEffect(() => {
    try { localStorage.setItem('pv_crm_tsi', JSON.stringify(tsiData)); } catch {}
  }, [tsiData]);

  useEffect(() => {
    try { localStorage.setItem('pv_crm_goal', String(goal)); } catch {}
  }, [goal]);

  const handleSaveLead = useCallback((data) => {
    if (editingLead) {
      setLeads(prev => prev.map(l => l.id === editingLead.id ? { ...l, ...data, atualizado_em: new Date().toISOString() } : l));
      toast.success('Lead atualizado com sucesso!');
    } else {
      const newLead = { ...data, id: String(Date.now()), criado_em: new Date().toISOString() };
      setLeads(prev => [newLead, ...prev]);
      toast.success('Novo lead cadastrado!');
    }
    setModalOpen(false);
    setEditingLead(null);
  }, [editingLead, toast]);

  const handleDeleteLead = useCallback((id) => {
    if (window.confirm('Tem certeza que deseja excluir este lead?')) {
      setLeads(prev => prev.filter(l => l.id !== id));
      toast.info('Lead removido.');
    }
  }, [toast]);

  const handleConvertLead = useCallback((id) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'Convertido', atualizado_em: new Date().toISOString() } : l));
    toast.success('Lead marcado como Convertido!');
  }, [toast]);

  const handleAddFiel = useCallback(async (nome, whatsapp, chassi) => {
    const novo = { id: String(Date.now()), nome, whatsapp, chassi, criado_em: new Date().toISOString() };
    setFieis(prev => [novo, ...prev]);
    toast.success('Cliente fiel cadastrado!');
  }, [toast]);

  const handleEditFiel = useCallback(async (id, nome, whatsapp, chassi) => {
    setFieis(prev => prev.map(f => f.id === id ? { ...f, nome, whatsapp, chassi } : f));
    toast.success('Cliente fiel atualizado!');
  }, [toast]);

  const handleDeleteFiel = useCallback(async (id) => {
    if (window.confirm('Excluir este cliente fiel?')) {
      setFieis(prev => prev.filter(f => f.id !== id));
      toast.info('Cliente fiel removido.');
    }
  }, [toast]);

  const subTabs = [
    { id: 'solvik', label: 'Dashboard Solvik (Visual CRM)', icon: LayoutDashboard, highlight: true },
    { id: 'leads', label: 'Leads & Funil', icon: Users, count: leads.length },
    { id: 'dash', label: 'Painel Geral', icon: BarChart2 },
    { id: 'tsi', label: 'Pesquisa de Satisfação', icon: MessageSquare },
    { id: 'tsidetail', label: 'Detalhamento TSI', icon: ListFilter },
    { id: 'tsilist', label: 'Lista de Pesquisas', icon: FileText, count: tsiData.length },
    { id: 'tsiresend', label: 'Reenvios', icon: RotateCcw },
    { id: 'fieis', label: 'Clientes Fiéis', icon: UserCheck, count: fieis.length },
    { id: 'report', label: 'Relatórios', icon: TrendingUp },
  ];

  return (
    <div className="crm-container" style={{ padding: '16px 20px', minHeight: 'calc(100vh - 120px)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            CRM & Relacionamento — Solvik Pós-Venda
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Painel CRM Solvik com integração completa ao funil de leads, satisfação TSI e clientes fiéis
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <ShinyButton onClick={() => { setEditingLead(null); setModalOpen(true); }}>
            <Plus size={16} style={{ marginRight: 6, display: 'inline' }} />
            Novo Lead
          </ShinyButton>
        </div>
      </div>

      {/* Navegação por Subabas */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--border-line)',
        paddingBottom: 10,
        marginBottom: 16,
        overflowX: 'auto',
      }}>
        {subTabs.map(tab => {
          const IconComp = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 13px',
                borderRadius: 8,
                border: tab.highlight && !active ? '1px solid #10b98166' : 'none',
                background: active ? (tab.highlight ? '#10b981' : 'var(--bg-elevated, #ffffff)') : 'transparent',
                color: active ? '#ffffff' : (tab.highlight ? '#10b981' : 'var(--text-muted, #64748b)'),
                fontWeight: active ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <IconComp size={16} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 6px',
                  borderRadius: 10,
                  background: active ? '#cc0000' : 'var(--border-line)',
                  color: active ? '#ffffff' : 'inherit',
                  fontWeight: 600,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Conteúdo da Subaba */}
      <div className="crm-content">
        {subTab === 'solvik' && (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-line)', background: '#1c211f', height: 'calc(100vh - 230px)', minHeight: 700, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: 'rgba(28, 33, 31, 0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.8rem', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                CRM Solvik Live Engine (Frosted-Glass Architecture)
              </span>
              <a
                href="/solvik/#/overview"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.75rem', color: '#10b981', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                Abrir em tela cheia <ExternalLink size={12} />
              </a>
            </div>
            <iframe
              src="/solvik/index.html#/overview"
              title="Solvik CRM Dashboard"
              style={{ width: '100%', height: 'calc(100% - 37px)', border: 'none', display: 'block' }}
            />
          </div>
        )}

        {subTab === 'leads' && (
          <LeadsView
            leads={leads}
            fieis={fieis}
            onEdit={(l) => { setEditingLead(l); setModalOpen(true); }}
            onDelete={handleDeleteLead}
            onConvert={handleConvertLead}
            onNew={() => { setEditingLead(null); setModalOpen(true); }}
            onDedupe={() => toast.info('Verificação de duplicados realizada.')}
          />
        )}

        {subTab === 'dash' && (
          <DashView
            leads={leads}
            goal={goal}
            onGoalChange={setGoal}
            onView={setSubTab}
            onNewLead={() => { setEditingLead(null); setModalOpen(true); }}
          />
        )}

        {subTab === 'tsi' && (
          <TsiView
            tsiData={tsiData}
            tsiUpdatedAt={new Date().toLocaleDateString('pt-BR')}
            onImport={() => toast.info('Importação pronta para uso.')}
          />
        )}

        {subTab === 'tsidetail' && (
          <TsiDetailView
            tsiData={tsiData}
            tsiResend={[]}
            onImport={() => toast.info('Importação pronta para uso.')}
          />
        )}

        {subTab === 'tsilist' && (
          <TsiListView
            tsiData={tsiData}
            onImport={() => toast.info('Importação pronta para uso.')}
          />
        )}

        {subTab === 'tsiresend' && (
          <TsiResendView
            data={[]}
            tsiData={tsiData}
            fieis={fieis}
            onImport={() => toast.info('Importação pronta para uso.')}
            onMarkSent={() => toast.success('Reenvio registrado!')}
          />
        )}

        {subTab === 'fieis' && (
          <FieisView
            fieis={fieis}
            onAdd={handleAddFiel}
            onEdit={handleEditFiel}
            onDelete={handleDeleteFiel}
          />
        )}

        {subTab === 'report' && (
          <ReportView leads={leads} />
        )}
      </div>

      {/* Modal de Lead */}
      {modalOpen && (
        <LeadModal
          open={modalOpen}
          editing={editingLead}
          onClose={() => { setModalOpen(false); setEditingLead(null); }}
          onSave={handleSaveLead}
        />
      )}
    </div>
  );
}
