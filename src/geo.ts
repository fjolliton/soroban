import { Point, IntersectionOutcome } from './common';

// Compute the distance between two points
export const ptDist = (a: Point, b: Point): number =>
    Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));

// Compute a point on the line passing by the given points
export const ptLerp = (a: Point, b: Point, k: number): Point => ({
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
});

// Test if a circle intersects with a directed line
export const circleLineIntersect = (
    c: { x: number; y: number; r: number },
    a: Point,
    b: Point,
): IntersectionOutcome => {
    const d =
        ((b.x - a.x) * (a.y - c.y) - (b.y - a.y) * (a.x - c.x)) / ptDist(a, b);
    return d > c.r ? 'outside' : d > -c.r ? 'intersect' : 'inside';
};

// Test if a circle intersects with a convex polygons
export const intersectCirclePolygon = (
    circle: { x: number; y: number; r: number },
    polygon: Array<Point>,
): IntersectionOutcome => {
    let intersect = false;
    let a = polygon[polygon.length - 1];
    for (const b of polygon) {
        const outcome = circleLineIntersect(circle, a, b);
        if (outcome === 'outside') return 'outside';
        if (outcome === 'intersect') intersect = true;
        a = b;
    }
    return intersect ? 'intersect' : 'inside';
};
