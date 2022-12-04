const template = document.querySelector('#app__template');
const templateRepo = template.content.querySelector('.app__repo');
const templateAutocompleteItem = template.content.querySelector(
    '.app__autocomplete-item'
);
const templateNotice = template.content.querySelector('.app__notice');
const searchWindow = document.querySelector('.app__input');
const wrapForAutocomplete = document.querySelector('.app__autocomplete');
const wrapForRepositories = document.querySelector('.app__repositories');
const form = document.querySelector('.app__form');
let isRunning;
let previousText;

showAutocomplete = debounce(showAutocomplete, 1000);

runApp();

function debounce(fn, debounceTime) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        return new Promise((resolve) => {
            timer = setTimeout(() => {
                resolve(fn.call(this, ...args));
            }, debounceTime);
        });
    };
}

function runApp() {
    isRunning = false;
    previousText = '';

    searchWindow.addEventListener('input', async () => {
        const searchText = searchWindow.value;
        try {
            await showAutocomplete(searchText, addSelectedRepo);
        } catch (err) {
            if (err instanceof appError) handleError(err, err.name);
            else throw err;
        }
    });
}

async function showAutocomplete(searchText, render) {
    if (searchText === previousText) return;

    cleaning([
        ...wrapForAutocomplete.querySelectorAll('.app__autocomplete-item'),
    ]);
    cleaning([...wrapForRepositories.querySelectorAll('.app__repo')]);

    if (!searchText || !searchText.split(' ').join('')) return;

    previousText = searchText;
    let result;

    try {
        result = await getSearchRepo(searchText);
    } catch (err) {
        throw err;
    }

    const resultArr = result.items;

    if (result === 'undefined' || resultArr === 'undefined')
        throw new DataMissError();
    if (typeof result !== 'object' || result === null)
        throw new ValidateError(result, typeof result, 'object');
    if (Array.isArray(resultArr) === false)
        throw new ValidateError(resultArr, typeof resultArr, 'array');

    try {
        createAutocomplete(resultArr, wrapForAutocomplete);
    } catch (err) {
        throw err;
    }

    if (!isRunning) {
        render(wrapForAutocomplete);
        isRunning = true;
    }
}

function addSelectedRepo(container) {
    container.addEventListener('click', (e) => {
        const choice = e.target.closest('.app__autocomplete-item');
        if (!choice) return;
        const name = choice.querySelector('.app__autocomplete-txt').textContent;
        const owner = choice.dataset.owner;

        const check = checkAddedRepo([name, owner]);

        if (check === false) {
            createNotice('Вы уже это сохранили', choice, 1500);
            return;
        }

        const stars = choice.dataset.stars;

        if (check === 0) closureRepoTracking(wrapForRepositories);
        if (check === 3) {
            cleaning(
                wrapForRepositories.querySelector('.app__repo:first-child')
            );
        }

        createSelectedRepo([name, owner, stars]);
    });
}

function checkAddedRepo(newRepo) {
    const addedRepos = wrapForRepositories.getElementsByClassName('app__repo');
    for (let el of addedRepos) {
        const name = el.querySelector(
            '.app__info-item:first-child .app__info-txt:last-child'
        ).textContent;
        const owner = el.querySelector(
            '.app__info-item:nth-child(2) .app__info-txt:last-child'
        ).textContent;
        if (name === newRepo[0] && owner === newRepo[1]) return false;
    }
    return addedRepos.length;
}

function cleaning(element) {
    if (!element) return;
    if (Array.isArray(element)) element.forEach((el) => cleaning(el));
    else element.remove();
}

function closureRepoTracking(container) {
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.app__btn');
        if (!btn) return;
        const repoForRemove = btn.closest('.app__repo');
        cleaning(repoForRemove);
    });
}

function createSelectedRepo(info) {
    const repo = templateRepo.cloneNode(true);
    const textArr = repo.querySelectorAll(
        '.app__info-item .app__info-txt:last-child'
    );
    textArr.forEach((el, i) => (el.textContent = info[i]));
    wrapForRepositories.appendChild(repo);
}

function createAutocomplete(arr, ul) {
    arr.forEach((el) => {
        const {
            name,
            owner: { login: owner },
            stargazers_count: stars,
        } = el;

        if (!name || !owner || !stars) throw new DataMissError();
        if (typeof name !== 'string')
            throw new ValidateError(name, typeof name, 'string');
        if (typeof owner !== 'string')
            throw new ValidateError(owner, typeof owner, 'string');
        if (typeof stars !== 'number')
            throw new ValidateError(stars, typeof stars, 'number');

        const autocompleteItem = templateAutocompleteItem.cloneNode(true);
        ul.appendChild(autocompleteItem);
        autocompleteItem.querySelector('.app__autocomplete-txt').textContent =
            name;
        autocompleteItem.dataset.owner = owner;
        autocompleteItem.dataset.stars = stars;
    });
}

function createNotice(text, container, time, addClasses) {
    const notice = templateNotice.cloneNode(true);
    notice.querySelector('.app__notice-txt').textContent = text;
    if (addClasses) {
        if (Array.isArray(addClasses))
            addClasses.forEach((el) => notice.classList.add(el));
        else notice.classList.add(addClasses);
    }
    container.appendChild(notice);
    setTimeout(() => cleaning(notice), time);
}

async function getSearchRepo(request) {
    let response;

    try {
        response = await fetch(
            `https://api.github.com/search/repositories?q=${request}&per_page=5`
        );
    } catch (err) {
        if (err instanceof TypeError) throw new OfflineError();
    }

    if (!response.ok)
        throw new ServerError('Проблемы с HTTP-запросом', response.status);
    response = await response.json();
    return response;
}

function handleError(err, errType) {
    let text;

    if (errType === 'ServerError') {
        if (err.status >= 400 && err.status <= 499) {
            text = 'Что-то пошло не так, напишите в поддержку';
        }
        if (err.status >= 500 && err.status <= 599) {
            text = 'GitHub отдыхает, попробуйте позже';
        }
    }
    if (errType === 'ValidateError') {
        text = 'Что-то пошло не так, напишите в поддержку';
    }
    if (errType === 'OfflineError') {
        text = 'Отсутствует связь с интернетом';
    }

    createNotice(text, form, 3000, 'app__notice--form');
}

class appError extends Error {
    constructor() {
        super();
    }
}

class ServerError extends appError {
    constructor(message, status) {
        super();
        this.name = this.constructor.name;
        this.status = status;
        this.message = `${message}, код статуса: ${this.status}`;
    }
}

class OfflineError extends ServerError {
    constructor() {
        super();
        this.message = 'Отсутствует интернет-связь';
        this.name = this.constructor.name;
    }
}

class ValidateError extends appError {
    constructor(el, type, needType) {
        super();
        this.name = this.constructor.name;
        this.el = el;
        this.type = type;
        this.needType = needType;
        this.message = `Проблемы с ${this.el}. Он ${this.type}, а нужен ${this.needType}`;
    }
}

class DataMissError extends ValidateError {
    constructor() {
        super();
        this.message = 'Данные потерялись';
        this.name = this.constructor.name;
    }
}
