export type HorizontalLayout = {
    beadWidth: number;
    beadHole: number;
    beadGap: number;
    rodWidth: number;
};

export type VerticalLayout = {
    beadHeight: number;
    beadExtra: number;
    upperDeckBeads: number;
    beamHeight: number;
    lowerDeckBeads: number;
    fontSize: number;
};

export type LayoutSize = 'small' | 'medium' | 'large' | 'big';

export const LAYOUTS: {
    [key in LayoutSize]: {
        vertical: VerticalLayout;
        horizontal: HorizontalLayout;
    };
} = {
    small: {
        horizontal: {
            beadWidth: 50,
            beadHole: 12,
            beadGap: 3,
            rodWidth: 10,
        },
        vertical: {
            beadHeight: 34,
            beadExtra: 2,
            upperDeckBeads: 1,
            beamHeight: 22,
            lowerDeckBeads: 4,
            fontSize: 45,
        },
    },
    medium: {
        horizontal: {
            beadWidth: 72,
            beadHole: 16,
            beadGap: 3,
            rodWidth: 12,
        },
        vertical: {
            beadHeight: 48,
            beadExtra: 2,
            upperDeckBeads: 1,
            beamHeight: 24,
            lowerDeckBeads: 4,
            fontSize: 60,
        },
    },
    large: {
        horizontal: {
            beadWidth: 92,
            beadHole: 18,
            beadGap: 4,
            rodWidth: 14,
        },
        vertical: {
            beadHeight: 62,
            beadExtra: 3,
            upperDeckBeads: 1,
            beamHeight: 28,
            lowerDeckBeads: 4,
            fontSize: 75,
        },
    },
    big: {
        horizontal: {
            beadWidth: 128,
            beadHole: 24,
            beadGap: 5,
            rodWidth: 18,
        },
        vertical: {
            beadHeight: 86,
            beadExtra: 4,
            upperDeckBeads: 1,
            beamHeight: 38,
            lowerDeckBeads: 4,
            fontSize: 90,
        },
    },
};
