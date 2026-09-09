const CharacterCreatorScreen = (() => {
  const SKIN_TONES = [
    { id: 'tone-1', color: '#F6D2A8' },
    { id: 'tone-2', color: '#D9A066' },
    { id: 'tone-3', color: '#A9673A' },
    { id: 'tone-4', color: '#6B4226' },
    { id: 'tone-5', color: '#3D2314' }
  ];

  const HAIR_OPTIONS = [
    { id: 'afro', emoji: '🙆🏾' , label: 'Afro' },
    { id: 'braids', emoji: '👧🏾', label: 'Braids' },
    { id: 'locs', emoji: '🧑🏾', label: 'Locs' },
    { id: 'twists', emoji: '👦🏾', label: 'Twists' },
    { id: 'short', emoji: '🧒🏾', label: 'Short' }
  ];

  const OUTFIT_OPTIONS = [
    { id: 'explorer', emoji: '🧭', label: 'Explorer' },
    { id: 'scholar', emoji: '📜', label: 'Scholar' },
    { id: 'royal', emoji: '👑', label: 'Royal' },
    { id: 'artist', emoji: '🎨', label: 'Artist' }
  ];

  const ACCESSORY_OPTIONS = [
    { id: 'none', emoji: '➖', label: 'None' },
    { id: 'glasses', emoji: '🕶️', label: 'Glasses' },
    { id: 'beads', emoji: '📿', label: 'Beads' },
    { id: 'headwrap', emoji: '🧕', label: 'Headwrap' }
  ];

  function render(root) {
    const player = GameState.get();
    if (!player.character) player.character = { skinTone: 'tone-3', hair: 'afro', outfit: 'explorer', accessory: 'none' };
    const c = player.character;

    root.innerHTML = `
      <div class="screen">
        <div class="top-bar">
          <button class="back-btn" id="back-btn" aria-label="Back">←</button>
          <h2>Create Your Character</h2>
          <span></span>
        </div>
        <div class="creator-grid">
          <div class="avatar-preview" id="avatar-preview"></div>
          <div>
            <div class="option-group">
              <label for="nickname-input"><h3>Nickname</h3></label>
              <input id="nickname-input" type="text" maxlength="16" placeholder="Explorer name"
                value="${player.nickname || ''}"
                style="width:100%;padding:12px;border-radius:10px;border:2px solid var(--color-cream-dim);font-size:1.1rem;" />
            </div>
            <div class="option-group">
              <h3>Age Level</h3>
              <div class="swatch-row" id="age-row">
                <button class="swatch age-swatch ${player.ageLevel === '5-8' ? 'selected' : ''}" data-value="5-8" style="min-width:110px;font-size:1rem;">Ages 5-8</button>
                <button class="swatch age-swatch ${player.ageLevel === '9-12' ? 'selected' : ''}" data-value="9-12" style="min-width:110px;font-size:1rem;">Ages 9-12</button>
                <button class="swatch age-swatch ${player.ageLevel === '13-17' ? 'selected' : ''}" data-value="13-17" style="min-width:110px;font-size:1rem;">Ages 13-17</button>
              </div>
              <p style="font-size:0.85rem;color:#666;margin-top:6px;">Ages 9-12 unlocks more detailed facts and tougher daily challenges. Ages 13-17 adds critical-thinking prompts and primary-source-style questions.</p>
            </div>
            <div class="option-group">
              <h3>Skin Tone</h3>
              <div class="swatch-row" id="skin-row">
                ${SKIN_TONES.map(t => `
                  <button class="swatch skin-swatch ${c.skinTone === t.id ? 'selected' : ''}"
                    data-value="${t.id}" style="background:${t.color}" aria-label="Skin tone ${t.id}"></button>
                `).join('')}
              </div>
            </div>
            <div class="option-group">
              <h3>Hairstyle</h3>
              <div class="swatch-row" id="hair-row">
                ${HAIR_OPTIONS.map(h => `
                  <button class="swatch ${c.hair === h.id ? 'selected' : ''}" data-value="${h.id}">${h.emoji}</button>
                `).join('')}
              </div>
            </div>
            <div class="option-group">
              <h3>Outfit</h3>
              <div class="swatch-row" id="outfit-row">
                ${OUTFIT_OPTIONS.map(o => `
                  <button class="swatch ${c.outfit === o.id ? 'selected' : ''}" data-value="${o.id}">${o.emoji}</button>
                `).join('')}
              </div>
            </div>
            <div class="option-group">
              <h3>Accessory</h3>
              <div class="swatch-row" id="accessory-row">
                ${ACCESSORY_OPTIONS.map(a => `
                  <button class="swatch ${c.accessory === a.id ? 'selected' : ''}" data-value="${a.id}">${a.emoji}</button>
                `).join('')}
              </div>
            </div>
            <button class="btn-primary btn-large-tap" id="save-btn" style="width:100%;margin-top:var(--space-2);">
              Begin Adventure
            </button>
          </div>
        </div>
      </div>
    `;

    function updatePreview() {
      const hair = HAIR_OPTIONS.find(h => h.id === c.hair);
      root.querySelector('#avatar-preview').textContent = hair.emoji;
    }
    updatePreview();

    function wireRow(rowId, key) {
      root.querySelectorAll(`#${rowId} .swatch`).forEach(btn => {
        btn.addEventListener('click', () => {
          c[key] = btn.dataset.value;
          root.querySelectorAll(`#${rowId} .swatch`).forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          updatePreview();
        });
      });
    }
    wireRow('skin-row', 'skinTone');
    wireRow('hair-row', 'hair');
    wireRow('outfit-row', 'outfit');
    wireRow('accessory-row', 'accessory');

    root.querySelectorAll('#age-row .age-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        player.ageLevel = btn.dataset.value;
        root.querySelectorAll('#age-row .age-swatch').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    root.querySelector('#back-btn').addEventListener('click', () => ScreenManager.go('home'));

    root.querySelector('#save-btn').addEventListener('click', () => {
      const nickname = root.querySelector('#nickname-input').value.trim();
      player.nickname = nickname || 'Explorer';
      GameState.persist();
      ScreenManager.go('world-map');
    });
  }

  return { render };
})();
