/**
 * PointsCanvasNode.ts
 *
 * Draws the data points of a graph on one canvas, so thousands of rows cost one
 * paint rather than thousands of scene-graph nodes. Points the fit uses are filled;
 * the rest are hollow, so inclusion is never shown by color alone.
 */

import type { ChartTransform } from "scenerystack/bamboo";
import { Bounds2 } from "scenerystack/dot";
import { CanvasNode } from "scenerystack/scenery";
import DataLabColors from "../../DataLabColors.js";
import { validUncertainty } from "../model/leastSquares.js";

import { axisCoordinate } from "./axisRange.js";

const POINT_RADIUS = 3;
const HOLLOW_LINE_WIDTH = 1;

export class PointsCanvasNode extends CanvasNode {
  private logX = false;
  private logY = false;
  private xs: readonly number[] = [];
  private ys: readonly number[] = [];
  private uncertainties: readonly number[] = [];
  private included: readonly boolean[] = [];
  private readonly chartTransform: ChartTransform;

  public constructor(chartTransform: ChartTransform, viewWidth: number, viewHeight: number) {
    super({ canvasBounds: new Bounds2(0, 0, viewWidth, viewHeight), pickable: false });
    this.chartTransform = chartTransform;
    const repaint = () => this.invalidatePaint();
    chartTransform.changedEmitter.addListener(repaint);
    DataLabColors.pointColorProperty.lazyLink(repaint);
    DataLabColors.excludedPointColorProperty.lazyLink(repaint);
  }

  /** `included[i]` says whether point i is filled. Non-finite points are not drawn. */
  public setPoints(
    xs: readonly number[],
    ys: readonly number[],
    included: readonly boolean[],
    uncertainties: readonly number[] = [],
    logX = false,
    logY = false,
  ): void {
    this.logX = logX;
    this.logY = logY;
    this.xs = xs;
    this.ys = ys;
    this.included = included;
    this.uncertainties = uncertainties;
    this.invalidatePaint();
  }

  public override paintCanvas(context: CanvasRenderingContext2D): void {
    const { minX, minY, maxX, maxY } = this.canvasBounds;
    const count = Math.min(this.xs.length, this.ys.length);
    context.lineWidth = HOLLOW_LINE_WIDTH;
    context.fillStyle = DataLabColors.pointColorProperty.value.toCSS();
    context.strokeStyle = DataLabColors.excludedPointColorProperty.value.toCSS();
    for (let i = 0; i < count; i++) {
      const x = this.xs[i] as number;
      const y = this.ys[i] as number;
      const axisX = axisCoordinate(x, this.logX);
      const axisY = axisCoordinate(y, this.logY);
      if (!(Number.isFinite(axisX) && Number.isFinite(axisY))) {
        continue;
      }
      const viewX = this.chartTransform.modelToViewX(axisX);
      const viewY = this.chartTransform.modelToViewY(axisY);
      const sigma = this.uncertainties[i];
      if (validUncertainty(sigma) && Number.isFinite(y + sigma) && Number.isFinite(y - sigma)) {
        const top = this.chartTransform.modelToViewY(axisCoordinate(y + sigma, this.logY));
        const lower = axisCoordinate(y - sigma, this.logY);
        const bottom = Number.isFinite(lower) ? this.chartTransform.modelToViewY(lower) : maxY;
        context.beginPath();
        context.moveTo(viewX, top);
        context.lineTo(viewX, bottom);
        context.moveTo(viewX - POINT_RADIUS, top);
        context.lineTo(viewX + POINT_RADIUS, top);
        if (Number.isFinite(lower)) {
          context.moveTo(viewX - POINT_RADIUS, bottom);
          context.lineTo(viewX + POINT_RADIUS, bottom);
        }
        context.stroke();
      }
      if (
        viewX < minX - POINT_RADIUS ||
        viewX > maxX + POINT_RADIUS ||
        viewY < minY - POINT_RADIUS ||
        viewY > maxY + POINT_RADIUS
      ) {
        continue;
      }
      context.beginPath();
      context.arc(viewX, viewY, POINT_RADIUS, 0, 2 * Math.PI);
      if (this.included[i]) {
        context.fill();
      } else {
        context.stroke();
      }
    }
  }
}
