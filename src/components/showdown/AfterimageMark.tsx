import { useId } from 'react';

/** A public still-life cover, independent of every ranked memory scene. */
export function AfterimageMark({ className = '', label }: { className?: string; label?: string }) {
  const id = useId();
  return <svg viewBox="0 0 160 160" className={`ai-mark ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <defs><linearGradient id={`${id}-paper`} x2="0" y2="1"><stop stopColor="#fff8e8" /><stop offset="1" stopColor="#e9d8b5" /></linearGradient><linearGradient id={`${id}-vase`} x2="1" y2="1"><stop stopColor="#70a89b" /><stop offset="1" stopColor="#285e59" /></linearGradient></defs>
    <rect x="8" y="9" width="144" height="142" rx="26" fill={`url(#${id}-paper)`} stroke="#b79864" strokeWidth="1.5" />
    <path d="M10 108h140v17a24 24 0 0 1-24 24H34a24 24 0 0 1-24-24Z" fill="#d6b77f" opacity=".52" />
    <rect x="90" y="31" width="42" height="42" rx="3" fill="#e3bc76" stroke="#b0884d" strokeWidth="3" />
    <path d="M95 67V37h32v30Z" fill="#718a75" /><path d="m95 60 12-16 10 14 10-8v17H95Z" fill="#adc2a0" /><circle cx="119" cy="43" r="5" fill="#f2d384" />
    <ellipse cx="55" cy="116" rx="27" ry="5" fill="#79643e" opacity=".15" />
    <path d="M45 79c0-4 17-4 17 0l4 25c1 8-23 9-24 0Z" fill={`url(#${id}-vase)`} /><ellipse cx="53.5" cy="79" rx="8.5" ry="3" fill="#254f49" />
    <path d="m52 80 3-31m-3 23L39 58m15 4 14-9" fill="none" stroke="#557a53" strokeWidth="2" strokeLinecap="round" />
    <path d="M39 58q-16-3-10-13 15 0 10 13m16 7q18 4 19-8-14-5-19 8" fill="#6b9875" />
    <path d="M55 51c-9-2-8-13-1-13 0-9 11-9 11-1 8-3 13 7 5 11 2 8-9 12-12 4Z" fill="#d8a474" /><circle cx="60" cy="45" r="4" fill="#b57849" />
    <path d="M82 119h46v9H82Z" fill="#315f5a" /><path d="M87 111h47v8H87Z" fill="#a8754c" /><path d="M89 113h41v4H89Z" fill="#f5e8c9" />
    <path d="M88 81h22v15c0 10-22 10-22 0Z" fill="#fff9e9" stroke="#c3aa7c" strokeWidth="1.5" /><path d="M111 85c15-3 15 16 0 11" fill="none" stroke="#c3aa7c" strokeWidth="3" /><ellipse cx="99" cy="81" rx="11" ry="3" fill="#b98756" /><ellipse cx="100" cy="105" rx="19" ry="3" fill="#b79864" opacity=".35" />
    <path d="m26 28 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#b88b45" opacity=".8" />
  </svg>;
}
