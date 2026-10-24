"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

export type VideoDialogHandle = { open: () => void };

const VideoDialog = forwardRef<VideoDialogHandle, { src: string; poster: string; title: string }>(
  function VideoDialog({ src, poster, title }, ref) {
    const dlg = useRef<HTMLDialogElement>(null);
    const vid = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      open: () => {
        dlg.current?.showModal();
        vid.current?.play().catch(() => {});
      },
    }));

    const close = () => dlg.current?.close();

    return (
      <dialog
        ref={dlg}
        className="dlg"
        aria-label={title}
        onClose={() => vid.current?.pause()}
        onClick={(e) => e.target === dlg.current && close()}
      >
        <video ref={vid} src={src} poster={poster} controls playsInline loop />
        <div className="dlg-bar">
          <span>{title}</span>
          <button type="button" className="pill" onClick={close}>Close</button>
        </div>
      </dialog>
    );
  },
);

export default VideoDialog;
