module.exports = function createHeadlessGlStub() {
    throw new Error("O stub local de 'gl' foi carregado. Este projeto usa apenas o bundle browser-only do GPU.js.");
};
