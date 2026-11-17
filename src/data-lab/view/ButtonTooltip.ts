/**
 * ButtonTooltip.ts
 *
 * The name of an icon button, shown under it while the pointer rests on it or it
 * has keyboard focus. One tooltip serves the whole screen: the screen view calls
 * `install()` once, which adds the tooltip above everything else and listens for
 * the pointer. A press hides it, so a touch does not leave a label behind.
 *
 * Hover is watched from the screen view rather than from each button: a disabled
 * button ignores input, and a disabled icon is where a student most needs its name.
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import type { Bounds2 } from "scenerystack/dot";
import { Node, type SceneryEvent, Text } from "scenerystack/scenery";
import { Panel } from "scenerystack/sun";
import DataLabColors from "../../DataLabColors.js";
import { FONTS } from "../../DataLabConstants.js";

/** Gap between a button and its tooltip. */
const GAP = 4;
const MAX_WIDTH = 240;

type Label = TReadOnlyProperty<string> | string;

/** Every button that has a tooltip, with the name it shows. */
const labels = new Map<Node, Label>();

let layer: { node: Node; text: Text; panel: Panel; bounds: Bounds2; target: Node | null } | null = null;

function show(target: Node): void {
  const label = labels.get(target);
  if (!layer || label === undefined) {
    return;
  }
  layer.target = target;
  layer.text.string = typeof label === "string" ? label : label.value;
  const button = layer.node.globalToLocalBounds(target.globalBounds);
  const { panel, bounds } = layer;
  panel.centerX = button.centerX;
  panel.top = button.bottom + GAP;
  if (panel.bottom > bounds.maxY) {
    panel.bottom = button.top - GAP;
  }
  panel.left = Math.max(bounds.minX, Math.min(panel.left, bounds.maxX - panel.width));
  layer.node.visible = true;
}

function hide(): void {
  if (layer) {
    layer.target = null;
    layer.node.visible = false;
  }
}

/** The innermost button with a tooltip under the pointer, if any. */
function targetOf(event: SceneryEvent): Node | null {
  const nodes = event.trail.nodes;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node && labels.has(node)) {
      return node;
    }
  }
  return null;
}

export const ButtonTooltip = {
  /** Adds the tooltip to `host` (the screen view), on top; it never leaves `bounds`. */
  install(host: Node, bounds: Bounds2): void {
    const text = new Text("", { font: FONTS.CONTROL, fill: DataLabColors.textColorProperty, maxWidth: MAX_WIDTH });
    const panel = new Panel(text, {
      fill: DataLabColors.panelBackgroundColorProperty,
      stroke: DataLabColors.panelBorderColorProperty,
      cornerRadius: 3,
      xMargin: 6,
      yMargin: 3,
    });
    const node = new Node({ children: [panel], visible: false, pickable: false });
    layer = { node, text, panel, bounds, target: null };
    host.addChild(node);
    // `move`, not `over`: Scenery cuts an `over` trail short at a disabled node.
    host.addInputListener({
      move: (event) => {
        const target = targetOf(event);
        if (target === null) {
          hide();
        } else if (target !== layer?.target) {
          show(target);
        }
      },
      exit: () => hide(),
      down: () => hide(),
    });
  },

  /** Shows `label` for `target` on hover and on keyboard focus. */
  attach(target: Node, label: Label): void {
    labels.set(target, label);
    target.addInputListener({
      focus: () => show(target),
      blur: () => hide(),
    });
  },
} as const;
