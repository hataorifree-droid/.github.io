/* ==========================================
   tab譜つくる君 - テキストTAB譜エディタ
   ========================================== */

(function () {
  'use strict';

  // ===== Constants =====
  const GUITAR_STRINGS = ['e', 'B', 'G', 'D', 'A', 'E'];
  const BASS_STRINGS = ['G', 'D', 'A', 'E'];
  const VALID_CHARS = '0123456789SsHhPpXx/\\~^';
  const CELL_EMPTY = '-';

  const HALF_TO_FULL = {
    '0': '０', '1': '１', '2': '２', '3': '３', '4': '４',
    '5': '５', '6': '６', '7': '７', '8': '８', '9': '９',
    '-': '−', 'S': 'Ｓ', 's': 'ｓ', 'H': 'Ｈ', 'h': 'ｈ',
    'P': 'Ｐ', 'p': 'ｐ', 'X': 'Ｘ', 'x': 'ｘ',
    '/': '／', '\\': '＼', '~': '〜', '^': '＾'
  };

  // ===== State =====
  let project = createNewProject();
  let cursor = null; // { sys, str, beat }

  // Digit input buffer for 2-digit fret numbers
  let digitBuffer = '';
  let digitTimer = null;
  const DIGIT_TIMEOUT = 500; // ms to wait for second digit

  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);

  function getStringLabels() {
    return project.instrument === 'guitar' ? GUITAR_STRINGS : BASS_STRINGS;
  }

  function getStringCount() {
    return project.instrument === 'guitar' ? 6 : 4;
  }

  // ===== Project Data Model =====
  function createNewProject() {
    return {
      title: '',
      artist: '',
      tempo: '',
      instrument: 'bass',
      beatsPerMeasure: 8,
      defaultMeasures: 4,
      showSection: true,
      showChord: true,
      showLyrics: true,
      systems: [createSystem(4, 'bass', 8)]
    };
  }

  function createSystem(measures, instrument, beatsPerMeasure) {
    const stringCount = instrument === 'guitar' ? 6 : 4;
    const totalBeats = measures * beatsPerMeasure;
    return {
      section: '',
      chords: Array(measures).fill(''),
      lyrics: Array(measures).fill(''),
      measures: measures,
      grid: Array.from({ length: stringCount }, () =>
        Array(totalBeats).fill(CELL_EMPTY)
      )
    };
  }

  // ===== Rendering =====
  function render() {
    const editor = $('editor-area');
    editor.innerHTML = '';

    project.systems.forEach((system, sysIndex) => {
      editor.appendChild(renderSystem(system, sysIndex));
    });

    updateStatusBar();
  }

  function renderSystem(system, sysIndex) {
    const container = document.createElement('div');
    container.className = 'system';
    container.dataset.systemIndex = sysIndex;

    // System header bar
    const header = document.createElement('div');
    header.className = 'system-header';

    const sysNum = document.createElement('span');
    sysNum.className = 'system-number';
    sysNum.textContent = `段 ${sysIndex + 1}`;
    header.appendChild(sysNum);

    const actions = document.createElement('div');
    actions.className = 'system-actions';

    // Move up/down buttons
    if (project.systems.length > 1) {
      if (sysIndex > 0) {
        const upBtn = createSysBtn('↑', 'move-up', sysIndex, 'この段を上に移動');
        upBtn.classList.add('move-btn');
        actions.appendChild(upBtn);
      }
      if (sysIndex < project.systems.length - 1) {
        const downBtn = createSysBtn('↓', 'move-down', sysIndex, 'この段を下に移動');
        downBtn.classList.add('move-btn');
        actions.appendChild(downBtn);
      }
    }

    actions.appendChild(createSysBtn('+小節', 'add-measure', sysIndex, '小節を追加'));
    if (system.measures > 1) {
      actions.appendChild(createSysBtn('-小節', 'remove-measure', sysIndex, '末尾の小節を削除'));
    }
    if (project.systems.length > 1) {
      const delBtn = createSysBtn('×', 'delete-system', sysIndex, 'この段を削除');
      delBtn.classList.add('danger');
      actions.appendChild(delBtn);
    }

    header.appendChild(actions);
    container.appendChild(header);

    // Section row
    if (project.showSection) {
      const sectionRow = document.createElement('div');
      sectionRow.className = 'header-row section-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'section-input';
      input.placeholder = 'セクション名 (例: Intro, Verse, サビ...)';
      input.value = system.section;
      input.dataset.systemIndex = sysIndex;
      input.addEventListener('input', (e) => {
        project.systems[sysIndex].section = e.target.value;
      });
      sectionRow.appendChild(input);
      container.appendChild(sectionRow);
    }

    // Chord row
    if (project.showChord) {
      container.appendChild(
        renderHeaderInputRow(system, sysIndex, 'chord', 'コード', 'chord-input')
      );
    }

    // Lyrics row
    if (project.showLyrics) {
      container.appendChild(
        renderHeaderInputRow(system, sysIndex, 'lyrics', '歌詞', 'lyrics-input')
      );
    }

    // Tab grid
    const grid = document.createElement('div');
    grid.className = 'tab-grid';

    const labels = getStringLabels();
    const stringCount = getStringCount();

    for (let s = 0; s < stringCount; s++) {
      const row = document.createElement('div');
      row.className = 'tab-row';

      // String label
      const label = document.createElement('span');
      label.className = 'string-label';
      label.textContent = labels[s];
      row.appendChild(label);

      // Start border
      const startBorder = document.createElement('span');
      startBorder.className = 'border-marker';
      startBorder.textContent = '||';
      row.appendChild(startBorder);

      // Beat cells with measure separators
      const totalBeats = system.measures * project.beatsPerMeasure;
      for (let b = 0; b < totalBeats; b++) {
        // Measure separator
        if (b > 0 && b % project.beatsPerMeasure === 0) {
          const sep = document.createElement('span');
          sep.className = 'measure-sep';
          sep.textContent = '|';
          row.appendChild(sep);
        }

        const cell = document.createElement('span');
        cell.className = 'cell';
        cell.dataset.system = sysIndex;
        cell.dataset.string = s;
        cell.dataset.beat = b;

        const value = system.grid[s][b];
        cell.textContent = value;

        if (value !== CELL_EMPTY) {
          cell.classList.add('has-value');
          if (value.length > 1) {
            cell.classList.add('wide-value');
          }
        }

        // Alternating measure background
        const measureIndex = Math.floor(b / project.beatsPerMeasure);
        if (measureIndex % 2 === 1) {
          cell.classList.add('measure-alt');
        }

        // Active cell highlight
        if (cursor && cursor.sys === sysIndex && cursor.str === s && cursor.beat === b) {
          cell.classList.add('active');
        }

        row.appendChild(cell);
      }

      // End border
      const endBorder = document.createElement('span');
      endBorder.className = 'border-marker';
      endBorder.textContent = '||';
      row.appendChild(endBorder);

      grid.appendChild(row);
    }

    container.appendChild(grid);
    return container;
  }

  function renderHeaderInputRow(system, sysIndex, type, placeholder, inputClass) {
    const row = document.createElement('div');
    row.className = `header-row ${type}-row`;

    const label = document.createElement('span');
    label.className = 'row-label';
    label.textContent = '';
    row.appendChild(label);

    const spacer = document.createElement('span');
    spacer.className = 'row-spacer';
    row.appendChild(spacer);

    const dataArray = type === 'chord' ? system.chords : system.lyrics;

    for (let m = 0; m < system.measures; m++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = inputClass;
      input.placeholder = placeholder;
      input.value = dataArray[m] || '';
      input.style.width = `calc(${project.beatsPerMeasure} * var(--cell-size))`;
      input.dataset.systemIndex = sysIndex;
      input.dataset.measure = m;

      const measureIdx = m; // capture for closure
      input.addEventListener('input', (e) => {
        if (type === 'chord') {
          project.systems[sysIndex].chords[measureIdx] = e.target.value;
        } else {
          project.systems[sysIndex].lyrics[measureIdx] = e.target.value;
        }
      });

      row.appendChild(input);

      if (m < system.measures - 1) {
        const sep = document.createElement('span');
        sep.className = 'header-sep';
        sep.textContent = ' ';
        row.appendChild(sep);
      }
    }

    return row;
  }

  function createSysBtn(text, action, sysIndex, title) {
    const btn = document.createElement('button');
    btn.className = 'sys-btn';
    btn.textContent = text;
    btn.dataset.action = action;
    btn.dataset.system = sysIndex;
    btn.title = title;
    return btn;
  }

  // ===== Cursor & Navigation =====
  function selectCell(sys, str, beat) {
    // Remove previous active
    const prevActive = document.querySelector('.cell.active');
    if (prevActive) prevActive.classList.remove('active');

    cursor = { sys, str, beat };

    // Find and highlight new cell
    const cell = document.querySelector(
      `.cell[data-system="${sys}"][data-string="${str}"][data-beat="${beat}"]`
    );
    if (cell) {
      cell.classList.add('active');
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }

    updateStatusBar();
  }

  function clearCursor() {
    const prevActive = document.querySelector('.cell.active');
    if (prevActive) prevActive.classList.remove('active');
    cursor = null;
    updateStatusBar();
  }

  function moveCursor(dx, dy) {
    if (!cursor) {
      // If no cursor, select first cell
      selectCell(0, 0, 0);
      return;
    }

    let { sys, str, beat } = cursor;
    const stringCount = getStringCount();

    // Vertical movement
    str += dy;
    if (str < 0) str = 0;
    if (str >= stringCount) str = stringCount - 1;

    // Horizontal movement
    const system = project.systems[sys];
    const totalBeats = system.measures * project.beatsPerMeasure;
    beat += dx;

    if (beat < 0) {
      // Move to previous system
      if (sys > 0) {
        sys--;
        const prevSystem = project.systems[sys];
        beat = prevSystem.measures * project.beatsPerMeasure - 1;
      } else {
        beat = 0;
      }
    } else if (beat >= totalBeats) {
      // Move to next system
      if (sys < project.systems.length - 1) {
        sys++;
        beat = 0;
      } else {
        beat = totalBeats - 1;
      }
    }

    // Clamp string if systems have different string counts (shouldn't happen but safe)
    const targetStringCount = getStringCount();
    if (str >= targetStringCount) str = targetStringCount - 1;

    selectCell(sys, str, beat);
  }

  function setCellValue(value) {
    if (!cursor) return;
    const { sys, str, beat } = cursor;
    project.systems[sys].grid[str][beat] = value;

    // Update DOM cell directly
    const cell = document.querySelector(
      `.cell[data-system="${sys}"][data-string="${str}"][data-beat="${beat}"]`
    );
    if (cell) {
      cell.textContent = value;
      if (value !== CELL_EMPTY) {
        cell.classList.add('has-value');
        // Add wide class for 2-digit values
        cell.classList.toggle('wide-value', value.length > 1);
      } else {
        cell.classList.remove('has-value');
        cell.classList.remove('wide-value');
      }
    }
  }

  // Flush the digit buffer: commit current digit(s) and advance cursor
  function flushDigitBuffer() {
    if (digitBuffer && cursor) {
      setCellValue(digitBuffer);
      digitBuffer = '';
      moveCursor(1, 0);
    }
    digitTimer = null;
  }

  // Cancel any pending digit input
  function cancelDigitBuffer() {
    if (digitTimer) {
      clearTimeout(digitTimer);
      digitTimer = null;
    }
    digitBuffer = '';
  }

  function updateStatusBar() {
    const statusEl = $('status-cursor');
    if (!cursor) {
      statusEl.textContent = 'カーソル: ---';
      return;
    }
    const labels = getStringLabels();
    const measureNum = Math.floor(cursor.beat / project.beatsPerMeasure) + 1;
    const beatInMeasure = (cursor.beat % project.beatsPerMeasure) + 1;
    statusEl.textContent =
      `カーソル: 段${cursor.sys + 1} / ${labels[cursor.str]}弦 / 小節${measureNum} 拍${beatInMeasure}`;
  }

  // ===== Input Handling =====
  function handleKeyDown(e) {
    // Skip if typing in an input or textarea
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return;
    }

    // Arrow key navigation
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        flushDigitBuffer();
        moveCursor(-1, 0);
        return;
      case 'ArrowRight':
        e.preventDefault();
        flushDigitBuffer();
        moveCursor(1, 0);
        return;
      case 'ArrowUp':
        e.preventDefault();
        flushDigitBuffer();
        moveCursor(0, -1);
        return;
      case 'ArrowDown':
        e.preventDefault();
        flushDigitBuffer();
        moveCursor(0, 1);
        return;
    }

    // Tab: move right/left
    if (e.key === 'Tab') {
      e.preventDefault();
      flushDigitBuffer();
      moveCursor(e.shiftKey ? -1 : 1, 0);
      return;
    }

    // Enter: move down
    if (e.key === 'Enter') {
      e.preventDefault();
      flushDigitBuffer();
      moveCursor(0, 1);
      return;
    }

    // Delete / Backspace: clear cell
    if (e.key === 'Delete') {
      e.preventDefault();
      cancelDigitBuffer();
      if (cursor) setCellValue(CELL_EMPTY);
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      cancelDigitBuffer();
      if (cursor) {
        setCellValue(CELL_EMPTY);
        moveCursor(-1, 0);
      }
      return;
    }

    // Escape: deselect
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelDigitBuffer();
      clearCursor();
      return;
    }

    // Space: insert dash and advance
    if (e.key === ' ') {
      e.preventDefault();
      cancelDigitBuffer();
      if (cursor) {
        setCellValue(CELL_EMPTY);
        moveCursor(1, 0);
      }
      return;
    }

    // Character input
    if (cursor && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Digit input: support 2-digit fret numbers (e.g. 12, 14, 24)
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();

        if (digitBuffer.length === 0) {
          // First digit: store in buffer and show immediately
          digitBuffer = e.key;
          setCellValue(digitBuffer);

          // Start timer - if no second digit comes, commit and advance
          digitTimer = setTimeout(() => {
            flushDigitBuffer();
          }, DIGIT_TIMEOUT);
        } else if (digitBuffer.length === 1) {
          // Second digit: combine and commit immediately
          clearTimeout(digitTimer);
          digitTimer = null;
          digitBuffer += e.key;

          // Validate: fret numbers 0-24 are typical
          const fretNum = parseInt(digitBuffer, 10);
          if (fretNum <= 24) {
            setCellValue(digitBuffer);
          } else {
            // If > 24, treat as separate: commit first digit, then set second
            setCellValue(digitBuffer.charAt(0));
            moveCursor(1, 0);
            digitBuffer = e.key;
            setCellValue(digitBuffer);
            digitTimer = setTimeout(() => {
              flushDigitBuffer();
            }, DIGIT_TIMEOUT);
            return;
          }

          digitBuffer = '';
          moveCursor(1, 0);
        }
        return;
      }

      // Non-digit valid character: flush any pending digit first
      if (VALID_CHARS.includes(e.key) && !(e.key >= '0' && e.key <= '9')) {
        e.preventDefault();
        cancelDigitBuffer();
        setCellValue(e.key);
        moveCursor(1, 0);
      }
    }
  }

  function handleEditorClick(e) {
    // Cell click
    const cell = e.target.closest('.cell');
    if (cell) {
      const sys = parseInt(cell.dataset.system);
      const str = parseInt(cell.dataset.string);
      const beat = parseInt(cell.dataset.beat);
      selectCell(sys, str, beat);
      return;
    }

    // System action button click
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      handleSystemAction(actionBtn);
      return;
    }
  }

  function handleSystemAction(btn) {
    const action = btn.dataset.action;
    const sysIndex = parseInt(btn.dataset.system);

    switch (action) {
      case 'add-measure':
        addMeasureToSystem(sysIndex);
        break;
      case 'remove-measure':
        removeMeasureFromSystem(sysIndex);
        break;
      case 'delete-system':
        deleteSystem(sysIndex);
        break;
      case 'move-up':
        moveSystem(sysIndex, -1);
        break;
      case 'move-down':
        moveSystem(sysIndex, 1);
        break;
    }
  }

  // ===== System Management =====
  function addSystem() {
    const measures = parseInt($('measures-per-system').value) || 4;
    project.systems.push(createSystem(measures, project.instrument, project.beatsPerMeasure));
    render();

    // Scroll to new system
    const editor = $('editor-area');
    setTimeout(() => {
      editor.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  function deleteSystem(sysIndex) {
    if (project.systems.length <= 1) return;

    // Check if system has data
    const system = project.systems[sysIndex];
    const hasData = system.grid.some(row => row.some(v => v !== CELL_EMPTY)) ||
      system.section || system.chords.some(c => c) || system.lyrics.some(l => l);

    if (hasData && !confirm('この段にはデータがあります。削除しますか？')) {
      return;
    }

    project.systems.splice(sysIndex, 1);

    // Adjust cursor
    if (cursor) {
      if (cursor.sys === sysIndex) {
        cursor = null;
      } else if (cursor.sys > sysIndex) {
        cursor.sys--;
      }
    }

    render();
  }

  function addMeasureToSystem(sysIndex) {
    const system = project.systems[sysIndex];
    system.measures++;
    system.chords.push('');
    system.lyrics.push('');
    for (let s = 0; s < system.grid.length; s++) {
      for (let i = 0; i < project.beatsPerMeasure; i++) {
        system.grid[s].push(CELL_EMPTY);
      }
    }
    render();
  }

  function removeMeasureFromSystem(sysIndex) {
    const system = project.systems[sysIndex];
    if (system.measures <= 1) return;

    system.measures--;
    system.chords.pop();
    system.lyrics.pop();
    for (let s = 0; s < system.grid.length; s++) {
      system.grid[s].splice(-project.beatsPerMeasure);
    }

    // Adjust cursor
    if (cursor && cursor.sys === sysIndex) {
      const totalBeats = system.measures * project.beatsPerMeasure;
      if (cursor.beat >= totalBeats) {
        cursor.beat = totalBeats - 1;
      }
    }

    render();
  }

  function moveSystem(sysIndex, direction) {
    const targetIndex = sysIndex + direction;
    if (targetIndex < 0 || targetIndex >= project.systems.length) return;

    // Swap systems
    [project.systems[sysIndex], project.systems[targetIndex]] =
      [project.systems[targetIndex], project.systems[sysIndex]];

    // Adjust cursor
    if (cursor) {
      if (cursor.sys === sysIndex) {
        cursor.sys = targetIndex;
      } else if (cursor.sys === targetIndex) {
        cursor.sys = sysIndex;
      }
    }

    render();
  }

  // ===== Instrument Switch =====
  function switchInstrument(instrument) {
    if (instrument === project.instrument) return;

    const hasData = project.systems.some(sys =>
      sys.grid.some(row => row.some(v => v !== CELL_EMPTY))
    );

    if (hasData && !confirm('楽器を切り替えると、譜面データがリセットされます。\nセクション名・コード・歌詞は保持されます。よろしいですか？')) {
      // Reset button state
      updateInstrumentButtons();
      return;
    }

    const oldSystems = project.systems;
    project.instrument = instrument;

    project.systems = oldSystems.map(sys => {
      const newSys = createSystem(sys.measures, instrument, project.beatsPerMeasure);
      newSys.section = sys.section;
      newSys.chords = [...sys.chords];
      newSys.lyrics = [...sys.lyrics];
      return newSys;
    });

    cursor = null;
    updateInstrumentButtons();
    render();
  }

  function updateInstrumentButtons() {
    document.querySelectorAll('.instrument-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.instrument === project.instrument);
    });
  }

  // ===== Export =====
  // Half-width to full-width mapping for labels
  const LABEL_TO_FULL = {
    'e': 'ｅ', 'B': 'Ｂ', 'G': 'Ｇ', 'D': 'Ｄ', 'A': 'Ａ', 'E': 'Ｅ'
  };

  function generateExport() {
    const showLabels = $('export-labels').checked;
    const labels = getStringLabels();
    const stringCount = getStringCount();

    let output = '';

    // Project metadata
    if (project.title) output += project.title + '\n';
    if (project.artist) output += project.artist + '\n';
    if (project.tempo) output += 'テンポ: ' + project.tempo + ' BPM\n';
    if (output) output += '\n';

    project.systems.forEach((system, sysIndex) => {
      // Section label
      if (project.showSection && system.section) {
        output += system.section + '\n';
      }

      // Prefix: label (1 full-width char) + ‖ (1 full-width char) = 2 full-width chars
      const prefixFullWidthCount = showLabels ? 2 : 1;

      // Chord line (use full-width spaces for alignment)
      if (project.showChord && system.chords.some(c => c)) {
        let chordLine = '\u3000'.repeat(prefixFullWidthCount);
        for (let m = 0; m < system.measures; m++) {
          const chord = system.chords[m] || '';
          let chordPadded = chord;
          while (chordPadded.length < project.beatsPerMeasure) {
            chordPadded += '\u3000';
          }
          chordLine += chordPadded;
          if (m < system.measures - 1) chordLine += '\u3000'; // separator
        }
        output += chordLine.replace(/[\u3000]+$/, '') + '\n';
      }

      // Lyrics line (use full-width spaces for alignment)
      if (project.showLyrics && system.lyrics.some(l => l)) {
        let lyricsLine = '\u3000'.repeat(prefixFullWidthCount);
        for (let m = 0; m < system.measures; m++) {
          const lyric = system.lyrics[m] || '';
          let lyricPadded = lyric;
          while (lyricPadded.length < project.beatsPerMeasure) {
            lyricPadded += '\u3000';
          }
          lyricsLine += lyricPadded;
          if (m < system.measures - 1) lyricsLine += '\u3000';
        }
        output += lyricsLine.replace(/[\u3000]+$/, '') + '\n';
      }

      // Tab lines
      // Strategy: 1-char values → full-width (1 full-width char width)
      //           2-char values (e.g. "12") → half-width (2 half-width ≈ 1 full-width width)
      // This keeps every beat exactly 1 full-width char wide, no padding needed.
      for (let s = 0; s < stringCount; s++) {
        let line = '';

        if (showLabels) {
          line += LABEL_TO_FULL[labels[s]] || labels[s];
        }
        line += '‖';

        for (let m = 0; m < system.measures; m++) {
          for (let b = 0; b < project.beatsPerMeasure; b++) {
            const beatIndex = m * project.beatsPerMeasure + b;
            const value = system.grid[s][beatIndex];

            if (value.length >= 2) {
              // 2-digit fret: keep half-width (2 half-width ≈ 1 full-width)
              line += value;
            } else {
              // Single char: convert to full-width
              line += HALF_TO_FULL[value] || value;
            }
          }
          if (m < system.measures - 1) {
            line += '｜';
          }
        }

        line += '‖';
        output += line + '\n';
      }

      // Blank line between systems
      if (sysIndex < project.systems.length - 1) {
        output += '\n';
      }
    });

    return output;
  }

  // ===== Save / Load =====
  function saveProject() {
    // Sync UI values to project
    syncUIToProject();

    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (project.title || 'tab-project') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('プロジェクトを保存しました');
  }

  function loadProject(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Validate basic structure
        if (!data.systems || !Array.isArray(data.systems)) {
          throw new Error('無効なプロジェクトファイルです');
        }

        project = data;
        cursor = null;

        // Ensure defaults for missing properties
        project.showSection = project.showSection !== false;
        project.showChord = project.showChord !== false;
        project.showLyrics = project.showLyrics !== false;
        project.beatsPerMeasure = project.beatsPerMeasure || 8;
        project.defaultMeasures = project.defaultMeasures || 4;

        syncProjectToUI();
        render();
        showToast('プロジェクトを読み込みました');
      } catch (err) {
        alert('ファイルの読み込みに失敗しました:\n' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function syncUIToProject() {
    project.title = $('project-title').value;
    project.artist = $('project-artist').value;
    project.tempo = $('project-tempo').value;
    project.showSection = $('toggle-section').checked;
    project.showChord = $('toggle-chord').checked;
    project.showLyrics = $('toggle-lyrics').checked;
  }

  function syncProjectToUI() {
    $('project-title').value = project.title || '';
    $('project-artist').value = project.artist || '';
    $('project-tempo').value = project.tempo || '';
    $('toggle-section').checked = project.showSection;
    $('toggle-chord').checked = project.showChord;
    $('toggle-lyrics').checked = project.showLyrics;
    $('beats-per-measure').value = project.beatsPerMeasure;
    $('measures-per-system').value = project.defaultMeasures || 4;
    updateInstrumentButtons();
  }

  // ===== Toast Notification =====
  function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // ===== Beats Per Measure Change =====
  function changeBeatsPerMeasure(newBPM) {
    const oldBPM = project.beatsPerMeasure;
    if (newBPM === oldBPM) return;

    project.beatsPerMeasure = newBPM;

    project.systems.forEach(sys => {
      const newTotalBeats = sys.measures * newBPM;
      for (let s = 0; s < sys.grid.length; s++) {
        const oldRow = sys.grid[s];
        const newRow = [];

        // Rebuild row: for each measure, take min(oldBPM, newBPM) beats from old data
        for (let m = 0; m < sys.measures; m++) {
          for (let b = 0; b < newBPM; b++) {
            const oldIndex = m * oldBPM + b;
            if (b < oldBPM && oldIndex < oldRow.length) {
              newRow.push(oldRow[oldIndex]);
            } else {
              newRow.push(CELL_EMPTY);
            }
          }
        }
        sys.grid[s] = newRow;
      }
    });

    cursor = null;
    render();
  }

  // ===== Initialization =====
  function init() {
    // Project info listeners
    $('project-title').addEventListener('input', (e) => { project.title = e.target.value; });
    $('project-artist').addEventListener('input', (e) => { project.artist = e.target.value; });
    $('project-tempo').addEventListener('input', (e) => { project.tempo = e.target.value; });

    // Toggle listeners
    $('toggle-section').addEventListener('change', (e) => {
      project.showSection = e.target.checked;
      render();
    });
    $('toggle-chord').addEventListener('change', (e) => {
      project.showChord = e.target.checked;
      render();
    });
    $('toggle-lyrics').addEventListener('change', (e) => {
      project.showLyrics = e.target.checked;
      render();
    });

    // Instrument switch
    document.querySelectorAll('.instrument-btn').forEach(btn => {
      btn.addEventListener('click', () => switchInstrument(btn.dataset.instrument));
    });

    // Add system button
    $('btn-add-system').addEventListener('click', addSystem);

    // Default measures setting
    $('measures-per-system').addEventListener('change', (e) => {
      project.defaultMeasures = parseInt(e.target.value) || 4;
    });

    // Beats per measure setting
    $('beats-per-measure').addEventListener('change', (e) => {
      const newBPM = parseInt(e.target.value) || 8;
      changeBeatsPerMeasure(newBPM);
    });

    // Editor click
    $('editor-area').addEventListener('click', handleEditorClick);

    // Keyboard
    document.addEventListener('keydown', handleKeyDown);

    // Export
    $('btn-export').addEventListener('click', () => {
      syncUIToProject();
      $('export-output').value = generateExport();
    });

    $('btn-copy').addEventListener('click', () => {
      const textarea = $('export-output');
      if (!textarea.value) {
        syncUIToProject();
        textarea.value = generateExport();
      }
      textarea.select();
      navigator.clipboard.writeText(textarea.value).then(() => {
        showToast('クリップボードにコピーしました');
      }).catch(() => {
        // Fallback
        document.execCommand('copy');
        showToast('コピーしました');
      });
    });

    // Save / Load
    $('btn-save').addEventListener('click', saveProject);
    $('btn-load').addEventListener('click', () => $('file-input').click());
    $('file-input').addEventListener('change', (e) => {
      if (e.target.files[0]) {
        loadProject(e.target.files[0]);
        e.target.value = '';
      }
    });

    // Click outside editor deselects cell
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.editor-area') && !e.target.closest('.cell')) {
        // Don't deselect if clicking toolbar buttons etc.
        // Only deselect if clicking on truly unrelated areas
      }
    });

    // Initial render
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
