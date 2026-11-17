/**
 * DataLabScreenIcons.ts
 *
 * Programmatic home-screen / navigation-bar icons for each screen.
 * Drawn on the standard PhET 548 × 373 canvas using DataLabColors.
 * Motif: scatter points with a fitted curve over a chart frame — the lab's
 * core activity (table → graph → fit).
 */
import { Shape } from "scenerystack/kite";
import { Circle, Node, Path, Rectangle } from "scenerystack/scenery";
import { ScreenIcon } from "scenerystack/sim";
import DataLabColors from "../DataLabColors.js";
import { SCREEN_ICONS } from "../DataLabConstants.js";

const W = SCREEN_ICONS.WIDTH;
const H = SCREEN_ICONS.HEIGHT;

/** Plot rectangle inset from the icon canvas. */
const PLOT = { left: 70, top: 50, width: 400, height: 260 } as const;

function background(): Rectangle {
  return new Rectangle(0, 0, W, H, {
    fill: DataLabColors.backgroundColorProperty,
  });
}

function chartFrame(): Node {
  return new Node({
    children: [
      new Rectangle(PLOT.left, PLOT.top, PLOT.width, PLOT.height, {
        fill: DataLabColors.chartBackgroundColorProperty,
        stroke: DataLabColors.panelBorderColorProperty,
        lineWidth: 3,
      }),
      // Light horizontal grid hints
      ...[0.25, 0.5, 0.75].map(
        (fraction) =>
          new Path(
            Shape.lineSegment(
              PLOT.left,
              PLOT.top + fraction * PLOT.height,
              PLOT.left + PLOT.width,
              PLOT.top + fraction * PLOT.height,
            ),
            {
              stroke: DataLabColors.chartGridColorProperty,
              lineWidth: 1.5,
            },
          ),
      ),
    ],
  });
}

/** Sample scatter that reads as rising data with a couple of outliers. */
const POINTS: ReadonlyArray<readonly [number, number]> = [
  [0.08, 0.82],
  [0.18, 0.74],
  [0.28, 0.68],
  [0.38, 0.55],
  [0.48, 0.5],
  [0.58, 0.42],
  [0.68, 0.3],
  [0.78, 0.24],
  [0.88, 0.16],
  [0.42, 0.22], // outlier below the trend
];

function scatterPoints(): Node {
  return new Node({
    children: POINTS.map(([nx, ny]) => {
      const x = PLOT.left + nx * PLOT.width;
      const y = PLOT.top + ny * PLOT.height;
      return new Circle(9, {
        x,
        y,
        fill: DataLabColors.pointColorProperty,
        stroke: DataLabColors.backgroundColorProperty,
        lineWidth: 2,
      });
    }),
  });
}

/** Gentle rising fit through the cloud (not through the outlier). */
function fitCurve(): Path {
  const shape = new Shape()
    .moveTo(PLOT.left + 0.05 * PLOT.width, PLOT.top + 0.85 * PLOT.height)
    .cubicCurveTo(
      PLOT.left + 0.35 * PLOT.width,
      PLOT.top + 0.7 * PLOT.height,
      PLOT.left + 0.65 * PLOT.width,
      PLOT.top + 0.35 * PLOT.height,
      PLOT.left + 0.95 * PLOT.width,
      PLOT.top + 0.12 * PLOT.height,
    );
  return new Path(shape, {
    stroke: DataLabColors.fitLineColorProperty,
    lineWidth: 8,
    lineCap: "round",
  });
}

function iconFrom(content: Node): ScreenIcon {
  return new ScreenIcon(content, {
    maxIconWidthProportion: 1,
    maxIconHeightProportion: 1,
    fill: DataLabColors.backgroundColorProperty,
  });
}

export function createDataLabIcon(): ScreenIcon {
  return iconFrom(
    new Node({
      children: [background(), chartFrame(), fitCurve(), scatterPoints()],
    }),
  );
}
