import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRuneDelveSfx } from "@/hooks/useRuneDelveSfx";
import emblem from "@/assets/runedelve-emblem.png";

const BOOT_FLAG = "rd_boot_played_v1";
/** A short, nonblocking title reveal once per session. No synthetic loading or per-frame React updates. */
export function RuneDelveBoot() {
  const [show, setShow] = useState(false);
  const reduced = useReducedMotion();
  const { play } = useRuneDelveSfx();
  const eligible = useRef<boolean | null>(null);
  const finished = useRef(false);
  const charged = useRef(false);
  useEffect(() => {
    if (eligible.current === null) {
      try {
        eligible.current = sessionStorage.getItem(BOOT_FLAG) !== "1";
        sessionStorage.setItem(BOOT_FLAG, "1");
      } catch {
        eligible.current = true;
      }
    }
    if (!eligible.current || finished.current) return;
    if (reduced || document.hidden) {
      finished.current = true;
      setShow(false);
      return;
    }
    setShow(true);
    if (!charged.current) {
      charged.current = true;
      play("boot.charge", { skipHaptic: true });
    }
    const hide = () => {
      finished.current = true;
      setShow(false);
    };
    const onVisibility = () => {
      if (document.hidden) hide();
    };
    const timer = window.setTimeout(hide, 1050);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [play, reduced]);
  return show && !reduced ? (
    <motion.div
      key="rune-arrival"
      className="rd-boot-cinematic"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1.05, times: [0, 0.18, 0.72, 1] }}
    >
      <motion.div
        className="rd-boot-seal"
        initial={{ scale: 0.82, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <span />
        <img src={emblem} alt="" width="128" height="128" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.45 }}
      >
        <p>BEYOND THE SEAL</p>
        <strong>Rune Delve</strong>
        <small>The Hollow awaits.</small>
      </motion.div>
    </motion.div>
  ) : null;
}
