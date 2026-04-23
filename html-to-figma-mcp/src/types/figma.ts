export type RGBA = { r: number; g: number; b: number; a: number };

export type SolidPaint = { type: "SOLID"; color: RGBA };
export type ImagePaint = {
  type: "IMAGE";
  imageHash?: string;
  imageUrl?: string;
  scaleMode?: "FILL" | "FIT" | "CROP" | "TILE";
};
export type GradientPaint = {
  type: "GRADIENT_LINEAR" | "GRADIENT_RADIAL";
  gradientStops: { position: number; color: RGBA }[];
};
export type Paint = SolidPaint | ImagePaint | GradientPaint;

export type DropShadowEffect = {
  type: "DROP_SHADOW" | "INNER_SHADOW";
  color: RGBA;
  offset: { x: number; y: number };
  radius: number;
  spread?: number;
  visible?: boolean;
  blendMode?: "NORMAL";
};
export type Effect = DropShadowEffect;

export type LayoutMode = "NONE" | "HORIZONTAL" | "VERTICAL";
export type LayoutSizing = "FIXED" | "HUG" | "FILL";

export type TypographyStyle = {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeight?: { value: number; unit: "PIXELS" | "PERCENT" | "AUTO" };
  letterSpacing?: { value: number; unit: "PIXELS" | "PERCENT" };
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textDecoration?: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  textCase?: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
};

export interface BaseNode {
  type: string;
  name?: string;
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  effects?: Effect[];
  opacity?: number;
  cornerRadius?: number;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomLeftRadius?: number;
  bottomRightRadius?: number;
  width?: number;
  height?: number;
  layoutSizingHorizontal?: LayoutSizing;
  layoutSizingVertical?: LayoutSizing;
  children?: FigmaNode[];
}

export interface FrameNode extends BaseNode {
  type: "FRAME";
  layoutMode?: LayoutMode;
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
}

export interface TextNode extends BaseNode {
  type: "TEXT";
  characters: string;
  style?: TypographyStyle;
}

export interface RectangleNode extends BaseNode {
  type: "RECTANGLE";
}

export interface ComponentNode extends BaseNode {
  type: "COMPONENT";
  layoutMode?: LayoutMode;
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
  componentPropertyDefinitions?: Record<
    string,
    { type: "TEXT" | "BOOLEAN" | "VARIANT"; defaultValue: string | boolean; variantOptions?: string[] }
  >;
}

export interface VectorNode extends BaseNode {
  type: "VECTOR";
  svgSource?: string;
}

export type FigmaNode = FrameNode | TextNode | RectangleNode | ComponentNode | VectorNode;

export type Warning = { code: string; message: string; property?: string };

export type ConvertResult = {
  node: FigmaNode;
  warnings: Warning[];
};
