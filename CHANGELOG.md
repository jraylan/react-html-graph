# Changelog

## [2.0.0](https://github.com/jraylan/react-html-graph/compare/react-html-graph-v1.2.5...react-html-graph-v2.0.0) (2026-04-12)


### ⚠ BREAKING CHANGES

* add adaptive math providers and live anchor previews for link rendering
* move link and temp-link anchor resolution out of the path layer and normalize port locations as Vector2
* add default temp link template support and wire the graph api load callback
* make path components consume resolved anchor geometry only

### Features

* add default temp link template support and wire the graph api load callback ([0cd811b](https://github.com/jraylan/react-html-graph/commit/0cd811b3f8a6262bd7019126e3c00de3394684d0))


### Bug Fixes

* infer fallback link tangents from continuous normalized vectors instead of cardinal directions ([0cd811b](https://github.com/jraylan/react-html-graph/commit/0cd811b3f8a6262bd7019126e3c00de3394684d0))
* keep drag updates and labels in sync without rerendering on each mousemove ([5cc2a70](https://github.com/jraylan/react-html-graph/commit/5cc2a700b57d0bc54144773fef0c07e5284323fa))
* keep node dragging stable when zoom changes during drag without cascading rerenders ([0cd811b](https://github.com/jraylan/react-html-graph/commit/0cd811b3f8a6262bd7019126e3c00de3394684d0))
* update the default temp link imperatively and seed drag state from the initial pointer position ([0cd811b](https://github.com/jraylan/react-html-graph/commit/0cd811b3f8a6262bd7019126e3c00de3394684d0))


### Code Refactoring

* add adaptive math providers and live anchor previews for link rendering ([5cc2a70](https://github.com/jraylan/react-html-graph/commit/5cc2a700b57d0bc54144773fef0c07e5284323fa))
* add adaptive math providers and live anchor previews for link rendering fix: keep drag updates and labels in sync without rerendering on each mousemove ([1b507c8](https://github.com/jraylan/react-html-graph/commit/1b507c89d8df21681d2c3582f18f989ee9fb9d97))
* make path components consume resolved anchor geometry only ([0cd811b](https://github.com/jraylan/react-html-graph/commit/0cd811b3f8a6262bd7019126e3c00de3394684d0))
* move link and temp-link anchor resolution out of the path layer and normalize port locations as Vector2 ([0cd811b](https://github.com/jraylan/react-html-graph/commit/0cd811b3f8a6262bd7019126e3c00de3394684d0))

## [1.2.5](https://github.com/jraylan/react-html-graph/compare/react-html-graph-v1.2.4...react-html-graph-v1.2.5) (2026-04-11)


### Bug Fixes

* Fix type erros ([d0660b9](https://github.com/jraylan/react-html-graph/commit/d0660b900ef8dc27f5e472e87e88969dd0deca15))

## [1.2.4](https://github.com/jraylan/react-html-graph/compare/react-html-graph-v1.2.3...react-html-graph-v1.2.4) (2026-04-11)


### Features

* Add capability to use a custom layout algorithm ([7f23087](https://github.com/jraylan/react-html-graph/commit/7f23087f5db48660a3d79835762590a0176004d8))

## [1.2.3](https://github.com/jraylan/react-html-graph/compare/react-html-graph-v1.2.2...react-html-graph-v1.2.3) (2026-04-11)


### ⚠ BREAKING CHANGES

* add a stable graph API hook with node type and link template registries
* add graph, node and link context/providers for event bus, registry lookup and link info access
* extract node drag handling into move behaviour and expose node/local event emitters
* refactor link rendering to delegate visual output to templates and export BidirectionalPath
* update ports, connection flow and shared types to use connectionType and graph-driven drag callbacks
* Graph now consumes an api prop created by useGraphApi instead of exposing the imperative API through ref.
* Node definitions now require nodeType registration, link rendering is template-driven, and several public interfaces rename type to connectionType.
* add custom link rendering and graph event registries

### Features

* add a stable graph API hook with node type and link template registries ([69b5c1b](https://github.com/jraylan/react-html-graph/commit/69b5c1b1d724c62b607e30b5a05bbb073de24794))
* add custom link rendering and graph event registries ([69b5c1b](https://github.com/jraylan/react-html-graph/commit/69b5c1b1d724c62b607e30b5a05bbb073de24794))
* add graph, node and link context/providers for event bus, registry lookup and link info access ([69b5c1b](https://github.com/jraylan/react-html-graph/commit/69b5c1b1d724c62b607e30b5a05bbb073de24794))
* add serialize/deserialize capability ([17e6109](https://github.com/jraylan/react-html-graph/commit/17e61094d568356699faaee7cf10f490bfbdc772))


### Bug Fixes

* fix path direction for ports with coordinates ([473b83f](https://github.com/jraylan/react-html-graph/commit/473b83fbf685025801f9a9396a2afa89b67e8bfd))
* fix TempLink not showing when connecting nodes. ([0b2e92f](https://github.com/jraylan/react-html-graph/commit/0b2e92f1dfa733827e654a0c93dc35d14c3c529f))
* Fix tree layout ([cce0bca](https://github.com/jraylan/react-html-graph/commit/cce0bcac64d3983797bbb5e2fa538d72fc5b3909))
* layout issues and graph returning to original position when moving ([510a885](https://github.com/jraylan/react-html-graph/commit/510a8850c36d9f76beee09aeba71a2c7fb77b81f))


### Code Refactoring

* extract node drag handling into move behaviour and expose node/local event emitters ([69b5c1b](https://github.com/jraylan/react-html-graph/commit/69b5c1b1d724c62b607e30b5a05bbb073de24794))
* Graph now consumes an api prop created by useGraphApi instead of exposing the imperative API through ref. ([69b5c1b](https://github.com/jraylan/react-html-graph/commit/69b5c1b1d724c62b607e30b5a05bbb073de24794))
* Node definitions now require nodeType registration, link rendering is template-driven, and several public interfaces rename type to connectionType. ([69b5c1b](https://github.com/jraylan/react-html-graph/commit/69b5c1b1d724c62b607e30b5a05bbb073de24794))
* refactor link rendering to delegate visual output to templates and export BidirectionalPath ([69b5c1b](https://github.com/jraylan/react-html-graph/commit/69b5c1b1d724c62b607e30b5a05bbb073de24794))
* update ports, connection flow and shared types to use connectionType and graph-driven drag callbacks ([69b5c1b](https://github.com/jraylan/react-html-graph/commit/69b5c1b1d724c62b607e30b5a05bbb073de24794))

## [1.2.2](https://github.com/jraylan/react-html-graph/compare/react-html-graph-v1.2.1...react-html-graph-v1.2.2) (2026-04-10)


### Features

* Add layout algorithms ([b3789f8](https://github.com/jraylan/react-html-graph/commit/b3789f8f688c9a6b46b37b8cbc16b88bd9ea7c8f))


### Bug Fixes

* fix forward link direction ([b2a9487](https://github.com/jraylan/react-html-graph/commit/b2a9487cc08cf88420c6169ceb0d26b292d134af))
* fix link direction heuristic ([c8f83f2](https://github.com/jraylan/react-html-graph/commit/c8f83f2679e8cfead416977577319fe1f05abfb3))
* fix unnecessary re-render while panning ([c8f83f2](https://github.com/jraylan/react-html-graph/commit/c8f83f2679e8cfead416977577319fe1f05abfb3))

## [1.2.1](https://github.com/jraylan/react-html-graph/compare/react-html-graph-v1.2.0...react-html-graph-v1.2.1) (2026-04-10)


### Bug Fixes

* fix build configuration ([1c5217a](https://github.com/jraylan/react-html-graph/commit/1c5217ad4fc7dd215a6d842e1f27757172b4c3b1))

## [1.2.0](https://github.com/jraylan/react-html-graph/compare/react-html-graph-v1.1.0...react-html-graph-v1.2.0) (2026-04-10)


### Features

* add useGetZoom, which returns a memoized immutable function ([dbc73b2](https://github.com/jraylan/react-html-graph/commit/dbc73b22b94d0a4f2e88c4cbc91e64b894466ca3))


### Bug Fixes

* fix link forwardDuration property not being used ([dbc73b2](https://github.com/jraylan/react-html-graph/commit/dbc73b22b94d0a4f2e88c4cbc91e64b894466ca3))
* fix package-log.json ([2d25dfa](https://github.com/jraylan/react-html-graph/commit/2d25dfa9306421592154dc9f35a192ee50cab189))
* fix unnecessary redraw on move node ([dbc73b2](https://github.com/jraylan/react-html-graph/commit/dbc73b22b94d0a4f2e88c4cbc91e64b894466ca3))

## [1.1.0](https://github.com/jraylan/react-html-graph/compare/react-html-graph-v1.0.1...react-html-graph-v1.1.0) (2026-04-10)


### Features

* add useGetZoom, which returns a memoized immutable function ([dbc73b2](https://github.com/jraylan/react-html-graph/commit/dbc73b22b94d0a4f2e88c4cbc91e64b894466ca3))


### Bug Fixes

* fix link forwardDuration property not being used ([dbc73b2](https://github.com/jraylan/react-html-graph/commit/dbc73b22b94d0a4f2e88c4cbc91e64b894466ca3))
* fix package-log.json ([2d25dfa](https://github.com/jraylan/react-html-graph/commit/2d25dfa9306421592154dc9f35a192ee50cab189))
* fix unnecessary redraw on move node ([dbc73b2](https://github.com/jraylan/react-html-graph/commit/dbc73b22b94d0a4f2e88c4cbc91e64b894466ca3))

## [1.0.1](https://github.com/jraylan/react-html-graph/compare/react-html-graph-v1.0.0...react-html-graph-v1.0.1) (2026-04-10)


### Bug Fixes

* fix package-lock.json ([2d25dfa](https://github.com/jraylan/react-html-graph/commit/2d25dfa9306421592154dc9f35a192ee50cab189))

## 1.0.0 (2026-04-10)


### Features

* add useGetZoom, which returns a memoized immutable function ([dbc73b2](https://github.com/jraylan/react-html-graph/commit/dbc73b22b94d0a4f2e88c4cbc91e64b894466ca3))


### Bug Fixes

* fix link forwardDuration property not being used ([dbc73b2](https://github.com/jraylan/react-html-graph/commit/dbc73b22b94d0a4f2e88c4cbc91e64b894466ca3))
* fix unnecessary redraw on move node ([dbc73b2](https://github.com/jraylan/react-html-graph/commit/dbc73b22b94d0a4f2e88c4cbc91e64b894466ca3))
