# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and follows [Conventional Commits](https://www.conventionalcommits.org/).

## [1.0.0](https://github.com/raesta/trpc-playground-plus/compare/v1.0.0-beta.2...v1.0.0) (2026-08-16)


### Features

* add autocomplete array ([910563c](https://github.com/raesta/trpc-playground-plus/commit/910563c35a8a9542aa6eedc0d6884f5e0f0a804e))
* add basic keybindings system ([14ee08d](https://github.com/raesta/trpc-playground-plus/commit/14ee08d9ecf41004c01a895fdc9e70a59a233682))
* add collapsed state of headers/variables in localStorage ([b01ea99](https://github.com/raesta/trpc-playground-plus/commit/b01ea9996ea8e85810c533a0e88829d3794aebed))
* add copy/past button to json viewer ([1352266](https://github.com/raesta/trpc-playground-plus/commit/1352266db0fbed9e301af9fced2cdccf30d9a22c))
* add requests history with actions (view, rerun & compare) ([4d683c4](https://github.com/raesta/trpc-playground-plus/commit/4d683c4de6703ce1a2cb467d52b52c2d07d83279))
* add zod schema constrains ([07f9c4a](https://github.com/raesta/trpc-playground-plus/commit/07f9c4a3482e8c5314f2d0f0ec9b47be39ced3ec))


### Bug Fixes

* add array schema parsing ([4923ff2](https://github.com/raesta/trpc-playground-plus/commit/4923ff2946d9fa4d91f62bdd42f4d087f40ebb6f))
* add autocomplete full literals ([866dabc](https://github.com/raesta/trpc-playground-plus/commit/866dabc5a354697806621cdd0dab706988795ecc))
* add recursive object parsing to type checking ([7c26a7f](https://github.com/raesta/trpc-playground-plus/commit/7c26a7f13a3598ae4c27a4da99bddd4fa8f975b8))
* apply correct design for typecheck popover ([447376d](https://github.com/raesta/trpc-playground-plus/commit/447376d4a99b54b6dbc0e909ebf9754dba5c66ad))
* linter changes ([4e2dfca](https://github.com/raesta/trpc-playground-plus/commit/4e2dfcac86a3bad4ab971531e542b0a2c62deac1))
* remove regex to locator offset ([f4f9749](https://github.com/raesta/trpc-playground-plus/commit/f4f974910ddcfe33b93282794d469d30131f0a19))
* use correctly email rule ([e6a0938](https://github.com/raesta/trpc-playground-plus/commit/e6a09383c3e7da7a8e77a1c0e1ece82abae26fb6))


### Refactor

* share code to parsing schema for typechecking, autocomplete et validation ([4de4596](https://github.com/raesta/trpc-playground-plus/commit/4de459681bf378db5d86aa32173a0d6268fa4417))

## [1.0.0-beta.2](https://github.com/raesta/trpc-playground-plus/compare/v1.0.0-beta.1...v1.0.0-beta.2) (2026-07-21)


### Features

* add environment variables injected in config file ([a2a595c](https://github.com/raesta/trpc-playground-plus/commit/a2a595c8721d0021a7eff0dead90ae5de48a2db6))
* add highlight info of started request ([2913c11](https://github.com/raesta/trpc-playground-plus/commit/2913c11893a6a986cf30ff5a7d4f6ac8d729595c))


### Bug Fixes

* add autocomplete variables based on discriminate type ([b135c67](https://github.com/raesta/trpc-playground-plus/commit/b135c67a9942cf4902218ec163ce1578f7d812cb))
* disable correctly variable if exist ([b91c1ab](https://github.com/raesta/trpc-playground-plus/commit/b91c1abf3a406a8c117ac80d7db754a803b17f3e))
* linter ([826573b](https://github.com/raesta/trpc-playground-plus/commit/826573bb5763bf2dba17e97b921fdd745f3b7d6a))
* rework header & variables ([b01841f](https://github.com/raesta/trpc-playground-plus/commit/b01841fc9b94fdf400840165309f4a92f4122ab9))
* show correctly discriminate type in input/output ([29f47de](https://github.com/raesta/trpc-playground-plus/commit/29f47de878420ab0ea37352ab70c6a31ac9ba8a4))
* update options separator ([d4bf3ed](https://github.com/raesta/trpc-playground-plus/commit/d4bf3edb1480e0fb5d283d548a8b8effeda9e881))
* update parsing error with discriminate type ([f6b78ae](https://github.com/raesta/trpc-playground-plus/commit/f6b78ae5367eaa735ca2f908160e9e05de21a7bf))

## [1.0.0-beta.1](https://github.com/raesta/trpc-playground-plus/compare/v1.0.0-beta.0...v1.0.0-beta.1) (2026-04-19)


### Features

* add indicator if the variables has errors ([ce5a505](https://github.com/raesta/trpc-playground-plus/commit/ce5a5051c810f12d8c1e58822db400e3171858d2))
* implement enum type (auto-completing, parsing, linting & checking) ([e12d0d0](https://github.com/raesta/trpc-playground-plus/commit/e12d0d0e316245436dd78a5784dc94ddcb4394f8))
