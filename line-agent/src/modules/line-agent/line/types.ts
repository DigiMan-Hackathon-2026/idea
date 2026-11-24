// The subset of the LINE Messaging API this agent sends and receives.

export type LineAction =
  | { type: "postback"; label: string; data: string; displayText?: string }
  | { type: "uri"; label: string; uri: string }
  | { type: "message"; label: string; text: string };

export type QuickReply = { items: { type: "action"; action: LineAction }[] };

export type FlexText = {
  type: "text";
  text: string;
  size?: "xxs" | "xs" | "sm" | "md" | "lg" | "xl";
  weight?: "regular" | "bold";
  color?: string;
  wrap?: boolean;
  margin?: "none" | "xs" | "sm" | "md" | "lg";
};
export type FlexButton = { type: "button"; action: LineAction; style?: "primary" | "secondary" | "link"; height?: "sm" | "md"; color?: string };
export type FlexSeparator = { type: "separator"; margin?: "sm" | "md" | "lg" };
export type FlexBox = {
  type: "box";
  layout: "vertical" | "horizontal" | "baseline";
  contents: FlexComponent[];
  spacing?: "none" | "xs" | "sm" | "md" | "lg";
  margin?: "none" | "xs" | "sm" | "md" | "lg";
  paddingAll?: string;
  backgroundColor?: string;
};
export type FlexComponent = FlexText | FlexButton | FlexSeparator | FlexBox;
export type FlexBubble = { type: "bubble"; size?: "kilo" | "mega" | "giga"; header?: FlexBox; body: FlexBox; footer?: FlexBox };
export type FlexCarousel = { type: "carousel"; contents: FlexBubble[] };

export type LineMessage =
  | { type: "text"; text: string; quickReply?: QuickReply }
  | { type: "flex"; altText: string; contents: FlexBubble | FlexCarousel; quickReply?: QuickReply };

export type LineSource =
  | { type: "user"; userId: string }
  | { type: "group"; groupId: string; userId?: string }
  | { type: "room"; roomId: string; userId?: string };

export type LineEvent =
  | {
      type: "message";
      webhookEventId: string;
      timestamp: number;
      replyToken: string;
      source: LineSource;
      mode?: string;
      deliveryContext?: { isRedelivery: boolean };
      message:
        | { type: "text"; id: string; text: string; mention?: { mentionees: { isSelf?: boolean; type?: string }[] } }
        | { type: "image" | "location" | "sticker" | "audio" | "video" | "file"; id: string };
    }
  | {
      type: "postback";
      webhookEventId: string;
      timestamp: number;
      replyToken: string;
      source: LineSource;
      postback: { data: string };
      deliveryContext?: { isRedelivery: boolean };
    }
  | { type: "follow" | "join"; webhookEventId: string; timestamp: number; replyToken: string; source: LineSource }
  | { type: "unfollow" | "leave" | "memberJoined" | "memberLeft" | "unsend" | "videoPlayComplete" | "beacon" | "accountLink" | "things"; webhookEventId: string; timestamp: number; source: LineSource };

export type LineWebhookBody = { destination: string; events: LineEvent[] };
