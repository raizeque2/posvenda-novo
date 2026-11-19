import test from "node:test";
import assert from "node:assert/strict";
import {
  gridSpan,
  packWidgets,
  resizedWidget,
  passoTamanho,
  ajustarLargura,
  ajustarAltura,
} from "../src/bi/widgetLayout.js";
import { kpiInsights } from "../src/bi/kpiInsights.js";
import { territoryGroups, matchMunicipality } from "../src/bi/territory.js";
import { matchesTerritory } from "../src/bi/model.js";
import { readFileSync } from "node:fs";

test("Redimensionamento encaixa em ⅓, ½, ⅔ ou inteiro e em 3 alturas, nunca espreme", () => {
  assert.deepEqual(resizedWidget(500, 340, 10000, 10000, 70, 12), {
    width: 12,
    height: 560,
  });
  assert.deepEqual(resizedWidget(500, 340, -10000, -10000, 70, 12), {
    width: 4,
    height: 300,
  });
  assert.equal(resizedWidget(500, 340, 0, 0, 70, 12).width, 6);
  assert.equal(gridSpan({ width: 8, height: 300 }, 1).w, 1);
});
test("Setas mudam um degrau de tamanho", () => {
  assert.deepEqual(passoTamanho({ width: 6, height: 400 }, "ArrowRight"), { width: 8, height: 400 });
  assert.deepEqual(passoTamanho({ width: 4, height: 300 }, "ArrowLeft"), { width: 4, height: 300 });
  assert.deepEqual(passoTamanho({ width: 5, height: 314 }, "ArrowDown"), { width: 4, height: 400 });
  assert.equal(ajustarLargura(2), 4);
  assert.equal(ajustarAltura(1000), 560);
});
test("A altura da linha do grid decide quantas linhas o bloco ocupa", () => {
  // Linha de 20 px + 18 px de espaço: 320 px de bloco cabem em 9 linhas.
  assert.equal(gridSpan({ width: 6, height: 320 }, 12, 38, 18).h, 9);
  // Grid com linhas de 100 px: as mesmas 320 px ocupam 4 linhas, não 9 —
  // era essa conta fixa em 38 px que deixava um vão embaixo do widget.
  assert.equal(gridSpan({ width: 6, height: 320 }, 12, 100, 18).h, 4);
  assert.equal(packWidgets([{ id: "a", width: 12, height: 320 }], 12, 100, 18)[0].h, 4);
});
test("Localidades homônimas são separadas e os filtros cruzam cidade, UF e bairro", () => {
  const rows = [
    {
      city: "Recife",
      uf: "PE",
      neighborhood: "Centro",
      value: 120,
      channel: "WEB",
    },
    {
      city: "Arapiraca",
      uf: "AL",
      neighborhood: "Centro",
      value: 70,
      channel: "SERVIÇOS",
    },
  ];
  assert.equal(territoryGroups(rows, "neighborhood").length, 2);
  assert.equal(
    matchesTerritory(rows[0], {
      level: "neighborhood",
      name: "Centro",
      city: "Arapiraca",
      uf: "AL",
    }),
    false,
  );
  assert.equal(
    matchesTerritory(rows[1], {
      level: "neighborhood",
      name: "Centro",
      city: "Arapiraca",
      uf: "AL",
    }),
    true,
  );
  assert.equal(
    matchesTerritory(
      { ...rows[1], uf: "" },
      { level: "city", name: "Arapiraca", uf: "AL" },
    ),
    false,
  );
  assert.equal(
    matchMunicipality({ city: "Bom Jardim", uf: "" }, [
      ["Bom Jardim", "PE", 1],
      ["Bom Jardim", "RJ", 2],
    ]),
    null,
  );
});
test("Mapa incluído reconhece as cidades demonstrativas com código IBGE correto", () => {
  const index = JSON.parse(
    readFileSync(
      new URL("../public/maps/municipios-index.json", import.meta.url),
    ),
  );
  assert.deepEqual(matchMunicipality({ city: "arapiraca", uf: "AL" }, index), [
    "Arapiraca",
    "AL",
    2700300,
  ]);
  assert.deepEqual(matchMunicipality({ city: "RECIFE", uf: "PE" }, index), [
    "Recife",
    "PE",
    2611606,
  ]);
  const pe = JSON.parse(
    readFileSync(new URL("../public/maps/PE.json", import.meta.url)),
  );
  assert.ok(
    pe.features.some(
      (f) => f.properties.id === 2611606 && f.geometry.coordinates.length,
    ),
  );
});
test("Comparativos usam receita líquida, períodos equivalentes e não inventam histórico", () => {
  const row = (date, value, channel = "VAREJO") => ({
    date,
    value,
    channel,
    quantity: 2,
  });
  assert.deepEqual(kpiInsights([row("2026-10-08", 100)], [], "VAREJO"), []);
  assert.deepEqual(
    kpiInsights(
      [row("2026-10-08", 100)],
      [row("2026-09-01", 500, "WEB")],
      "VAREJO",
    ),
    [],
  );
  const history = [
    row("2026-09-01", 1),
    row("2026-09-08", 100),
    row("2026-10-01", 30),
    row("2026-10-07", 50),
  ];
  const result = kpiInsights(
    [
      row("2026-10-08", 120),
      row("2026-10-08", -20),
      row("2026-10-08", 9999, "WEB"),
    ],
    history,
    "VAREJO",
  );
  assert.equal(result[0].difference, 50);
  assert.equal(result[0].percent, 100);
  assert.ok(result.every((item) => !item.label.includes("horário")));
  assert.equal(
    result.find((item) => item.label.startsWith("no mês")).difference,
    79,
  );
  assert.ok(!result.some((item) => item.label.startsWith("nos últimos 7")));
});
test("Comparativo regional não inclui vendas ou histórico de outra cidade", () => {
  const filter = { level: "city", name: "Arapiraca", uf: "AL" };
  const rows = [
    {
      city: "Arapiraca",
      uf: "AL",
      date: "2026-10-08",
      value: 120,
      channel: "VAREJO",
    },
    {
      city: "Recife",
      uf: "PE",
      date: "2026-10-08",
      value: 2000,
      channel: "VAREJO",
    },
  ];
  const history = [
    {
      city: "Arapiraca",
      uf: "AL",
      date: "2026-10-07",
      value: 100,
      channel: "VAREJO",
    },
    {
      city: "Recife",
      uf: "PE",
      date: "2026-10-07",
      value: 3000,
      channel: "VAREJO",
    },
  ];
  const result = kpiInsights(
    rows.filter((row) => matchesTerritory(row, filter)),
    history.filter((row) => matchesTerritory(row, filter)),
    "VAREJO",
  );
  assert.equal(result[0].difference, 20);
  assert.equal(result[0].percent, 20);
});
test("Blocos com tamanhos diferentes mantêm dimensões e não se sobrepõem", () => {
  const items = [
    { id: "a", width: 8, height: 400 },
    { id: "b", width: 4, height: 300 },
    { id: "c", width: 5, height: 600 },
    { id: "d", width: 12, height: 260 },
  ];
  for (const columns of [1, 4, 12]) {
    const placements = packWidgets(items, columns),
      cells = new Set();
    assert.equal(placements.length, items.length);
    for (const p of placements) {
      assert.equal(
        p.w,
        gridSpan(
          items.find((i) => i.id === p.id),
          columns,
        ).w,
      );
      assert.ok(p.col + p.w <= columns);
      for (let y = p.row; y < p.row + p.h; y++)
        for (let x = p.col; x < p.col + p.w; x++) {
          const key = `${x}:${y}`;
          assert.ok(!cells.has(key));
          cells.add(key);
        }
    }
  }
});
