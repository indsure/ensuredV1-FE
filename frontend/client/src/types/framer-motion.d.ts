import "framer-motion";
import React from "react";

declare module "framer-motion" {
  export interface MotionProps extends React.HTMLAttributes<HTMLElement> {
    className?: string;
    onClick?: React.MouseEventHandler<HTMLElement>;
    style?: React.CSSProperties;
    key?: React.Key;
  }
}
