import { pointFrom, type GlobalPoint, type LocalPoint } from "@excalidraw/math";

import { THEME } from "@excalidraw/common";

import type { PointSnapLine, PointerSnapLine } from "../snapping";
import type { InteractiveCanvasAppState } from "../types";

const SNAP_COLOR_LIGHT = "#ff2d78";
const SNAP_COLOR_DARK = "#ff174d";
const SNAP_HALO_LIGHT = "rgba(255, 255, 255, 0.96)";
const SNAP_HALO_DARK = "rgba(0, 0, 0, 0.92)";
const SNAP_WIDTH = 1.5;
const SNAP_CROSS_SIZE = 3;
const SNAP_LINE_EXTENSION = 6;

export const renderSnaps = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  if (!appState.snapLines.length) {
    return;
  }

  // in dark mode, we need to adjust the color to account for color inversion.
  // Don't change if zen mode, because we draw only crosses, we want the
  // colors to be more visible
  const snapColor =
    appState.theme === THEME.LIGHT || appState.zenModeEnabled
      ? SNAP_COLOR_LIGHT
      : SNAP_COLOR_DARK;
  const snapHaloColor =
    appState.theme === THEME.LIGHT || appState.zenModeEnabled
      ? SNAP_HALO_LIGHT
      : SNAP_HALO_DARK;
  // in zen mode make the cross more visible since we don't draw the lines
  const snapWidth =
    (appState.zenModeEnabled ? SNAP_WIDTH * 1.5 : SNAP_WIDTH) /
    appState.zoom.value;

  context.save();
  context.translate(appState.scrollX, appState.scrollY);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalAlpha = 0.98;
  context.shadowColor = snapHaloColor;
  context.shadowBlur = 2 / appState.zoom.value;
  context.fillStyle = snapColor;

  for (const snapLine of appState.snapLines) {
    if (snapLine.type === "pointer") {
      context.lineWidth = snapWidth;
      context.strokeStyle = snapColor;

      drawPointerSnapLine(snapLine, context, appState);
    } else if (snapLine.type === "gap") {
      context.lineWidth = snapWidth;
      context.strokeStyle = snapColor;

      drawGapLine(
        snapLine.points[0],
        snapLine.points[1],
        snapLine.direction,
        appState,
        context,
        snapColor,
        snapHaloColor,
      );
    } else if (snapLine.type === "points") {
      context.lineWidth = snapWidth;
      context.strokeStyle = snapColor;
      drawPointsSnapLine(snapLine, context, appState);
    }
  }

  context.restore();
};

const drawPointsSnapLine = (
  pointSnapLine: PointSnapLine,
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  if (!appState.zenModeEnabled) {
    const firstPoint = pointSnapLine.points[0];
    const lastPoint = pointSnapLine.points[pointSnapLine.points.length - 1];
    const extension = SNAP_LINE_EXTENSION / appState.zoom.value;

    const lineStart =
      firstPoint[0] === lastPoint[0]
        ? pointFrom(firstPoint[0], firstPoint[1] - extension)
        : pointFrom(firstPoint[0] - extension, firstPoint[1]);
    const lineEnd =
      firstPoint[0] === lastPoint[0]
        ? pointFrom(lastPoint[0], lastPoint[1] + extension)
        : pointFrom(lastPoint[0] + extension, lastPoint[1]);

    drawLine(lineStart, lineEnd, context);
  }

  for (const point of pointSnapLine.points) {
    drawCross(point, appState, context);
  }
};

const drawPointerSnapLine = (
  pointerSnapLine: PointerSnapLine,
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  drawCross(pointerSnapLine.points[0], appState, context);
  if (!appState.zenModeEnabled) {
    drawLine(pointerSnapLine.points[0], pointerSnapLine.points[1], context);
  }
};

const drawCross = <Point extends LocalPoint | GlobalPoint>(
  [x, y]: Point,
  appState: InteractiveCanvasAppState,
  context: CanvasRenderingContext2D,
) => {
  context.save();
  const size =
    (appState.zenModeEnabled ? SNAP_CROSS_SIZE * 1.5 : SNAP_CROSS_SIZE) /
    appState.zoom.value;
  context.beginPath();

  context.moveTo(x - size, y - size);
  context.lineTo(x + size, y + size);

  context.moveTo(x + size, y - size);
  context.lineTo(x - size, y + size);

  context.stroke();
  context.beginPath();
  context.arc(x, y, size * 0.45, 0, Math.PI * 2);
  context.fill();
  context.restore();
};

const drawLine = <Point extends LocalPoint | GlobalPoint>(
  from: Point,
  to: Point,
  context: CanvasRenderingContext2D,
) => {
  context.beginPath();
  context.lineTo(from[0], from[1]);
  context.lineTo(to[0], to[1]);
  context.stroke();
};

const drawGapLine = <Point extends LocalPoint | GlobalPoint>(
  from: Point,
  to: Point,
  direction: "horizontal" | "vertical",
  appState: InteractiveCanvasAppState,
  context: CanvasRenderingContext2D,
  snapColor: string,
  snapHaloColor: string,
) => {
  // a horizontal gap snap line
  // |–––––––||–––––––|
  // ^    ^   ^       ^
  // \    \   \       \
  // (1)  (2) (3)     (4)

  const FULL = 8 / appState.zoom.value;
  const HALF = FULL / 2;
  const QUARTER = FULL / 4;

  if (direction === "horizontal") {
    const halfPoint = [(from[0] + to[0]) / 2, from[1]];
    // (1)
    if (!appState.zenModeEnabled) {
      drawLine(
        pointFrom(from[0], from[1] - FULL),
        pointFrom(from[0], from[1] + FULL),
        context,
      );
    }

    // (3)
    drawLine(
      pointFrom(halfPoint[0] - QUARTER, halfPoint[1] - HALF),
      pointFrom(halfPoint[0] - QUARTER, halfPoint[1] + HALF),
      context,
    );
    drawLine(
      pointFrom(halfPoint[0] + QUARTER, halfPoint[1] - HALF),
      pointFrom(halfPoint[0] + QUARTER, halfPoint[1] + HALF),
      context,
    );

    if (!appState.zenModeEnabled) {
      // (4)
      drawLine(
        pointFrom(to[0], to[1] - FULL),
        pointFrom(to[0], to[1] + FULL),
        context,
      );

      // (2)
      drawLine(from, to, context);
    }
  } else {
    const halfPoint = [from[0], (from[1] + to[1]) / 2];
    // (1)
    if (!appState.zenModeEnabled) {
      drawLine(
        pointFrom(from[0] - FULL, from[1]),
        pointFrom(from[0] + FULL, from[1]),
        context,
      );
    }

    // (3)
    drawLine(
      pointFrom(halfPoint[0] - HALF, halfPoint[1] - QUARTER),
      pointFrom(halfPoint[0] + HALF, halfPoint[1] - QUARTER),
      context,
    );
    drawLine(
      pointFrom(halfPoint[0] - HALF, halfPoint[1] + QUARTER),
      pointFrom(halfPoint[0] + HALF, halfPoint[1] + QUARTER),
      context,
    );

    if (!appState.zenModeEnabled) {
      // (4)
      drawLine(
        pointFrom(to[0] - FULL, to[1]),
        pointFrom(to[0] + FULL, to[1]),
        context,
      );

      // (2)
      drawLine(from, to, context);
    }
  }

  if (!appState.zenModeEnabled) {
    drawGapDistanceLabel(
      from,
      to,
      direction,
      appState,
      context,
      snapColor,
      snapHaloColor,
    );
  }
};

const drawGapDistanceLabel = <Point extends LocalPoint | GlobalPoint>(
  from: Point,
  to: Point,
  direction: "horizontal" | "vertical",
  appState: InteractiveCanvasAppState,
  context: CanvasRenderingContext2D,
  snapColor: string,
  snapHaloColor: string,
) => {
  const distance =
    direction === "horizontal"
      ? Math.abs(to[0] - from[0])
      : Math.abs(to[1] - from[1]);

  // Avoid illegible labels when the measured gap is too short on screen.
  if (distance * appState.zoom.value < 24) {
    return;
  }

  const zoom = appState.zoom.value;
  const label = Number.isInteger(distance)
    ? `${distance}`
    : `${Math.round(distance * 10) / 10}`;
  const offset = 11 / zoom;
  const x =
    direction === "horizontal" ? (from[0] + to[0]) / 2 : from[0] + offset;
  const y =
    direction === "horizontal" ? from[1] - offset : (from[1] + to[1]) / 2;

  context.save();
  context.shadowBlur = 0;
  context.font = `600 ${
    11 / zoom
  }px -apple-system, BlinkMacSystemFont, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 4 / zoom;
  context.strokeStyle = snapHaloColor;
  context.strokeText(label, x, y);
  context.fillStyle = snapColor;
  context.fillText(label, x, y);
  context.restore();
};
