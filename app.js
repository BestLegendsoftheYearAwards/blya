const SUPABASE_URL = 'https://ntwngjhxmusuhblfioog.supabase.co';
const SUPABASE_KEY = 'sb_publishable__5eKwjalqyD9jjYALCL5xw_AD8QniBv';

const blyaSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

window.blyaSupabase = blyaSupabase;

console.log('B.L.Y.A. Supabase client создан');

// ОБЩИЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

let currentSitePhase = 'loading';

function showParticipantPanel(show) {
  const loginPanel = document.getElementById('participant-login-panel');
  const votingPanel = document.getElementById('voting-panel');

  if (!loginPanel || !votingPanel) return;

  if (currentSitePhase !== 'voting') {
    loginPanel.hidden = true;
    votingPanel.hidden = true;
    return;
  }

  loginPanel.hidden = show;
  votingPanel.hidden = !show;
}

// ПУБЛИЧНОЕ РАСПИСАНИЕ И ЭТАПЫ B.L.Y.A.

let siteServerTime = null;
let siteClientTime = null;

async function loadPublicSiteState() {
  const { data, error } = await blyaSupabase.rpc(
    'blya_get_public_site_state'
  );

  if (error) {
    console.error('Ошибка загрузки расписания:', error.message);
    return;
  }

  const settings = Array.isArray(data) ? data[0] : data;

  if (!settings) {
    console.error('Настройки расписания не найдены.');
    return;
  }

  siteServerTime = new Date(settings.server_now).getTime();
  siteClientTime = Date.now();

  updateSitePhase(settings);
}

function updateSitePhase(settings) {
  if (!siteServerTime || !siteClientTime) return;

  const now = siteServerTime + (Date.now() - siteClientTime);

  const nominationsOpen = new Date(settings.nominations_open_at).getTime();
  const nominationsClose = new Date(settings.nominations_close_at).getTime();
  const votingOpen = new Date(settings.voting_open_at).getTime();
  const votingClose = new Date(settings.voting_close_at).getTime();
  const resultsPublish = new Date(settings.results_publish_at).getTime();

  let phase;

  if (now < nominationsOpen) {
    phase = 'before';
  } else if (now <= nominationsClose) {
    phase = 'nominations';
  } else if (now < votingOpen) {
    phase = 'between';
  } else if (now <= votingClose) {
    phase = 'voting';
  } else if (now < resultsPublish) {
    phase = 'waiting';
  } else {
    phase = 'results';
  }

  if (phase === currentSitePhase) return;

  currentSitePhase = phase;

  const proposalPanel = document.getElementById('proposal-panel');
  const loginPanel = document.getElementById('participant-login-panel');
  const votingPanel = document.getElementById('voting-panel');
  const noticePanel = document.getElementById('phase-notice-panel');
  const noticeText = document.getElementById('phase-notice-text');
  const resultsPanel = document.getElementById('public-results-panel');

  if (proposalPanel) proposalPanel.hidden = true;
  if (loginPanel) loginPanel.hidden = true;
  if (votingPanel) votingPanel.hidden = true;
  if (noticePanel) noticePanel.hidden = true;
  if (resultsPanel) resultsPanel.hidden = true;

  if (phase === 'before') {
    if (noticePanel) noticePanel.hidden = false;
    if (noticeText) {
      noticeText.textContent =
  'Торжественное открытие "B.L.Y.A. 2026" состоится 1 декабря';
    }
  }

  if (phase === 'nominations') {
    if (proposalPanel) proposalPanel.hidden = false;
  }

  if (phase === 'voting') {
    showParticipantPanel(false);
  }

  if (phase === 'waiting') {
    if (noticePanel) noticePanel.hidden = false;
    if (noticeText) {
      noticeText.textContent =
        'Голосование "B.L.Y.A. 2026" окончено! Спасибо Вам за Ваши голоса!'
    }
  }

  if (phase === 'results') {
    if (resultsPanel) resultsPanel.hidden = false;
    loadPublicResults();
  }
}

// ПУБЛИЧНЫЕ РЕЗУЛЬТАТЫ

async function loadPublicResults() {
  const list = document.getElementById('public-results-list');
  if (!list) return;

  list.textContent = 'Загружаем результаты...';

  const { data, error } = await blyaSupabase.rpc(
    'blya_get_public_results'
  );

  if (error) {
    list.textContent = 'Не удалось загрузить результаты.';
    console.error('Ошибка публичных результатов:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    list.textContent = 'Результаты пока не опубликованы.';
    return;
  }

  list.innerHTML = '';

  const groups = new Map();

  for (const item of data) {
    if (!groups.has(item.nomination_id)) {
      groups.set(item.nomination_id, {
        title: item.nomination_title,
        options: [],
        total: Number(item.total_votes || 0)
      });
    }

    if (item.option_id) {
      groups.get(item.nomination_id).options.push({
        label: item.option_label,
        votes: Number(item.vote_count || 0)
      });
    }
  }

  for (const nomination of groups.values()) {
    const section = document.createElement('section');
    section.className = 'nomination-card';

    const heading = document.createElement('h3');
    heading.textContent = nomination.title;
    section.appendChild(heading);

    if (nomination.options.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'Варианты ответов отсутствуют.';
      section.appendChild(empty);
    } else {
      const highest = Math.max(
        ...nomination.options.map(option => option.votes)
      );

      for (const option of nomination.options) {
        const line = document.createElement('p');

        line.textContent =
          option.label + ': ' + option.votes +
          (option.votes === 1 ? ' голос' :
            option.votes >= 2 && option.votes <= 4 ? ' голоса' : ' голосов');

        section.appendChild(line);

        if (highest > 0 && option.votes === highest) {
          const winner = document.createElement('strong');
          winner.textContent = 'Победитель';
          section.appendChild(winner);
        }
      }
    }

    const total = document.createElement('p');
    total.textContent = 'Всего голосов: ' + nomination.total;
    section.appendChild(total);

    list.appendChild(section);
  }
}

// ЗАПУСК РАСПИСАНИЯ

async function initializePublicSite() {
  await loadPublicSiteState();

  if (currentSitePhase === 'voting') {
    await restoreParticipantSession();
  }

  setInterval(async () => {
    await loadPublicSiteState();
  }, 60000);
}

// АДМИНИСТРАТОР: ВХОД

const loginForm = document.getElementById('admin-login-form');

if (loginForm) {
  loginForm.addEventListener('submit', async event => {
    event.preventDefault();

    const status = document.getElementById('login-status');
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    status.textContent = 'Проверяем данные...';

    const { data, error } = await blyaSupabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      status.textContent = 'Ошибка входа: ' + error.message;
      return;
    }

    const { data: admin, error: adminError } = await blyaSupabase
      .from('blya_admins')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      await blyaSupabase.auth.signOut();
      status.textContent = 'У этой учётной записи нет прав администратора.';
      return;
    }

    status.textContent = 'Вход выполнен! Ты администратор B.L.Y.A.';
    document.getElementById('admin-panel').hidden = false;

    await loadNominations();
    await loadProposals();
    await loadOptionNominationChoices();
    await loadParticipants();
    await loadAdminResults();
await loadAdminTestResults();
  });
}

// УСТАНОВКА ОБЩЕГО PIN АДМИНИСТРАТОРОМ

const participantPinForm = document.getElementById('participant-pin-form');

if (participantPinForm) {
  participantPinForm.addEventListener('submit', async event => {
    event.preventDefault();

    const pinInput = document.getElementById('participant-pin-admin');
    const status = document.getElementById('participant-pin-status');
    const pin = pinInput.value.trim();
    const button = participantPinForm.querySelector('button');

    if (!/^[0-9]{4}$/.test(pin)) {
      status.textContent = 'PIN должен состоять ровно из 4 цифр.';
      return;
    }

    button.disabled = true;
    status.textContent = 'Сохраняем PIN...';

    const { error } = await blyaSupabase.rpc(
      'blya_set_participant_pin',
      { p_pin: pin }
    );

    button.disabled = false;

    if (error) {
      status.textContent = 'Не удалось сохранить PIN: ' + error.message;
      return;
    }

    pinInput.value = '';
    status.textContent = 'Общий PIN успешно сохранён!';
  });
}

// УЧАСТНИКИ: СПИСОК

async function loadParticipants() {
  const list = document.getElementById('participants-list');
  if (!list) return;

  list.textContent = 'Загружаем участников...';

  const { data, error } = await blyaSupabase
    .from('blya_participants')
    .select('id, display_name, active, created_at')
    .order('created_at');

  if (error) {
    list.textContent = 'Ошибка загрузки участников: ' + error.message;
    return;
  }

  if (!data.length) {
    list.textContent = 'Участников пока нет. Можно добавить до 10 человек.';
    return;
  }

  list.innerHTML = '';

  const counter = document.createElement('p');
  counter.textContent = 'Добавлено участников: ' + data.length + ' из 10';
  list.appendChild(counter);

  for (const participant of data) {
    const item = document.createElement('p');
    item.textContent = participant.display_name;
    list.appendChild(item);
  }
}

// ДОБАВЛЕНИЕ УЧАСТНИКА

const participantForm = document.getElementById('participant-form');

if (participantForm) {
  participantForm.addEventListener('submit', async event => {
    event.preventDefault();

    const nameInput = document.getElementById('participant-name');
    const codeInput = document.getElementById('participant-code');
    const status = document.getElementById('participant-status');

    const name = nameInput.value.trim();
    const code = codeInput.value.trim();

    if (name.length < 2) {
      status.textContent = 'Имя должно содержать минимум 2 символа.';
      return;
    }

    if (code.length < 8) {
      status.textContent = 'Код должен содержать минимум 8 символов.';
      return;
    }

    status.textContent = 'Добавляем участника...';

    const submitButton = participantForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const { data, error } = await blyaSupabase.rpc(
      'blya_add_participant',
      {
        p_display_name: name,
        p_code: code
      }
    );

    submitButton.disabled = false;

    if (error) {
      status.textContent = 'Не удалось добавить участника: ' + error.message;
      return;
    }

    nameInput.value = '';
    codeInput.value = '';

    status.textContent = data || 'Участник успешно добавлен!';
    await loadParticipants();
  });
}

// ВХОД УЧАСТНИКА

const participantLoginForm = document.getElementById('participant-login-form');

if (participantLoginForm) {
  participantLoginForm.addEventListener('submit', async event => {
    event.preventDefault();

    const pinInput = document.getElementById('participant-login-pin');
    const codeInput = document.getElementById('participant-login-code');
    const status = document.getElementById('participant-login-status');
    const pin = pinInput.value.trim();
    const code = codeInput.value.trim();
    const button = participantLoginForm.querySelector('button');

    if (!/^[0-9]{4}$/.test(pin)) {
      status.textContent = 'Введи общий PIN из 4 цифр.';
      return;
    }

    if (code.length < 8) {
      status.textContent = 'Код должен содержать минимум 8 символов.';
      return;
    }

    button.disabled = true;
    status.textContent = 'Выполняем вход...';

    try {
      await blyaSupabase.auth.signOut();

      const { error: authError } =
        await blyaSupabase.auth.signInAnonymously();

      if (authError) throw authError;

      const { error: claimError } = await blyaSupabase.rpc(
        'blya_claim_participant_with_pin',
        {
          p_pin: pin,
          p_code: code
        }
      );

      if (claimError) throw claimError;

      const { data: state, error: stateError } =
        await blyaSupabase.rpc('blya_get_participant_state');

      if (stateError) throw stateError;

      pinInput.value = '';
      codeInput.value = '';
      status.textContent = '';

      showParticipantPanel(true);

      setText(
        'participant-welcome',
        'Добро пожаловать, ' + state.display_name + '!'
      );

      await loadParticipantVoting();

    } catch (error) {
      await blyaSupabase.auth.signOut();
      status.textContent = 'Не удалось войти: ' + error.message;
    } finally {
      button.disabled = false;
    }
  });
}

// ЗАГРУЗКА ГОЛОСОВАНИЯ УЧАСТНИКА

async function loadParticipantVoting() {
  const list = document.getElementById('voting-list');
  if (!list) return;

  list.textContent = 'Загружаем голосование...';

  const { data: state, error: stateError } =
    await blyaSupabase.rpc('blya_get_participant_state');

  if (stateError) {
    list.textContent = 'Ошибка загрузки: ' + stateError.message;
    return;
  }

  const votes = Array.isArray(state.votes) ? state.votes : [];

  if (state.voting_open) {
    setText('voting-period-status', 'Голосование открыто! Выбирай варианты.');
  } else {
    const now = new Date();
    const openAt = new Date(state.voting_open_at);
    const closeAt = new Date(state.voting_close_at);

    if (now < openAt) {
      setText(
        'voting-period-status',
        'Голосование ещё не началось. Оно откроется 11 декабря.'
      );
    } else if (now > closeAt) {
      setText(
        'voting-period-status',
        'Голосование завершено. Спасибо за участие!'
      );
    } else {
      setText('voting-period-status', 'Голосование временно недоступно.');
    }
  }

  const { data: nominations, error: nominationsError } =
    await blyaSupabase
      .from('blya_nominations')
      .select('id, group_no, title, description, sort_order')
      .eq('active', true)
      .order('group_no')
      .order('sort_order');

  if (nominationsError) {
    list.textContent = 'Ошибка загрузки номинаций: ' + nominationsError.message;
    return;
  }

  if (!nominations.length) {
    list.textContent = 'Пока нет доступных номинаций.';
    return;
  }

  const { data: options, error: optionsError } =
    await blyaSupabase
      .from('blya_nomination_options')
      .select('id, nomination_id, label, description, image_url, sort_order')
      .order('sort_order');

  if (optionsError) {
    list.textContent = 'Ошибка загрузки вариантов: ' + optionsError.message;
    return;
  }

  list.innerHTML = '';

  for (const groupNo of [1, 2]) {
    const groupNominations = nominations.filter(
      nomination => nomination.group_no === groupNo
    );

    if (!groupNominations.length) continue;

    const heading = document.createElement('h3');
    heading.textContent = groupNo === 1
      ? 'Основные номинации'
      : 'Дополнительные номинации';

    list.appendChild(heading);

    for (const nomination of groupNominations) {
      const card = document.createElement('div');
      card.className = 'nomination-card';

      const title = document.createElement('h3');
      title.textContent = nomination.title;
      card.appendChild(title);

      if (nomination.description) {
        const description = document.createElement('p');
        description.textContent = nomination.description;
        card.appendChild(description);
      }

      const nominationOptions = options.filter(
        option => option.nomination_id === nomination.id
      );

      const existingVote = votes.find(
        vote => vote.nomination_id === nomination.id
      );

      if (!nominationOptions.length) {
        const empty = document.createElement('p');
        empty.textContent = 'Варианты ответов пока не добавлены.';
        card.appendChild(empty);
        list.appendChild(card);
        continue;
      }

      if (existingVote) {
        const selected = nominationOptions.find(
          option => option.id === existingVote.option_id
        );

        const result = document.createElement('p');
        result.textContent = selected
          ? 'Твой голос принят: ' + selected.label
          : 'В этой номинации твой голос уже принят.';

        card.appendChild(result);

      } else if (state.voting_open) {
        const form = document.createElement('form');
        const radioName = 'vote-' + nomination.id;

        for (const option of nominationOptions) {
          const label = document.createElement('label');
          label.style.display = 'block';
          label.style.margin = '12px 0';

          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = radioName;
          radio.value = option.id;
          radio.required = true;

          label.appendChild(radio);

          const text = document.createElement('span');
          text.textContent = ' ' + option.label;
          label.appendChild(text);

          if (option.description) {
            const details = document.createElement('small');
            details.textContent = ' — ' + option.description;
            label.appendChild(details);
          }

          if (option.image_url) {
            const image = document.createElement('img');
            image.src = option.image_url;
            image.alt = option.label;
            image.style.display = 'block';
            image.style.maxWidth = '180px';
            image.style.marginTop = '8px';
            label.appendChild(image);
          }

          form.appendChild(label);
        }

        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.textContent = 'Подтвердить голос';
        form.appendChild(submit);

        form.addEventListener('submit', async event => {
          event.preventDefault();

          const selected = form.querySelector(
            'input[name="' + radioName + '"]:checked'
          );

          if (!selected) return;

          const selectedOption = nominationOptions.find(
            item => item.id === selected.value
          );

          const confirmed = confirm(
            'Подтвердить выбор «' +
            selectedOption.label +
            '»? После отправки изменить голос будет нельзя.'
          );

          if (!confirmed) return;

          submit.disabled = true;
          submit.textContent = 'Отправляем голос...';

          const { error } = await blyaSupabase.rpc(
            'blya_cast_vote',
            {
              p_nomination_id: nomination.id,
              p_option_id: selected.value
            }
          );

          if (error) {
            alert('Не удалось отправить голос: ' + error.message);
            submit.disabled = false;
            submit.textContent = 'Подтвердить голос';
            return;
          }

          alert('Твой голос принят!');
          await loadParticipantVoting();
        });

        card.appendChild(form);

      } else {
        const message = document.createElement('p');
        message.textContent = 'Голосование пока недоступно.';
        card.appendChild(message);
      }

      list.appendChild(card);
    }
  }
}

// ВЫХОД УЧАСТНИКА

const participantLogout = document.getElementById('participant-logout');

if (participantLogout) {
  participantLogout.addEventListener('click', async () => {
    await blyaSupabase.auth.signOut();
    showParticipantPanel(false);

    setText('participant-login-status', 'Ты вышел из аккаунта.');
  });
}

// ВОССТАНОВЛЕНИЕ СЕССИИ УЧАСТНИКА

async function restoreParticipantSession() {
  const { data } = await blyaSupabase.auth.getSession();
  const user = data.session?.user;

  if (!user || !user.is_anonymous) return;

  const { data: state, error } =
    await blyaSupabase.rpc('blya_get_participant_state');

  if (error || !state) {
    await blyaSupabase.auth.signOut();
    return;
  }

  showParticipantPanel(true);

  setText(
    'participant-welcome',
    'Добро пожаловать, ' + state.display_name + '!'
  );

  await loadParticipantVoting();
}

// НОМИНАЦИИ: АДМИНИСТРАТОР

async function loadNominations() {
  const list = document.getElementById('nominations-list');
  if (!list) return;

  list.textContent = 'Загружаем номинации...';

  const { data, error } = await blyaSupabase
    .from('blya_nominations')
    .select('id, group_no, title, active, sort_order')
    .order('group_no')
    .order('sort_order');

  if (error) {
    list.textContent = 'Ошибка загрузки: ' + error.message;
    return;
  }

  if (!data.length) {
    list.textContent = 'Номинаций пока нет.';
    return;
  }

  list.innerHTML = '';

  for (const group of [1, 2]) {
    const heading = document.createElement('h3');
    heading.textContent = group === 1
      ? 'Основные номинации'
      : 'Дополнительные номинации';

    list.appendChild(heading);

    const nominations = data.filter(item => item.group_no === group);

    if (!nominations.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Пока нет номинаций.';
      list.appendChild(empty);
    }

    for (const nomination of nominations) {
      const item = document.createElement('div');

      const title = document.createElement('p');
      title.textContent =
        nomination.title + (nomination.active ? '' : ' (неактивна)');
      item.appendChild(title);

      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Удалить';

      deleteButton.addEventListener('click', async () => {
        const confirmed = confirm(
          'Точно удалить номинацию «' + nomination.title + '»? Все её варианты тоже будут удалены. Если за неё уже голосовали, удалить её не получится.'
        );

        if (!confirmed) return;

        deleteButton.disabled = true;
        deleteButton.textContent = 'Проверяем...';

        const { count, error: votesError } = await blyaSupabase
          .from('blya_votes')
          .select('nomination_id', { count: 'exact', head: true })
          .eq('nomination_id', nomination.id);

        if (votesError) {
          alert('Не удалось проверить голоса: ' + votesError.message);
          deleteButton.disabled = false;
          deleteButton.textContent = 'Удалить';
          return;
        }

        if (count > 0) {
          alert('Эту номинацию нельзя удалить: за неё уже голосовали.');
          deleteButton.disabled = false;
          deleteButton.textContent = 'Удалить';
          return;
        }

        const { error: optionsError } = await blyaSupabase
          .from('blya_nomination_options')
          .delete()
          .eq('nomination_id', nomination.id);

        if (optionsError) {
          alert('Не удалось удалить варианты: ' + optionsError.message);
          deleteButton.disabled = false;
          deleteButton.textContent = 'Удалить';
          return;
        }

        const { error: deleteError } = await blyaSupabase
          .from('blya_nominations')
          .delete()
          .eq('id', nomination.id);

        if (deleteError) {
          alert('Не удалось удалить номинацию: ' + deleteError.message);
          deleteButton.disabled = false;
          deleteButton.textContent = 'Удалить';
          return;
        }

        await loadNominations();
        await loadOptionNominationChoices();
      });

      item.appendChild(deleteButton);
      list.appendChild(item);
    }
  }
}

// ПРЕДЛОЖЕНИЯ НОМИНАЦИЙ

async function loadProposals() {
  const list = document.getElementById('proposals-list');
  if (!list) return;

  list.textContent = 'Загружаем предложения...';

  const { data, error } = await blyaSupabase
    .from('blya_nomination_proposals')
    .select('id, title, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    list.textContent = 'Ошибка загрузки: ' + error.message;
    return;
  }

  if (!data.length) {
    list.textContent = 'Пока предложений нет.';
    return;
  }

  list.innerHTML = '';

  for (const proposal of data) {
    const item = document.createElement('div');

    const title = document.createElement('p');
    title.textContent = proposal.title;
    item.appendChild(title);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Удалить';

    deleteButton.addEventListener('click', async () => {
      const confirmed = confirm(
        'Точно удалить предложение «' + proposal.title + '»?'
      );

      if (!confirmed) return;

      deleteButton.disabled = true;
      deleteButton.textContent = 'Удаляем...';

      const { error: deleteError } = await blyaSupabase
        .from('blya_nomination_proposals')
        .delete()
        .eq('id', proposal.id);

      if (deleteError) {
        alert('Не удалось удалить предложение: ' + deleteError.message);
        deleteButton.disabled = false;
        deleteButton.textContent = 'Удалить';
        return;
      }

      await loadProposals();
    });

    item.appendChild(deleteButton);
    list.appendChild(item);
  }
}

// ВАРИАНТЫ ОТВЕТОВ: АДМИНИСТРАТОР

async function loadOptionNominationChoices() {
  const select = document.getElementById('option-nomination');
  if (!select) return;

  const { data, error } = await blyaSupabase
    .from('blya_nominations')
    .select('id, title')
    .eq('active', true)
    .order('group_no')
    .order('sort_order');

  if (error) {
    setText('option-status', 'Ошибка загрузки номинаций: ' + error.message);
    return;
  }

  select.innerHTML = '<option value="">Выбери номинацию</option>';

  for (const nomination of data) {
    const option = document.createElement('option');
    option.value = nomination.id;
    option.textContent = nomination.title;
    select.appendChild(option);
  }
}

async function loadOptions() {
  const select = document.getElementById('option-nomination');
  const list = document.getElementById('options-list');

  if (!select || !list) return;

  const nominationId = select.value;

  if (!nominationId) {
    list.textContent = 'Выбери номинацию, чтобы посмотреть варианты.';
    return;
  }

  list.textContent = 'Загружаем варианты...';

  const { data, error } = await blyaSupabase
    .from('blya_nomination_options')
    .select('id, label, description, sort_order')
    .eq('nomination_id', nominationId)
    .order('sort_order');

  if (error) {
    list.textContent = 'Ошибка загрузки вариантов: ' + error.message;
    return;
  }

  if (!data.length) {
    list.textContent = 'Для этой номинации пока нет вариантов.';
    return;
  }

  list.innerHTML = '';

  for (const option of data) {
    const item = document.createElement('div');

    const title = document.createElement('strong');
    title.textContent = option.label;
    item.appendChild(title);

    if (option.description) {
      const description = document.createElement('p');
      description.textContent = option.description;
      item.appendChild(description);
    }

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Удалить';

    deleteButton.addEventListener('click', async () => {
      const confirmed = confirm(
        'Точно удалить вариант «' + option.label + '»?'
      );

      if (!confirmed) return;

      deleteButton.disabled = true;
      deleteButton.textContent = 'Удаляем...';

      const { error: deleteError } = await blyaSupabase
        .from('blya_nomination_options')
        .delete()
        .eq('id', option.id);

      if (deleteError) {
        alert('Не удалось удалить вариант: ' + deleteError.message);
        deleteButton.disabled = false;
        deleteButton.textContent = 'Удалить';
        return;
      }

      await loadOptions();
    });

    item.appendChild(deleteButton);
    list.appendChild(item);
  }
}

const optionNominationSelect = document.getElementById('option-nomination');

if (optionNominationSelect) {
  optionNominationSelect.addEventListener('change', loadOptions);
}

const optionForm = document.getElementById('option-form');

if (optionForm) {
  optionForm.addEventListener('submit', async event => {
    event.preventDefault();

    const nominationId = document.getElementById('option-nomination').value;
    const labelInput = document.getElementById('option-label');
    const descriptionInput = document.getElementById('option-description');
    const status = document.getElementById('option-status');

    const label = labelInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!nominationId || !label) {
      status.textContent = 'Выбери номинацию и укажи название варианта.';
      return;
    }

    status.textContent = 'Добавляем вариант...';

    const { error } = await blyaSupabase
      .from('blya_nomination_options')
      .insert({
        nomination_id: nominationId,
        label,
        description: description || null
      });

    if (error) {
      status.textContent = 'Ошибка добавления: ' + error.message;
      return;
    }

    labelInput.value = '';
    descriptionInput.value = '';

    status.textContent = 'Вариант успешно добавлен!';
    await loadOptions();
  });
}

// ДОБАВЛЕНИЕ НОМИНАЦИИ

const nominationForm = document.getElementById('nomination-form');

if (nominationForm) {
  nominationForm.addEventListener('submit', async event => {
    event.preventDefault();

    const status = document.getElementById('nomination-status');
    const titleInput = document.getElementById('nomination-title');
    const title = titleInput.value.trim();

    if (!title) return;

    status.textContent = 'Добавляем номинацию...';

    const { data: userData } = await blyaSupabase.auth.getUser();

    if (!userData.user) {
      status.textContent = 'Войди в аккаунт администратора заново.';
      return;
    }

    const { error } = await blyaSupabase
      .from('blya_nominations')
      .insert({
        group_no: 2,
        title,
        created_by: userData.user.id
      });

    if (error) {
      status.textContent = 'Ошибка: ' + error.message;
      return;
    }

    titleInput.value = '';
    status.textContent = 'Номинация успешно добавлена!';

    await loadNominations();
    await loadOptionNominationChoices();
  });
}

// ПРЕДЛОЖЕНИЯ НОМИНАЦИЙ: ПУБЛИЧНАЯ ФОРМА

const proposalForm = document.getElementById('proposal-form');

if (proposalForm) {
  proposalForm.addEventListener('submit', async event => {
    event.preventDefault();

    const titleInput = document.getElementById('proposal-title');
    const status = document.getElementById('proposal-status');
    const title = titleInput.value.trim();

    if (title.length < 3 || title.length > 120) {
      status.textContent = 'Название должно содержать от 3 до 120 символов.';
      return;
    }

    status.textContent = 'Отправляем предложение...';

    const { error } = await blyaSupabase
      .from('blya_nomination_proposals')
      .insert({ title });

    if (error) {
      status.textContent = 'Ошибка отправки: ' + error.message;
      return;
    }

    titleInput.value = '';
    status.textContent = 'Спасибо! Предложение отправлено организаторам.';
  });
}

// РЕЗУЛЬТАТЫ ДЛЯ АДМИНИСТРАТОРА

async function loadAdminResults() {
  const list = document.getElementById('admin-results');
  if (!list) return;

  list.textContent = 'Загружаем результаты...';

  const { data: nominations, error: nominationsError } =
    await blyaSupabase
      .from('blya_nominations')
      .select('id, title')
      .order('group_no')
      .order('sort_order');

  if (nominationsError) {
    list.textContent = 'Ошибка загрузки номинаций: ' + nominationsError.message;
    return;
  }

  const { data: options, error: optionsError } =
    await blyaSupabase
      .from('blya_nomination_options')
      .select('id, nomination_id, label');

  if (optionsError) {
    list.textContent = 'Ошибка загрузки вариантов: ' + optionsError.message;
    return;
  }

  const { data: votes, error: votesError } =
    await blyaSupabase
      .from('blya_votes')
      .select('nomination_id, option_id');

  if (votesError) {
    list.textContent = 'Ошибка загрузки голосов: ' + votesError.message;
    return;
  }

  list.innerHTML = '';

  for (const nomination of nominations) {
    const section = document.createElement('div');
    const heading = document.createElement('h4');
    heading.textContent = nomination.title;
    section.appendChild(heading);

    const nominationOptions = options.filter(
      option => option.nomination_id === nomination.id
    );

    if (!nominationOptions.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Варианты ещё не добавлены.';
      section.appendChild(empty);
    }

    for (const option of nominationOptions) {
      const count = votes.filter(
        vote => vote.nomination_id === nomination.id &&
          vote.option_id === option.id
      ).length;

      const item = document.createElement('p');
      item.textContent = option.label + ': ' + count;
      section.appendChild(item);
    }

    const total = votes.filter(
      vote => vote.nomination_id === nomination.id
    ).length;

    const totalLine = document.createElement('p');
    totalLine.textContent = 'Всего голосов: ' + total;
    section.appendChild(totalLine);

    list.appendChild(section);
  }
}

// ТЕСТОВЫЕ РЕЗУЛЬТАТЫ ДЛЯ АДМИНИСТРАТОРА

async function loadAdminTestResults() {
  let list = document.getElementById('admin-test-results');

  if (!list) {
    list = document.createElement('div');
    list.id = 'admin-test-results';

    const realResults = document.getElementById('admin-results');
    if (!realResults) return;

    const heading = document.createElement('h3');
    heading.textContent = 'Тестовые результаты';

    const note = document.createElement('p');
    note.textContent = 'Эти голоса не влияют на настоящие результаты.';

    realResults.parentNode.insertBefore(heading, realResults.nextSibling);
    realResults.parentNode.insertBefore(note, heading.nextSibling);
    realResults.parentNode.insertBefore(list, note.nextSibling);
  }

  list.textContent = 'Загружаем тестовые результаты...';

  const { data, error } = await blyaSupabase.rpc(
    'blya_get_test_admin_results'
  );

  if (error) {
    list.textContent = 'Ошибка загрузки тестовых результатов: ' + error.message;
    return;
  }

  if (!data || data.length === 0) {
    list.textContent = 'Тестовых голосов пока нет.';
    return;
  }

  list.innerHTML = '';

  const groups = new Map();

  for (const vote of data) {
    if (!groups.has(vote.nomination_title)) {
      groups.set(vote.nomination_title, []);
    }
    groups.get(vote.nomination_title).push(vote);
  }

  for (const [nominationTitle, votes] of groups) {
    const section = document.createElement('div');

    const heading = document.createElement('h4');
    heading.textContent = nominationTitle;
    section.appendChild(heading);

    const counts = new Map();

    for (const vote of votes) {
      if (!counts.has(vote.option_label)) {
        counts.set(vote.option_label, []);
      }
      counts.get(vote.option_label).push(vote.participant_name);
    }

    for (const [optionLabel, names] of counts) {
      const item = document.createElement('p');
      item.textContent =
        optionLabel + ': ' + names.length +
        ' (' + names.join(', ') + ')';
      section.appendChild(item);
    }

    const total = document.createElement('p');
    total.textContent = 'Всего тестовых голосов: ' + votes.length;
    section.appendChild(total);

    list.appendChild(section);
  }
}
// ПРИ ЗАГРУЗКЕ СТРАНИЦЫ

initializePublicSite();
// Автоматическая смена фотографий участников
(function () {
  const stack = document.querySelector('.participants-stack');

  if (!stack) return;

  const cards = Array.from(stack.querySelectorAll('.participant-card'));

  if (cards.length < 3) return;

  let current = 0;

  function updateCarousel() {
    cards.forEach(card => {
      card.classList.remove('is-left', 'is-center', 'is-right');
    });

    cards[(current + cards.length - 1) % cards.length]
      .classList.add('is-left');

    cards[current].classList.add('is-center');

    cards[(current + 1) % cards.length]
      .classList.add('is-right');

    current = (current + 1) % cards.length;
  }

  updateCarousel();
  setInterval(updateCarousel, 4500);
})();