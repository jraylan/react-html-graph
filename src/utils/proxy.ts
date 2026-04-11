
function deepFreeze<T extends object>(obj: T): T {
    // Retrieve the property names defined on obj
    const propNames = Object.getOwnPropertyNames(obj);

    // Freeze properties before freezing self
    for (const name of propNames) {
        const value = obj[name as keyof T];

        if (value && typeof value === "object") {
            deepFreeze(value);
        }
    }

    return Object.freeze(obj);
}

export function createReadonlyProxy<T extends object>(target: T): T {
    const clone = JSON.parse(JSON.stringify(target));
    deepFreeze(clone);
    return clone;
}