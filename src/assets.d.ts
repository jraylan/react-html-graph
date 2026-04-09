declare module "*.css" {
    const content: string;
    export default content;
}

declare module "*.scss" {
    const content: string;
    export default content;
}

declare module "*.sass" {
    const content: string;
    export default content;
}

declare module "*.less" {
    const content: string;
    export default content;
}

declare module "*.module.css" {
    const classes: Record<string, string>;
    export default classes;
}

declare module "*.module.scss" {
    const classes: Record<string, string>;
    export default classes;
}

declare module "*.png" {
    const source: string;
    export default source;
}

declare module "*.jpg" {
    const source: string;
    export default source;
}

declare module "*.jpeg" {
    const source: string;
    export default source;
}

declare module "*.gif" {
    const source: string;
    export default source;
}

declare module "*.svg" {
    const source: string;
    export default source;
}
