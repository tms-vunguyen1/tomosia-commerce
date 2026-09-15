"use client";

import Image from "next/image";
import { useState } from "react";

const ImageFallback = (props: any) => {
  const { src, fallback, ...rest } = props;
  const [imgSrc, setImgSrc] = useState(src);
  const [prevSrc, setPrevSrc] = useState(src);

  // Reset to the new source during render rather than in an effect, so a
  // changed `src` does not paint the stale image first.
  if (src !== prevSrc) {
    setPrevSrc(src);
    setImgSrc(src);
  }

  return (
    <Image
      {...rest}
      src={imgSrc}
      alt={props.alt || ""}
      onError={() => {
        setImgSrc(fallback);
      }}
    />
  );
};

export default ImageFallback;
