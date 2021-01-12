// TODO:
// - [ ] Customize dots (edit mode then tap to toggle a dot) (also allow in-between dots)
// - [ ] Provide some sort of undo/redo? (to cancel bead moved by
//       mistake) This imply to snapshot the position after a delay
//       without moving.
// - [ ] Remember beads positions in localStorage?
// - [ ] Marks on frame (see 27 rods tomoe)

import 'core-js/es6';
import 'regenerator-runtime/runtime';

import React, {
    ReactNode,
    memo,
    useRef,
    useCallback,
    useEffect,
    useState,
    useMemo,
} from 'react';
import ReactDOM from 'react-dom';
import {
    RecoilRoot,
    atom,
    useRecoilValue,
    useSetRecoilState,
    useRecoilState,
} from 'recoil';

import update from 'immutability-helper';

import './style.css';

import { Point, Move, IntersectionOutcome } from './common';
import { ptDist, ptLerp, intersectCirclePolygon } from './geo';
import {
    HorizontalLayout,
    VerticalLayout,
    LayoutSize,
    LAYOUTS,
} from './layouts';
import { drawBead, drawBeam, drawBeamDot, drawRod, STYLES } from './render';

const BEAM_SLIDE_TOLERANCE = 5; // vertical tolerance
const BEAM_SLIDE_THRESHOLD = 0.75; // ratio of beadWidth
const TOUCH_RADIUS = 5;
const MAX_RODS = 37;
const MAX_FIRST_UNIT_ROD = 4;

type Bead = { y: number; header: boolean };

type RodSection = {
    y1: number;
    y2: number;
    direction: 'bottom' | 'top';
    factor: 1 | 5;
    beads: Array<Bead>;
};

type Rod = {
    place: number;
    sections: Array<RodSection>;
};

type Configuration = {
    showDigits: boolean;
    firstUnitRod: number;
    size: LayoutSize;
    mainStyle: number;
    topUnitStyle: null | number;
    rodUnitStyle: null | number;
};

const configurationState = atom<Configuration>({
    key: 'configuration',
    default: {
        showDigits: false,
        firstUnitRod: 3,
        size: 'medium',
        mainStyle: 0,
        topUnitStyle: null,
        rodUnitStyle: null,
    },
});

const horizontalLayoutState = atom<HorizontalLayout>({
    key: 'horizontal-layout',
    default: LAYOUTS.medium.horizontal,
});

const verticalLayoutState = atom<VerticalLayout>({
    key: 'vertical-layout',
    default: LAYOUTS.medium.vertical,
});

const rodOffset = (
    place: number,
    rods: number,
    horizontalLayout: HorizontalLayout,
): number => {
    const { beadWidth, beadGap } = horizontalLayout;
    return (rods - place - 1) * (beadWidth + beadGap) + beadWidth / 2;
};

const showConfigurationState = atom<boolean>({
    key: 'show-configuration',
    default: false,
});

const beadsState = atom<Array<Rod>>({
    key: 'beads',
    default: [],
});

const offsetState = atom<Point>({
    key: 'offset',
    default: { x: 0, y: 0 },
});

const getUpperDeckHeight = (verticalLayout: VerticalLayout) => {
    const { beadHeight, upperDeckBeads } = verticalLayout;
    return Math.round(beadHeight * (upperDeckBeads + 0.5));
};

const getLowerDeckHeight = (verticalLayout: VerticalLayout) => {
    const { beadHeight, lowerDeckBeads } = verticalLayout;
    return Math.round(beadHeight * (lowerDeckBeads + 0.5));
};

// TODO: reuse current bead configuration (but beware of bead amount change)
const makeRods = (
    rods: number,
    verticalLayout: VerticalLayout,
    _current: Array<Rod>,
) => {
    const result: Array<Rod> = [];
    const { beadHeight, beamHeight } = verticalLayout;
    const upperDeckHeight = getUpperDeckHeight(verticalLayout);
    const lowerDeckHeight = getLowerDeckHeight(verticalLayout);
    const h = beadHeight / 2;
    const r = (n: number) => Math.round(n);
    const upperTop = h;
    const upperBottom = upperDeckHeight - h;
    const lowerTop = upperDeckHeight + beamHeight + h;
    const lowerBottom = upperDeckHeight + beamHeight + lowerDeckHeight - h;
    for (let i = 0; i < rods; ++i) {
        const upperBeads: Array<Bead> = [];
        for (let j = 0; j < verticalLayout.upperDeckBeads; ++j) {
            upperBeads.push({ y: r(upperTop + j * beadHeight), header: false });
        }
        const lowerBeads: Array<Bead> = [];
        const n = verticalLayout.lowerDeckBeads;
        for (let j = 0; j < n; ++j) {
            lowerBeads.push({
                y: r(lowerBottom - (n - j - 1) * beadHeight),
                header: j === 0,
            });
        }
        result.push({
            place: i,
            sections: [
                {
                    y1: r(upperTop),
                    y2: r(upperBottom),
                    beads: upperBeads,
                    direction: 'bottom',
                    factor: 5,
                },
                {
                    y1: r(lowerTop),
                    y2: r(lowerBottom),
                    beads: lowerBeads,
                    direction: 'top',
                    factor: 1,
                },
            ],
        });
    }
    return result;
};

const drawAllBeads = (
    ctx: CanvasRenderingContext2D,
    beads: Array<Rod>,
    rods: number,
    styledBeads: Array<HTMLCanvasElement>,
    configuration: Configuration,
    horizontalLayout: HorizontalLayout,
) => {
    for (const { place, sections } of beads.slice(0, rods)) {
        const x = rodOffset(place, rods, horizontalLayout);
        const isUnit = (place - configuration.firstUnitRod + 2) % 3 === 1;
        for (const { beads } of sections) {
            for (const { y, header } of beads) {
                const style =
                    (isUnit && header ? configuration.topUnitStyle : null) ??
                    (isUnit ? configuration.rodUnitStyle : null) ??
                    configuration.mainStyle;
                const bead = styledBeads[style % styledBeads.length];
                ctx.drawImage(
                    bead,
                    Math.round(x - bead.width / 2),
                    Math.round(y - bead.height / 2),
                );
            }
        }
    }
};

const resetRod = (rod: Rod, verticalLayout: VerticalLayout): Rod => {
    const { beadHeight } = verticalLayout;
    const updatedSections: Rod['sections'] = [];
    for (const section of rod.sections) {
        const n = section.beads.length;
        const f: (i: number) => number =
            section.direction === 'bottom'
                ? i => section.y1 + i * beadHeight
                : i => section.y2 - (n - i - 1) * beadHeight;
        updatedSections.push({
            ...section,
            beads: section.beads.map((item, i) => ({ ...item, y: f(i) })),
        });
    }
    return { ...rod, sections: updatedSections };
};

const resetRods = (
    beads: Array<Rod>,
    rods: number,
    swipes: Array<{ a: number; b: number }>,
    horizontalLayout: HorizontalLayout,
    verticalLayout: VerticalLayout,
): Array<Rod> => {
    const result: Array<Rod> = [];
    let anyReset = false;
    for (const rod of beads) {
        const { place } = rod;
        const x = rodOffset(place, rods, horizontalLayout);
        let reset = false;
        for (const { a, b } of swipes) {
            if (x >= a && x < b) {
                reset = true;
                break;
            }
        }
        if (reset) {
            anyReset = true;
        }
        result.push(reset ? resetRod(rod, verticalLayout) : rod);
    }
    return anyReset ? result : beads;
};

const moveBeads = (
    beads: Array<Rod>,
    rods: number,
    moves: Array<Move>,
    horizontalLayout: HorizontalLayout,
    verticalLayout: VerticalLayout,
): Array<Rod> => {
    const { beadHeight } = verticalLayout;
    const w = horizontalLayout.beadWidth / 2;
    const h = verticalLayout.beadHeight / 2;
    const t = horizontalLayout.beadHole / 2;
    const b = verticalLayout.beadExtra / 2;
    const beadShape: Array<Point> = [
        { x: w, y: -b },
        { x: w, y: b },
        { x: t, y: h },
        { x: -t, y: h },
        { x: -w, y: b },
        { x: -w, y: -b },
        { x: -t, y: -h },
        { x: t, y: -h },
    ];
    let result = beads;
    const far = w + TOUCH_RADIUS; // correct?
    for (const [rodIndex, rod] of Array.from(beads.entries())) {
        const { place } = rod;
        const cx = rodOffset(place, rods, horizontalLayout);
        for (const { from: a, to: b, radius } of moves) {
            if (
                Math.max(a.x, b.x) < cx - far ||
                Math.min(a.x, b.x) > cx + far
            ) {
                // it doesn't cross the rod
                continue;
            }
            // Split the into steps for better simulation
            const dist = ptDist(a, b);
            const steps = Math.max(1, Math.min(20, Math.ceil(dist / 5)));
            for (let step = 0; step < steps; ++step) {
                const aa = ptLerp(a, b, step / steps);
                const bb = ptLerp(a, b, (step + 1) / steps);
                if (
                    Math.max(aa.x, bb.x) < cx - far ||
                    Math.min(aa.x, bb.x) > cx + far
                ) {
                    // it doesn't cross the rod
                    continue;
                }
                // NOTE: We make sure to use the latest known state of
                // the sections (as updated by `update()` below)
                for (const [sectionIndex, { y1, y2, beads }] of Array.from(
                    result[rodIndex].sections.entries(),
                )) {
                    const n = beads.length;
                    for (let i = 0; i < n; ++i) {
                        let { y: cy } = beads[i];
                        if (aa.y < cy - beadHeight || aa.y > cy + beadHeight) {
                            continue;
                        }
                        const outcome: IntersectionOutcome = intersectCirclePolygon(
                            { x: aa.x - cx, y: aa.y - cy, r: radius },
                            beadShape,
                        );
                        const minY = y1 + i * beadHeight;
                        const maxY = y2 - (n - i - 1) * beadHeight;
                        if (outcome !== 'outside') {
                            const dy = aa.y - cy;
                            cy = Math.max(minY, Math.min(maxY, bb.y - dy));
                        }
                        if (beads[i].y !== cy) {
                            const dy = cy - beads[i].y;
                            const updatedBeads = beads.map(item => ({
                                ...item,
                            }));
                            updatedBeads[i].y = cy;
                            if (dy < 0) {
                                // Moved down
                                for (let j = i - 1; j >= 0; --j) {
                                    updatedBeads[j].y = Math.min(
                                        updatedBeads[j + 1].y - beadHeight,
                                        updatedBeads[j].y,
                                    );
                                }
                            } else if (dy > 0) {
                                // Moved up
                                for (let j = i + 1; j < n; ++j) {
                                    updatedBeads[j].y = Math.max(
                                        updatedBeads[j - 1].y + beadHeight,
                                        updatedBeads[j].y,
                                    );
                                }
                            }
                            result = update(result, {
                                [rodIndex]: {
                                    sections: {
                                        [sectionIndex]: {
                                            beads: { $set: updatedBeads },
                                        },
                                    },
                                },
                            });
                            break;
                        }
                    }
                }
            }
        }
    }
    return result;
};

const getRodDigit = (
    rod: Rod,
    verticalLayout: VerticalLayout,
): null | number => {
    const { beadHeight } = verticalLayout;
    let digit: null | number = 0;
    for (const { y1, y2, beads, direction, factor } of rod.sections) {
        const n = beads.length;
        const h = y2 - y1;
        const g = h - (n - 1) * beadHeight;
        const k = 1.5;
        let bottom = 0; // considered at the bottom of the rod
        let top = 0; // considered at the top of the rod
        for (const [i, bead] of Array.from(beads.entries())) {
            const ii = n - i - 1;
            const y = y1 + i * beadHeight;
            if (bead.y < y + k * (i + 1) + 3) {
                bottom++;
            } else if (bead.y > y + g - k * (ii + 1) - 3) {
                top++;
            }
        }
        if (top + bottom === n) {
            const value = (direction === 'top' ? bottom : top) * factor;
            if (digit !== null) digit += value;
        } else {
            // misplaced
            digit = null;
            break;
        }
    }
    return digit;
};

const getDigits = (
    rods: Array<Rod>,
    verticalLayout: VerticalLayout,
): Map<number, null | number> => {
    const result: Map<number, null | number> = new Map();
    for (const rod of rods) {
        const value = getRodDigit(rod, verticalLayout);
        result.set(rod.place, value);
    }
    return result;
};

type BackgroundProps = {
    rods: number;
    rodWidth: number;
    columnWidth: number;
    columnGap: number;
    width: number;
    height: number;
    beamPosition: number;
    beamHeight: number;
};

const Background = memo(function Background(props: BackgroundProps) {
    const {
        rods,
        rodWidth,
        columnWidth,
        columnGap,
        width,
        height,
        beamPosition,
        beamHeight,
    } = props;
    const configuration = useRecoilValue(configurationState);
    const verticalLayout = useRecoilValue(verticalLayoutState);
    const bgCanvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = bgCanvas.current;
        if (canvas === null) return;
        const ctx = canvas.getContext('2d');
        if (ctx === null) return;
        ctx.clearRect(0, 0, width, height);
        const r = Math.round;
        for (let i = 0; i < rods; ++i) {
            const x = Math.round(
                (rods - i - 1) * (columnWidth + columnGap) + columnWidth / 2,
            );
            drawRod(ctx, r(x - rodWidth / 2), r(x + rodWidth / 2), 0, height);
        }
        drawBeam(ctx, 0, width, beamPosition, beamPosition + beamHeight);
        for (let i = 0; i < rods; ++i) {
            if ((i - configuration.firstUnitRod + 2) % 3 !== 1) continue;
            const x = Math.round(
                (rods - i - 1) * (columnWidth + columnGap) + columnWidth / 2,
            );
            drawBeamDot(
                ctx,
                r(x),
                r(beamPosition + beamHeight / 2),
                Math.round(verticalLayout.beamHeight / 8),
            );
        }
    }, [rods, columnWidth, columnGap, rodWidth, width, height, beamPosition, beamHeight, configuration, verticalLayout]);
    return (
        <canvas
            className="background"
            ref={bgCanvas}
            width={width}
            height={height}
        />
    );
});

type ForegroundProps = {
    rods: number;
    width: number;
    height: number;
    styledBeads: Array<HTMLCanvasElement>;
};

const Foreground = (props: ForegroundProps) => {
    const { rods, width, height, styledBeads } = props;
    const configuration = useRecoilValue(configurationState);
    const horizontalLayout = useRecoilValue(horizontalLayoutState);
    const fgCanvas = useRef<HTMLCanvasElement>(null);
    const beads = useRecoilValue(beadsState);
    const setOffset = useSetRecoilState(offsetState);
    // Monitor the abacus position. This is needed to get relative
    // touches (and mouse) position later.
    useEffect(() => {
        const id = setInterval(() => {
            const canvas = fgCanvas.current;
            if (canvas === null) return;
            const bb = canvas.getBoundingClientRect();
            const x = bb.left;
            const y = bb.top;
            setOffset(p => (p.x === x && p.y === y ? p : { x, y }));
        }, 200);
        return () => clearInterval(id);
    }, [setOffset]);
    useEffect(() => {
        const canvas = fgCanvas.current;
        if (canvas === null) return;
        const ctx = canvas.getContext('2d');
        if (ctx === null) return;
        // FIXME: We could redraw *only* the rods that changed, rather
        // than drawing everything again.
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawAllBeads(
            ctx,
            beads,
            rods,
            styledBeads,
            configuration,
            horizontalLayout,
        );
    }, [beads, rods, styledBeads, width, configuration, horizontalLayout]);
    return (
        <canvas
            className="foreground"
            ref={fgCanvas}
            width={width}
            height={height}
        />
    );
};

type DigitsProps = {
    rods: number;
};

const Digits = (props: DigitsProps) => {
    const { rods } = props;
    const { showDigits } = useRecoilValue(configurationState);
    const beads = useRecoilValue(beadsState);
    const horizontalLayout = useRecoilValue(horizontalLayoutState);
    const verticalLayout = useRecoilValue(verticalLayoutState);
    const { fontSize } = verticalLayout;
    const digits = useMemo(() => getDigits(beads, verticalLayout), [
        beads,
        verticalLayout,
    ]);
    const result = [];
    const width = horizontalLayout.beadWidth + horizontalLayout.beadGap;
    for (let i = rods - 1; i >= 0; --i) {
        result.push(
            <div
                key={i}
                className="digit"
                style={{
                    width,
                }}
            >
                {digits.get(i) ?? ''}
            </div>,
        );
    }
    return (
        <div
            className="digits"
            style={{
                display: showDigits ? undefined : 'none',
                fontSize: Math.floor(fontSize * 1.4),
                lineHeight: `${fontSize}px`,
            }}
        >
            {result}
        </div>
    );
};

const ConfigurationButton = () => {
    const setShowConfiguration = useSetRecoilState(showConfigurationState);
    const handleToggleConfiguration = useCallback(() => {
        setShowConfiguration(d => !d);
    }, [setShowConfiguration]);
    return (
        <div className="controls leftControls">
            <button onClick={handleToggleConfiguration}>⚙</button>
        </div>
    );
};

const DigitsButton = () => {
    const setConfiguration = useSetRecoilState(configurationState);
    const handleToggleDigits = useCallback(() => {
        setConfiguration(conf => ({ ...conf, showDigits: !conf.showDigits }));
    }, []);
    return (
        <div className="controls rightControls">
            <button onClick={handleToggleDigits} style={{ padding: '0 .5rem' }}>
                123
            </button>
        </div>
    );
};

type ContentProps = {
    styledBeads: Array<HTMLCanvasElement>;
};

const Content = (props: ContentProps) => {
    const { styledBeads } = props;
    // rods to display. null = unknown.
    const [rods, setRods] = useState<null | number>(null);
    const { showDigits } = useRecoilValue(configurationState);
    const horizontalLayout = useRecoilValue(horizontalLayoutState);
    const verticalLayout = useRecoilValue(verticalLayoutState);
    const handleWidthChange = useCallback(
        (width: number) => {
            // FIXME: no magic numbers, use configuration
            const margin = 40 + horizontalLayout.beadGap; // border + some margin
            const k = horizontalLayout.beadWidth + horizontalLayout.beadGap;
            setRods(
                Math.min(
                    Math.max(1, Math.floor((width - margin) / k)),
                    MAX_RODS,
                ),
            );
        },
        [horizontalLayout],
    );
    const height =
        getUpperDeckHeight(verticalLayout) +
        verticalLayout.beamHeight +
        getLowerDeckHeight(verticalLayout);
    const width =
        rods === null
            ? 0
            : rods * (horizontalLayout.beadWidth + horizontalLayout.beadGap) -
              horizontalLayout.beadGap;
    const mouse = useRef<{ id: number; last: null | Point }>({
        id: 0,
        last: null,
    });
    const offset = useRecoilValue(offsetState);
    const setBeads = useSetRecoilState(beadsState);
    const touches = useRef<Map<number, Point>>(new Map());

    // Maybe one per touch
    const beamSlides = useRef<Map<number, { start: Point }>>(new Map());

    const updateBeamSlide = useCallback(
        (moves: Array<Move>) => {
            const k = BEAM_SLIDE_TOLERANCE;
            const swipes: Array<{ a: number; b: number }> = [];
            // FIXME: functions to extract these range from configuration?
            const beamTop = getUpperDeckHeight(verticalLayout);
            const beamBottom = beamTop + verticalLayout.beamHeight;
            for (const { id, from: a, to: b } of moves) {
                if (
                    a.y > beamTop - k &&
                    a.y < beamBottom + k &&
                    b.y > beamTop - k &&
                    b.y < beamBottom + k
                ) {
                    const slide = beamSlides.current.get(id);
                    if (slide !== undefined) {
                        // BUG: if the cursor moved far enough, the
                        // start position no longer matter. That is,
                        // if we start a swipe near a rod, move far
                        // enough then come back, the rod is not reset
                        // because we consider incorrectly that we
                        // didn't travel enough to reset it.
                        const { start } = slide;
                        if (
                            Math.abs(start.x - b.x) >
                            horizontalLayout.beadWidth * BEAM_SLIDE_THRESHOLD
                        ) {
                            swipes.push({
                                a: Math.min(a.x, b.x),
                                b: Math.max(a.x, b.x),
                            });
                        }
                    } else {
                        beamSlides.current.set(id, { start: a });
                    }
                } else {
                    beamSlides.current.delete(id);
                }
            }
            if (swipes.length && rods !== null) {
                setBeads(beads =>
                    resetRods(
                        beads,
                        rods,
                        swipes,
                        horizontalLayout,
                        verticalLayout,
                    ),
                );
            }
        },
        [setBeads, rods, horizontalLayout, verticalLayout],
    );

    const update = useCallback(
        (moves: Array<Move>) => {
            updateBeamSlide(moves);
            if (rods !== null) {
                setBeads(beads =>
                    moveBeads(
                        beads,
                        rods,
                        moves,
                        horizontalLayout,
                        verticalLayout,
                    ),
                );
            }
        },
        [setBeads, updateBeamSlide, rods, horizontalLayout, verticalLayout],
    );
    const currentButtons = useRef(0); // bit fields
    const updateMouse = useCallback(
        (event: MouseEvent) => {
            // COMPAT: FF6: event.buttons is undefined. So we track
            // actual buttons ourself in currentButtons.
            if (!(currentButtons.current & 1)) {
                mouse.current.last = null;
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const { x: dx, y: dy } = offset;
            const p = { x: event.clientX - dx, y: event.clientY - dy };
            if (mouse.current.last === null) {
                ++mouse.current.id;
                mouse.current.last = p;
            }
            const move = {
                id: mouse.current.id,
                from: mouse.current.last,
                to: p,
                radius: 0,
            };
            update([move]);
            mouse.current.last = p;
        },
        [update, offset],
    );
    const handleMouseDown = useCallback(
        (event: MouseEvent) => {
            if (event.buttons === undefined) {
                currentButtons.current |= 1 << event.button;
            } else {
                currentButtons.current = event.buttons;
            }
            updateMouse(event);
        },
        [updateMouse],
    );
    const handleMouseMove = useCallback(
        (event: MouseEvent) => {
            updateMouse(event);
        },
        [updateMouse],
    );
    const dropMouse = useCallback(
        (event: MouseEvent) => {
            if (event.buttons === undefined) {
                currentButtons.current &= ~(1 << event.button);
            } else {
                currentButtons.current = event.buttons;
            }
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            mouse.current.last = null;
            update([]);
        },
        [update],
    );
    const updateTouches = useCallback(
        (event: TouchEvent) => {
            event.preventDefault();
            event.stopPropagation();
            const { x: dx, y: dy } = offset;
            const moves: Array<Move> = [];
            for (let i = 0; i < event.changedTouches.length; ++i) {
                const touch = event.changedTouches.item(i);
                if (touch === null) continue;
                const previous = touches.current.get(touch.identifier);
                const current = {
                    x: touch.clientX - dx,
                    y: touch.clientY - dy,
                };
                if (previous !== undefined) {
                    moves.push({
                        id: touch.identifier,
                        from: previous,
                        to: current,
                        radius: TOUCH_RADIUS,
                    });
                } else {
                    moves.push({
                        id: touch.identifier,
                        from: current,
                        to: current,
                        radius: TOUCH_RADIUS,
                    });
                }
                touches.current.set(touch.identifier, current);
            }
            update(moves);
        },
        [update, offset],
    );
    const dropTouches = useCallback(
        (event: TouchEvent) => {
            event.preventDefault();
            event.stopPropagation();
            for (let i = 0; i < event.changedTouches.length; ++i) {
                const touch = event.changedTouches.item(i);
                if (touch === null) continue;
                touches.current.delete(touch.identifier);
            }
            update([]);
        },
        [update],
    );
    // BEWARE: we need to actually register the events with
    // `passive:false` (but I don't remember why exactly).
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let knownWidth: null | number = null;
        const id = setInterval(() => {
            const el = ref.current;
            if (el === null) return;
            const width = el.clientWidth;
            if (width !== knownWidth) {
                knownWidth = width;
                handleWidthChange(width);
            }
        }, 200);
        return () => clearInterval(id);
    }, [handleWidthChange]);
    useEffect(() => {
        const el = ref.current;
        if (el === null) return;
        el.addEventListener('mousedown', handleMouseDown, {
            passive: false,
        });
        el.addEventListener('mousemove', handleMouseMove, {
            passive: false,
        });
        window.addEventListener('mouseup', dropMouse, { passive: false });
        el.addEventListener('touchstart', updateTouches, {
            passive: false,
        });
        el.addEventListener('touchmove', updateTouches, {
            passive: false,
        });
        el.addEventListener('touchend', dropTouches, { passive: false });
        el.addEventListener('touchcancel', dropTouches, {
            passive: false,
        });
        return () => {
            // COMPAT: We need to passe {passive:false} (actually
            // maybe any object) to ensure the listener is removed by
            // FF20. Otherwise, it is kept, and we end up with multiple
            // handler for the same event!
            el.removeEventListener('mousedown', handleMouseDown, {
                passive: false,
            } as any);
            el.removeEventListener('mousemove', handleMouseMove, {
                passive: false,
            } as any);
            window.removeEventListener('mouseup', dropMouse, {
                passive: false,
            } as any);
            el.removeEventListener('touchstart', updateTouches, {
                passive: false,
            } as any);
            el.removeEventListener('touchmove', updateTouches, {
                passive: false,
            } as any);
            el.removeEventListener('touchend', dropTouches, {
                passive: false,
            } as any);
            el.removeEventListener('touchcancel', dropTouches, {
                passive: false,
            } as any);
        };
    }, [
        updateMouse,
        dropMouse,
        updateTouches,
        dropTouches,
        handleMouseDown,
        handleMouseMove,
    ]);
    const marginTop = -Math.round(
        (height + 30 + (showDigits ? verticalLayout.fontSize : 0)) / 2,
    );
    return (
        <div ref={ref} className="contentWrapper">
            <div className="content" style={{ marginTop }}>
                {rods !== null && (
                    <>
                        <Digits rods={rods} />
                        <div className="frame">
                            <Background
                                rods={rods}
                                rodWidth={horizontalLayout.rodWidth}
                                columnWidth={horizontalLayout.beadWidth}
                                columnGap={horizontalLayout.beadGap}
                                width={width}
                                height={height}
                                beamPosition={getUpperDeckHeight(
                                    verticalLayout,
                                )}
                                beamHeight={verticalLayout.beamHeight}
                            />
                            <Foreground
                                rods={rods}
                                width={width}
                                height={height}
                                styledBeads={styledBeads}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

type RenderProps = {
    element: HTMLElement;
    className?: string;
    onClick?: () => void;
};

const Render = (props: RenderProps) => {
    const { element, className, onClick } = props;
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const target = ref.current;
        if (target !== null) {
            const source = element.cloneNode();
            if (
                source instanceof HTMLCanvasElement &&
                element instanceof HTMLCanvasElement
            ) {
                const ctx = source.getContext('2d');
                if (ctx !== null) {
                    ctx.drawImage(element, 0, 0);
                }
            }
            target.appendChild(source);
            if (source !== null) {
                return () => {
                    target.removeChild(source);
                };
            }
        }
    }, [element]);
    return (
        <div
            tabIndex={onClick !== undefined ? 1 : undefined}
            onClick={onClick}
            className={className}
            ref={ref}
            style={{ display: 'inline-block' }}
        />
    );
};

type ConfigurationProps = {
    styledBeads: Array<HTMLCanvasElement>;
};

const Configuration = (props: ConfigurationProps) => {
    const { styledBeads } = props;
    const setShowConfiguration = useSetRecoilState(showConfigurationState);
    const [configuration, setConfiguration] = useRecoilState(
        configurationState,
    );
    const {
        showDigits,
        firstUnitRod,
        size,
        mainStyle,
        topUnitStyle,
        rodUnitStyle,
    } = configuration;
    const handleShowDigitsChange = useCallback(
        event => {
            const value = !!event.target.checked;
            setConfiguration(conf => ({ ...conf, showDigits: value }));
        },
        [setConfiguration],
    );
    const handleFirstUnitRodChange = useCallback(
        event => {
            const value = parseInt(event.target.value);
            setConfiguration(conf => ({ ...conf, firstUnitRod: value }));
        },
        [setConfiguration],
    );
    const handleSizeChange = useCallback(
        event => {
            const value = event.target.value;
            setConfiguration(conf => ({ ...conf, size: value }));
        },
        [setConfiguration],
    );
    const setMainStyle = useCallback(
        (i: number) => {
            setConfiguration(conf => ({ ...conf, mainStyle: i }));
        },
        [setConfiguration],
    );
    const setRodUnitStyle = useCallback(
        (i: number) => {
            setConfiguration(conf => ({
                ...conf,
                rodUnitStyle: conf.rodUnitStyle === i ? null : i,
            }));
        },
        [setConfiguration],
    );
    const setTopUnitStyle = useCallback(
        (i: number) => {
            setConfiguration(conf => ({
                ...conf,
                topUnitStyle: conf.topUnitStyle === i ? null : i,
            }));
        },
        [setConfiguration],
    );
    const handleClose = useCallback(() => {
        setShowConfiguration(false);
    }, [setShowConfiguration]);
    const furChoices: Array<ReactNode> = [];
    for (let i = 1; i <= MAX_FIRST_UNIT_ROD; ++i) {
        furChoices.push(
            <option key={i} value={i}>
                {i}
            </option>,
        );
    }
    return (
        <div className="configurationWrapper">
            <div className="configuration">
                <h1>Soroban</h1>
                <table>
                    <tbody>
                        <tr>
                            <th>Show Digits</th>
                            <td>
                                <label>
                                    {/* exception with FF6 here */}
                                    <input
                                        onChange={handleShowDigitsChange}
                                        type="checkbox"
                                        checked={showDigits}
                                    />{' '}
                                    (0123456789)
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th>First Unit Rod</th>
                            <td>
                                <select
                                    value={firstUnitRod}
                                    onChange={handleFirstUnitRodChange}
                                >
                                    {furChoices}
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th>Size</th>
                            <td>
                                <select
                                    value={size}
                                    onChange={handleSizeChange}
                                >
                                    <option value="small">Small</option>
                                    <option value="medium">Medium</option>
                                    <option value="large">Large</option>
                                    <option value="big">Big</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th>Main Style</th>
                            <td>
                                <ul>
                                    {styledBeads.map((el, i) => (
                                        <Render
                                            key={i}
                                            element={el}
                                            className={
                                                i === mainStyle
                                                    ? 'choice selected'
                                                    : 'choice'
                                            }
                                            onClick={() => setMainStyle(i)}
                                        />
                                    ))}
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <th>Unit Rod Style</th>
                            <td>
                                {styledBeads.map((el, i) => (
                                    <Render
                                        key={i}
                                        element={el}
                                        className={
                                            i === rodUnitStyle
                                                ? 'choice selected'
                                                : 'choice'
                                        }
                                        onClick={() => setRodUnitStyle(i)}
                                    />
                                ))}
                            </td>
                        </tr>
                        <tr>
                            <th>Unit Top Style</th>
                            <td>
                                {styledBeads.map((el, i) => (
                                    <Render
                                        key={i}
                                        element={el}
                                        className={
                                            i === topUnitStyle
                                                ? 'choice selected'
                                                : 'choice'
                                        }
                                        onClick={() => setTopUnitStyle(i)}
                                    />
                                ))}
                            </td>
                        </tr>
                        <tr>
                            <th></th>
                            <td>
                                <button onClick={handleClose}>Close</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ConfigurationTracker = () => {
    const [configuration, setConfiguration] = useRecoilState(
        configurationState,
    );
    useEffect(() => {
        if (typeof localStorage !== undefined) {
            const data = localStorage.getItem('configuration');
            if (data === null) return;
            let setup;
            try {
                setup = JSON.parse(data);
            } catch (e) {
                return;
            }
            if (setup === null || typeof setup !== 'object') return;
            const {
                showDigits,
                firstUnitRod,
                size,
                mainStyle,
                rodUnitStyle,
                topUnitStyle,
            } = setup;
            if (typeof showDigits === 'boolean') {
                setConfiguration(conf => ({
                    ...conf,
                    showDigits: showDigits,
                }));
            }
            if (typeof firstUnitRod === 'number') {
                setConfiguration(conf => ({
                    ...conf,
                    firstUnitRod: Math.max(
                        0,
                        firstUnitRod % MAX_FIRST_UNIT_ROD,
                    ),
                }));
            }
            if (
                typeof size === 'string' &&
                ['small', 'medium', 'large', 'big'].indexOf(size) !== -1
            ) {
                setConfiguration(conf => ({
                    ...conf,
                    size: size as any,
                }));
            }
            if (typeof mainStyle === 'number') {
                setConfiguration(conf => ({
                    ...conf,
                    mainStyle: Math.max(0, mainStyle),
                }));
            }
            if (typeof rodUnitStyle === 'number') {
                setConfiguration(conf => ({
                    ...conf,
                    rodUnitStyle: Math.max(0, rodUnitStyle),
                }));
            }
            if (typeof topUnitStyle === 'number') {
                setConfiguration(conf => ({
                    ...conf,
                    topUnitStyle: Math.max(0, topUnitStyle),
                }));
            }
        }
    }, [setConfiguration]);
    useEffect(() => {
        if (typeof localStorage !== undefined) {
            localStorage.setItem(
                'configuration',
                JSON.stringify(configuration),
            );
        }
    }, [configuration]);
    return null;
};

const Reconfiguration = () => {
    const configuration = useRecoilValue(configurationState);
    const setHorizontalLayout = useSetRecoilState(horizontalLayoutState);
    const setVerticalLayout = useSetRecoilState(verticalLayoutState);
    const { size } = configuration;
    useEffect(() => {
        setHorizontalLayout(layout => ({
            ...layout,
            ...LAYOUTS[size].horizontal,
        }));
        setVerticalLayout(layout => ({ ...layout, ...LAYOUTS[size].vertical }));
    }, [size, setHorizontalLayout, setVerticalLayout]);
    return null;
};

const Soroban = () => {
    const horizontalLayout = useRecoilValue(horizontalLayoutState);
    const verticalLayout = useRecoilValue(verticalLayoutState);
    const styledBeads: Array<HTMLCanvasElement> = useMemo(() => {
        const styledBeads: Array<HTMLCanvasElement> = [];
        for (let style = 0; style < STYLES; ++style) {
            const bead = document.createElement('canvas');
            bead.width = horizontalLayout.beadWidth;
            bead.height = verticalLayout.beadHeight;
            const beadContext = bead.getContext('2d');
            if (beadContext === null) continue;
            drawBead(
                beadContext,
                bead.width / 2,
                bead.height / 2,
                style,
                horizontalLayout,
                verticalLayout,
            );
            styledBeads.push(bead);
        }
        return styledBeads;
    }, [horizontalLayout, verticalLayout]);
    const styledBeadsSmall: Array<HTMLCanvasElement> = useMemo(() => {
        const styledBeads: Array<HTMLCanvasElement> = [];
        for (let style = 0; style < STYLES; ++style) {
            const bead = document.createElement('canvas');
            const width = 32;
            const height = 22;
            bead.width = width;
            bead.height = height;
            const beadContext = bead.getContext('2d');
            if (beadContext === null) continue;
            drawBead(
                beadContext,
                bead.width / 2,
                bead.height / 2,
                style,
                { ...horizontalLayout, beadWidth: width, beadHole: 6 },
                { ...verticalLayout, beadHeight: height, beadExtra: 2 },
            );
            styledBeads.push(bead);
        }
        return styledBeads;
    }, [horizontalLayout, verticalLayout]);
    const showConfiguration = useRecoilValue(showConfigurationState);
    const setBeads = useSetRecoilState(beadsState);
    useEffect(() => {
        setBeads(beads => makeRods(MAX_RODS, verticalLayout, beads));
    }, [setBeads, verticalLayout]);
    return (
        <>
            <ConfigurationTracker />
            <Reconfiguration />
            {showConfiguration && (
                <Configuration styledBeads={styledBeadsSmall} />
            )}
            {!showConfiguration && <ConfigurationButton />}
            {!showConfiguration && <DigitsButton />}
            <Content styledBeads={styledBeads} />
        </>
    );
};

const boot = () => {
    document.title = 'Soroban';
    ReactDOM.render(
        <RecoilRoot>
            <Soroban />
        </RecoilRoot>,
        document.getElementById('root'),
    );
};

// window.addEventListener('load', boot);
window.onload = boot;
boot();
