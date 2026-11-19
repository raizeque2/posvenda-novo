/**
 * Dropdown com foto — mesma lógica de abertura, clique fora, teclado e
 * acessibilidade do FormDropdown (DS.jsx) e da busca central do topo, com
 * uma foto redonda opcional ao lado do nome.
 *
 * Sem Tailwind: o visual vem de dropdown-menu.css, que só usa os tokens do
 * projeto (--bg2, --border, --text, --honda...). Sem dados fixos: quem chama
 * passa as opções; sem imagem, cai nas iniciais do nome.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import './dropdown-menu.css'

export interface DropdownOption {
  value: string
  label: string
  /** Foto do perfil. Sem ela, o componente mostra as iniciais do nome. */
  image?: string | null
  /** Linha de apoio opcional (ex.: loja). Nunca usada para desempenho. */
  description?: string
}

export interface DropdownMenuProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  /** Busca interna. Padrão: aparece a partir de 9 opções (mesma ideia do FormDropdown). */
  searchable?: boolean
  /** aria-label do botão quando não há `label` visível. */
  ariaLabel?: string
  className?: string
}

export function initialsOf(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
}

function Avatar({ option }: { option: DropdownOption }) {
  return (
    <span className="dropdown-avatar" aria-hidden="true">
      {option.image ? <img src={option.image} alt="" /> : initialsOf(option.label)}
    </span>
  )
}

export function DropdownMenu({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  label,
  disabled = false,
  searchable,
  ariaLabel,
  className = '',
}: DropdownMenuProps) {
  const baseId = useId().replace(/:/g, '')
  const listboxId = `${baseId}-listbox`
  const optionId = (index: number) => `${baseId}-option-${index}`
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)

  const selected = options.find(option => option.value === value)
  const withSearch = searchable ?? options.length > 8
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options
    return options.filter(option =>
      `${option.label} ${option.description ?? ''}`.toLowerCase().includes(term),
    )
  }, [options, query])

  const close = useCallback((refocus = true) => {
    setOpen(false)
    setQuery('')
    setActive(-1)
    if (refocus) trigger.current?.focus()
  }, [])

  const openMenu = useCallback(() => {
    if (disabled) return
    setOpen(true)
    const index = options.findIndex(option => option.value === value)
    setActive(index >= 0 ? index : options.length ? 0 : -1)
  }, [disabled, options, value])

  // Clique fora fecha — mesmo padrão do FormDropdown.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, close])

  // Foco na busca (quando existe) ou na lista, para o teclado já valer.
  useEffect(() => {
    if (!open) return
    const target = withSearch ? search.current : list.current
    target?.focus()
  }, [open, withSearch])

  useEffect(() => {
    if (!open || active < 0) return
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function choose(index: number) {
    const option = filtered[index]
    if (!option) return
    onChange(option.value)
    close()
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key === 'Tab') {
      close(false)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!filtered.length) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive(index => ((index < 0 ? 0 : index + step) + filtered.length) % filtered.length)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActive(event.key === 'Home' ? 0 : filtered.length - 1)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (active >= 0) choose(active)
    }
  }

  return (
    <div className={`dropdown-menu ${className}`} ref={root}>
      {label && (
        <span className="dropdown-label" id={`${baseId}-label`}>
          {label}
        </span>
      )}
      <button
        ref={trigger}
        type="button"
        className="form-input dropdown-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={label ? undefined : ariaLabel || placeholder}
        aria-labelledby={label ? `${baseId}-label` : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={event => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            openMenu()
          }
        }}
      >
        {selected && <Avatar option={selected} />}
        <span className={`dropdown-trigger-text${selected ? '' : ' is-placeholder'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`dropdown-caret${open ? ' is-open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m7 15 5 5 5-5" />
          <path d="m7 9 5-5 5 5" />
        </svg>
      </button>
      {open && (
        <div className="dropdown-panel">
          {withSearch && (
            <div className="dropdown-search">
              <input
                ref={search}
                className="form-input"
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? optionId(active) : undefined}
                placeholder="Buscar..."
                value={query}
                onChange={event => {
                  setQuery(event.target.value)
                  setActive(0)
                }}
                onKeyDown={onKeyDown}
              />
            </div>
          )}
          <ul
            ref={list}
            id={listboxId}
            className="dropdown-list"
            role="listbox"
            tabIndex={-1}
            aria-labelledby={label ? `${baseId}-label` : undefined}
            aria-activedescendant={!withSearch && active >= 0 ? optionId(active) : undefined}
            onKeyDown={withSearch ? undefined : onKeyDown}
          >
            {filtered.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={option.value === value}
                className={`dropdown-option${option.value === value ? ' is-selected' : ''}${index === active ? ' is-active' : ''}`}
                onMouseDown={event => event.preventDefault()}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <Avatar option={option} />
                <span className="dropdown-option-text">
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
              </li>
            ))}
          </ul>
          {!filtered.length && <p className="dropdown-empty">Nenhuma opção encontrada.</p>}
        </div>
      )}
    </div>
  )
}

export default DropdownMenu
