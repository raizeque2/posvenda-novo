export function WidgetChoices({ widget, patch, dims, types, canCompare }) {
  const choices = (title, field, values) => (
    <fieldset className="bi-choice-section">
      <legend>{title}</legend>
      <div className="bi-choice-grid">
        {Object.entries(values).map(([value, label]) => (
          <label
            key={value}
            className="bi-choice"
            data-selected={(widget[field] || "") === value}
          >
            <input
              type="radio"
              name={`${widget.id}-${field}`}
              value={value}
              checked={(widget[field] || "") === value}
              onChange={() => patch({ [field]: value })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  const display = widget.display || {};
  const available = (field) => {
    if (field === "meta") return canCompare && !["pie", "donut"].includes(widget.type);
    if (["grid", "table"].includes(widget.type)) return false;
    if (field === "grid") return ["bar", "line", "area"].includes(widget.type);
    return true;
  };
  return (
    <>
      <p className="bi-choice-help">
        Monte sua análise escolhendo as caixinhas abaixo. As mudanças aparecem
        no gráfico e ficam no perfil ao salvar.
      </p>
      {choices("1. De onde vêm os dados?", "source", {
        "": "Peças e serviços",
        pieces: "Só peças",
        services: "Só serviços",
      })}
      {choices("2. O que você quer medir?", "metric", {
        value: "Receita líquida (R$)",
        quantity: "Quantidade de peças",
        records: "Número de registros",
      })}
      {widget.metric === "quantity" && (
        <p className="bi-choice-help">
          Serviços não têm quantidade de peças. Registros sem quantidade
          informada não são contados.
        </p>
      )}
      {choices("3. Como agrupar?", "dimension", dims)}
      {choices("4. Qual formato?", "type", types)}
      <fieldset className="bi-choice-section">
        <legend>5. O que aparece no gráfico?</legend>
        <div className="bi-choice-grid">
          {Object.entries({
            legend: "Legenda",
            grid: "Linhas de referência",
            tooltip: "Detalhes ao passar o mouse",
            values: "Lista de valores",
            meta: "Comparar com metas",
          }).map(([field, label]) => (
            <label
              key={field}
              className="bi-choice"
              data-selected={available(field) && display[field] !== false}
            >
              <input
                type="checkbox"
                checked={available(field) && display[field] !== false}
                disabled={!available(field)}
                onChange={(e) =>
                  patch({ display: { ...display, [field]: e.target.checked } })
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {!canCompare && (
          <p className="bi-choice-help">
            Metas estão disponíveis para receita por pessoa, sem recorte de
            loja, fonte ou região.
          </p>
        )}
      </fieldset>
    </>
  );
}
