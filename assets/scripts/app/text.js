
export function phoneHref(phone) {
    return `tel:${phone.replace(/[^+\d]/g, '')}`;
}

export default {
    phoneHref,
}
