export type Point = {
    x: number;
    y: number;
};

// A linear move between two points with a touch of a given radius
export type Move = {
    id: number;
    from: Point;
    to: Point;
    radius: number;
};

export type IntersectionOutcome = 'inside' | 'outside' | 'intersect';
