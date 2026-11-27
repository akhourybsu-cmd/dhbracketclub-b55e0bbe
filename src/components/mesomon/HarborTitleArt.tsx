import { MESOMON_ASSETS } from "@/lib/mesomon/assets";

/** The water marks follow individual sunlit ripples in the original plate.
 * Both layers share its crop when the console turns or changes size. */
export function HarborTitleArt() {
  return (
    <div className="mm-title-art" aria-hidden="true">
      <div className="mm-title-painting">
        <img src={MESOMON_ASSETS.cover} alt="" />
        <svg className="mm-title-water" viewBox="0 0 624 351" fill="none" focusable="false">
          <g className="mm-title-ripples" stroke="#ffe5a1" strokeWidth="1.2" strokeLinecap="round">
            <path d="M66 230h5m5-2h2 M94 213h7 M186 199h5m4-1h3 M229 172h7m4-1h3 M273 166h6"/>
            <path d="M33 256h5m3-1h4 M111 220h7 M204 191h4 M251 166h5m4-1h2 M427 157h5"/>
            <path d="M53 246h4 M90 236h6m4-1h3 M223 181h7 M265 175h5 M436 164h8m4-1h3"/>
          </g>
          <g className="mm-title-tern" strokeWidth="1.2" strokeLinecap="round">
            <path d="M257 61q2-1 4 1 2-3 5-3" stroke="#718993"/>
            <path d="M257 60.5q2-1 4 1 2-3 5-3" stroke="#fff5db"/>
          </g>
        </svg>
      </div>
    </div>
  );
}
