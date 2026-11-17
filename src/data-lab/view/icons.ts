/**
 * icons.ts
 *
 * Line icons for the screen's buttons, drawn with kite shapes in a 16 × 16 box so
 * every button in a row has the same height. Strokes use the dark text color of
 * the light button surface; the button dims them when it is disabled.
 */

import { Shape } from "scenerystack/kite";
import { Node, Path, Rectangle, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { LIGHT_SURFACE_TEXT_FILL } from "../../common/DataLabButtonOptions.js";

/** Side of the square every icon occupies. */
const SIZE = 16;
const LINE_WIDTH = 1.5;

function line(shape: Shape, lineDash: number[] = []): Path {
  return new Path(shape, {
    stroke: LIGHT_SURFACE_TEXT_FILL,
    lineWidth: LINE_WIDTH,
    lineCap: "round",
    lineJoin: "round",
    lineDash,
  });
}

function solid(shape: Shape): Path {
  return new Path(shape, { fill: LIGHT_SURFACE_TEXT_FILL });
}

/** Places the drawing in the fixed box, so a small drawing does not make a small button. */
function icon(...children: Node[]): Node {
  return new Node({ children: [new Rectangle(0, 0, SIZE, SIZE), ...children] });
}

function glyph(string: string, font: PhetFont): Node {
  const text = new Text(string, { font, fill: LIGHT_SURFACE_TEXT_FILL, maxWidth: SIZE + 2 });
  text.centerX = SIZE / 2;
  text.centerY = SIZE / 2;
  return icon(text);
}

const page = () =>
  new Shape()
    .moveTo(3, 1)
    .lineTo(10, 1)
    .lineTo(13, 4)
    .lineTo(13, 15)
    .lineTo(3, 15)
    .close()
    .moveTo(10, 1)
    .lineTo(10, 4)
    .lineTo(13, 4);

const pin = () =>
  new Shape()
    .moveTo(5, 1.5)
    .lineTo(11, 1.5)
    .moveTo(6, 1.5)
    .lineTo(6, 6)
    .lineTo(3.5, 9)
    .lineTo(12.5, 9)
    .lineTo(10, 6)
    .lineTo(10, 1.5)
    .moveTo(8, 9)
    .lineTo(8, 15);

export const Icons = {
  /** A new page. */
  newRun: (): Node => icon(line(page().moveTo(8, 7).lineTo(8, 12.5).moveTo(5.25, 9.75).lineTo(10.75, 9.75))),

  /** A pencil. */
  edit: (): Node =>
    icon(
      line(
        new Shape()
          .moveTo(2, 14)
          .lineTo(3, 10.5)
          .lineTo(11, 2.5)
          .lineTo(13.5, 5)
          .lineTo(5.5, 13)
          .close()
          .moveTo(9.5, 4)
          .lineTo(12, 6.5),
      ),
    ),

  /** A page with an arrow coming out of it: read a file. */
  openFile: (): Node => icon(line(page().moveTo(8, 13).lineTo(8, 7).moveTo(5.5, 9.5).lineTo(8, 7).lineTo(10.5, 9.5))),

  /** A clipboard. */
  paste: (): Node =>
    icon(
      line(new Shape().roundRect(2.5, 2.5, 11, 12.5, 1.5, 1.5).moveTo(5, 8).lineTo(11, 8).moveTo(5, 11).lineTo(11, 11)),
      solid(new Shape().roundRect(5.5, 1, 5, 3, 1, 1)),
    ),

  /** A flask. */
  sample: (): Node =>
    icon(
      line(
        new Shape()
          .moveTo(5.5, 1.5)
          .lineTo(10.5, 1.5)
          .moveTo(6.5, 1.5)
          .lineTo(6.5, 6)
          .lineTo(3, 14.5)
          .lineTo(13, 14.5)
          .lineTo(9.5, 6)
          .lineTo(9.5, 1.5),
      ),
      solid(new Shape().moveTo(4.44, 11).lineTo(11.56, 11).lineTo(13, 14.5).lineTo(3, 14.5).close()),
    ),

  /** The Bluetooth rune: the Smart Cart connects over Bluetooth. */
  bluetooth: (): Node =>
    icon(
      line(new Shape().moveTo(4.5, 5).lineTo(11.5, 11).lineTo(8, 14.5).lineTo(8, 1.5).lineTo(11.5, 5).lineTo(4.5, 11)),
    ),

  /** A table with a row added below it. */
  addRow: (): Node =>
    icon(
      line(
        new Shape()
          .rect(1.5, 1, 13, 8)
          .moveTo(1.5, 5)
          .lineTo(14.5, 5)
          .moveTo(8, 1)
          .lineTo(8, 9)
          .moveTo(8, 10.5)
          .lineTo(8, 15)
          .moveTo(5.75, 12.75)
          .lineTo(10.25, 12.75),
      ),
    ),

  /** A table with a column added to its right. */
  addColumn: (): Node =>
    icon(
      line(
        new Shape()
          .rect(1, 1.5, 8, 13)
          .moveTo(5, 1.5)
          .lineTo(5, 14.5)
          .moveTo(1, 8)
          .lineTo(9, 8)
          .moveTo(10.5, 8)
          .lineTo(15, 8)
          .moveTo(12.75, 5.75)
          .lineTo(12.75, 10.25),
      ),
    ),

  /** f(x): a column computed from others. */
  formula: (): Node => glyph("f(x)", new PhetFont({ size: 12, style: "italic", family: "Georgia, serif" })),

  /** An arrow into a tray. */
  download: (): Node =>
    icon(
      line(
        new Shape()
          .moveTo(8, 1.5)
          .lineTo(8, 10)
          .moveTo(4.5, 6.5)
          .lineTo(8, 10)
          .lineTo(11.5, 6.5)
          .moveTo(2, 10.5)
          .lineTo(2, 14.5)
          .lineTo(14, 14.5)
          .lineTo(14, 10.5),
      ),
    ),

  /** An arrow that turns back on itself. Redo is its mirror image. */
  undo: (): Node => icon(undoShape(false)),
  redo: (): Node => icon(undoShape(true)),

  /** An open folder. */
  openSession: (): Node =>
    icon(
      line(
        new Shape()
          .moveTo(1.5, 13.5)
          .lineTo(1.5, 2.5)
          .lineTo(6, 2.5)
          .lineTo(7.5, 4)
          .lineTo(13, 4)
          .lineTo(13, 7)
          .moveTo(1.5, 13.5)
          .lineTo(4, 7)
          .lineTo(15, 7)
          .lineTo(12.5, 13.5)
          .close(),
      ),
    ),

  /** A floppy disk. */
  save: (): Node =>
    icon(
      line(
        new Shape()
          .moveTo(2, 2)
          .lineTo(11.5, 2)
          .lineTo(14, 4.5)
          .lineTo(14, 14)
          .lineTo(2, 14)
          .close()
          .rect(5, 2, 5.5, 3.5)
          .rect(4.5, 9, 7, 5),
      ),
    ),

  /** The two range edges with a cross between them. */
  clearRange: (): Node =>
    icon(
      line(
        new Shape()
          .moveTo(2, 2)
          .lineTo(2, 14)
          .moveTo(14, 2)
          .lineTo(14, 14)
          .moveTo(5.5, 5.5)
          .lineTo(10.5, 10.5)
          .moveTo(10.5, 5.5)
          .lineTo(5.5, 10.5),
      ),
    ),

  /** A magnifying glass with a plus. */
  zoomIn: (): Node =>
    icon(
      line(new Shape().circle(6.5, 6.5, 4.75).moveTo(6.5, 4.5).lineTo(6.5, 8.5).moveTo(4.5, 6.5).lineTo(8.5, 6.5)),
      new Path(new Shape().moveTo(10.25, 10.25).lineTo(14.5, 14.5), {
        stroke: LIGHT_SURFACE_TEXT_FILL,
        lineWidth: 2.5,
        lineCap: "round",
      }),
    ),

  /** Four corners around a rising line: fit the view to the data. */
  autoScale: (): Node =>
    icon(
      line(
        new Shape()
          .moveTo(1.5, 5.5)
          .lineTo(1.5, 1.5)
          .lineTo(5.5, 1.5)
          .moveTo(10.5, 1.5)
          .lineTo(14.5, 1.5)
          .lineTo(14.5, 5.5)
          .moveTo(14.5, 10.5)
          .lineTo(14.5, 14.5)
          .lineTo(10.5, 14.5)
          .moveTo(5.5, 14.5)
          .lineTo(1.5, 14.5)
          .lineTo(1.5, 10.5)
          .moveTo(4.5, 11.5)
          .lineTo(7.5, 8)
          .lineTo(9, 9)
          .lineTo(11.5, 4.5),
      ),
    ),

  /** Σ: statistics of the selected range. */
  statistics: (): Node => glyph("Σ", new PhetFont({ size: 15, weight: "bold" })),

  /** Two overlapping sheets. */
  copy: (): Node =>
    icon(
      line(
        new Shape()
          .roundRect(5, 5, 9.5, 9.5, 1.5, 1.5)
          .moveTo(3.5, 11)
          .lineTo(1.5, 11)
          .lineTo(1.5, 1.5)
          .lineTo(11, 1.5)
          .lineTo(11, 3.5),
      ),
    ),

  /** A pushpin. */
  pin: (): Node => icon(line(pin())),

  /** A pushpin struck through. */
  unpin: (): Node => icon(line(pin().moveTo(2, 2).lineTo(14, 14))),

  /** A solid curve and a dashed one: the current fit against the pinned fit. */
  compare: (): Node =>
    icon(
      line(new Shape().moveTo(1.5, 12).quadraticCurveTo(7, 12, 14.5, 2)),
      line(new Shape().moveTo(1.5, 14.5).quadraticCurveTo(10, 14.5, 14.5, 7), [2, 2]),
    ),
} as const;

function undoShape(mirrored: boolean): Path {
  const x = (value: number) => (mirrored ? SIZE - value : value);
  const shape = new Shape()
    .moveTo(x(6), 4)
    .lineTo(x(3), 7)
    .lineTo(x(6), 10)
    .moveTo(x(3), 7)
    .lineTo(x(10), 7)
    .arc(x(10), 10.5, 3.5, -Math.PI / 2, Math.PI / 2, mirrored)
    .lineTo(x(6), 14);
  return line(shape);
}
