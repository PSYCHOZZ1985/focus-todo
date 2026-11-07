'use strict';

(() => {
  const KEY = 'focus-todo:v1';
  const $ = (id) => document.getElementById(id);
  const input = $('task-input');
  const list = $('task-list');
  let tasks = [];
  let filter = 'all';
  let storageReady = true;

  function readTasks(raw) {
    if (raw === null) return [];
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || saved.some((task) => !task || typeof task.id !== 'string' || !task.id || typeof task.text !== 'string' || !task.text.trim() || task.text.length > 200 || typeof task.done !== 'boolean') || new Set(saved.map((task) => task.id)).size !== saved.length) {
      throw new Error('Invalid saved list');
    }
    return saved.map(({ id, text, done }) => ({ id, text, done }));
  }

  function showSaved() {
    $('save-status').innerHTML = '<span aria-hidden="true">✓</span>Сохранено в браузере';
    $('storage-warning').hidden = true;
  }

  function warn(message) {
    $('storage-warning').textContent = message;
    $('storage-warning').hidden = false;
    $('save-status').textContent = 'Только в этой вкладке';
  }

  try {
    tasks = readTasks(localStorage.getItem(KEY));
  } catch {
    storageReady = false;
    warn('Не удалось прочитать сохранённый список. Новые задачи будут доступны только в этой вкладке. Старые данные не перезаписываются.');
  }

  function persist() {
    if (!storageReady) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(tasks));
      showSaved();
    } catch {
      warn('Браузер не разрешил сохранить изменения. Пока не закрывайте эту вкладку: после обновления они могут пропасть.');
    }
  }

  function countLabel(number) {
    const last = number % 10;
    const teen = number % 100;
    if (last === 1 && teen !== 11) return 'задача';
    if (last >= 2 && last <= 4 && !(teen >= 12 && teen <= 14)) return 'задачи';
    return 'задач';
  }

  function announce(message) {
    $('announcement').textContent = message;
  }

  function render(focusId = null) {
    list.replaceChildren();
    const visible = tasks.filter((task) => filter === 'all' || (filter === 'done' ? task.done : !task.done));
    for (const task of visible) {
      const row = document.createElement('li');
      row.className = `task-item${task.done ? ' is-done' : ''}`;
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'task-check';
      check.id = `task-${task.id}`;
      check.checked = task.done;
      const label = document.createElement('label');
      label.htmlFor = check.id;
      label.className = 'task-text';
      label.textContent = task.text;
      check.addEventListener('change', () => {
        task.done = check.checked;
        persist();
        render(task.id);
        announce(task.done ? 'Задача выполнена' : 'Задача возвращена в работу');
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-button';
      remove.setAttribute('aria-label', `Удалить задачу: ${task.text}`);
      remove.innerHTML = '<svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.5 5.5h13M8 3h4l1 2.5M5.5 5.5l.7 11h7.6l.7-11M8.5 8.5v5M11.5 8.5v5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      remove.addEventListener('click', () => {
        const index = visible.findIndex((item) => item.id === task.id);
        tasks = tasks.filter((item) => item.id !== task.id);
        persist();
        render();
        const next = list.children[Math.min(index, list.children.length - 1)];
        if (next) next.querySelector('.delete-button').focus();
        else input.focus();
        announce('Задача удалена');
      });
      row.append(check, label, remove);
      list.append(row);
    }
    $('all-count').textContent = String(tasks.length);
    const active = tasks.filter((task) => !task.done).length;
    $('summary').textContent = tasks.length ? `${active} ${countLabel(active)} в работе · ${tasks.length - active} выполнено` : 'Пока задач нет';
    $('empty-state').hidden = visible.length > 0;
    const emptyCopy = filter === 'done' ? ['Всё ещё впереди', 'Выполненные задачи появятся здесь.'] : filter === 'active' && tasks.length ? ['Отличная работа!', 'Все задачи выполнены. Можно выдохнуть.'] : ['Здесь начинается порядок', 'Добавьте первую задачу. Даже маленький шаг — уже движение.'];
    $('empty-title').textContent = emptyCopy[0];
    $('empty-text').textContent = emptyCopy[1];
    if (focusId) {
      const target = document.getElementById(`task-${focusId}`);
      if (target) target.focus();
      else document.querySelector(`[data-filter="${filter}"]`).focus();
    }
  }

  $('today').textContent = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  input.addEventListener('input', () => {
    $('input-count').textContent = `${input.value.length} / 200`;
    $('input-error').hidden = true;
    input.removeAttribute('aria-invalid');
  });
  $('task-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      $('input-error').textContent = 'Сначала напишите, что нужно сделать.';
      $('input-error').hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    if (text.length > 200) return;
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    tasks.push({ id, text, done: false });
    persist();
    filter = 'all';
    updateFilters();
    input.value = '';
    $('input-count').textContent = '0 / 200';
    $('input-error').hidden = true;
    input.removeAttribute('aria-invalid');
    render();
    input.focus();
    announce('Задача добавлена');
  });

  function updateFilters() {
    document.querySelectorAll('[data-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
  }
  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      filter = button.dataset.filter;
      updateFilters();
      render();
    });
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY && event.key !== null) return;
    try {
      // Read the latest value: another tab may have written again since this event.
      tasks = readTasks(localStorage.getItem(KEY));
      storageReady = true;
      showSaved();
      render();
      announce('Список обновлён в другой вкладке');
    } catch {
      storageReady = false;
      warn('Сохранённый список изменился, но его не удалось прочитать. Текущий список остаётся в этой вкладке; старые данные не перезаписываются.');
    }
  });
  render();
})();
