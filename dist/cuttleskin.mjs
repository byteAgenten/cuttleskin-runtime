// config/settings.ts
const MODES = ["embedded", "editor"];
const IMAGE_RENDERINGS = ["quality", "speed"];
const DEFAULT_SETTINGS = Object.freeze({
	mode: "embedded",
	imageRendering: "quality"
});
function resolveSettings(overrides = {}) {
	return Object.freeze({
		...DEFAULT_SETTINGS,
		...overrides
	});
}
// config/graphic-config.ts
const EASING_NAMES = [
	"step",
	"linear",
	"easein",
	"easeout",
	"easeinout",
	"backin",
	"backout",
	"elastic",
	"bounce",
	"easeoutqart"
];
const VARIABLE_TYPES = [
	"number",
	"boolean",
	"text"
];
/** Reserved frame names generated from the variable domain. */
/** Positions at the ends of a number variable's range; frames there follow range changes. */
const RANGE_ENDS = {
	min: "$min",
	max: "$max"
};
const TRANSFORMATION_TYPES = [
	"translate",
	"rotate",
	"scale",
	"text",
	"image-url",
	"opacity",
	"fill-color",
	"stroke-color",
	"stroke-width",
	"motion-path"
];
const ANCHOR_NAMES = [
	"center",
	"top-left",
	"top",
	"top-right",
	"left",
	"right",
	"bottom-left",
	"bottom",
	"bottom-right"
];
// config/frame-position.ts
/** Whether the position is one of the ends `$min`/`$max` of a number variable's range. */
function isRangeEnd(at) {
	return at === RANGE_ENDS.min || at === RANGE_ENDS.max;
}
/**
* Variable value at which a frame is located: `$min`/`$max` resolve to the range of a number
* variable, all other positions are values of the variable already.
*/
function resolveFramePosition(variable, at) {
	if (variable.type === "number") {
		if (at === RANGE_ENDS.min) return variable.minimum;
		if (at === RANGE_ENDS.max) return variable.maximum;
	}
	return at;
}
// config/parse/issues.ts
/** Thrown by strict parsing when the configuration contains issues. */
var ConfigError = class extends Error {
	issues;
	constructor(issues) {
		const summary = issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
		super(`Invalid graphic configuration:\n${summary}`);
		this.name = "ConfigError";
		this.issues = issues;
	}
};
/** Marker for a value that failed validation; the issue has already been recorded. */
const INVALID = Symbol("invalid");
/** Collects issues and builds paths while walking the input. */
var IssueCollector = class {
	issues = [];
	add(path, message, code, params) {
		this.issues.push({
			path,
			message,
			code,
			...params ? { params } : {}
		});
		return INVALID;
	}
};
function joinPath(base, key) {
	if (typeof key === "number") return `${base}[${String(key)}]`;
	return base ? `${base}.${key}` : key;
}
// config/parse/primitives.ts
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function describe(value) {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}
function record(value, path, issues) {
	return isRecord(value) ? value : expectedType(issues, path, "object", value);
}
/** Records a value of the wrong type; `expected` is a type name like `object` or `number`. */
function expectedType(issues, path, expected, value) {
	const actual = describe(value);
	return issues.add(path, `Expected ${expected}, got ${actual}`, "config.expectedType", {
		expected,
		actual
	});
}
function string(value, path, issues) {
	return typeof value === "string" ? value : expectedType(issues, path, "string", value);
}
function nonEmptyString(value, path, issues) {
	const result = string(value, path, issues);
	if (result === INVALID) return INVALID;
	return result.trim() ? result : issues.add(path, "Must not be empty", "config.empty");
}
function finiteNumber(value, path, issues) {
	return typeof value === "number" && Number.isFinite(value) ? value : expectedType(issues, path, "finite number", value);
}
function boolean(value, path, issues) {
	return typeof value === "boolean" ? value : expectedType(issues, path, "boolean", value);
}
function oneOf(allowed, value, path, issues) {
	if (allowed.includes(value)) return value;
	const actual = typeof value === "string" ? JSON.stringify(value) : describe(value);
	const options = allowed.join(", ");
	return issues.add(path, `Expected one of ${options}, got ${actual}`, "config.expectedOneOf", {
		options,
		actual
	});
}
function point(value, path, issues) {
	const input = record(value, path, issues);
	if (input === INVALID) return INVALID;
	const x = finiteNumber(input.x, joinPath(path, "x"), issues);
	const y = finiteNumber(input.y, joinPath(path, "y"), issues);
	return x === INVALID || y === INVALID ? INVALID : {
		x,
		y
	};
}
/** Validates each item; invalid items are dropped (their issues are recorded). */
function list(value, path, issues, item) {
	if (value === void 0 || value === null) return [];
	if (!Array.isArray(value)) {
		expectedType(issues, path, "array", value);
		return [];
	}
	const result = [];
	value.forEach((entry, index) => {
		const parsed = item(entry, joinPath(path, index));
		if (parsed !== INVALID) result.push(parsed);
	});
	return result;
}
/** Runs `parse` for a present value; `undefined` and `null` count as absent. */
function optional(value, parse) {
	return value === void 0 || value === null ? void 0 : parse(value);
}
// config/parse/upgrade-graphic-config.ts
/** Positions of the former reserved frame names. */
const RESERVED_POSITIONS = {
	$min: "$min",
	$max: "$max",
	$false: false,
	$true: true
};
/** Copy of `record` without the property `key`. */
function withoutKey(record, key) {
	return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}
/**
* Converts one frame of the former object format (`name -> { at?, value, transition? }`) into
* an entry of the frame list. `keyFrames` are the named positions of the variable in the oldest
* format. Names that only repeat the position are dropped, other names are kept as `label`.
*/
function upgradeFrame(name, frame, keyFrames) {
	const at = Object.hasOwn(RESERVED_POSITIONS, name) ? RESERVED_POSITIONS[name] : "at" in frame ? frame.at : Object.hasOwn(keyFrames, name) ? keyFrames[name] : name.startsWith("$") ? name : void 0;
	const label = name.startsWith("$") || name === String(at) ? void 0 : name;
	const easing = frame.easing ?? frame.transition;
	return {
		...at === void 0 ? {} : { at },
		value: frame.value,
		...easing === void 0 || easing === null ? {} : { easing },
		...label === void 0 ? {} : { label }
	};
}
function upgradeTransformation(transformation, keyFramesByVariable) {
	if (!isRecord(transformation) || !isRecord(transformation.frames)) return transformation;
	const keyFrames = (typeof transformation.variable === "string" ? keyFramesByVariable.get(transformation.variable) : void 0) ?? {};
	let fallback;
	const frames = [];
	for (const [name, frame] of Object.entries(transformation.frames)) if (!isRecord(frame)) frames.push({
		at: name,
		value: frame
	});
	else if (name === "$default") fallback = frame.value;
	else frames.push(upgradeFrame(name, frame, keyFrames));
	const rest = withoutKey(transformation, "frames");
	const keepDefault = "default" in rest || fallback === void 0 || fallback === null;
	return {
		...rest,
		frames,
		...keepDefault ? {} : { default: fallback }
	};
}
/**
* Converts configurations of former formats into the current one, in which every transformation
* lists its frames with their position (`frames: [{ at, value }]`):
*
* - Frames as object keyed by name: `$min`/`$max` and `$false`/`$true` become positions, other
*   frames keep their `at`, `$default` becomes the transformation's `default`, the frame option
*   `transition` becomes `easing`.
* - Named key frames of variables (`variables[].keyFrames`): referenced frames get the position
*   of their key frame; the `keyFrames` are removed.
*
* Returns the input unchanged if there is nothing to convert, otherwise a converted copy; the
* input is never modified.
*/
function upgradeGraphicConfig(input) {
	if (!isRecord(input)) return input;
	const variables = Array.isArray(input.variables) ? input.variables : [];
	const transformations = Array.isArray(input.transformations) ? input.transformations : [];
	const keyFramesByVariable = /* @__PURE__ */ new Map();
	for (const variable of variables) if (isRecord(variable) && "keyFrames" in variable && typeof variable.name === "string") keyFramesByVariable.set(variable.name, isRecord(variable.keyFrames) ? variable.keyFrames : {});
	const formerFrames = transformations.some((transformation) => isRecord(transformation) && isRecord(transformation.frames));
	if (keyFramesByVariable.size === 0 && !formerFrames) return input;
	return {
		...input,
		...Array.isArray(input.variables) ? { variables: variables.map((variable) => {
			if (!isRecord(variable) || !("keyFrames" in variable)) return variable;
			return withoutKey(variable, "keyFrames");
		}) } : {},
		...Array.isArray(input.transformations) ? { transformations: transformations.map((transformation) => upgradeTransformation(transformation, keyFramesByVariable)) } : {}
	};
}
// config/parse/parse-graphic-config.ts
const VARIABLE_VALUE_PARSERS = {
	number: finiteNumber,
	boolean,
	text: string
};
const FRAME_VALUE_PARSERS = {
	translate: point,
	scale: point,
	rotate: finiteNumber,
	"stroke-width": finiteNumber,
	opacity: (value, path, issues) => {
		const result = finiteNumber(value, path, issues);
		if (result === INVALID) return INVALID;
		return result >= 0 && result <= 1 ? result : issues.add(path, "Opacity must be between 0 and 1", "config.opacityRange");
	},
	"fill-color": nonEmptyString,
	"stroke-color": nonEmptyString,
	text: string,
	"image-url": string,
	"motion-path": (value, path, issues) => {
		const result = finiteNumber(value, path, issues);
		if (result === INVALID) return INVALID;
		return result >= 0 && result <= 100 ? result : issues.add(path, "Path position must be between 0 and 100 (percent)", "config.pathPositionRange");
	}
};
/**
* Position (`at`) of a frame: a number within the range or `$min`/`$max` for number variables,
* `false`/`true` for boolean variables, any text for text variables.
*/
function parseFramePosition(value, path, issues, variable) {
	if (value === void 0 || value === null) return issues.add(path, "Missing frame position", "config.missingFramePosition");
	if (variable.type === "number") {
		if (value === RANGE_ENDS.min || value === RANGE_ENDS.max) return value;
		if (typeof value !== "number") return issues.add(path, `Expected a number, ${RANGE_ENDS.min} or ${RANGE_ENDS.max}`, "config.expectedFramePosition", {
			min: RANGE_ENDS.min,
			max: RANGE_ENDS.max
		});
		const at = finiteNumber(value, path, issues);
		if (at === INVALID) return INVALID;
		if (at < variable.minimum || at > variable.maximum) return issues.add(path, `Position must be between ${String(variable.minimum)} and ${String(variable.maximum)}`, "config.positionRange", {
			minimum: variable.minimum,
			maximum: variable.maximum
		});
		return at;
	}
	return VARIABLE_VALUE_PARSERS[variable.type](value, path, issues);
}
function parseVariable(value, path, issues, names) {
	const input = record(value, path, issues);
	if (input === INVALID) return INVALID;
	const name = nonEmptyString(input.name, joinPath(path, "name"), issues);
	const type = oneOf(VARIABLE_TYPES, input.type, joinPath(path, "type"), issues);
	if (name === INVALID || type === INVALID) return INVALID;
	if (names.has(name)) return issues.add(joinPath(path, "name"), `Duplicate variable name: ${name}`, "config.duplicateVariable", { name });
	const parseValue = VARIABLE_VALUE_PARSERS[type];
	const defaultValue = optional(input.defaultValue, (v) => parseValue(v, joinPath(path, "defaultValue"), issues));
	if (defaultValue === INVALID) return INVALID;
	const common = {
		name,
		...defaultValue === void 0 ? {} : { defaultValue }
	};
	let result;
	if (type === "number") {
		const minimum = finiteNumber(input.minimum, joinPath(path, "minimum"), issues);
		const maximum = finiteNumber(input.maximum, joinPath(path, "maximum"), issues);
		if (minimum === INVALID || maximum === INVALID) return INVALID;
		if (minimum > maximum) return issues.add(joinPath(path, "maximum"), "Maximum must not be less than minimum", "config.maximumBelowMinimum");
		result = {
			...common,
			type,
			minimum,
			maximum
		};
	} else result = {
		...common,
		type
	};
	names.add(name);
	return result;
}
function parseFrames(value, path, issues, type, variable) {
	if (value === void 0 || value === null) return [];
	if (!Array.isArray(value)) return expectedType(issues, path, "array", value);
	const parseValue = FRAME_VALUE_PARSERS[type];
	const result = [];
	const taken = /* @__PURE__ */ new Map();
	let valid = true;
	for (const [index, entry] of value.entries()) {
		const framePath = joinPath(path, String(index));
		const frame = record(entry, framePath, issues);
		if (frame === INVALID) {
			valid = false;
			continue;
		}
		const at = parseFramePosition(frame.at, joinPath(framePath, "at"), issues, variable);
		const parsedValue = frame.value === null ? null : parseValue(frame.value, joinPath(framePath, "value"), issues);
		const easing = optional(frame.easing, (v) => oneOf(EASING_NAMES, v, joinPath(framePath, "easing"), issues));
		const label = optional(frame.label, (v) => string(v, joinPath(framePath, "label"), issues));
		if (at === INVALID || parsedValue === INVALID || easing === INVALID || label === INVALID) {
			valid = false;
			continue;
		}
		const position = resolveFramePosition(variable, at);
		const other = taken.get(position);
		if (other !== void 0) {
			issues.add(joinPath(framePath, "at"), `Frame ${String(other)} is already at this position`, "config.framePositionTaken", { frame: other });
			valid = false;
			continue;
		}
		taken.set(position, index);
		result.push({
			at,
			value: parsedValue,
			...easing === void 0 ? {} : { easing },
			...label === void 0 || label === "" ? {} : { label }
		});
	}
	return valid ? result : INVALID;
}
function parseTransition(value, path, issues) {
	const input = record(value, path, issues);
	if (input === INVALID) return INVALID;
	const duration = finiteNumber(input.duration, joinPath(path, "duration"), issues);
	const easing = oneOf(EASING_NAMES, input.easing ?? "linear", joinPath(path, "easing"), issues);
	if (duration === INVALID || easing === INVALID) return INVALID;
	if (duration < 0) return issues.add(joinPath(path, "duration"), "Duration must not be negative", "config.negativeDuration");
	return {
		duration,
		easing
	};
}
function parseAnchor(value, path, issues) {
	return typeof value === "string" ? oneOf(ANCHOR_NAMES, value, path, issues) : point(value, path, issues);
}
/** Accepts `true` and the legacy editor export value `"value"`. */
function parseBind(value, path, issues) {
	if (value === "value") return true;
	return boolean(value, path, issues);
}
/** `path` is required for `motion-path` and not used by other types. */
function parsePathOption(type, value, path, issues) {
	if (type !== "motion-path") return void 0;
	if (value === void 0 || value === null) return issues.add(path, "Missing path element for motion-path", "config.missingMotionPath");
	return nonEmptyString(value, path, issues);
}
function parseTransformation(value, path, issues, variables) {
	const input = record(value, path, issues);
	if (input === INVALID) return INVALID;
	const type = oneOf(TRANSFORMATION_TYPES, input.type, joinPath(path, "type"), issues);
	const element = nonEmptyString(input.element, joinPath(path, "element"), issues);
	const variableName = nonEmptyString(input.variable, joinPath(path, "variable"), issues);
	if (type === INVALID || element === INVALID || variableName === INVALID) return INVALID;
	const variable = variables.get(variableName);
	if (!variable) return issues.add(joinPath(path, "variable"), `Unknown variable: ${variableName}`, "config.unknownVariable", { name: variableName });
	const at = (key) => joinPath(path, key);
	const name = optional(input.name, (v) => nonEmptyString(v, at("name"), issues));
	const frames = parseFrames(input.frames, at("frames"), issues, type, variable);
	const fallback = optional(input.default, (v) => FRAME_VALUE_PARSERS[type](v, at("default"), issues));
	const priority = optional(input.priority, (v) => finiteNumber(v, at("priority"), issues));
	const transition = optional(input.transition, (v) => parseTransition(v, at("transition"), issues));
	const bind = optional(input.bind, (v) => parseBind(v, at("bind"), issues));
	const origin = optional(input.origin, (v) => parseAnchor(v, at("origin"), issues));
	const pathId = parsePathOption(type, input.path, at("path"), issues);
	const orient = type === "motion-path" ? optional(input.orient, (v) => boolean(v, at("orient"), issues)) : void 0;
	if (name === INVALID || frames === INVALID || fallback === INVALID || priority === INVALID || transition === INVALID || bind === INVALID || origin === INVALID || pathId === INVALID || orient === INVALID) return INVALID;
	return {
		type,
		element,
		variable: variableName,
		frames,
		...fallback === void 0 ? {} : { default: fallback },
		...name === void 0 ? {} : { name },
		...priority === void 0 ? {} : { priority },
		...transition === void 0 ? {} : { transition },
		...bind === true ? { bind } : {},
		...origin === void 0 ? {} : { origin },
		...pathId === void 0 ? {} : { path: pathId },
		...orient === true ? { orient } : {}
	};
}
function parseElement(value, path, issues, ids) {
	const input = record(value, path, issues);
	if (input === INVALID) return INVALID;
	const id = nonEmptyString(input.id, joinPath(path, "id"), issues);
	if (id === INVALID) return INVALID;
	if (ids.has(id)) return issues.add(joinPath(path, "id"), `Duplicate element id: ${id}`, "config.duplicateId", { id });
	const name = optional(input.name, (v) => nonEmptyString(v, joinPath(path, "name"), issues));
	if (name === INVALID) return INVALID;
	const eventsPath = joinPath(path, "events");
	const before = issues.issues.length;
	const events = list(input.events, eventsPath, issues, (v, p) => nonEmptyString(v, p, issues));
	if (issues.issues.length > before) return INVALID;
	ids.add(id);
	return {
		id,
		...name === void 0 ? {} : { name },
		...events.length ? { events } : {}
	};
}
function parseSettings(value, path, issues) {
	const input = record(value, path, issues);
	if (input === INVALID) return INVALID;
	const mode = optional(input.mode, (v) => oneOf(MODES, v, joinPath(path, "mode"), issues));
	const imageRendering = optional(input.imageRendering, (v) => oneOf(IMAGE_RENDERINGS, v, joinPath(path, "imageRendering"), issues));
	if (mode === INVALID || imageRendering === INVALID) return INVALID;
	return {
		...mode === void 0 ? {} : { mode },
		...imageRendering === void 0 ? {} : { imageRendering }
	};
}
const EMPTY_CONFIG$1 = Object.freeze({
	variables: [],
	transformations: []
});
/**
* Validates a graphic configuration (already parsed JSON) and normalizes legacy editor output.
* Invalid variables, transformations and elements are dropped as a whole and reported in `issues`;
* transformations referencing a dropped or unknown variable are dropped as well.
*/
function parseGraphicConfig(input) {
	const issues = new IssueCollector();
	const root = record(upgradeGraphicConfig(input), "", issues);
	if (root === INVALID) return {
		config: EMPTY_CONFIG$1,
		issues: issues.issues
	};
	const variableNames = /* @__PURE__ */ new Set();
	const variables = list(root.variables, "variables", issues, (v, p) => parseVariable(v, p, issues, variableNames));
	const variablesByName = new Map(variables.map((variable) => [variable.name, variable]));
	const transformations = list(root.transformations, "transformations", issues, (v, p) => parseTransformation(v, p, issues, variablesByName));
	const elementIds = /* @__PURE__ */ new Set();
	const elements = list(root.elements, "elements", issues, (v, p) => parseElement(v, p, issues, elementIds));
	const settings = optional(root.settings, (v) => parseSettings(v, "settings", issues));
	return {
		config: {
			variables,
			transformations,
			...elements.length ? { elements } : {},
			...settings === void 0 || settings === INVALID ? {} : { settings }
		},
		issues: issues.issues
	};
}
/** Parses JSON text; syntax errors are reported as an issue with an empty configuration. */
function parseGraphicConfigJson(text) {
	let input;
	try {
		input = JSON.parse(text);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			config: EMPTY_CONFIG$1,
			issues: [{
				path: "",
				message: `Invalid JSON: ${message}`,
				code: "config.invalidJson",
				params: { message }
			}]
		};
	}
	return parseGraphicConfig(input);
}
/** Like `parseGraphicConfig`, but throws a `ConfigError` if there is any issue. */
function parseGraphicConfigStrict(input) {
	const { config, issues } = parseGraphicConfig(input);
	if (issues.length) throw new ConfigError(issues);
	return config;
}
// config/safe-url.ts
/** URL schemes allowed in links and image references of graphics; relative URLs have none. */
const SAFE_SCHEMES = /* @__PURE__ */ new Set([
	"http",
	"https",
	"blob"
]);
/** Images as data URLs; an SVG image runs no script when shown through `<image>`. */
const SAFE_DATA_URL = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|svg\+xml)[;,]/i;
/**
* Whether a URL may be used as `href` in a graphic: relative URLs and fragments, `http(s):`,
* `blob:` and data URLs of images. Everything else, in particular `javascript:`, is refused.
* Whitespace and control characters are ignored like browsers do (`java\tscript:`).
*/
function isSafeUrl(value) {
	const url = value.replace(/[\u0000- \u007f]/g, "");
	const scheme = /^([a-z][a-z\d+.-]*):/i.exec(url)?.[1]?.toLowerCase();
	if (scheme === void 0) return true;
	if (scheme === "data") return SAFE_DATA_URL.test(url);
	return SAFE_SCHEMES.has(scheme);
}
// src/util/easing.ts
const BACK_OVERSHOOT = 1.70158;
function cubeRoot(value) {
	return Math.sign(value) * Math.pow(Math.abs(value), 1 / 3);
}
/** Curves match the former Snap.svg `mina` easings so existing graphics animate identically. */
const EASINGS = Object.freeze({
	step: () => 0,
	linear: (t) => t,
	easein: (t) => Math.pow(t, 1.7),
	easeout: (t) => Math.pow(t, .48),
	easeinout: (t) => {
		if (t === 0 || t === 1) return t;
		const q = .48 - t / 1.04;
		const root = Math.sqrt(.1734 + q * q);
		const x = cubeRoot(root - q) + cubeRoot(-root - q) + .5;
		return (1 - x) * 3 * x * x + x * x * x;
	},
	backin: (t) => {
		if (t === 1) return 1;
		return t * t * (2.70158 * t - BACK_OVERSHOOT);
	},
	backout: (t) => {
		if (t === 0) return 0;
		const u = t - 1;
		return u * u * (2.70158 * u + BACK_OVERSHOOT) + 1;
	},
	elastic: (t) => {
		if (t === 0 || t === 1) return t;
		return Math.pow(2, -10 * t) * Math.sin((t - .075) * (2 * Math.PI) / .3) + 1;
	},
	bounce: (t) => {
		const s = 7.5625;
		const p = 2.75;
		if (t < 1 / p) return s * t * t;
		if (t < 2 / p) {
			const u = t - 1.5 / p;
			return s * u * u + .75;
		}
		if (t < 2.5 / p) {
			const u = t - 2.25 / p;
			return s * u * u + .9375;
		}
		const u = t - 2.625 / p;
		return s * u * u + .984375;
	},
	easeoutqart: (t) => {
		const u = t - 1;
		return 1 - u * u * u * u;
	}
});
function isEasingName(name) {
	return EASING_NAMES.includes(name);
}
/** Resolves an easing by name; unknown or missing names fall back to `linear`. */
function resolveEasing(name) {
	return isEasingName(name) ? EASINGS[name] : EASINGS.linear;
}
// src/util/animate.ts
function animate(options) {
	const { duration, easing = EASINGS.linear, onUpdate, onComplete } = options;
	let frameId;
	let running = true;
	const finish = () => {
		running = false;
		onUpdate(1);
		onComplete?.();
	};
	if (!(duration > 0)) finish();
	else {
		const start = performance.now();
		const tick = (now) => {
			const t = Math.min(Math.max((now - start) / duration, 0), 1);
			if (t >= 1) {
				frameId = void 0;
				finish();
				return;
			}
			onUpdate(easing(t));
			frameId = requestAnimationFrame(tick);
		};
		frameId = requestAnimationFrame(tick);
	}
	return {
		stop() {
			running = false;
			if (frameId !== void 0) cancelAnimationFrame(frameId);
			frameId = void 0;
		},
		get running() {
			return running;
		}
	};
}
// src/util/assert.ts
function assert(condition, message) {
	if (!condition) throw new Error(message);
}
// src/util/assets.ts
const SCHEME = /^[a-z][\w.+-]*:/i;
function assetName(url) {
	return url.split("/").at(-1) ?? url;
}
/**
* Resolves asset names relative to `root` (e.g. `assets/`). Names listed in `urls` resolve to
* their own URL instead, e.g. content-addressed URLs that do not end with the name.
*/
function createAssetResolver(root = "", urls = {}) {
	const byName = new Map(Object.entries(urls));
	const byUrl = new Map([...byName].map(([name, url]) => [url, name]));
	return Object.freeze({
		resolve(nameOrUrl) {
			if (SCHEME.test(nameOrUrl)) return nameOrUrl;
			const name = assetName(nameOrUrl);
			return byName.get(name) ?? root + name;
		},
		nameOf: (url) => byUrl.get(url) ?? assetName(url)
	});
}
// src/util/color.ts
const cache = /* @__PURE__ */ new Map();
let context;
function getContext() {
	context ??= new OffscreenCanvas(1, 1).getContext("2d");
	return context;
}
const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGBA = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;
function parseSerialized(value) {
	const hex = HEX.exec(value);
	if (hex) {
		const [, r = "", g = "", b = ""] = hex;
		return {
			r: parseInt(r, 16),
			g: parseInt(g, 16),
			b: parseInt(b, 16),
			opacity: 1
		};
	}
	const rgba = RGBA.exec(value);
	if (rgba) {
		const [, r = "", g = "", b = "", a] = rgba;
		return {
			r: Number(r),
			g: Number(g),
			b: Number(b),
			opacity: a === void 0 ? 1 : Number(a)
		};
	}
	return null;
}
/**
* Parses any CSS color (hex, rgb(), hsl(), named colors, ...) using the browser's canvas color parser.
* Returns `null` for `none` and invalid values.
*/
function parseColor(value) {
	const key = value.trim().toLowerCase();
	const cached = cache.get(key);
	if (cached !== void 0) return cached;
	let result = null;
	const ctx = getContext();
	if (ctx && key !== "" && key !== "none") {
		ctx.fillStyle = "#000000";
		ctx.fillStyle = key;
		const first = ctx.fillStyle;
		ctx.fillStyle = "#ffffff";
		ctx.fillStyle = key;
		if (first === ctx.fillStyle) result = parseSerialized(first);
	}
	cache.set(key, result);
	return result;
}
function hex(channel) {
	return Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, "0");
}
/** Formats as `#rrggbb`, or `rgba(...)` when translucent; `null` becomes `none`. */
function formatColor(color) {
	if (!color) return "none";
	if (color.opacity < 1) {
		const opacity = Math.max(0, Number(color.opacity.toFixed(3)));
		return `rgba(${String(Math.round(color.r))}, ${String(Math.round(color.g))}, ${String(Math.round(color.b))}, ${String(opacity)})`;
	}
	return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
}
/**
* Linear RGB interpolation. A missing color fades in/out using the other color's channels with opacity 0.
*/
function interpolateColor(from, to, t) {
	if (t === 0) return from;
	if (t === 1) return to;
	if (!from && !to) return null;
	const start = from ?? {
		...to,
		opacity: 0
	};
	const end = to ?? {
		...start,
		opacity: 0
	};
	return {
		r: Math.round(start.r + t * (end.r - start.r)),
		g: Math.round(start.g + t * (end.g - start.g)),
		b: Math.round(start.b + t * (end.b - start.b)),
		opacity: start.opacity + t * (end.opacity - start.opacity)
	};
}
// src/util/observable.ts
/**
* Event emitter with optional bubbling to a parent.
* Events emitted here are re-dispatched on the parent as `<prefix>.<event>`,
* so `graphic.on('element.click', ...)` captures clicks of all elements.
*/
var Observable = class {
	#listeners = /* @__PURE__ */ new Map();
	#parent;
	#prefix;
	constructor(parent, prefix) {
		this.#parent = parent;
		this.#prefix = prefix;
	}
	/** Registers a listener and returns a function that removes it again. */
	on(event, listener) {
		let listeners = this.#listeners.get(event);
		if (!listeners) {
			listeners = /* @__PURE__ */ new Set();
			this.#listeners.set(event, listeners);
		}
		listeners.add(listener);
		return () => {
			this.off(event, listener);
		};
	}
	off(event, listener) {
		const listeners = this.#listeners.get(event);
		if (!listeners) return;
		listeners.delete(listener);
		if (listeners.size === 0) this.#listeners.delete(event);
	}
	emit(event, ...args) {
		this.#dispatch(event, args);
		this.#parent?.bubble(this.#prefix ? `${this.#prefix}.${event}` : event, args);
	}
	bubble(event, args) {
		this.#dispatch(event, args);
		this.#parent?.bubble(event, args);
	}
	listenerCount(event) {
		return this.#listeners.get(event)?.size ?? 0;
	}
	destroy() {
		this.#listeners.clear();
	}
	#dispatch(event, args) {
		const listeners = this.#listeners.get(event);
		if (!listeners) return;
		for (const listener of [...listeners]) listener(...args);
	}
};
// src/util/screen-bbox.ts
function outermostSvg(element) {
	let result = element;
	let owner = element instanceof SVGElement ? element.ownerSVGElement : null;
	while (owner) {
		result = owner;
		owner = owner.ownerSVGElement;
	}
	return result;
}
function screenBBox(element) {
	const bounds = element.getBoundingClientRect();
	const containerBounds = outermostSvg(element).getBoundingClientRect();
	return {
		x: bounds.left - containerBounds.left,
		y: bounds.top - containerBounds.top,
		width: bounds.width,
		height: bounds.height,
		clientX: bounds.left,
		clientY: bounds.top,
		pageX: bounds.left + window.scrollX,
		pageY: bounds.top + window.scrollY
	};
}
// src/util/dom-observable.ts
/**
* Observable that forwards DOM events of an element.
* Exactly one native listener is registered per event type, regardless of the number of subscribers,
* and it is removed once the last subscriber is gone.
*/
var DomObservable = class extends Observable {
	#element;
	#name;
	#attached = /* @__PURE__ */ new Set();
	/** `name` is passed to the listeners; without it, the ID of the element. */
	constructor(element, parent, prefix, name) {
		super(parent, prefix);
		this.#element = element;
		this.#name = name;
	}
	on(event, listener) {
		const unsubscribe = super.on(event, listener);
		if (!this.#attached.has(event)) {
			this.#element.addEventListener(event, this.#handleEvent);
			this.#attached.add(event);
		}
		return unsubscribe;
	}
	off(event, listener) {
		super.off(event, listener);
		if (this.listenerCount(event) === 0) this.#detach(event);
	}
	destroy() {
		super.destroy();
		for (const event of [...this.#attached]) this.#detach(event);
	}
	#detach(event) {
		if (!this.#attached.delete(event)) return;
		this.#element.removeEventListener(event, this.#handleEvent);
	}
	#handleEvent = (event) => {
		this.emit(event.type, this.#name ?? this.#element.id, this.#element, event, screenBBox(this.#element));
	};
};
// src/util/fetch-text.ts
/** Loads a text resource (markup, configuration). Rejects on network errors and non-2xx responses. */
async function fetchText(url, init) {
	const response = await fetch(url, init);
	if (!response.ok) throw new Error(`Failed to load ${String(url)}: ${String(response.status)} ${response.statusText}`);
	return response.text();
}
// src/util/geometry.ts
/** Resolves a named anchor of `box`; an explicit point is returned unchanged. */
function boxPosition(box, anchor = "center") {
	if (typeof anchor !== "string") return anchor;
	const { x, y, width, height } = box;
	const right = x + width;
	const bottom = y + height;
	const cx = x + width / 2;
	const cy = y + height / 2;
	switch (anchor) {
		case "top-left": return {
			x,
			y
		};
		case "top": return {
			x: cx,
			y
		};
		case "top-right": return {
			x: right,
			y
		};
		case "left": return {
			x,
			y: cy
		};
		case "center": return {
			x: cx,
			y: cy
		};
		case "right": return {
			x: right,
			y: cy
		};
		case "bottom-left": return {
			x,
			y: bottom
		};
		case "bottom": return {
			x: cx,
			y: bottom
		};
		case "bottom-right": return {
			x: right,
			y: bottom
		};
	}
}
/**
* Bounding box of all elements after their transforms, in the coordinate system of the nearest viewport
* (`getCTM`). Returns `null` for an empty list.
*/
function combinedBoundingBox(elements, padding = 0) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const element of elements) {
		const bbox = element.getBBox();
		const matrix = element.getCTM() ?? new DOMMatrix();
		const corners = [
			new DOMPoint(bbox.x, bbox.y),
			new DOMPoint(bbox.x + bbox.width, bbox.y),
			new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height),
			new DOMPoint(bbox.x, bbox.y + bbox.height)
		];
		for (const corner of corners) {
			const p = corner.matrixTransform(matrix);
			minX = Math.min(minX, p.x);
			minY = Math.min(minY, p.y);
			maxX = Math.max(maxX, p.x);
			maxY = Math.max(maxY, p.y);
		}
	}
	if (minX === Infinity) return null;
	return {
		x: minX - padding,
		y: minY - padding,
		width: maxX - minX + 2 * padding,
		height: maxY - minY + 2 * padding
	};
}
// src/util/interpolate.ts
function ease(t, easing) {
	return easing ? easing(t) : t;
}
const interpolateNumber = (from, to, t, easing) => from + (to - from) * ease(t, easing);
const interpolatePoint = (from, to, t, easing) => {
	const f = ease(t, easing);
	return {
		x: from.x + (to.x - from.x) * f,
		y: from.y + (to.y - from.y) * f
	};
};
/**
* Interpolates CSS color strings; intermediate results are hex/rgba strings or `none`.
* The bounds are returned unchanged, so non-color paints such as `url(#gradient)` survive.
*/
const interpolateCssColor = (from, to, t, easing) => {
	const f = ease(t, easing);
	if (f === 0) return from;
	if (f === 1) return to;
	return formatColor(interpolateColor(parseColor(from), parseColor(to), f));
};
/** Discrete values (text, urls) keep the start value until the end is reached. */
const interpolateDiscrete = (from, to, t, easing) => ease(t, easing) < 1 ? from : to;
// src/util/logger.ts
const enabledLevels = /* @__PURE__ */ new Set(["warn", "error"]);
function setLogLevel(level, enabled) {
	if (enabled) enabledLevels.add(level);
	else enabledLevels.delete(level);
}
function isLogLevelEnabled(level) {
	return enabledLevels.has(level);
}
function createLogger(name) {
	const prefix = `[${name}]`;
	const log = (level) => (...args) => {
		if (enabledLevels.has(level)) console[level](prefix, ...args);
	};
	return Object.freeze({
		debug: log("debug"),
		info: log("info"),
		warn: log("warn"),
		error: log("error")
	});
}
// src/model/frames.ts
/**
* Frames of a transformation: its configured frames plus the ends of the domain (minimum and
* maximum, false and true) without a value where the transformation configures none. The ends
* keep interpolation and lookup defined over the whole domain.
*/
function createFrames(variable, domainEnds, configs) {
	const byIndex = /* @__PURE__ */ new Map();
	for (const index of domainEnds) byIndex.set(index, {
		index,
		exists: false,
		value: null,
		easing: resolveEasing(void 0)
	});
	for (const config of configs) {
		const index = resolveFramePosition(variable, config.at);
		byIndex.set(index, {
			index,
			exists: true,
			value: config.value,
			easing: resolveEasing(config.easing)
		});
	}
	const series = Array.from(byIndex.values());
	if (variable.type === "number") series.sort((left, right) => left.index - right.index);
	return {
		series,
		byIndex
	};
}
// src/model/transformation.ts
function createTransformationModel(config, variable) {
	const frames = createFrames(variable.config, variable.domainEnds, config.frames);
	const configured = config.default;
	return Object.freeze({
		config,
		name: config.name ?? `${config.type}_${config.element}`,
		type: config.type,
		element: config.element,
		variable,
		frames,
		priority: config.priority ?? 0,
		defaultValue: (fallback) => configured ?? fallback
	});
}
// src/model/variable.ts
function createDomainEnds(config) {
	switch (config.type) {
		case "number": return [config.minimum, config.maximum];
		case "boolean": return [false, true];
		case "text": return [];
	}
}
function createVariableModel(config) {
	return Object.freeze({
		config,
		name: config.name,
		type: config.type,
		domainEnds: Object.freeze(createDomainEnds(config))
	});
}
// src/translation/mapping.ts
/** Discrete lookup of the frame located exactly at the variable value (boolean and text variables). */
function mapping(frames) {
	return (index, fallback) => {
		if (index == null) return fallback;
		return frames.byIndex.get(index)?.value ?? fallback;
	};
}
// src/translation/transition.ts
/** Configured frames enclosing `index`; falls back to the first/last frame of the series. */
function boundaries(index, series) {
	const first = series[0];
	const last = series.at(-1);
	assert(first && last, "Need at least one frame");
	let lower;
	let upper;
	for (const frame of series) {
		if (!frame.exists) continue;
		if (frame.index > index) {
			upper = frame;
			break;
		}
		lower = frame;
	}
	return {
		lower: lower ?? first,
		upper: upper ?? last
	};
}
function progress(index, { lower, upper }) {
	const min = lower.index;
	const max = upper.index;
	const t = (Math.min(Math.max(index, min), max) - min) / (max - min);
	return Number.isFinite(t) ? t : 0;
}
/** Continuous interpolation between the frames enclosing the value (number variables). */
function transition(frames, interpolate) {
	return (index, fallback) => {
		if (typeof index !== "number" || Number.isNaN(index)) return fallback;
		const bounds = boundaries(index, frames.series);
		const lowerValue = bounds.lower.value ?? fallback;
		return interpolate(lowerValue, bounds.upper.value ?? (bounds.upper.exists ? fallback : lowerValue), progress(index, bounds), bounds.lower.easing);
	};
}
// src/translation/factory.ts
function createTranslation(indexType, frames, interpolate) {
	switch (indexType) {
		case "number": return transition(frames, interpolate);
		case "boolean":
		case "text": return mapping(frames);
	}
}
// src/runtime/scheduler.ts
const PHASES = [
	"reset",
	"transform",
	"render"
];
const log$4 = createLogger("cuttleskin.scheduler");
/**
* Executes scheduled tasks once per animation frame in the phases reset, transform and render.
* - Higher priorities run first; equal priorities keep their scheduling order
* - Tasks scheduled while a frame runs are executed in the same frame if their phase has not passed yet,
*   otherwise in the next frame
* - A failing task is logged and does not affect other tasks
*/
var Scheduler = class extends Observable {
	#queues = {
		reset: [],
		transform: [],
		render: []
	};
	#frameId;
	#running = false;
	constructor(parent) {
		super(parent, "scheduler");
	}
	scheduleReset(task, priority = 0) {
		return this.#schedule("reset", task, priority);
	}
	scheduleTransform(task, priority = 0) {
		return this.#schedule("transform", task, priority);
	}
	scheduleRender(task, priority = 0) {
		return this.#schedule("render", task, priority);
	}
	/** Number of tasks waiting for execution. */
	get pending() {
		return PHASES.reduce((sum, phase) => sum + this.#queues[phase].length, 0);
	}
	/** Executes all pending tasks synchronously instead of waiting for the next animation frame. */
	flush() {
		this.#cancelFrame();
		this.#execute();
	}
	destroy() {
		this.#cancelFrame();
		for (const phase of PHASES) this.#queues[phase] = [];
		super.destroy();
	}
	#schedule(phase, task, priority) {
		const entry = {
			task,
			priority
		};
		const queue = this.#queues[phase];
		const index = queue.findIndex((other) => other.priority < priority);
		queue.splice(index < 0 ? queue.length : index, 0, entry);
		this.#requestFrame();
		return () => {
			const position = this.#queues[phase].indexOf(entry);
			if (position >= 0) this.#queues[phase].splice(position, 1);
		};
	}
	#requestFrame() {
		if (this.#frameId !== void 0 || this.#running) return;
		this.#frameId = requestAnimationFrame(() => {
			this.#frameId = void 0;
			this.#execute();
		});
	}
	#cancelFrame() {
		if (this.#frameId !== void 0) cancelAnimationFrame(this.#frameId);
		this.#frameId = void 0;
	}
	#execute() {
		if (this.#running) return;
		this.#running = true;
		try {
			this.emit("start");
			for (const phase of PHASES) {
				this.#executePhase(phase);
				this.emit(phase);
			}
			this.emit("complete");
		} finally {
			this.#running = false;
		}
		if (this.pending > 0) this.#requestFrame();
	}
	#executePhase(phase) {
		const queue = this.#queues[phase];
		for (let entry = queue.shift(); entry; entry = queue.shift()) try {
			entry.task();
		} catch (error) {
			log$4.error(`Error executing task in ${phase} phase`, error);
		}
	}
};
// src/runtime/element/attributes.ts
const XLINK_NS$1 = "http://www.w3.org/1999/xlink";
function localMatrix(node) {
	if (!(node instanceof SVGGraphicsElement)) return new DOMMatrix();
	const consolidated = node.transform.baseVal.consolidate();
	return consolidated ? DOMMatrix.fromMatrix(consolidated.matrix) : new DOMMatrix();
}
/** Transforms of the node and its ancestors up to the nearest `<svg>`. */
function totalMatrix(node) {
	let matrix = localMatrix(node);
	for (let parent = node.parentElement; parent && !(parent instanceof SVGSVGElement); parent = parent.parentElement) matrix = localMatrix(parent).multiply(matrix);
	return matrix;
}
function attributeRestorer(node, name, namespace = null) {
	const value = node.getAttributeNS(namespace, name);
	return () => {
		if (value === null) node.removeAttributeNS(namespace, name);
		else node.setAttributeNS(namespace, name, value);
	};
}
/** Accessor for a CSS property; writes inline styles so they override attributes and stylesheet rules. */
function styleAccessor(property, parse, serialize) {
	return (node) => ({
		read: () => parse(getComputedStyle(node).getPropertyValue(property)),
		write: (value) => {
			node.style.setProperty(property, serialize(value));
		},
		capture: () => {
			const value = node.style.getPropertyValue(property);
			const priority = node.style.getPropertyPriority(property);
			return () => {
				if (value) node.style.setProperty(property, value, priority);
				else node.style.removeProperty(property);
			};
		}
	});
}
const identity = (value) => value;
const ACCESSORS = {
	transform: (node) => ({
		read: () => ({
			local: localMatrix(node),
			total: totalMatrix(node)
		}),
		write: (value) => {
			node.setAttribute("transform", value.local.toString());
		},
		capture: () => attributeRestorer(node, "transform")
	}),
	bbox: (node) => ({
		read: () => {
			const { x, y, width, height } = node.getBBox();
			return {
				x,
				y,
				width,
				height
			};
		},
		write: () => {},
		capture: () => () => {}
	}),
	text: (node) => ({
		read: () => node.textContent,
		write: (value) => {
			node.textContent = value;
		},
		capture: () => {
			const text = node.textContent;
			return () => {
				node.textContent = text;
			};
		}
	}),
	href: (node, assets) => ({
		read: () => {
			const url = node.getAttribute("href") ?? node.getAttributeNS(XLINK_NS$1, "href") ?? "";
			return url ? assets.nameOf(url) : "";
		},
		write: (value) => {
			const url = value ? assets.resolve(value) : "";
			if (url && isSafeUrl(url)) node.setAttribute("href", url);
			else {
				node.removeAttribute("href");
				node.removeAttributeNS(XLINK_NS$1, "href");
			}
		},
		capture: () => {
			const restoreHref = attributeRestorer(node, "href");
			const restoreXlink = attributeRestorer(node, "href", XLINK_NS$1);
			return () => {
				restoreHref();
				restoreXlink();
			};
		}
	}),
	fill: styleAccessor("fill", identity, identity),
	stroke: styleAccessor("stroke", identity, identity),
	"stroke-width": styleAccessor("stroke-width", parseFloat, (value) => `${String(value)}px`),
	opacity: styleAccessor("opacity", parseFloat, String),
	display: styleAccessor("display", identity, identity),
	visibility: styleAccessor("visibility", identity, identity)
};
function createAccessor(node, attribute, assets) {
	return ACCESSORS[attribute](node, assets);
}
// src/runtime/element/element-state.ts
/**
* Buffered attribute access for one element.
* - Default values: effective values before any modification, read once and cached
* - Modifications are collected and written to the DOM in `apply()`
* - Attributes modified earlier but not in the current frame are restored to their original markup state
*/
var ElementState = class {
	#node;
	#assets;
	#accessors = /* @__PURE__ */ new Map();
	#defaults = /* @__PURE__ */ new Map();
	#modified = /* @__PURE__ */ new Map();
	/** Attributes currently differing from markup, with their restore functions. */
	#restorers = /* @__PURE__ */ new Map();
	constructor(node, assets) {
		this.#node = node;
		this.#assets = assets;
	}
	getDefaultValue(attribute) {
		if (!this.#defaults.has(attribute)) this.#defaults.set(attribute, this.#accessor(attribute).read());
		return this.#defaults.get(attribute);
	}
	getDefaultValues(attributes) {
		return Object.fromEntries(attributes.map((attribute) => [attribute, this.getDefaultValue(attribute)]));
	}
	/** Value modified in the current frame, otherwise the default value. */
	getValue(attribute) {
		return this.#modified.has(attribute) ? this.#modified.get(attribute) : this.getDefaultValue(attribute);
	}
	getValues(attributes) {
		return Object.fromEntries(attributes.map((attribute) => [attribute, this.getValue(attribute)]));
	}
	setValue(attribute, value) {
		this.getDefaultValue(attribute);
		if (!this.#restorers.has(attribute)) this.#restorers.set(attribute, this.#accessor(attribute).capture());
		this.#modified.set(attribute, value);
	}
	setValues(values) {
		const entries = Object.entries(values);
		for (const [attribute, value] of entries) if (value !== void 0) this.setValue(attribute, value);
	}
	/** Writes modifications to the DOM, restores attributes that are no longer modified and starts a new frame. */
	apply() {
		for (const [attribute, restore] of this.#restorers) if (this.#modified.has(attribute)) this.#accessor(attribute).write(this.#modified.get(attribute));
		else {
			restore();
			this.#restorers.delete(attribute);
		}
		this.#modified.clear();
	}
	/** Discards modifications of the current frame. */
	clear() {
		this.#modified.clear();
	}
	#accessor(attribute) {
		let accessor = this.#accessors.get(attribute);
		if (!accessor) {
			accessor = createAccessor(this.#node, attribute, this.#assets);
			this.#accessors.set(attribute, accessor);
		}
		return accessor;
	}
};
// src/runtime/element/element.ts
const log$3 = createLogger("cuttleskin.element");
/**
* Runtime wrapper of an SVG element.
* - Collects transform functions and renders them in priority order in the render phase
* - Restores the original markup state when transforms are removed or the element is destroyed
* - Forwards DOM events via `dom` (e.g. `element.dom.on('click', ...)`, bubbled as `element.click`)
*/
var RuntimeElement = class extends Observable {
	node;
	/** DOM events of the node. */
	dom;
	#state;
	#scheduler;
	#transforms = [];
	#unscheduleRender;
	constructor(node, context, config) {
		super(context.events, "element");
		this.node = node;
		this.dom = new DomObservable(node, context.events, "element", config?.name);
		this.#state = new ElementState(node, context.assets);
		this.#scheduler = context.scheduler;
		for (const event of config?.events ?? []) this.dom.on(event, () => void 0);
	}
	get id() {
		return this.node.id;
	}
	getDefaultValue(attribute) {
		return this.#state.getDefaultValue(attribute);
	}
	getDefaultValues(attributes) {
		return this.#state.getDefaultValues(attributes);
	}
	/**
	* Adds a transform function executed on every render; higher priorities run first.
	* Returns a function that removes it again and re-renders the element.
	*/
	transform(fn, priority = 0) {
		const entry = {
			fn,
			priority
		};
		this.#transforms.push(entry);
		this.#scheduleRender();
		return () => {
			const index = this.#transforms.indexOf(entry);
			if (index < 0) return;
			this.#transforms.splice(index, 1);
			this.#scheduleRender();
		};
	}
	/** Current position and size on screen. */
	screenBBox() {
		return screenBBox(this.node);
	}
	/** Removes all transforms, restores the original markup state in the next reset phase and removes listeners. */
	destroy() {
		this.#transforms = [];
		this.#state.clear();
		this.#unscheduleRender?.();
		this.#scheduler.scheduleReset(() => {
			this.#state.apply();
		});
		this.emit("destroy", this);
		this.dom.destroy();
		super.destroy();
	}
	#scheduleRender() {
		this.#unscheduleRender?.();
		this.#unscheduleRender = this.#scheduler.scheduleRender(() => {
			this.#render();
		});
	}
	#render() {
		this.#unscheduleRender = void 0;
		const ordered = [...this.#transforms].sort((left, right) => right.priority - left.priority);
		for (const { fn } of ordered) fn(this.#state);
		this.#state.apply();
		this.emit("render", this);
		log$3.debug("Rendered element", this.id);
	}
};
// src/runtime/transformation/types/appearance.ts
/**
* Sets the opacity. At opacity 0 the element is also hidden (`visibility: hidden`) so it no longer receives
* pointer events; this is skipped in the editor to keep the visibility defined in the markup.
*/
function opacity(model, settings) {
	const translation = createTranslation(model.variable.type, model.frames, interpolateNumber);
	const toggleVisibility = settings.mode !== "editor";
	return {
		attributes: ["opacity", "visibility"],
		calculate: (value, defaults) => translation(value, model.defaultValue(defaults.opacity)),
		interpolate: interpolateNumber,
		apply: (value) => toggleVisibility ? {
			opacity: value,
			visibility: value === 0 ? "hidden" : "inherit"
		} : { opacity: value }
	};
}
/** Sets the fill paint. */
function fillColor(model) {
	const translation = createTranslation(model.variable.type, model.frames, interpolateCssColor);
	return {
		attributes: ["fill"],
		calculate: (value, defaults) => translation(value, model.defaultValue(defaults.fill)),
		interpolate: interpolateCssColor,
		apply: (fill) => ({ fill })
	};
}
/** Sets the stroke paint. */
function strokeColor(model) {
	const translation = createTranslation(model.variable.type, model.frames, interpolateCssColor);
	return {
		attributes: ["stroke"],
		calculate: (value, defaults) => translation(value, model.defaultValue(defaults.stroke)),
		interpolate: interpolateCssColor,
		apply: (stroke) => ({ stroke })
	};
}
/** Sets the stroke width in user units. */
function strokeWidth(model) {
	const translation = createTranslation(model.variable.type, model.frames, interpolateNumber);
	return {
		attributes: ["stroke-width"],
		calculate: (value, defaults) => translation(value, model.defaultValue(defaults["stroke-width"])),
		interpolate: interpolateNumber,
		apply: (width) => ({ "stroke-width": width })
	};
}
/** Replaces the text content; supports `bind` to show the formatted variable value. */
function text(model) {
	const translation = createTranslation(model.variable.type, model.frames, interpolateDiscrete);
	return {
		attributes: ["text"],
		calculate: (value, defaults) => translation(value, model.defaultValue(defaults.text)),
		interpolate: interpolateDiscrete,
		apply: (content) => ({ text: content }),
		fromText: (content) => content
	};
}
/** Replaces the image of an `<image>` element by asset name; supports `bind`. */
function imageUrl(model) {
	const translation = createTranslation(model.variable.type, model.frames, interpolateDiscrete);
	return {
		attributes: ["href"],
		calculate: (value, defaults) => translation(value, model.defaultValue(defaults.href)),
		interpolate: interpolateDiscrete,
		apply: (href) => ({ href }),
		fromText: (name) => name
	};
}
// src/runtime/transformation/types/geometric.ts
/**
* Applies `matrix`, given in the coordinate system of the nearest `<svg>`, on top of the current transform.
* The element's local transform becomes `local * total^-1 * matrix * total`.
*/
function applyInSvgSpace(transform, matrix) {
	return {
		local: transform.local.multiply(transform.total.inverse()).multiply(matrix).multiply(transform.total),
		total: matrix.multiply(transform.total)
	};
}
/** Moves the element by a point value in `<svg>` coordinates. */
function translate(model) {
	const translation = createTranslation(model.variable.type, model.frames, interpolatePoint);
	return {
		attributes: ["transform"],
		calculate: (value) => translation(value, model.defaultValue({
			x: 0,
			y: 0
		})),
		interpolate: interpolatePoint,
		apply: (offset, { transform }) => ({ transform: applyInSvgSpace(transform, new DOMMatrix().translate(offset.x, offset.y)) })
	};
}
/** Rotates the element by an angle in degrees around `origin` (anchor of its bounding box). */
function rotate(model) {
	const translation = createTranslation(model.variable.type, model.frames, interpolateNumber);
	return {
		attributes: ["transform", "bbox"],
		calculate: (value) => translation(value, model.defaultValue(0)),
		interpolate: interpolateNumber,
		apply: (angle, { transform, bbox }) => {
			const origin = boxPosition(bbox, model.config.origin);
			const pivot = new DOMPoint(origin.x, origin.y).matrixTransform(transform.total);
			return { transform: applyInSvgSpace(transform, new DOMMatrix().translate(pivot.x, pivot.y).rotate(angle).translate(-pivot.x, -pivot.y)) };
		}
	};
}
/** Scales the element by a point factor around `origin` in its own user space. */
function scale(model) {
	const translation = createTranslation(model.variable.type, model.frames, interpolatePoint);
	return {
		attributes: ["transform", "bbox"],
		calculate: (value) => translation(value, model.defaultValue({
			x: 1,
			y: 1
		})),
		interpolate: interpolatePoint,
		apply: (factor, { transform, bbox }) => {
			const pivot = boxPosition(bbox, model.config.origin);
			const scaling = new DOMMatrix().translate(pivot.x, pivot.y).scale(factor.x, factor.y).translate(-pivot.x, -pivot.y);
			return { transform: {
				local: transform.local.multiply(scaling),
				total: transform.total.multiply(scaling)
			} };
		}
	};
}
/**
* Position and direction on a path, given as percentage of its length, in `<svg>` coordinates.
* The direction is the chord between two points just before and after the position, so it is the
* mean direction exactly at a corner; at the ends only the inner side is used.
*/
function pathPose(path, percent) {
	const length = path.getTotalLength();
	const at = Math.min(Math.max(percent, 0), 100) / 100 * length;
	const matrix = totalMatrix(path);
	const point = (distance) => {
		const local = path.getPointAtLength(Math.min(Math.max(distance, 0), length));
		return new DOMPoint(local.x, local.y).matrixTransform(matrix);
	};
	const { x, y } = point(at);
	const delta = Math.max(length * 1e-4, .001);
	const before = point(at - delta);
	const after = point(at + delta);
	const dx = after.x - before.x;
	const dy = after.y - before.y;
	return {
		x,
		y,
		angle: dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx) * 180 / Math.PI
	};
}
/**
* Moves the element along `path` so that its `origin` anchor lies on the path; the value is the position
* in percent of the path length (0–100). Overrides the position reached by higher-priority transforms.
* With `orient`, the element is also rotated around the anchor by the direction of the path; it is
* drawn facing right (positive x axis), and a rotation it already has is kept on top.
*/
function motionPath(model, path) {
	const translation = createTranslation(model.variable.type, model.frames, interpolateNumber);
	const orient = model.config.orient === true;
	return {
		attributes: ["transform", "bbox"],
		calculate: (value) => translation(value, model.defaultValue(0)),
		interpolate: interpolateNumber,
		apply: (percent, { transform, bbox }) => {
			const target = pathPose(path, percent);
			const anchor = boxPosition(bbox, model.config.origin);
			const current = new DOMPoint(anchor.x, anchor.y).matrixTransform(transform.total);
			let matrix = new DOMMatrix().translate(target.x - current.x, target.y - current.y);
			if (orient) matrix = new DOMMatrix().translate(target.x, target.y).rotate(target.angle).translate(-target.x, -target.y).multiply(matrix);
			return { transform: applyInSvgSpace(transform, matrix) };
		}
	};
}
// src/runtime/transformation/factory.ts
/**
* Creates the behaviour for the model's transformation type.
* Frame values are trusted to match the type; validating them is the job of the config parser.
*/
function createTransformType(model, settings, path) {
	switch (model.type) {
		case "translate": return translate(model);
		case "rotate": return rotate(model);
		case "scale": return scale(model);
		case "opacity": return opacity(model, settings);
		case "fill-color": return fillColor(model);
		case "stroke-color": return strokeColor(model);
		case "stroke-width": return strokeWidth(model);
		case "text": return text(model);
		case "image-url": return imageUrl(model);
		case "motion-path":
			assert(path, `Path element missing: ${String(model.config.path)}`);
			return motionPath(model, path);
	}
}
// src/runtime/transformation/updater.ts
/** Applies every value immediately. */
function discreteUpdater(apply) {
	return {
		update: apply,
		destroy: () => void 0
	};
}
/**
* Animates from the currently displayed value to the next one. The first value is applied immediately;
* a new value during a running animation starts from the intermediate value reached so far.
*/
function transitionUpdater(transition, interpolate, apply) {
	const easing = resolveEasing(transition.easing);
	let animation;
	let current;
	return {
		update(next) {
			animation?.stop();
			if (!current) {
				current = { value: next };
				apply(next);
				return;
			}
			const from = current.value;
			const state = current;
			animation = animate({
				duration: transition.duration,
				easing,
				onUpdate: (progress) => {
					state.value = interpolate(from, next, progress);
					apply(state.value);
				}
			});
		},
		destroy() {
			animation?.stop();
		}
	};
}
// src/runtime/transformation/transformation.ts
const log$2 = createLogger("cuttleskin.transformation");
/** Shape followed by a `motion-path` transformation; throws if it does not exist or has no geometry. */
function resolvePath(config, context) {
	if (config.type !== "motion-path" || config.path === void 0) return void 0;
	const node = context.getElement(config.path)?.node;
	assert(node, `Path element does not exist: ${config.path}`);
	assert(node instanceof SVGGeometryElement, `Element is not a path or shape: ${config.path}`);
	return node;
}
/**
* Connects a variable with an element:
* - On variable changes, computes the new value in the transform phase
* - Applies the value (optionally animated) as transform function on the element
*/
var Transformation = class extends Observable {
	model;
	#variable;
	#element;
	#type;
	#updater;
	#scheduler;
	#unobserve;
	#unschedule;
	#removeTransform;
	/** Throws if variable or element do not exist. */
	constructor(config, context) {
		super(context.events, "transformation");
		const variable = context.getVariable(config.variable);
		const element = context.getElement(config.element);
		assert(variable, `Variable does not exist: ${config.variable}`);
		assert(element, `Element does not exist: ${config.element}`);
		this.#variable = variable;
		this.#element = element;
		this.#scheduler = context.scheduler;
		this.model = createTransformationModel(config, variable.model);
		this.#type = createTransformType(this.model, context.settings, resolvePath(config, context));
		if (config.bind && !this.#type.fromText) log$2.warn(`Transformation type does not support bind: ${config.type}`, this.model.name);
		const apply = (value) => {
			this.#apply(value);
		};
		const transition = config.transition;
		this.#updater = transition && Number.isFinite(transition.duration) && transition.duration > 0 ? transitionUpdater(transition, (from, to, t) => this.#type.interpolate(from, to, t), apply) : discreteUpdater(apply);
		this.#unobserve = variable.on("change", () => {
			this.schedule();
		});
	}
	/** Schedules a recalculation in the next transform phase. */
	schedule() {
		this.#unschedule?.();
		this.#unschedule = this.#scheduler.scheduleTransform(() => {
			this.#update();
		}, this.model.priority);
	}
	destroy() {
		this.#removeTransform?.();
		this.#updater.destroy();
		this.#unobserve();
		this.#unschedule?.();
		this.emit("destroy", this);
		super.destroy();
	}
	#update() {
		this.#unschedule = void 0;
		const type = this.#type;
		const value = this.model.config.bind && type.fromText ? type.fromText(this.#variable.formattedValue) : type.calculate(this.#variable.value, this.#element.getDefaultValues(type.attributes));
		this.#updater.update(value);
		this.emit("update", this);
	}
	#apply(value) {
		const type = this.#type;
		this.#removeTransform?.();
		this.#removeTransform = this.#element.transform((state) => {
			state.setValues(type.apply(value, state.getValues(type.attributes)));
		}, this.model.priority);
	}
};
// src/runtime/variable/value.ts
function parseNumber(value) {
	const parsed = parseFloat(value);
	return Number.isNaN(parsed) ? null : parsed;
}
/** Converts external input into the variable's type; `null` if it cannot be represented. */
function convertValue(value, type) {
	switch (type) {
		case "number":
			if (typeof value === "number") return Number.isFinite(value) ? value : null;
			if (typeof value === "string") return parseNumber(value);
			if (typeof value === "boolean") return value ? 1 : 0;
			return null;
		case "boolean":
			if (typeof value === "boolean") return value;
			if (typeof value === "number") return value > 0;
			if (typeof value === "string") {
				const number = parseNumber(value);
				return number === null ? value.trim().toLowerCase() === "true" : number > 0;
			}
			return null;
		case "text":
			if (typeof value === "string") return value;
			if (typeof value === "number" || typeof value === "boolean") return String(value);
			return null;
	}
}
/** Clamps number values into the configured domain. */
function sanitizeValue(value, config) {
	if (config.type !== "number" || typeof value !== "number") return value;
	return Math.min(Math.max(value, config.minimum), config.maximum);
}
/** Display text of a value; numbers are rounded to integers. */
function formatValue(value) {
	if (value === null) return "";
	if (typeof value === "number") return String(Math.round(value));
	return String(value);
}
/** Value used when no `defaultValue` is configured. */
function domainDefault(config) {
	switch (config.type) {
		case "number": return config.minimum;
		case "boolean": return false;
		case "text": return "";
	}
}
// src/runtime/variable/variable.ts
/** Runtime state of a configured variable: converts, clamps and formats values and notifies on change. */
var Variable = class extends Observable {
	model;
	#value = null;
	#formattedValue = "";
	constructor(config, parent) {
		super(parent, "variable");
		this.model = createVariableModel(config);
		this.reset();
	}
	get name() {
		return this.model.name;
	}
	/** Current value; `null` if the last input could not be converted. */
	get value() {
		return this.#value;
	}
	/** Display text of the current value. */
	get formattedValue() {
		return this.#formattedValue;
	}
	/**
	* Sets a new value. The input is converted to the variable type and clamped to the domain.
	* `formattedValue` overrides the generated display text.
	*/
	setValue(value, formattedValue) {
		const config = this.model.config;
		this.#value = sanitizeValue(convertValue(value, config.type), config);
		this.#formattedValue = formattedValue ?? formatValue(this.#value);
		this.emit("change", this, this.#value, this.#formattedValue);
	}
	/** Restores the configured default value. */
	reset() {
		this.setValue(this.model.config.defaultValue ?? domainDefault(this.model.config));
	}
	destroy() {
		this.emit("destroy", this);
		super.destroy();
	}
};
// src/runtime/runtime.ts
const EMPTY_CONFIG = Object.freeze({
	variables: [],
	transformations: []
});
const log$1 = createLogger("cuttleskin.runtime");
/**
* Builds variables, elements and transformations from a graphic configuration and manages their lifecycle.
* Entries that fail to initialize (e.g. missing SVG element) are logged and skipped.
*/
var Runtime = class {
	#context;
	#config = EMPTY_CONFIG;
	#variables = /* @__PURE__ */ new Map();
	#elements = /* @__PURE__ */ new Map();
	#transformations = [];
	constructor(context) {
		this.#context = context;
	}
	/** The currently loaded configuration. */
	get config() {
		return this.#config;
	}
	get variables() {
		return this.#variables;
	}
	get transformations() {
		return this.#transformations;
	}
	/** Replaces the current configuration; the previous one is destroyed and its DOM changes restored. */
	load(config) {
		this.#clear();
		this.#config = config;
		for (const element of config.elements ?? []) this.#createElement(element);
		for (const variable of config.variables) this.#createVariable(variable);
		const context = this.#transformationContext();
		for (const transformation of config.transformations) this.#createTransformation(transformation, context);
		for (const transformation of this.#transformations) transformation.schedule();
		log$1.debug(`Loaded ${String(this.#variables.size)} variables, ${String(this.#transformations.length)} transformations`);
	}
	getVariable(name) {
		return this.#variables.get(name);
	}
	/** Sets a variable value; logs a warning if the variable does not exist. */
	setValue(name, value, formattedValue) {
		const variable = this.#variables.get(name);
		if (!variable) {
			log$1.warn(`Variable does not exist: ${name}`);
			return;
		}
		variable.setValue(value, formattedValue);
	}
	getValue(name) {
		return this.#variables.get(name)?.value;
	}
	/**
	* Runtime wrapper for an element of the document, created on first access.
	* Elements with an ID are cached; `undefined` if no such element exists.
	*/
	getElement(elementOrId) {
		const id = typeof elementOrId === "string" ? elementOrId : elementOrId.id;
		const cached = id ? this.#elements.get(id) : void 0;
		if (cached) return cached;
		const node = typeof elementOrId === "string" ? this.#context.document.getElement(elementOrId) : elementOrId;
		if (!node) return void 0;
		const element = this.#newElement(node);
		if (id) this.#elements.set(id, element);
		return element;
	}
	destroy() {
		this.#clear();
		this.#config = EMPTY_CONFIG;
	}
	#clear() {
		for (const transformation of this.#transformations) transformation.destroy();
		for (const variable of this.#variables.values()) variable.destroy();
		for (const element of this.#elements.values()) element.destroy();
		this.#transformations = [];
		this.#variables = /* @__PURE__ */ new Map();
		this.#elements = /* @__PURE__ */ new Map();
	}
	#newElement(node, config) {
		const { scheduler, assets, events } = this.#context;
		return new RuntimeElement(node, events ? {
			scheduler,
			assets,
			events
		} : {
			scheduler,
			assets
		}, config);
	}
	#createElement(config) {
		const node = this.#context.document.getElement(config.id);
		if (!node) {
			log$1.error(`Error initializing element: ${config.id}`, "Element does not exist");
			return;
		}
		this.#elements.set(config.id, this.#newElement(node, config));
	}
	#createVariable(config) {
		this.#variables.set(config.name, new Variable(config, this.#context.events));
	}
	#createTransformation(config, context) {
		try {
			this.#transformations.push(new Transformation(config, context));
		} catch (error) {
			log$1.error(`Error initializing transformation: ${config.name ?? `${config.type}_${config.element}`}`, error);
		}
	}
	#transformationContext() {
		const { scheduler, settings, events } = this.#context;
		const lookups = {
			getVariable: (name) => this.getVariable(name),
			getElement: (id) => this.getElement(id)
		};
		return events ? {
			scheduler,
			settings,
			events,
			...lookups
		} : {
			scheduler,
			settings,
			...lookups
		};
	}
};
// src/runtime/load-config.ts
/**
* Loads and validates a graphic configuration.
* Rejects on network errors; JSON and schema problems are returned as `issues`.
*/
async function loadGraphicConfig(url, init) {
	return parseGraphicConfigJson(await fetchText(url, init));
}
// src/document/sanitize.ts
const SVG_NS$1 = "http://www.w3.org/2000/svg";
/** SVG elements that can run script or embed HTML; removed with their content. */
const BLOCKED_ELEMENTS = /* @__PURE__ */ new Set([
	"script",
	"foreignobject",
	"handler",
	"listener"
]);
/** SMIL elements that could set an event handler or a link at runtime. */
const ANIMATION_ELEMENTS = /* @__PURE__ */ new Set([
	"animate",
	"set",
	"animatetransform",
	"animatemotion"
]);
/** Whether an attribute name is an event handler (`onload`, `onclick`, …). */
function isEventHandler(name) {
	return name.toLowerCase().startsWith("on");
}
/** Whether a SMIL animation targets an event handler or a link. */
function animatesUnsafeAttribute(element) {
	const target = (element.getAttribute("attributeName") ?? "").trim().toLowerCase();
	const name = target.includes(":") ? target.slice(target.indexOf(":") + 1) : target;
	return isEventHandler(name) || name === "href";
}
/** Whether the element must be removed with its content. */
function isBlocked(element) {
	if (element.namespaceURI !== SVG_NS$1) return true;
	const name = element.localName.toLowerCase();
	if (BLOCKED_ELEMENTS.has(name)) return true;
	return ANIMATION_ELEMENTS.has(name) && animatesUnsafeAttribute(element);
}
/** Removes event handlers and unsafe links from the attributes of one element. */
function cleanAttributes(element) {
	for (const attribute of [...element.attributes]) {
		const name = attribute.localName;
		if (isEventHandler(name) || name.toLowerCase() === "href" && !isSafeUrl(attribute.value)) element.removeAttributeNode(attribute);
	}
}
/**
* Removes everything from SVG content that could run script in the page that shows it:
* - elements outside the SVG namespace (HTML, MathML, editor metadata), `<script>` and
*   `<foreignObject>`
* - event handler attributes (`onload`, `onclick`, …)
* - links and image references with other schemes than `http(s):`, `blob:`, relative URLs and
*   image data URLs, e.g. `javascript:`
* - SMIL animations that would set an event handler or a link
*
* Works in place on `root` and its descendants; call it before the content is inserted into a
* live document. Returns `false` if `root` itself must not be inserted at all.
*/
function sanitizeSvg(root) {
	const visit = (node) => {
		for (const child of [...node.childNodes]) if (child.nodeType === Node.PROCESSING_INSTRUCTION_NODE) child.remove();
		else if (child instanceof Element) {
			if (isBlocked(child)) child.remove();
			else {
				cleanAttributes(child);
				visit(child);
			}
		}
	};
	if (root instanceof Element) {
		if (isBlocked(root)) return false;
		cleanAttributes(root);
	} else if (root.nodeType === Node.PROCESSING_INSTRUCTION_NODE) return false;
	visit(root);
	return true;
}
// src/document/document.ts
const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
/** Parses SVG markup; markup with several root elements is parsed as children of a wrapper. */
function parseMarkup(markup) {
	const parser = new DOMParser();
	const document = parser.parseFromString(markup, "image/svg+xml");
	if (!document.querySelector("parsererror")) return [document.documentElement];
	const wrapped = parser.parseFromString(`<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}">${markup}</svg>`, "image/svg+xml");
	const error = wrapped.querySelector("parsererror");
	assert(!error, `Invalid SVG markup: ${error?.textContent ?? ""}`);
	return [...wrapped.documentElement.childNodes];
}
/** First `<svg>` element among or inside the nodes. */
function findSvg(nodes) {
	for (const node of nodes) {
		if (node instanceof SVGSVGElement) return node;
		if (node instanceof Element || node instanceof Document || node instanceof DocumentFragment) {
			const found = node.querySelector("svg");
			if (found instanceof SVGSVGElement) return found;
		}
	}
	return null;
}
/** Length in pixels for unitless or `px` values, otherwise `null`. */
function pixelSize(value) {
	return value && /^\s*[\d.]+(px)?\s*$/.test(value) ? parseFloat(value) : null;
}
/** Bounds declared by an SVG root via `viewBox` or pixel `width`/`height`. */
function declaredBounds(svg) {
	const viewBox = svg.getAttribute("viewBox");
	if (viewBox) {
		const [x = 0, y = 0, width = 0, height = 0] = viewBox.trim().split(/[\s,]+/).map(Number);
		if ([
			x,
			y,
			width,
			height
		].every(Number.isFinite)) return {
			x,
			y,
			width,
			height
		};
	}
	const width = pixelSize(svg.getAttribute("width"));
	const height = pixelSize(svg.getAttribute("height"));
	return width && height ? {
		x: 0,
		y: 0,
		width,
		height
	} : null;
}
/**
* The SVG content of a graphic inside its container.
* - Owns the content layer (`<svg>`) that view and runtime work on
* - Loads markup, adapts nested SVGs and resolves image URLs against the asset root
* - Provides content bounds (declared by the SVG or measured) and the container size
*/
var GraphicDocument = class extends Observable {
	container;
	contentLayer;
	#assets = createAssetResolver();
	#assetRoot = "";
	#assetUrls = {};
	#bounds = null;
	/** Removes all existing children of `container`. */
	constructor(container, parent) {
		super(parent, "document");
		this.container = container;
		this.contentLayer = container.ownerDocument.createElementNS(SVG_NS, "svg");
		this.contentLayer.setAttribute("overflow", "hidden");
		this.contentLayer.style.display = "block";
		container.replaceChildren(this.contentLayer);
	}
	/**
	* Replaces the content with an SVG document. Its `viewBox` or pixel size becomes the document bounds.
	* Throws if the content is not and does not contain an `<svg>` element.
	*/
	load(content) {
		const svg = findSvg(typeof content === "string" ? parseMarkup(content) : [content]);
		assert(svg, "Content must be or contain an SVG element");
		this.contentLayer.replaceChildren();
		this.#bounds = declaredBounds(svg);
		this.append(svg);
	}
	/**
	* Adds content to the content layer or to `parent`. The content is sanitized first: scripts,
	* event handlers, HTML and unsafe links are removed (see `sanitizeSvg`).
	*/
	append(content, parent = this.contentLayer) {
		const nodes = typeof content === "string" ? parseMarkup(content) : [content];
		for (const node of nodes) {
			const imported = node.ownerDocument === this.contentLayer.ownerDocument ? node : this.contentLayer.ownerDocument.importNode(node, true);
			if (!sanitizeSvg(imported)) continue;
			this.#prepare(imported);
			parent.append(imported);
		}
		this.emit("contentChange");
	}
	remove(node) {
		node.parentNode?.removeChild(node);
		this.emit("contentChange");
	}
	clear() {
		this.contentLayer.replaceChildren();
		this.#bounds = null;
		this.emit("contentChange");
	}
	/** First element in the content matching a CSS selector. */
	find(selector) {
		return this.contentLayer.querySelector(selector);
	}
	/** Graphics element with the given ID inside the content. */
	getElement(id) {
		const element = this.find(`#${CSS.escape(id)}`);
		return element instanceof SVGGraphicsElement ? element : null;
	}
	/** Topmost content element at a viewport position. */
	elementAt(clientX, clientY) {
		const element = this.contentLayer.ownerDocument.elementFromPoint(clientX, clientY);
		return element && element !== this.contentLayer && this.contentLayer.contains(element) ? element : null;
	}
	/** Root for relative image URLs, e.g. `assets/`; a trailing slash is added if missing. */
	setAssetRoot(root) {
		this.#assetRoot = root && !root.endsWith("/") ? `${root}/` : root;
		this.#assets = createAssetResolver(this.#assetRoot, this.#assetUrls);
	}
	/**
	* URLs of individual images by file name; they take precedence over the asset root. Takes
	* effect for markup loaded afterwards and for all values set by transformations.
	*/
	setAssetUrls(urls) {
		this.#assetUrls = { ...urls };
		this.#assets = createAssetResolver(this.#assetRoot, this.#assetUrls);
	}
	resolve(nameOrUrl) {
		return this.#assets.resolve(nameOrUrl);
	}
	nameOf(url) {
		return this.#assets.nameOf(url);
	}
	/** Overrides the bounds declared by the loaded SVG; `null` uses the measured content bounds. */
	setDocumentBounds(bounds) {
		this.#bounds = bounds;
	}
	/** Declared or explicitly set bounds, otherwise the bounding box of the content. */
	contentBounds() {
		if (this.#bounds) return this.#bounds;
		const { x, y, width, height } = this.contentLayer.getBBox();
		return {
			x,
			y,
			width,
			height
		};
	}
	/** Inner size of the container. */
	viewSize() {
		const style = getComputedStyle(this.container);
		return {
			width: parseFloat(style.width) || 0,
			height: parseFloat(style.height) || 0
		};
	}
	destroy() {
		this.contentLayer.remove();
		super.destroy();
	}
	/**
	* Adapts content for display:
	* - Nested SVGs lose their `viewBox` (conflicts with zooming) and get `overflow: visible` (no clipping)
	* - Relative image URLs are resolved against the asset root
	*/
	#prepare(node) {
		if (!(node instanceof Element)) return;
		const svgs = [...node.querySelectorAll("svg"), ...node.localName === "svg" ? [node] : []];
		for (const svg of svgs) {
			svg.setAttribute("overflow", "visible");
			svg.removeAttribute("viewBox");
		}
		const images = [...node.querySelectorAll("image"), ...node.localName === "image" ? [node] : []];
		for (const image of images) for (const [namespace, name] of [[null, "href"], [XLINK_NS, "href"]]) {
			const url = image.getAttributeNS(namespace, name);
			if (url) image.setAttributeNS(namespace, namespace ? "xlink:href" : "href", this.resolve(url));
		}
	}
};
// src/view/viewport.ts
const MIN_ZOOM_LEVEL = .01;
const MAX_ZOOM_LEVEL = 99.99;
function clampZoom(level) {
	return Math.min(Math.max(level, MIN_ZOOM_LEVEL), MAX_ZOOM_LEVEL);
}
const INITIAL_STATE = {
	x: 0,
	y: 0,
	width: 0,
	height: 0,
	zoomLevel: 1,
	viewSize: {
		width: 0,
		height: 0
	},
	contentBounds: {
		x: 0,
		y: 0,
		width: 0,
		height: 0
	}
};
/** Immutable visible area of the content; all operations return a new viewport. */
var Viewport = class Viewport {
	x;
	y;
	width;
	height;
	zoomLevel;
	viewSize;
	contentBounds;
	constructor(state = INITIAL_STATE) {
		this.x = state.x;
		this.y = state.y;
		this.width = state.width;
		this.height = state.height;
		this.zoomLevel = state.zoomLevel;
		this.viewSize = state.viewSize;
		this.contentBounds = state.contentBounds;
		Object.freeze(this);
	}
	/** Center of the content bounds. */
	get contentCenter() {
		const { x, y, width, height } = this.contentBounds;
		return {
			x: x + width / 2,
			y: y + height / 2
		};
	}
	/** Center of the visible area. */
	get center() {
		return {
			x: this.x + this.width / 2,
			y: this.y + this.height / 2
		};
	}
	/** `viewBox` attribute value. */
	get viewBox() {
		return [
			this.x,
			this.y,
			this.width,
			this.height
		].join(" ");
	}
	with(changes) {
		const { x, y, width, height, zoomLevel, viewSize, contentBounds } = this;
		return new Viewport({
			x,
			y,
			width,
			height,
			zoomLevel,
			viewSize,
			contentBounds,
			...changes
		});
	}
	/** Adapts the visible area to the view size, keeping the zoom level and the top-left corner. */
	resize() {
		return this.with({
			width: this.viewSize.width / this.zoomLevel,
			height: this.viewSize.height / this.zoomLevel
		});
	}
	moveBy(dx, dy) {
		return this.with({
			x: this.x + dx,
			y: this.y + dy
		});
	}
	centerAt(x, y) {
		return this.with({
			x: x - this.width / 2,
			y: y - this.height / 2
		});
	}
	/** Zooms so that `target` (content coordinates, default: center) stays at the same screen position. */
	zoomTo(zoomLevel, target = this.center) {
		const level = clampZoom(zoomLevel);
		const width = this.viewSize.width / level;
		const height = this.viewSize.height / level;
		const ratioX = this.width ? (target.x - this.x) / this.width : .5;
		const ratioY = this.height ? (target.y - this.y) / this.height : .5;
		return this.with({
			zoomLevel: level,
			x: this.x - (width - this.width) * ratioX,
			y: this.y - (height - this.height) * ratioY,
			width,
			height
		});
	}
	zoomIn(factor, target) {
		return this.zoomTo(this.zoomLevel * factor, target);
	}
	zoomOut(factor, target) {
		return this.zoomTo(this.zoomLevel / factor, target);
	}
	/** Shows the whole content, centered, with `padding` content units on each side. */
	zoomToFit(padding = 0) {
		const { width, height } = this.contentBounds;
		const level = Math.min(this.viewSize.width / (width + 2 * padding), this.viewSize.height / (height + 2 * padding));
		const center = this.contentCenter;
		return this.zoomTo(level).centerAt(center.x, center.y);
	}
	/** Zoom level 1, centered on the content. */
	zoomToOriginal() {
		const center = this.contentCenter;
		return this.zoomTo(1).centerAt(center.x, center.y);
	}
	/** Shows `bounds` completely and centered, keeping the aspect ratio of the view. */
	setBounds(bounds) {
		const level = clampZoom(Math.min(this.viewSize.width / bounds.width, this.viewSize.height / bounds.height));
		const width = this.viewSize.width / level;
		const height = this.viewSize.height / level;
		return this.with({
			zoomLevel: level,
			x: bounds.x - (width - bounds.width) / 2,
			y: bounds.y - (height - bounds.height) / 2,
			width,
			height
		});
	}
	/** Keeps the center of the visible area within the content bounds. */
	sanitize() {
		const { x, y, width, height } = this.contentBounds;
		const halfWidth = this.width / 2;
		const halfHeight = this.height / 2;
		return this.with({
			x: Math.min(Math.max(this.x, x - halfWidth), x + width - halfWidth),
			y: Math.min(Math.max(this.y, y - halfHeight), y + height - halfHeight)
		});
	}
	/** Converts a distance in content units to pixels. */
	toPx(point) {
		return {
			x: point.x * this.zoomLevel,
			y: point.y * this.zoomLevel
		};
	}
	/** Converts a distance in pixels to content units. */
	fromPx(point) {
		return {
			x: point.x / this.zoomLevel,
			y: point.y / this.zoomLevel
		};
	}
	/** Content coordinate at a position relative to the container's top-left corner (pixels). */
	toContent(offset) {
		return {
			x: this.x + offset.x / this.zoomLevel,
			y: this.y + offset.y / this.zoomLevel
		};
	}
};
// src/view/pointer-control.ts
const WHEEL_ZOOM_FACTOR = .001;
const WHEEL_ZOOM_MAX_STEP = 1.25;
const WHEEL_ZOOM_MIN_STEP = .8;
/** Trackpad pinch gestures arrive as wheel events with `ctrlKey` and small deltas. */
const TRACKPAD_PINCH_BOOST = 5;
/** A drag released within this time (ms) after the last move keeps gliding. */
const FLING_THRESHOLD = 100;
const FLING_FACTOR = 5;
const FLING_DURATION = 600;
function distance(a, b) {
	return Math.hypot(b.x - a.x, b.y - a.y);
}
/**
* Pan and zoom interaction for a view, based on Pointer Events (mouse, touch and pen):
* - Drag with one pointer pans, with a short glide after a fast release
* - Two pointers pinch-zoom around their center
* - Mouse wheel and trackpad pinch zoom around the pointer position
*/
var PointerControl = class {
	#view;
	#container;
	#pointers = /* @__PURE__ */ new Map();
	#pan = false;
	#zoom = false;
	#pinch;
	#lastMove;
	constructor(view, container) {
		this.#view = view;
		this.#container = container;
	}
	enable(pan, zoom) {
		this.#detach();
		this.#pan = pan;
		this.#zoom = zoom;
		if (!pan && !zoom) return;
		this.#container.addEventListener("pointerdown", this.#onPointerDown);
		if (zoom) this.#container.addEventListener("wheel", this.#onWheel, { passive: false });
		this.#container.style.touchAction = "none";
	}
	#detach() {
		this.#container.removeEventListener("pointerdown", this.#onPointerDown);
		this.#container.removeEventListener("wheel", this.#onWheel);
		this.#stopTracking();
		this.#container.style.removeProperty("touch-action");
	}
	#stopTracking() {
		window.removeEventListener("pointermove", this.#onPointerMove);
		window.removeEventListener("pointerup", this.#onPointerUp);
		window.removeEventListener("pointercancel", this.#onPointerUp);
		this.#pointers.clear();
		this.#pinch = void 0;
		this.#lastMove = void 0;
	}
	/** Content coordinate under a viewport (client) position. */
	#contentAt(client) {
		const rect = this.#container.getBoundingClientRect();
		return this.#view.viewport.toContent({
			x: client.x - rect.left,
			y: client.y - rect.top
		});
	}
	#startPinch() {
		const [a, b] = [...this.#pointers.values()];
		if (!a || !b) return;
		this.#pinch = {
			startDistance: distance(a, b),
			startZoom: this.#view.zoomLevel,
			target: this.#contentAt({
				x: (a.x + b.x) / 2,
				y: (a.y + b.y) / 2
			})
		};
	}
	#onPointerDown = (event) => {
		if (event.pointerType === "mouse" && event.button !== 0) return;
		if (this.#pointers.size === 0) {
			window.addEventListener("pointermove", this.#onPointerMove);
			window.addEventListener("pointerup", this.#onPointerUp);
			window.addEventListener("pointercancel", this.#onPointerUp);
		}
		this.#pointers.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY
		});
		this.#lastMove = void 0;
		if (this.#pointers.size === 2 && this.#zoom) this.#startPinch();
	};
	#onPointerMove = (event) => {
		const previous = this.#pointers.get(event.pointerId);
		if (!previous) return;
		const current = {
			x: event.clientX,
			y: event.clientY
		};
		this.#pointers.set(event.pointerId, current);
		if (this.#pinch) {
			const [a, b] = [...this.#pointers.values()];
			if (!a || !b) return;
			const { startDistance, startZoom, target } = this.#pinch;
			this.#view.zoomTo(startZoom * distance(a, b) / startDistance, target);
			event.preventDefault();
			return;
		}
		if (this.#pan && this.#pointers.size === 1) {
			const delta = {
				x: current.x - previous.x,
				y: current.y - previous.y
			};
			this.#lastMove = {
				time: performance.now(),
				delta
			};
			const move = this.#view.viewport.fromPx({
				x: -delta.x,
				y: -delta.y
			});
			this.#view.moveBy(move.x, move.y);
			event.preventDefault();
		}
	};
	#onPointerUp = (event) => {
		if (!this.#pointers.delete(event.pointerId)) return;
		if (this.#pinch) {
			this.#pinch = void 0;
			this.#lastMove = void 0;
			return;
		}
		if (this.#pointers.size === 0) {
			this.#fling();
			this.#stopTracking();
		}
	};
	#fling() {
		const last = this.#lastMove;
		if (!last || performance.now() - last.time >= FLING_THRESHOLD) return;
		const viewport = this.#view.viewport;
		const move = viewport.fromPx({
			x: -last.delta.x * FLING_FACTOR,
			y: -last.delta.y * FLING_FACTOR
		});
		this.#view.setViewport(viewport.moveBy(move.x, move.y), {
			easing: EASINGS.easeoutqart,
			duration: FLING_DURATION
		});
	}
	#onWheel = (event) => {
		event.preventDefault();
		const delta = event.ctrlKey ? event.deltaY * TRACKPAD_PINCH_BOOST : event.deltaY;
		const step = Math.min(Math.max(1 - delta * WHEEL_ZOOM_FACTOR, WHEEL_ZOOM_MIN_STEP), WHEEL_ZOOM_MAX_STEP);
		this.#view.zoomTo(this.#view.zoomLevel * step, this.#contentAt({
			x: event.clientX,
			y: event.clientY
		}));
	};
};
// src/view/view.ts
const DEFAULT_DURATION = 400;
/**
* Visible area of the graphic: zooming, panning and fitting the content into the container.
* Viewport changes are written to the content layer's `viewBox` once per animation frame.
*/
var View = class extends Observable {
	#document;
	#pointer;
	#resizeObserver;
	#unsubscribe;
	#viewport = new Viewport();
	#applied;
	#animation;
	#frameId;
	constructor(document, parent) {
		super(parent, "view");
		this.#document = document;
		this.#pointer = new PointerControl(this, document.container);
		this.#unsubscribe = document.on("contentChange", () => {
			this.resize();
		});
		this.#resizeObserver = new ResizeObserver(() => {
			const { width, height } = this.#document.viewSize();
			const current = this.#viewport.viewSize;
			if (width !== current.width || height !== current.height) this.resize();
		});
		this.#resizeObserver.observe(document.container);
		this.resize();
	}
	get viewport() {
		return this.#viewport;
	}
	get zoomLevel() {
		return this.#viewport.zoomLevel;
	}
	/**
	* Re-reads container size and content bounds. Called automatically on content and size changes.
	* When the content bounds change, the visible area starts at the content's top-left corner.
	*/
	resize() {
		const viewSize = this.#document.viewSize();
		const contentBounds = this.#document.contentBounds();
		const previous = this.#viewport.contentBounds;
		const contentMoved = previous.x !== contentBounds.x || previous.y !== contentBounds.y || previous.width !== contentBounds.width || previous.height !== contentBounds.height;
		this.#document.contentLayer.setAttribute("width", String(viewSize.width));
		this.#document.contentLayer.setAttribute("height", String(viewSize.height));
		this.setViewport(this.#viewport.with({
			viewSize,
			contentBounds,
			...contentMoved ? {
				x: contentBounds.x,
				y: contentBounds.y
			} : {}
		}).resize());
	}
	/** Shows `viewport`, restricted to the content bounds, optionally animated. */
	setViewport(viewport, animation = false) {
		this.#animation?.stop();
		this.#animation = void 0;
		const target = viewport.sanitize();
		if (!animation) {
			this.#viewport = target;
			this.#scheduleApply();
			return;
		}
		const { duration = DEFAULT_DURATION, easing = EASINGS.easeinout } = animation === true ? {} : animation;
		const from = this.#viewport;
		this.#animation = animate({
			duration,
			easing,
			onUpdate: (t) => {
				this.#viewport = target.with({
					x: from.x + (target.x - from.x) * t,
					y: from.y + (target.y - from.y) * t,
					width: from.width + (target.width - from.width) * t,
					height: from.height + (target.height - from.height) * t
				});
				this.#scheduleApply();
			}
		});
	}
	zoomTo(zoomLevel, target, animation) {
		this.setViewport(this.#viewport.zoomTo(zoomLevel, target), animation);
	}
	zoomIn(factor, target, animation) {
		this.setViewport(this.#viewport.zoomIn(factor, target), animation);
	}
	zoomOut(factor, target, animation) {
		this.setViewport(this.#viewport.zoomOut(factor, target), animation);
	}
	zoomToFit(padding, animation) {
		this.setViewport(this.#viewport.zoomToFit(padding), animation);
	}
	zoomToOriginal(animation) {
		this.setViewport(this.#viewport.zoomToOriginal(), animation);
	}
	/** Shows the given elements completely; does nothing for an empty list. */
	zoomToElements(elements, padding, animation) {
		const bounds = combinedBoundingBox(elements, padding);
		if (bounds) this.setViewport(this.#viewport.setBounds(bounds), animation);
	}
	moveBy(dx, dy, animation) {
		this.setViewport(this.#viewport.moveBy(dx, dy), animation);
	}
	centerAt(x, y, animation) {
		this.setViewport(this.#viewport.centerAt(x, y), animation);
	}
	/** Enables panning (drag) and zooming (wheel, pinch) with mouse, touch and pen. */
	enablePointer(pan, zoom) {
		this.#pointer.enable(pan, zoom);
	}
	destroy() {
		this.#animation?.stop();
		if (this.#frameId !== void 0) cancelAnimationFrame(this.#frameId);
		this.#resizeObserver.disconnect();
		this.#unsubscribe();
		this.#pointer.enable(false, false);
		super.destroy();
	}
	#scheduleApply() {
		if (this.#frameId !== void 0) return;
		this.#frameId = requestAnimationFrame(() => {
			this.#frameId = void 0;
			this.#apply();
		});
	}
	#apply() {
		const viewport = this.#viewport;
		this.#document.contentLayer.setAttribute("viewBox", viewport.viewBox);
		if (this.#applied?.zoomLevel !== viewport.zoomLevel) this.emit("zoomChange", viewport.zoomLevel);
		this.#applied = viewport;
		this.emit("viewportChange", viewport);
	}
};
// src/graphic.ts
const log = createLogger("cuttleskin.graphic");
/**
* An interactive SVG graphic in a container element: loads markup and configuration,
* connects variables with the SVG and manages the visible area.
*/
var Graphic = class extends Observable {
	document;
	scheduler;
	view;
	runtime;
	#settings;
	/** Replaces the content of `container`. */
	constructor(container, settings = {}) {
		super();
		this.#settings = resolveSettings(settings);
		this.document = new GraphicDocument(container, this);
		this.scheduler = new Scheduler(this);
		this.view = new View(this.document, this);
		const currentSettings = () => this.#settings;
		this.runtime = new Runtime({
			scheduler: this.scheduler,
			document: this.document,
			assets: this.document,
			get settings() {
				return currentSettings();
			},
			events: this
		});
		this.#applySettings();
	}
	get settings() {
		return this.#settings;
	}
	/** The loaded configuration. */
	get config() {
		return this.runtime.config;
	}
	/** Changes settings; `mode` takes effect with the next `load`. */
	setSettings(settings) {
		this.#settings = resolveSettings({
			...this.#settings,
			...settings
		});
		this.#applySettings();
	}
	/** Root for relative image URLs in markup and configuration, e.g. `assets/`. */
	setAssetRoot(root) {
		this.document.setAssetRoot(root);
	}
	/**
	* URLs of individual images by file name, e.g. `{ "car.png": "/images/3f2a…" }`; they take
	* precedence over the asset root. Set before `load`, so that the markup uses them.
	*/
	setAssetUrls(urls) {
		this.document.setAssetUrls(urls);
	}
	/**
	* Loads SVG markup and configuration (JSON text or parsed JSON). Invalid configuration entries are
	* skipped and returned as issues. Emits `ready` on success; on failure emits `error` and throws.
	*/
	load(markup, config) {
		try {
			const { config: parsed, issues } = typeof config === "string" ? parseGraphicConfigJson(config) : parseGraphicConfig(config);
			for (const issue of issues) log.warn(`Invalid configuration at ${issue.path || "/"}: ${issue.message}`);
			if (parsed.settings) this.setSettings(parsed.settings);
			this.document.load(markup);
			this.runtime.load(parsed);
			this.emit("ready");
			return issues;
		} catch (error) {
			log.error("Error initializing graphic", error);
			this.emit("error", error);
			throw error;
		}
	}
	/** Fetches markup and configuration in parallel and loads them; see `load`. */
	async loadUrl(markupUrl, configUrl) {
		let markup;
		let config;
		try {
			[markup, config] = await Promise.all([fetchText(markupUrl), fetchText(configUrl)]);
		} catch (error) {
			log.error("Could not load graphic files", error);
			this.emit("error", error);
			throw error;
		}
		return this.load(markup, config);
	}
	/** Runtime element for an SVG element ID or node. */
	element(elementOrId) {
		return this.runtime.getElement(elementOrId);
	}
	variable(name) {
		return this.runtime.getVariable(name);
	}
	getValue(name) {
		return this.runtime.getValue(name);
	}
	setValue(name, value, formattedValue) {
		this.runtime.setValue(name, value, formattedValue);
	}
	/** Removes the graphic from its container and releases all listeners. */
	destroy() {
		this.view.destroy();
		this.runtime.destroy();
		this.scheduler.destroy();
		this.document.destroy();
		super.destroy();
	}
	#applySettings() {
		this.document.contentLayer.style.imageRendering = this.#settings.imageRendering === "speed" ? "pixelated" : "auto";
	}
};
/** Creates a graphic in `container`. */
function create(container, settings) {
	return new Graphic(container, settings);
}
export { ANCHOR_NAMES, ConfigError, DEFAULT_SETTINGS, DomObservable, EASINGS, EASING_NAMES, ElementState, Graphic, GraphicDocument, IMAGE_RENDERINGS, MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, MODES, Observable, PointerControl, RANGE_ENDS, Runtime, RuntimeElement, Scheduler, TRANSFORMATION_TYPES, Transformation, VARIABLE_TYPES, Variable, View, Viewport, animate, assert, assetName, boxPosition, combinedBoundingBox, convertValue, create, createAccessor, createAssetResolver, createFrames, createLogger, createTransformType, createTransformationModel, createTranslation, createVariableModel, discreteUpdater, domainDefault, fetchText, formatColor, formatValue, interpolateColor, interpolateCssColor, interpolateDiscrete, interpolateNumber, interpolatePoint, isEasingName, isLogLevelEnabled, isRangeEnd, isSafeUrl, loadGraphicConfig, mapping, parseColor, parseGraphicConfig, parseGraphicConfigJson, parseGraphicConfigStrict, resolveEasing, resolveFramePosition, resolveSettings, sanitizeSvg, sanitizeValue, screenBBox, setLogLevel, totalMatrix, transition, transitionUpdater, upgradeGraphicConfig };
