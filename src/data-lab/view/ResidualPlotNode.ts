/**
 * ResidualPlotNode.ts
 *
 * Residuals (y − fit) of the rows the fit used, against x, on the same x axis as
 * the main graph. A fit that suits the data scatters evenly about the zero line;
 * a curve or a trend here says the model is wrong, whatever R² reads.
 */

import { Multilink, type TReadOnlyProperty } from "scenerystack/axon";
import { Range } from "scenerystack/dot";
import { Line, Node } from "scenerystack/scenery";
import { columnLabel } from "../../common/model/Dataset.js";
import { withUnit } from "../../common/model/formatFit.js";
import { ChartFrameNode } from "../../common/view/ChartFrameNode.js";
import { PointsCanvasNode } from "../../common/view/PointsCanvasNode.js";
import DataLabColors from "../../DataLabColors.js";
import { StringManager } from "../../i18n/StringManager.js";
import type { DataLabModel } from "../model/DataLabModel.js";

/** Headroom above the largest residual, as a multiple of it. */
const Y_HEADROOM = 1.25;

export type ResidualPlotNodeOptions = {
  readonly viewWidth: number;
  readonly viewHeight: number;
};

export class ResidualPlotNode extends Node {
  public constructor(
    model: DataLabModel,
    xAxisRangeProperty: TReadOnlyProperty<Range>,
    options: ResidualPlotNodeOptions,
  ) {
    super();
    const { viewWidth, viewHeight } = options;
    const labels = StringManager.getInstance().getLabels();

    const frame = new ChartFrameNode({ viewWidth, viewHeight, yTickCount: 3 });
    const chartTransform = frame.chartTransform;
    const zeroLine = new Line(0, 0, viewWidth, 0, {
      stroke: DataLabColors.fitLineColorProperty,
      lineWidth: 1.5,
    });
    const points = new PointsCanvasNode(chartTransform, viewWidth, viewHeight);
    frame.plotLayer.addChild(zeroLine);
    frame.plotLayer.addChild(points);
    this.addChild(frame);

    Multilink.multilink(
      [model.fitProperty, xAxisRangeProperty, labels.residualsStringProperty],
      (fit, xRange, residualsLabel) => {
        const xColumn = model.xColumnProperty.value;
        const yColumn = model.yColumnProperty.value;
        const indices = model.inclusionProperty.value.indices;

        const xs: number[] = [];
        const residuals: number[] = [];
        let largest = 0;
        if (fit.ok && xColumn) {
          indices.forEach((rowIndex, k) => {
            const residual = fit.residuals[k] as number;
            xs.push(xColumn.values[rowIndex] as number);
            residuals.push(residual);
            largest = Math.max(largest, Math.abs(residual));
          });
        }
        const halfHeight = largest > 0 ? largest * Y_HEADROOM : 1;
        frame.setRanges(xRange, new Range(-halfHeight, halfHeight));
        zeroLine.y = chartTransform.modelToViewY(0);
        points.setPoints(
          xs,
          residuals,
          xs.map(() => true),
        );
        frame.xAxisLabel.string = xColumn ? columnLabel(xColumn) : "";
        frame.yAxisLabel.string = withUnit(residualsLabel, yColumn?.unit ? `(${yColumn.unit})` : "");
      },
    );
  }
}
