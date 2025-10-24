// simulador.js — Parte 1/5
document.addEventListener('DOMContentLoaded', () => {
  // ===== Refs UI =====
  const groupsGrid   = document.getElementById('groupsGrid');
  const btnGenerate  = document.getElementById('btnGenerate');
  const btnClear     = document.getElementById('btnClear');

  const btnToggleBet = document.getElementById('btnToggleBet');
  const betPanel     = document.getElementById('betPanel');
  const betClose     = document.getElementById('betClose');
  const betGroupSel  = document.getElementById('betGroup');
  const betTeamSel   = document.getElementById('betTeam');
  const betGemsInp   = document.getElementById('betGems');
  const betSubmitBtn = document.getElementById('betSubmit');

  const resultsCard  = document.getElementById('resultsCard');
  const resultsBody  = document.getElementById('resultsBody');
  const resultsHint  = document.getElementById('resultsHint');

  const simOverlay   = document.getElementById('simOverlay');

  // --- Bracket / llaves ---
  const bracketCard   = document.getElementById('bracketCard');
  const bracketGrid   = document.getElementById('bracketGrid');
  const btnBuildBrkt  = document.getElementById('btnBuildBracket');
  const btnSimBrkt    = document.getElementById('btnSimBracket');
  const championBox   = document.getElementById('championBox');
  const championName  = document.getElementById('championName');

  // ===== Config =====
  const GROUPS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)); // A..L
  const TEAMS_PER_GROUP = 4;

  // 48 equipos “dummy” (puedes reemplazar por lista real)
  const baseTeams = Array.from({ length: 48 }, (_, i) => `Equipo ${String(i + 1).padStart(2, '0')}`);

  // ===== Estado =====
  const state = {
    teamsByGroup: {},       // { A: ['Equipo 01', ...], ... }
    bet: null,              // { group, team, gems }
    generated: false,
    bracket: { r32: [], r16: [], qf: [], sf: [], final: [], champion: null }
  };

    // simulador.js — Parte 2/5

  // Render inicial: tarjetas de grupos vacías
  function renderEmptyGroups() {
    groupsGrid.innerHTML = '';
    GROUPS.forEach(letter => {
      const card = document.createElement('article');
      card.className = 'group-card';
      card.innerHTML = `
        <header class="group-head">
          <div class="group-title">Grupo ${letter}</div>
          <span class="group-badge">${TEAMS_PER_GROUP} equipos</span>
        </header>
        <table class="group-table">
          <thead><tr><th style="width:50px;">#</th><th>Equipo</th></tr></thead>
          <tbody>
            ${Array.from({ length: TEAMS_PER_GROUP }, (_, i) => `
              <tr><td>${i + 1}</td><td class="empty">—</td></tr>
            `).join('')}
          </tbody>
        </table>
      `;
      groupsGrid.appendChild(card);
    });

    state.generated = false;
    state.teamsByGroup = {};
    resultsCard.hidden = true;
    bracketCard.hidden = true;
    btnSimBrkt.disabled = true;

    // reset apuestas
    fillBetGroups();
    betTeamSel.innerHTML = `<option value="">— Selecciona grupo primero —</option>`;
    betTeamSel.disabled = true;
  }

  // Fisher–Yates shuffle
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Llenar grupos con nombres
  function fillGroupsWithTeams(teams) {
    const t = teams.slice(0, GROUPS.length * TEAMS_PER_GROUP); // 48
    const shuffled = shuffle(t);
    state.teamsByGroup = {};
    let idx = 0;

    const cards = groupsGrid.querySelectorAll('.group-card');
    cards.forEach((card, gIdx) => {
      const letter = GROUPS[gIdx];
      const rows   = card.querySelectorAll('tbody tr');
      state.teamsByGroup[letter] = [];

      rows.forEach(row => {
        const name = shuffled[idx++] || '—';
        const cell = row.children[1];
        cell.classList.remove('empty');
        cell.textContent = name;
        state.teamsByGroup[letter].push(name);
      });
    });

    state.generated = true;
    fillBetGroups();
    if (betGroupSel.value) populateBetTeams(betGroupSel.value);
  }

    // simulador.js — Parte 3/5

  // Apuestas: poblar selects
  function fillBetGroups() {
    betGroupSel.innerHTML = GROUPS.map(g => `<option value="${g}">${g}</option>`).join('');
  }
  function populateBetTeams(groupLetter) {
    const teams = state.teamsByGroup[groupLetter] || [];
    if (!teams.length) {
      betTeamSel.innerHTML = `<option value="">— Aún no hay equipos generados —</option>`;
      betTeamSel.disabled = true;
      return;
    }
    betTeamSel.innerHTML = teams.map(t => `<option value="${t}">${t}</option>`).join('');
    betTeamSel.disabled = false;
  }

  // Clasificados (top-2 por grupo)
  function getQualifiers() {
    const out = {};
    GROUPS.forEach(g => {
      const list = state.teamsByGroup[g] || [];
      out[g] = list.slice(0, 2);
    });
    return out;
  }

  // Pintar clasificados y habilitar sección de llaves
  function renderResults(qualifiers, bet) {
    resultsBody.innerHTML = '';
    GROUPS.forEach(g => {
      const card = document.createElement('div');
      card.className = 'result-card';
      const q = qualifiers[g] || [];
      card.innerHTML = `
        <h4>Grupo ${g}</h4>
        <ol class="result-list">
          ${q.map(t => {
            let cls = '';
            if (bet && bet.group === g && bet.team === t) cls = 'win';
            return `<li class="${cls}">${t}</li>`;
          }).join('')}
        </ol>
      `;
      resultsBody.appendChild(card);
    });

    // mensaje de apuesta
    if (bet) {
      const passed = (qualifiers[bet.group] || []).includes(bet.team);
      resultsHint.textContent = passed
        ? `Tu apuesta: ${bet.team} (${bet.group}) clasificó ✔ — Apuesta: ${bet.gems} 💎`
        : `Tu apuesta: ${bet.team} (${bet.group}) NO clasificó ✖ — Apuesta: ${bet.gems} 💎`;
    } else {
      resultsHint.textContent = '';
    }

    resultsCard.hidden = false;
    // mostrar tarjeta de llaves
    bracketCard.hidden = false;
    btnSimBrkt.disabled = true; // hasta construir emparejamientos
  }

  // Overlay helpers
  function showOverlay() { simOverlay.hidden = false; }
  function hideOverlay() { simOverlay.hidden = true; }

    // simulador.js — Parte 4/5

  // Construir listado de 32 equipos:
  // 24 (top-2 por grupo) + 8 terceros aleatorios
  function buildTop32() {
    const top2 = [];
    const thirds = [];
    GROUPS.forEach(g => {
      const list = state.teamsByGroup[g] || [];
      if (list.length >= 2) {
        top2.push(list[0], list[1]);      // 24
        if (list[2]) thirds.push(list[2]); // 12 posibles
      }
    });
    const best8thirds = shuffle(thirds).slice(0, 8);
    return shuffle(top2.concat(best8thirds)); // barajar para emparejar
  }

  // Emparejar 2 en 2
  function pairTeams(list){
    const pairs = [];
    for (let i = 0; i < list.length; i += 2) {
      pairs.push([ list[i] || '—', list[i+1] || '—' ]);
    }
    return pairs;
  }

  // Simular ronda (ganador random)
  function simulateRound(pairs){
    return pairs.map(([a,b]) => (Math.random() < 0.5 ? a : b));
  }

  // Pintar una columna de ronda
  function renderRoundColumn(title, pairs, winners = []){
    const col = document.createElement('div');
    col.className = 'round-col';
    col.innerHTML = `<h4>${title}</h4>`;
    pairs.forEach((p, idx) => {
      const [a,b] = p;
      const w = winners[idx];
      const m = document.createElement('div');
      m.className = 'match';
      m.innerHTML = `
        <div class="team ${w === a ? 'winner' : (w ? 'loser' : '')}">${a}</div>
        <div class="team ${w === b ? 'winner' : (w ? 'loser' : '')}">${b}</div>
      `;
      col.appendChild(m);
    });
    bracketGrid.appendChild(col);
  }

  // Construir llaves (solo emparejamientos R32)
  function buildBracket() {
    const teams32 = buildTop32();
    state.bracket.r32 = pairTeams(teams32);
    state.bracket.r16 = [];
    state.bracket.qf  = [];
    state.bracket.sf  = [];
    state.bracket.final = [];
    state.bracket.champion = null;

    bracketGrid.innerHTML = '';
    renderRoundColumn('Ronda de 32', state.bracket.r32);
    renderRoundColumn('Octavos', []);
    renderRoundColumn('Cuartos', []);
    renderRoundColumn('Semifinales', []);
    renderRoundColumn('Final', []);
    renderRoundColumn('Campeón', []);
    btnSimBrkt.disabled = false;
    championBox.hidden = true;
  }

  // Simular todas las rondas y pintar
  function simulateBracket() {
    const r16winners  = simulateRound(state.bracket.r32);
    state.bracket.r16 = pairTeams(r16winners);

    const qfwinners   = simulateRound(state.bracket.r16);
    state.bracket.qf  = pairTeams(qfwinners);

    const sfwinners   = simulateRound(state.bracket.qf);
    state.bracket.sf  = pairTeams(sfwinners);

    const finalWins   = simulateRound(state.bracket.sf);
    state.bracket.final = pairTeams(finalWins);

    const champArr    = simulateRound(state.bracket.final);
    state.bracket.champion = champArr[0];

    // re-render completo con winners marcados
    bracketGrid.innerHTML = '';
    renderRoundColumn('Ronda de 32', state.bracket.r32, r16winners);
    renderRoundColumn('Octavos',     state.bracket.r16, qfwinners);
    renderRoundColumn('Cuartos',     state.bracket.qf,  sfwinners);
    renderRoundColumn('Semifinales', state.bracket.sf,  finalWins);
    renderRoundColumn('Final',       state.bracket.final, champArr);

    const champCol = document.createElement('div');
    champCol.className = 'round-col';
    champCol.innerHTML = `<h4>Campeón</h4>
      <div class="match"><div class="team winner">${state.bracket.champion}</div></div>`;
    bracketGrid.appendChild(champCol);

    championName.textContent = state.bracket.champion;
    championBox.hidden = false;
  }

    // simulador.js — Parte 5/5

  // Botones principales
  btnGenerate.addEventListener('click', () => {
    fillGroupsWithTeams(baseTeams);
  });

  btnClear.addEventListener('click', () => {
    renderEmptyGroups();
  });

  // Apuestas: abrir/cerrar + selects
  btnToggleBet.addEventListener('click', () => { betPanel.hidden = false; });
  betClose.addEventListener('click', () => { betPanel.hidden = true; });

  betGroupSel.addEventListener('change', (e) => {
    populateBetTeams(e.target.value);
  });

  betSubmitBtn.addEventListener('click', () => {
    if (!state.generated) {
      alert('Primero genera el torneo (fase de grupos).');
      return;
    }
    const group = betGroupSel.value;
    const team  = betTeamSel.value;
    const gems  = parseInt(betGemsInp.value, 10);

    if (!group) return alert('Selecciona un grupo.');
    if (!team)  return alert('Selecciona un equipo.');
    if (!(gems > 0)) return alert('Ingresa la cantidad de gemas.');

    state.bet = { group, team, gems };
    localStorage.setItem('sim_last_bet', JSON.stringify(state.bet));

    betPanel.hidden = true;
    showOverlay();
    setTimeout(() => {
      hideOverlay();
      const qualifiers = getQualifiers();
      renderResults(qualifiers, state.bet);
      resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 900);
  });

  // Bracket
  btnBuildBrkt.addEventListener('click', () => {
    if (!state.generated) return alert('Primero genera la fase de grupos.');
    buildBracket();
  });

  btnSimBrkt.addEventListener('click', () => {
    showOverlay();
    setTimeout(() => {
      hideOverlay();
      simulateBracket();
      bracketCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 700);
  });

  // Restaurar última apuesta (solo gems por conveniencia)
  try {
    const last = JSON.parse(localStorage.getItem('sim_last_bet') || 'null');
    if (last) { state.bet = last; betGemsInp.value = last.gems || ''; }
  } catch {}

  // Render inicial
  renderEmptyGroups();
}); // <-- DOMContentLoaded
