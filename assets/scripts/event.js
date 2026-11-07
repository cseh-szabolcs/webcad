export function dispatch(name, payload = undefined, remember = true) {
    if (payload && !running[name] && remember) {
        waiting[name] = payload;
    }

    window.dispatchEvent(new CustomEvent(name, {
        detail: payload,
    }));
}

export function on(name, handler, remember = true) {
    if (!running[name]) {
        running[name] = true;
    }

    const ctr = new AbortController();
    window.addEventListener(name, (event) => {
        event.detail ? handler(event.detail, event) : handler(event);
    }, {
        signal: ctr.signal,
    });

    if (waiting[name] && remember) {
        dispatch(name, waiting[name], false);
        delete waiting[name];
    }

    return ctr;
}

const waiting = {};
const running = {};

export default {
    dispatch,
    on,
}
