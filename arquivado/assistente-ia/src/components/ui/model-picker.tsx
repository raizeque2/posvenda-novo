"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import * as Popover from '@radix-ui/react-popover'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Brain, ImageIcon } from 'lucide-react'
import { ProviderIcon } from './provider-icon'
import { Check, ChevronDown, Search, X } from '../../icons/iconoir'
import './model-picker.css'

export type ThinkingEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type ModelPickerModel = { id: string; name: string; description?: string; available?: boolean; capabilities?: readonly ('reasoning' | 'image')[]; thinking?: readonly ThinkingEffort[]; defaultThinking?: ThinkingEffort }
export type ModelPickerProvider = { id: string; name: string; models: ModelPickerModel[] }
export const effortLabel: Record<ThinkingEffort, string> = { none: 'Desligado', minimal: 'Mínimo', low: 'Baixo', medium: 'Médio', high: 'Alto', xhigh: 'Muito alto', max: 'Máximo' }

type Props = {
  providers: ModelPickerProvider[]
  value: string
  provider: string
  thinking?: ThinkingEffort
  busy?: boolean
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  onValueChange: (id: string, provider: string, thinking?: ThinkingEffort) => void
  onConnect: (provider?: string) => void
  onInspect?: () => void
}

function EffortMeter({ levels, value }: { levels: readonly ThinkingEffort[]; value?: ThinkingEffort }) {
  const filled = value && value !== 'none' ? levels.indexOf(value) + 1 : 0
  return <span className="model-effort-meter" aria-hidden="true">{levels.map((level, i) => <i key={level} className={i < filled ? 'is-filled' : ''} style={{ height: 5 + i * 2.5 }}/>)}</span>
}

function ThinkingTrack({ levels, value, onChange }: { levels: readonly ThinkingEffort[]; value?: ThinkingEffort; onChange: (value: ThinkingEffort) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const current = Math.max(0, levels.indexOf(value || levels[0]))
  function move(index: number) {
    const next = (index + levels.length) % levels.length
    onChange(levels[next]); refs.current[next]?.focus()
  }
  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? current + 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? current - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? levels.length - 1 : null
    if (next !== null) { event.preventDefault(); move(next) }
  }
  return <div className="model-thinking-track" role="radiogroup" aria-label="Esforço de raciocínio">
    <span className="model-thinking-indicator" aria-hidden="true" style={{ width: `calc((100% - 8px) / ${levels.length})`, transform: `translateX(${current * 100}%)` }}/>
    {levels.map((level, i) => <button key={level} type="button" role="radio" aria-checked={i === current} tabIndex={i === current ? 0 : -1} ref={node => { refs.current[i] = node }} onClick={() => onChange(level)} onKeyDown={handleKey}>{effortLabel[level]}</button>)}
  </div>
}

function CapabilityChips({ model }: { model: ModelPickerModel }) {
  const capabilities = model.capabilities || (model.thinking?.length ? ['reasoning'] as const : [])
  if (!capabilities.length) return null
  return <span className="model-capabilities">{capabilities.map(capability => <Tooltip.Root key={capability}><Tooltip.Trigger asChild><span className={`model-capability-${capability}`} aria-label={capability === 'reasoning' ? 'Raciocínio' : 'Imagem'}>{capability === 'reasoning' ? <Brain size={12}/> : <ImageIcon size={12}/>}</span></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="model-picker-tooltip" side="top" sideOffset={4}>{capability === 'reasoning' ? 'Raciocínio' : 'Imagem'}</Tooltip.Content></Tooltip.Portal></Tooltip.Root>)}</span>
}

export function ModelPicker({ providers, value, provider, thinking, busy, onValueChange, onConnect, onInspect, side = 'top', align = 'start' }: Props) {
  const [open, setOpen] = useState(false), [active, setActive] = useState(provider), [query, setQuery] = useState('')
  const listId = useId(), searchRef = useRef<HTMLInputElement>(null)
  const providerRefs = useRef<Array<HTMLButtonElement | null>>([]), modelRefs = useRef<Array<HTMLDivElement | null>>([])
  const selected = providers.find(p => p.id === provider)?.models.find(m => m.id === value)
  const current = providers.find(p => p.id === active) || providers[0]
  const search = query.trim().toLocaleLowerCase('pt-BR')
  const rows = useMemo(() => providers.flatMap(owner => owner.models.filter(model => model.available !== false).map(model => ({ model, owner }))).filter(({ model, owner }) => search ? `${model.name} ${model.id} ${model.description || ''} ${owner.name}`.toLocaleLowerCase('pt-BR').includes(search) : owner.id === current?.id), [providers, current, search])
  const activeRow = Math.max(0, rows.findIndex(row => row.owner.id === provider && row.model.id === value))
  const levels = selected?.thinking, effort = thinking || selected?.defaultThinking
  function changeOpen(next: boolean) {
    setOpen(next); setQuery('')
    if (next) { setActive(provider); onInspect?.() }
  }
  function connect(id: string) { changeOpen(false); onConnect(id) }
  function focusModel(index: number) { if (rows.length) modelRefs.current[(index + rows.length) % rows.length]?.focus() }
  function focusProvider(index: number) { if (providers.length) providerRefs.current[(index + providers.length) % providers.length]?.focus() }
  function selectModel(model: ModelPickerModel, owner: ModelPickerProvider) { onValueChange(model.id, owner.id, model.defaultThinking || model.thinking?.[0]) }
  function handleModelKey(event: KeyboardEvent<HTMLDivElement>, index: number) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectModel(rows[index].model, rows[index].owner); return }
    const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : null
    if (next !== null) { event.preventDefault(); focusModel(next) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); focusProvider(providers.findIndex(p => p.id === current?.id)) }
  }
  return <Tooltip.Provider delayDuration={250}><Popover.Root open={open} onOpenChange={changeOpen} modal={false}>
    <Popover.Trigger type="button" className="model-picker-trigger" aria-label="Escolher modelo e esforço" aria-haspopup="listbox" disabled={busy}>
      <span className="model-trigger-glyph"><ProviderIcon provider={provider}/></span><span className="model-trigger-label" translate="no">{selected?.name || 'Escolher modelo'}</span>
      {!!levels?.length && effort !== 'none' && <EffortMeter levels={levels} value={effort}/>}
      <ChevronDown size={14} className="model-trigger-chevron"/>
    </Popover.Trigger>
    <Popover.Portal><Popover.Content className="model-picker-panel" side={side} align={align} sideOffset={10} collisionPadding={12} aria-label="Selecionar modelo" onEscapeKeyDown={event => { if (query) { event.preventDefault(); setQuery('') } }} onOpenAutoFocus={event => { event.preventDefault(); requestAnimationFrame(() => searchRef.current?.focus()) }}>
      {!current ? <p className="model-picker-empty">Nenhum modelo disponível.</p> : <div className="model-picker-body">
        <div className="model-provider-rail-wrap"><div className="model-provider-rail" role="tablist" aria-label="Provedores" aria-orientation="vertical">
          {providers.map((owner, i) => <Tooltip.Root key={owner.id}><Tooltip.Trigger asChild><button type="button" role="tab" id={`${listId}-${owner.id}`} className={owner.id === current.id && !search ? 'is-active' : ''} aria-label={owner.name} aria-selected={owner.id === current.id} aria-controls={listId} tabIndex={owner.id === current.id ? 0 : -1} ref={node => { providerRefs.current[i] = node }} onClick={() => { setActive(owner.id); setQuery('') }} onKeyDown={event => {
            const next = event.key === 'ArrowDown' ? i + 1 : event.key === 'ArrowUp' ? i - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? providers.length - 1 : null
            if (next !== null) { event.preventDefault(); focusProvider(next) }
            if (event.key === 'ArrowRight') { event.preventDefault(); focusModel(0) }
          }}><ProviderIcon provider={owner.id}/></button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="model-picker-tooltip" side="right" sideOffset={5}>{owner.name}</Tooltip.Content></Tooltip.Portal></Tooltip.Root>)}
        </div></div>
        <div className="model-picker-column">
          <div className="model-search"><Search size={14}/><input ref={searchRef} type="text" aria-label="Buscar modelos" aria-controls={listId} placeholder="Buscar modelos" autoComplete="off" spellCheck={false} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); focusModel(0) }
            if (event.key === 'Enter') { event.preventDefault(); if (rows[0]) selectModel(rows[0].model, rows[0].owner) }
            if (event.key === 'Escape' && query) { event.preventDefault(); event.stopPropagation(); setQuery('') }
          }}/>{query && <button type="button" aria-label="Limpar busca" onClick={() => { setQuery(''); searchRef.current?.focus() }}><X size={12}/></button>}</div>
          <div className="model-picker-models"><p className="model-provider-name" translate="no">{search ? `${rows.length} resultado${rows.length === 1 ? '' : 's'}` : current.name}</p>
            <div className="model-picker-rows" role="listbox" id={listId} aria-label={search ? 'Resultados da busca' : `Modelos ${current.name}`}>
              {rows.map(({ model, owner }, i) => { const isSelected = model.id === value && owner.id === provider; return <div key={`${owner.id}:${model.id}`} role="option" aria-selected={isSelected} tabIndex={i === activeRow ? 0 : -1} className={`model-picker-row${isSelected ? ' is-active' : ''}`} ref={node => { modelRefs.current[i] = node }} onClick={() => selectModel(model, owner)} onKeyDown={event => handleModelKey(event, i)}>
                {search && <span className="model-row-glyph"><ProviderIcon provider={owner.id}/></span>}
                <span className="model-row-copy"><span><strong translate="no">{model.name}</strong>{isSelected && <Check size={14}/>}</span>{model.description && <small>{model.description}</small>}</span><CapabilityChips model={model}/>
              </div> })}
              {!rows.length && <div className="model-picker-empty"><p>{search ? `Nenhum modelo corresponde a “${query.trim()}”.` : 'Conecte este provedor para carregar os modelos disponíveis.'}</p>{!search && <button type="button" onClick={() => connect(current.id)}>Conectar {current.name}</button>}</div>}
            </div>
          </div>
          <footer className="model-picker-footer"><span><EffortMeter levels={levels || ['low', 'medium', 'high', 'max']} value={effort}/>Esforço</span>
            {levels?.length ? <ThinkingTrack levels={levels} value={effort} onChange={next => onValueChange(value, provider, next)}/> : <small>{selected ? 'Indisponível para este modelo' : 'Selecione um modelo para ajustar o esforço'}</small>}
          </footer>
        </div>
      </div>}
    </Popover.Content></Popover.Portal>
  </Popover.Root></Tooltip.Provider>
}

export default ModelPicker
