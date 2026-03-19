document.addEventListener('DOMContentLoaded', () => {
    const items = window.INITIAL_ITEMS || [];
    const container = document.getElementById('board-container');
    let isAlphabeticalSort = false;
    const LS_KEY = 'project_os_card_overrides';

    // === LocalStorage Layer ===
    function getLocalOverrides() {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch(e) { return {}; }
    }
    function setLocalOverride(id, data) {
        const overrides = getLocalOverrides();
        overrides[id] = Object.assign(overrides[id] || {}, data);
        localStorage.setItem(LS_KEY, JSON.stringify(overrides));
        showSaveIndicator();
    }
    function showSaveIndicator() {
        const el = document.getElementById('ls-indicator');
        if (!el) return;
        el.classList.add('show');
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 2500);
    }
    // Merge overrides INTO items so all rendering uses up-to-date data
    function applyLocalOverrides() {
        const overrides = getLocalOverrides();
        items.forEach(item => {
            if (overrides[item.id]) {
                Object.assign(item, overrides[item.id]);
            }
        });
    }
    applyLocalOverrides();

    function normalizeTags(tagsValue) {
        if (Array.isArray(tagsValue)) {
            return tagsValue.map(t => String(t).trim()).filter(Boolean);
        }
        if (typeof tagsValue === 'string') {
            return tagsValue.split(',').map(t => t.trim()).filter(Boolean);
        }
        return [];
    }
    
    // Return Lucide icon for matching keywords
    function getCategoryIcon(catName) {
        catName = (catName || "").toLowerCase();
        let icon = 'folder';
        if (catName.includes('ui') || catName.includes('interface')) icon = 'monitor';
        else if (catName.includes('combat') || catName.includes('enemy') || catName.includes('battle')) icon = 'sword';
        else if (catName.includes('world') || catName.includes('generation') || catName.includes('building')) icon = 'globe';
        else if (catName.includes('inventory') || catName.includes('resource') || catName.includes('loot') || catName.includes('item')) icon = 'package';
        else if (catName.includes('system') || catName.includes('architecture') || catName.includes('core')) icon = 'cpu';
        else if (catName.includes('character') || catName.includes('player') || catName.includes('movement')) icon = 'user-round';
        else if (catName.includes('sound') || catName.includes('audio')) icon = 'music';
        else if (catName.includes('network') || catName.includes('multiplayer')) icon = 'wifi';
        else if (catName.includes('bug')) icon = 'bug';
        return `<i data-lucide="${icon}" class="cat-icon"></i>`;
    }

    function createCard(item) {
        const card = document.createElement('div');
        card.className = `card`;
        card.draggable = true;
        card.dataset.id = item.id;
        if (item.priority) card.dataset.priority = item.priority;
        
        const safeTitle = item.title ? item.title.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "Untitled";
        
        // V2 Studio Upgrade: Render Badges and Assignee
        let badgesHtml = '';
        if (item.priority && item.priority !== 'Medium' && item.priority !== '') {
            const prioClass = `badge-priority-${item.priority}`;
            let prioIcon = 'minus';
            if (item.priority === 'Critical') prioIcon = 'flame';
            else if (item.priority === 'High') prioIcon = 'arrow-up';
            else if (item.priority === 'Low') prioIcon = 'arrow-down';
            badgesHtml += `<span class="badge ${prioClass}"><i data-lucide="${prioIcon}" style="width:11px;height:11px;vertical-align:middle;"></i> ${item.priority}</span>`;
        }
        const tags = normalizeTags(item.tags);
        if (tags.length) {
            tags.forEach(t => {
                badgesHtml += `<span class="badge">#${t}</span>`;
            });
        }
        
        let assigneeHtml = '';
        if (item.assignee) {
            const initials = item.assignee.substring(0, 2).toUpperCase();
            assigneeHtml = `<div class="assignee-avatar" title="${item.assignee}">${initials}</div>`;
        }
        
        // V3 Tracking: Progress Bar and Date
        const progress = item.progress || 0;
        const progressHtml = progress > 0 ? `<div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 3px; margin-top: 8px; overflow: hidden;">
                                <div style="height: 100%; width: ${progress}%; background: ${progress >= 80 ? '#34d399' : progress >= 40 ? '#fbbf24' : 'var(--accent)'}"></div>
                              </div>` : '';
        
        let dateHtml = '';
        if (item.created_at) {
            const d = new Date(item.created_at + "Z");
            if (!isNaN(d)) {
                dateHtml = `<div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 5px; text-align: right;">${d.toLocaleDateString()}</div>`;
            }
        }

        // Quick-action hover buttons
        const qaHtml = `<div class="card-actions">
            <button class="card-action-btn" data-set-status="DONE" title="Mark as done"><i data-lucide="check" style="width:11px;height:11px;"></i></button>
            <button class="card-action-btn" data-set-status="PARTIAL" title="In progress"><i data-lucide="loader" style="width:11px;height:11px;"></i></button>
            <button class="card-action-btn" data-set-status="TODO" title="Move to planned"><i data-lucide="rotate-ccw" style="width:11px;height:11px;"></i></button>
        </div>`;

        card.innerHTML = `
            <div class="card-header">
                <div class="card-id">T-${item.id}</div>
            </div>
            <div class="card-title">${safeTitle}</div>
            ${progressHtml}
            ${badgesHtml ? `<div class="card-badges">${badgesHtml}</div>` : ''}
            ${dateHtml}
            ${assigneeHtml}
            ${qaHtml}
        `;

        // Wire up quick-action buttons (stop event from bubbling to card's openModal)
        card.querySelectorAll('.card-action-btn[data-set-status]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newStatus = btn.dataset.setStatus;
                item.status = newStatus;
                renderSwimlanes();
                try {
                    await fetch('/api/items/update_status', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({id: item.id, status: newStatus})
                    });
                } catch(err) { /* server may be stale - ignore */ }
            });
        });

        // V2 Studio Upgrade: Open Modal on Click
        card.addEventListener('click', (e) => {
            if (e.target.closest('.modal')) return; // ignore if someone clicked inside modal overlay
            openModal(item);
        });

        card.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', item.id);
            setTimeout(() => {
                card.style.opacity = '0.4';
                trashZone.classList.add('visible');
            }, 0);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            card.style.opacity = '1';
            trashZone.classList.remove('visible', 'drag-over');
        });

        return card;
    }
    
    function renderSwimlanes() {
        container.innerHTML = '';
        
        // Group items by exact Category Name
        const groups = {};
        items.forEach(item => {
            const cName = item.category || 'General';
            if (!groups[cName]) groups[cName] = { 'TODO': [], 'PARTIAL': [], 'DONE': [] };
            
            const stat = ['TODO','PARTIAL','DONE'].includes(item.status) ? item.status : 'TODO';
            groups[cName][stat].push(item);
        });

        // Apply sorting based on select value
        const sortMode = document.getElementById('sort-select') ? document.getElementById('sort-select').value : 'default';
        
        Object.keys(groups).forEach(cat => {
            ['TODO', 'PARTIAL', 'DONE'].forEach(status => {
                if (sortMode === 'alphabetical') {
                    groups[cat][status].sort((a, b) => a.title.localeCompare(b.title));
                } else if (sortMode === 'newest') {
                    groups[cat][status].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                } else if (sortMode === 'oldest') {
                    groups[cat][status].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
                }
            });
        });
        
        // Render each category as a swimlane
        Object.keys(groups).sort().forEach(catName => {
            const icon = getCategoryIcon(catName);
            const totalInCat = groups[catName]['TODO'].length + groups[catName]['PARTIAL'].length + groups[catName]['DONE'].length;
            
            const swimlane = document.createElement('div');
            swimlane.className = 'swimlane';
            swimlane.dataset.category = catName;
            swimlane.innerHTML = `
                <div class="swimlane-header">
                    <span class="swimlane-cat-icon">${icon}</span>
                    <h2 class="swimlane-title">${catName}</h2>
                    <span class="swimlane-badge">${totalInCat}</span>
                    <button class="collapse-btn" title="Collapse"><i data-lucide="chevron-down" style="width:16px;height:16px;"></i></button>
                </div>
                <div class="swimlane-board">
                    <div class="column" data-status="TODO">
                        <div class="column-header"><h3><i data-lucide="clipboard-list" style="width:15px;height:15px;vertical-align:middle;"></i> Planned <span style="font-size: 0.8rem; color: #a1a1aa;">(${groups[catName]['TODO'].length})</span></h3></div>
                        <div class="column-content"></div>
                    </div>
                    <div class="column" data-status="PARTIAL">
                        <div class="column-header"><h3><i data-lucide="loader" style="width:15px;height:15px;vertical-align:middle;"></i> In Progress <span style="font-size: 0.8rem; color: #a1a1aa;">(${groups[catName]['PARTIAL'].length})</span></h3></div>
                        <div class="column-content"></div>
                    </div>
                    <div class="column" data-status="DONE">
                        <div class="column-header"><h3><i data-lucide="check-circle-2" style="width:15px;height:15px;vertical-align:middle;"></i> Done <span style="font-size: 0.8rem; color: #a1a1aa;">(${groups[catName]['DONE'].length})</span></h3></div>
                        <div class="column-content"></div>
                    </div>
                </div>
            `;
            
            // Append cards to their respective columns
            const cols = swimlane.querySelectorAll('.column-content');
            
            groups[catName]['TODO'].forEach(it => cols[0].appendChild(createCard(it)));
            groups[catName]['PARTIAL'].forEach(it => cols[1].appendChild(createCard(it)));
            groups[catName]['DONE'].forEach(it => cols[2].appendChild(createCard(it)));
            
            container.appendChild(swimlane);
        });
        
        setupDropzones();
        updateGlobalCount();
        populateFilters();
        applyFilters();

        // Re-attach collapse buttons after re-render
        document.querySelectorAll('.collapse-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sl = btn.closest('.swimlane');
                sl.classList.toggle('collapsed');
                const chevron = btn.querySelector('i');
                if (chevron) chevron.setAttribute('data-lucide', sl.classList.contains('collapsed') ? 'chevron-right' : 'chevron-down');
                if (window.lucide) lucide.createIcons();
            });
        });

        // Initialize Lucide icons on re-render
        if (window.lucide) lucide.createIcons();
    }
    
    function getAvailableCategories() {
        const categories = new Set();
        items.forEach(i => {
            const c = (i.category || '').trim();
            if (c) categories.add(c);
        });
        if (!categories.size) categories.add('General');
        return Array.from(categories).sort((a, b) => a.localeCompare(b));
    }

    function getAvailableAssignees() {
        const assignees = new Set();
        items.forEach(i => {
            const assignee = (i.assignee || '').trim();
            if (assignee) assignees.add(assignee);
        });
        return Array.from(assignees).sort((a, b) => a.localeCompare(b));
    }

    // V2 Studio Upgrade: Filter Logic
    function populateFilters() {
        const categories = getAvailableCategories();
        const assignees = getAvailableAssignees();
        
        const assigneeSelect = document.getElementById('filter-assignee');
        const currentAss = assigneeSelect.value;
        assigneeSelect.innerHTML = '<option value="">All assignees</option>';
        assignees.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a; opt.textContent = a;
            assigneeSelect.appendChild(opt);
        });
        assigneeSelect.value = currentAss; // Restore selection
        
        const categorySelect = document.getElementById('filter-category');
        const currentCat = categorySelect.value;
        categorySelect.innerHTML = '<option value="">All categories</option>';
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            categorySelect.appendChild(opt);
        });
        categorySelect.value = currentCat;
    }

    function applyFilters() {
        const searchText = document.getElementById('search-input').value.toLowerCase();
        const prioFilter = document.getElementById('filter-priority').value;
        const assigneeFilter = document.getElementById('filter-assignee').value;
        const catFilter = document.getElementById('filter-category').value;

        document.querySelectorAll('.card').forEach(card => {
            const id = parseInt(card.dataset.id);
            const item = items.find(i => i.id === id);
            if (!item) return;

            const tagsText = normalizeTags(item.tags).join(' ').toLowerCase();
            const matchSearch = item.title.toLowerCase().includes(searchText) || tagsText.includes(searchText);
            const matchPrio = !prioFilter || item.priority === prioFilter;
            const matchAssignee = !assigneeFilter || (item.assignee && item.assignee.trim() === assigneeFilter);
            const matchCat = !catFilter || (item.category && item.category.trim() === catFilter);

            if (matchSearch && matchPrio && matchAssignee && matchCat) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
        
        // Hide empty swimlanes if filtering by category
        document.querySelectorAll('.swimlane').forEach(sl => {
            const cat = sl.dataset.category;
            if (catFilter && cat !== catFilter) {
                sl.style.display = 'none';
            } else {
                sl.style.display = 'flex';
            }
        });

        updateSwimlaneCountsSafely();
    }

    function updateSwimlaneCountsSafely() {
        document.querySelectorAll('.swimlane').forEach(sl => {
            const visibleCards = sl.querySelectorAll('.card[style="display: flex;"], .card:not([style*="display: none"])').length;
            sl.querySelector('.swimlane-badge').textContent = visibleCards;
        });
    }

    document.getElementById('search-input').addEventListener('input', applyFilters);
    document.getElementById('filter-category').addEventListener('change', applyFilters);
    document.getElementById('filter-priority').addEventListener('change', applyFilters);
    document.getElementById('filter-assignee').addEventListener('change', applyFilters);

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            renderSwimlanes();
        });
    }

    document.getElementById('clear-filters').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        document.getElementById('filter-category').value = '';
        document.getElementById('filter-priority').value = '';
        document.getElementById('filter-assignee').value = '';
        document.getElementById('sort-select').value = 'default';
        renderSwimlanes();
    });

    function updateGlobalCount() {
        document.getElementById('total-tasks').textContent = document.querySelectorAll('.card').length;
        // Also update the stats strip
        const done = items.filter(i => i.status === 'DONE').length;
        const partial = items.filter(i => i.status === 'PARTIAL').length;
        const todo = items.filter(i => !i.status || i.status === 'TODO').length;
        const total = items.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        document.getElementById('stat-done').querySelector('.stat-num').textContent = done;
        document.getElementById('stat-partial').querySelector('.stat-num').textContent = partial;
        document.getElementById('stat-todo').querySelector('.stat-num').textContent = todo;
        document.getElementById('stat-pct').textContent = pct + '%';
        document.getElementById('stat-progress-bar').style.width = pct + '%';
    }

    function setupDropzones() {
        document.querySelectorAll('.column-content').forEach(zone => {
            zone.addEventListener('dragover', e => {
                e.preventDefault();
                zone.classList.add('drag-over');
                const afterElement = getDragAfterElement(zone, e.clientY);
                const draggable = document.querySelector('.dragging');
                
                if (draggable) {
                    if (afterElement == null) {
                        zone.appendChild(draggable);
                    } else {
                        zone.insertBefore(draggable, afterElement);
                    }
                }
            });

            zone.addEventListener('dragleave', () => {
                 zone.classList.remove('drag-over');
            });

            zone.addEventListener('drop', async e => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                
                const draggable = document.querySelector('.dragging');
                if (draggable) {
                    const id = parseInt(draggable.dataset.id);
                    const newStatus = zone.closest('.column').dataset.status;
                    
                    const item = items.find(i => i.id === id);
                    if (item && item.status !== newStatus) {
                        item.status = newStatus;
                        updateGlobalCount();
                        
                        try {
                            await fetch('/api/items/update_status', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({id: id, status: newStatus})
                            });
                            renderSwimlanes();
                        } catch(error) {
                            console.error("Error updating via API:", error);
                        }
                    }
                }
            });
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // V2 Studio Upgrade: Modal Logic
    const modal = document.getElementById('task-modal');
    let currentEditingId = null;
    const modalAssigneeModeExistingBtn = document.getElementById('modal-assignee-mode-existing');
    const modalAssigneeModeCustomBtn = document.getElementById('modal-assignee-mode-custom');
    const modalAssigneeSelect = document.getElementById('modal-assignee-select');
    const modalAssigneeCustom = document.getElementById('modal-assignee-custom');
    const legacyModalAssigneeInput = document.getElementById('modal-assignee');
    const modalTagsList = document.getElementById('modal-tags-list');
    const modalTagInput = document.getElementById('modal-tag-input');
    let modalAssigneeMode = 'existing';
    let currentModalTags = [];

    function refreshModalAssigneeOptions(selectedValue) {
        if (!modalAssigneeSelect) return;
        const assignees = getAvailableAssignees();
        modalAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';
        assignees.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            modalAssigneeSelect.appendChild(option);
        });
        modalAssigneeSelect.value = assignees.includes(selectedValue) ? selectedValue : '';
    }

    function setModalAssigneeMode(mode) {
        if (!modalAssigneeModeExistingBtn || !modalAssigneeModeCustomBtn || !modalAssigneeSelect || !modalAssigneeCustom) return;
        modalAssigneeMode = mode === 'custom' ? 'custom' : 'existing';
        const isCustom = modalAssigneeMode === 'custom';
        modalAssigneeModeExistingBtn.classList.toggle('active', !isCustom);
        modalAssigneeModeCustomBtn.classList.toggle('active', isCustom);
        modalAssigneeSelect.style.display = isCustom ? 'none' : 'block';
        modalAssigneeCustom.style.display = isCustom ? 'block' : 'none';
        if (isCustom) modalAssigneeCustom.focus();
    }

    function getModalAssigneeValue() {
        if (legacyModalAssigneeInput) return legacyModalAssigneeInput.value.trim();
        if (!modalAssigneeSelect || !modalAssigneeCustom) return '';
        return modalAssigneeMode === 'custom'
            ? modalAssigneeCustom.value.trim()
            : (modalAssigneeSelect.value || '').trim();
    }

    function renderModalTags() {
        if (!modalTagsList) return;
        modalTagsList.innerHTML = '';
        modalTagsList.style.display = 'flex';
        modalTagsList.style.flexWrap = 'wrap';
        modalTagsList.style.gap = '10px';
        modalTagsList.style.marginBottom = currentModalTags.length ? '10px' : '0';
        currentModalTags.forEach((tag, index) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'modal-tag-chip';
            chip.style.all = 'unset';
            chip.style.display = 'inline-flex';
            chip.style.alignItems = 'center';
            chip.style.gap = '8px';
            chip.style.padding = '8px 10px 8px 12px';
            chip.style.borderRadius = '999px';
            chip.style.border = '1px solid rgba(16, 163, 127, 0.28)';
            chip.style.background = 'linear-gradient(180deg, rgba(16, 163, 127, 0.18) 0%, rgba(16, 163, 127, 0.1) 100%)';
            chip.style.color = 'var(--text-main)';
            chip.style.fontFamily = 'Inter, sans-serif';
            chip.style.fontSize = '0.82rem';
            chip.style.fontWeight = '500';
            chip.style.lineHeight = '1';
            chip.style.cursor = 'pointer';
            chip.style.whiteSpace = 'nowrap';
            chip.innerHTML = `<span>${tag}</span><span class="modal-tag-remove" aria-hidden="true">x</span>`;
            const remove = chip.querySelector('.modal-tag-remove');
            if (remove) {
                remove.style.display = 'inline-flex';
                remove.style.alignItems = 'center';
                remove.style.justifyContent = 'center';
                remove.style.width = '18px';
                remove.style.height = '18px';
                remove.style.borderRadius = '999px';
                remove.style.background = 'rgba(255,255,255,0.08)';
                remove.style.color = 'var(--text-muted)';
                remove.style.fontSize = '0.72rem';
                remove.style.fontWeight = '700';
                remove.style.lineHeight = '1';
                remove.style.flex = '0 0 auto';
            }
            chip.addEventListener('click', () => {
                currentModalTags.splice(index, 1);
                renderModalTags();
            });
            modalTagsList.appendChild(chip);
        });
    }

    function addModalTags(rawValue) {
        const nextTags = normalizeTags(rawValue);
        nextTags.forEach(tag => {
            if (!currentModalTags.includes(tag)) {
                currentModalTags.push(tag);
            }
        });
        renderModalTags();
    }

    function openModal(item) {
        currentEditingId = item.id;
        document.getElementById('modal-title').textContent = `Task: T-${item.id}`;
        
        // Priority Select Options
        const prioSel = document.getElementById('modal-priority');
        prioSel.innerHTML = `
            <option value="Critical" ${item.priority==='Critical'?'selected':''}>Critical</option>
            <option value="High" ${item.priority==='High'?'selected':''}>High</option>
            <option value="Medium" ${(!item.priority || item.priority==='Medium')?'selected':''}>Medium</option>
            <option value="Low" ${item.priority==='Low'?'selected':''}>Low</option>
        `;

        const currentAssignee = (item.assignee || '').trim();
        if (legacyModalAssigneeInput) {
            legacyModalAssigneeInput.value = currentAssignee;
        } else if (modalAssigneeSelect && modalAssigneeCustom) {
            const availableAssignees = getAvailableAssignees();
            refreshModalAssigneeOptions(currentAssignee);
            modalAssigneeCustom.value = currentAssignee;
            setModalAssigneeMode(currentAssignee && !availableAssignees.includes(currentAssignee) ? 'custom' : 'existing');
        }
        document.getElementById('modal-due-date').value = item.due_date || '';
        currentModalTags = normalizeTags(item.tags);
        renderModalTags();
        if (modalTagInput) modalTagInput.value = '';
        document.getElementById('modal-desc').value = item.description || '';
        
        const progSlider = document.getElementById('modal-progress');
        const progVal = document.getElementById('modal-progress-val');
        progSlider.value = item.progress || 0;
        progVal.textContent = item.progress || 0;

        modal.style.display = 'flex';
        if (window.lucide) lucide.createIcons();
    }
    
    document.getElementById('modal-progress').addEventListener('input', (e) => {
        document.getElementById('modal-progress-val').textContent = e.target.value;
    });

    document.getElementById('modal-close').addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.style.display = 'none'; });
    if (modalAssigneeModeExistingBtn) modalAssigneeModeExistingBtn.addEventListener('click', () => setModalAssigneeMode('existing'));
    if (modalAssigneeModeCustomBtn) modalAssigneeModeCustomBtn.addEventListener('click', () => setModalAssigneeMode('custom'));
    if (modalTagInput) {
        modalTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const value = modalTagInput.value.trim();
                if (!value) return;
                addModalTags(value);
                modalTagInput.value = '';
            }
        });
        modalTagInput.addEventListener('blur', () => {
            const value = modalTagInput.value.trim();
            if (!value) return;
            addModalTags(value);
            modalTagInput.value = '';
        });
    }

    document.getElementById('modal-delete').addEventListener('click', async () => {
        if (!currentEditingId) return;
        if (!confirm(`Delete task T-${currentEditingId}? This action cannot be undone.`)) return;

        const idx = items.findIndex(i => i.id === currentEditingId);
        if (idx !== -1) items.splice(idx, 1);

        // Remove from LS overrides too
        const overrides = getLocalOverrides();
        delete overrides[currentEditingId];
        localStorage.setItem(LS_KEY, JSON.stringify(overrides));

        modal.style.display = 'none';
        renderSwimlanes();
        showSaveIndicator();

        try {
            await fetch('/api/items/delete', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id: currentEditingId, status: 'DELETED'})
            });
        } catch(e) { /* server stale */ }
    });

    document.getElementById('modal-save').addEventListener('click', async () => {
        if (!currentEditingId) return;
        
        const updatedData = {
            id: currentEditingId,
            priority: document.getElementById('modal-priority').value,
            assignee: getModalAssigneeValue(),
            due_date: document.getElementById('modal-due-date').value,
            tags: currentModalTags,
            description: document.getElementById('modal-desc').value,
            progress: parseInt(document.getElementById('modal-progress').value)
        };

        // === PRIMARY SAVE: LocalStorage (instant, no server needed) ===
        setLocalOverride(currentEditingId, updatedData);
        const item = items.find(i => i.id === currentEditingId);
        if (item) Object.assign(item, updatedData);
        modal.style.display = 'none';
        renderSwimlanes();
        
        // === BACKGROUND SYNC: Try to save to server (best effort) ===
        try {
            await fetch('/api/items/update_details', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(updatedData)
            });
        } catch (error) {
            // Server unavailable is fine - data is already in LocalStorage
            console.log('Server sync failed, data saved locally:', error);
        }
    });

    // === Quick Add (FAB) ===
    const qaModeExistingBtn = document.getElementById('qa-mode-existing');
    const qaModeCustomBtn = document.getElementById('qa-mode-custom');
    const qaCategorySelect = document.getElementById('qa-category-select');
    const qaCategoryCustom = document.getElementById('qa-category-custom');
    const qaCategoryHint = document.getElementById('qa-category-hint');
    const qaAssigneeModeExistingBtn = document.getElementById('qa-assignee-mode-existing');
    const qaAssigneeModeCustomBtn = document.getElementById('qa-assignee-mode-custom');
    const qaAssigneeSelect = document.getElementById('qa-assignee-select');
    const qaAssigneeCustom = document.getElementById('qa-assignee-custom');
    const qaAssigneeHint = document.getElementById('qa-assignee-hint');
    const legacyQaAssigneeInput = document.getElementById('qa-assignee');
    const qaTitleInput = document.getElementById('qa-title');
    let qaCategoryMode = 'existing';
    let qaAssigneeMode = 'existing';

    function autoResizeTextarea(el) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }

    function setQuickAddCategoryMode(mode) {
        qaCategoryMode = mode === 'custom' ? 'custom' : 'existing';
        const isCustom = qaCategoryMode === 'custom';
        qaModeExistingBtn.classList.toggle('active', !isCustom);
        qaModeCustomBtn.classList.toggle('active', isCustom);
        qaCategorySelect.style.display = isCustom ? 'none' : 'block';
        qaCategoryCustom.style.display = isCustom ? 'block' : 'none';
        qaCategoryHint.textContent = isCustom
            ? 'Create a new category. It will appear in the shared list after you add the card.'
            : 'Choose one of the existing categories.';
        if (isCustom) qaCategoryCustom.focus();
    }
    function refreshQuickAddCategoryOptions(selectedValue) {
        const categories = getAvailableCategories();
        qaCategorySelect.innerHTML = '';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            qaCategorySelect.appendChild(opt);
        });
        if (selectedValue && categories.includes(selectedValue)) {
            qaCategorySelect.value = selectedValue;
        } else {
            qaCategorySelect.value = categories[0] || 'General';
        }
    }

    function setQuickAddAssigneeMode(mode) {
        if (!qaAssigneeModeExistingBtn || !qaAssigneeModeCustomBtn || !qaAssigneeSelect || !qaAssigneeCustom || !qaAssigneeHint) return;
        qaAssigneeMode = mode === 'custom' ? 'custom' : 'existing';
        const isCustom = qaAssigneeMode === 'custom';
        qaAssigneeModeExistingBtn.classList.toggle('active', !isCustom);
        qaAssigneeModeCustomBtn.classList.toggle('active', isCustom);
        qaAssigneeSelect.style.display = isCustom ? 'none' : 'block';
        qaAssigneeCustom.style.display = isCustom ? 'block' : 'none';
        qaAssigneeHint.textContent = isCustom
            ? 'Create a new assignee name. It will appear in the shared list after you add the card.'
            : 'Choose one of the existing assignees.';
        if (isCustom) qaAssigneeCustom.focus();
    }

    function refreshQuickAddAssigneeOptions(selectedValue) {
        if (!qaAssigneeSelect) return;
        const assignees = getAvailableAssignees();
        qaAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';
        assignees.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            qaAssigneeSelect.appendChild(opt);
        });
        qaAssigneeSelect.value = assignees.includes(selectedValue) ? selectedValue : '';
    }

    function getQuickAddAssigneeValue() {
        if (legacyQaAssigneeInput) return legacyQaAssigneeInput.value.trim();
        if (!qaAssigneeSelect || !qaAssigneeCustom) return '';
        return qaAssigneeMode === 'custom'
            ? qaAssigneeCustom.value.trim()
            : (qaAssigneeSelect.value || '').trim();
    }

    function openQuickAdd(prefillCategory) {
        qaModal.style.display = 'flex';
        refreshQuickAddCategoryOptions(prefillCategory);
        if (legacyQaAssigneeInput) {
            legacyQaAssigneeInput.value = '';
        } else {
            refreshQuickAddAssigneeOptions('');
        }
        qaCategoryCustom.value = prefillCategory || '';
        if (qaAssigneeCustom) qaAssigneeCustom.value = '';
        setQuickAddCategoryMode(prefillCategory ? 'custom' : 'existing');
        setQuickAddAssigneeMode('existing');
        qaTitleInput.value = '';
        document.getElementById('qa-priority').value = 'Medium';
        document.getElementById('qa-status').value = 'TODO';
        autoResizeTextarea(qaTitleInput);
        setTimeout(() => qaTitleInput.focus(), 50);
    }

    const qaModal = document.getElementById('quick-add-modal');
    document.getElementById('qa-close').addEventListener('click', () => qaModal.style.display = 'none');
    qaModal.addEventListener('click', (e) => { if (e.target === qaModal) qaModal.style.display = 'none'; });
    qaModeExistingBtn.addEventListener('click', () => setQuickAddCategoryMode('existing'));
    qaModeCustomBtn.addEventListener('click', () => setQuickAddCategoryMode('custom'));
    if (qaAssigneeModeExistingBtn) qaAssigneeModeExistingBtn.addEventListener('click', () => setQuickAddAssigneeMode('existing'));
    if (qaAssigneeModeCustomBtn) qaAssigneeModeCustomBtn.addEventListener('click', () => setQuickAddAssigneeMode('custom'));
    qaTitleInput.addEventListener('input', () => autoResizeTextarea(qaTitleInput));

    async function submitQuickAdd() {
        const title = qaTitleInput.value.trim();
        if (!title) return;
        const category = qaCategoryMode === 'custom'
            ? qaCategoryCustom.value.trim()
            : (qaCategorySelect.value || '').trim();
        const tempId = Date.now();
        const newItem = {
            id: tempId,
            title,
            category: category || 'General',
            status: document.getElementById('qa-status').value,
            priority: document.getElementById('qa-priority').value,
            assignee: getQuickAddAssigneeValue(),
            progress: 0
        };
        // Save to local view immediately
        items.push(newItem);
        qaModal.style.display = 'none';
        renderSwimlanes();
        showSaveIndicator();
        // Save to server
        try {
            const resp = await fetch('/api/items/add', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(newItem)
            });
            if (resp.ok) {
                const payload = await resp.json();
                if (payload && payload.item && payload.item.id) {
                    const idx = items.findIndex(i => i.id === tempId);
                    if (idx !== -1) items[idx] = Object.assign({}, items[idx], payload.item);
                }
            }
        } catch(e) { /* server stale - item in memory */ }
    }

    document.getElementById('qa-save').addEventListener('click', submitQuickAdd);
    qaTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitQuickAdd();
        }
        if (e.key === 'Escape') qaModal.style.display = 'none';
    });

    // === Trash Drop Zone ===
    const trashZone = document.getElementById('trash-zone');

    trashZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        trashZone.classList.add('drag-over');
    });

    trashZone.addEventListener('dragleave', () => {
        trashZone.classList.remove('drag-over');
    });

    trashZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        trashZone.classList.remove('drag-over', 'visible');

        const rawId = e.dataTransfer.getData('text/plain');
        const droppedId = parseInt(rawId, 10) || rawId;
        const idx = items.findIndex(i => String(i.id) === String(droppedId));
        if (idx === -1) return;

        const deletedId = items[idx].id;
        items.splice(idx, 1);

        // Remove from LocalStorage overrides
        const overrides = getLocalOverrides();
        delete overrides[deletedId];
        localStorage.setItem(LS_KEY, JSON.stringify(overrides));

        renderSwimlanes();
        showSaveIndicator();

        // Sync with server in background
        try {
            await fetch('/api/items/delete', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id: deletedId, status: 'DELETED'})
            });
        } catch(e) { /* server may be stale */ }
    });

    // FAB button + keyboard shortcut N
    document.getElementById('quick-add-fab').addEventListener('click', () => openQuickAdd());
    document.addEventListener('keydown', (e) => {
        if (e.key === 'n' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            openQuickAdd();
        }
    });

    // Initial Render
    renderSwimlanes();
});

