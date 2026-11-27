import './arrivalArt.css';

export type ArrivalShot = 'sea' | 'letter' | 'quay';

/** Farther scenery bleeds outside the composition so either orientation can reveal more of it. */
function Dawn() {
  return (
    <g>
      <path fill="#465b66" d="M-800-700H1060V20H-800z" />
      <path fill="#79878a" d="M-800 13H1060V54H-800z" />
      <path fill="#a6a595" d="M-800 31H1060V59H-800z" />
      <path fill="#c7b293" d="M-800 46H1060V68H-800z" />
      <path fill="#e3c598" d="M-800 54H1060V80H-800z" />
      <path fill="#506572" d="M-60-30h43v-3h24v-2h17v2h14v4h38v2H-60zM157-16h20v-2h32v-3h17v2h14v2h26v2H157z" />
      <path fill="#9fa8a5" d="M28-52h1v1h-1zm129-18h1v1h-1zm58 31h1v1h-1zm-117 2h1v1h-1z" />
      <g fill="#566b75" className="mm-arr-cloud">
        <path d="M-45 9h43V6h16V3h23v3h12v4h23v3h19v2H-45zM159 18h20v-3h14v-4h33v3h16v3h31v3H159z" />
        <path fill="#a5a195" d="M-44 15H91v2H67v2H10v-2h-54zM169 20h100v2h-38v2h-44v-2h-18z" />
      </g>
      <path fill="#d7bca0" d="M-70 37h80v-2h20v-3h30v2h13v2h18v2H-70zM122 42h19v-2h18v-2h29v2h18v2h17v2H122z" />
      <path fill="#f2d7a4" d="M182 48h4v-3h6v-1h7v1h5v3h3v10h-25z" />
      <path fill="#a9a197" d="M152 59h15v-2h14v-2h23v2h12v2h18v2h-82z" />
      <g fill="none" stroke="#455b62" strokeWidth="1.5" className="mm-arr-terns">
        <path d="m145 37 4 1 2 2 2-3 4-2m5-6 3 1 2 2 3-3h2m-32 9 3 1 1 1 2-2h2" />
      </g>
    </g>
  );
}

function Tide({ y = 74 }: { y?: number }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <path fill="#223e49" d="M-800 0H1060V800H-800z" />
      <path fill="#668383" d="M-800 0H1060v6H-800z" />
      <path fill="#507276" d="M-800 5H1060v10H-800z" />
      <path fill="#3a616a" d="M-800 14H1060v19H-800z" />
      <path fill="#2c505c" d="M-800 32H1060v28H-800z" />
      <g fill="none" strokeLinecap="square" className="mm-arr-waves">
        <path stroke="#a8a992" d="M-30 4H4m18 2h17m20-2h13m73-1h8m5 2h18m5-2h27m3 4h21m10-2h21M160 10h15m4 0h19m9-1h8" />
        <path stroke="#699292" d="M-11 17h19m13-6h14m17 5h21m12-8h19m5 9h9m63-2h22m9 5h16m9-2h24M-35 29h29m17-4h12m18 6h26m7-6h11m31 5h21m8-5h18m21 3h24m9 5h21m24-4h19" />
        <path stroke="#486f78" strokeWidth="2" d="M-45 40h32m21 4h26m18-5h17m14 9h33m18-8h29m53 3h15m6-4h49M-22 62h30m27-8h25m12 4h40m17 4h17m31-6h33m20 6h38" />
        <path stroke="#385866" strokeWidth="2" d="M-33 82H7m15 8h44m25-14h28m28 8h32m19-9h41m14 15h37M45 111h35m98-11h34m-95 20h28M-40 145h52m12 26h41m71-28h43m13 24h48m-111 35h42" />
      </g>
    </g>
  );
}

function Lantern({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path fill="#363c41" d="M-1-7h2v2h2v1h1v1H3v6h1v1h-8V3h1v-6h-1v-1h1v-1h2z" />
      <path fill="#d58e51" d="M-2-3h4v6h-4z" />
      <path fill="#fbe1a1" className="mm-arr-lantern" d="M-1-2h2v4h-2z" />
    </g>
  );
}

function Beacon() {
  return (
    <g transform="translate(205 53)">
      <path fill="#485d61" d="M-5 19v-5h2V4h1v-6h5v6h1v10h2v5z" />
      <path fill="#e1c59e" d="M-2-2h4v6h-1v10h-3z" />
      <path fill="#987968" d="M-3 8h7v3h-7z" />
      <path fill="#384f56" d="M-4-3v-2h1v-3l3-3 3 3v3h2v2z" />
      <path fill="#eccb83" className="mm-arr-lantern" d="M-2-7h4v3h-4z" />
    </g>
  );
}

/** The twin deckhouses and copper vent repeat the same features seen on the playable deck. */
function Wayfarer() {
  return (
    <g className="mm-arr-hull">
      <path fill="#bdc9ae" d="m18 110 16-2h11l6-2 13 2h57l15-2h15l11-3-6 5-16 3-13 2H48l-16-1H10z" />
      <path fill="#6b9898" d="M9 113h26l13 2h54l18-2h17l-11 3H36l-9-1H6z" />
      <g fill="none" stroke="#394e52" strokeWidth="1.25">
        <path d="M59 91 89 45l44 46M43 91 89 45l18 41m-16-44 49 40 15 4M92 46l20 30" />
        <path d="M43 91 49 63l28 25m-30-9 3-14 9 16" />
      </g>
      <path fill="#644e45" d="M48 65h2v24h-2zM88 43h3v48h-3z" />
      <path fill="#b3936c" d="M89 43h1v42h-1zM49 65h1v16h-1z" />
      <path fill="#a05e48" d="m90 43 8 1 6-2-3 5-6 2-5-2z" />
      <path fill="#e4ad70" d="m90 43 9 1 5-2-3 3-7 1-4-1z" />
      <path fill="#263f49" d="M63 85v-7h2v-5h11v2h4v3h3v10zM103 87V73h4v-3h18v3h3v14z" />
      <path fill="#b28764" d="M65 78h15v10H65zM104 76h21v12h-21z" />
      <path fill="#638185" d="M68 80h3v5h-3zm6 0h3v5h-3zm33-2h4v5h-4zm7 0h4v5h-4z" />
      <path fill="#efc78a" d="M68 80h3v2h-3zm39-2h4v2h-4zm7 0h4v2h-4z" />
      <path fill="#366061" d="M62 76h4v-3h11v2h5v3H62zM101 74h4v-4h19l5 3v2h-28z" />
      <path fill="#9aab92" d="M66 73h11v1H66zm40-3h16v1h-16z" />
      <path fill="#7d5346" d="M117 69v-6h-2v-2l3-2h3l2 3v2h-3v5z" />
      <path fill="#d09262" d="M116 61h5v2h-3v5h-1v-5h-2z" />
      <path fill="#283f46" d="M36 89h14v2h15v-2h60v-3h12v-3h19l-4 6-12 11-12 7-16 3H60l-17-4-8-10-3-6z" />
      <path fill="#ac7959" d="M33 89h18v2h16v-2h58v-3h13v-3h17l-3 3h-13v3h-13v3H67v2H49v-2H35z" />
      <path fill="#436262" d="M39 94h12v2h15v-2h59l14-4h8l-9 7-14 6H57l-12-3z" />
      <path fill="#8b8e78" d="m45 94 11 1v1h-9zm43-1h18v1H88zm30-7h5v1h-5z" />
      <path fill="#213740" d="M128 90h2v5h-2zm9-3h2v4h-2z" />
      <path fill="#273f45" d="M56 100h63l16-5h4l-12 6-9 2H59z" />
      <path fill="#b18762" d="M53 103h65l13-3-4 3-10 2H59z" />
      <path fill="#dda96e" d="M61 95h3v2h-3zm10 0h3v2h-3zm10 0h3v2h-3zm32-1h3v2h-3zm10-1h3v2h-3z" />
      <path fill="#435153" d="M47 88v-4h2v4zm11 1v-6h2v6zm29-1v-6h2v6zm9 0v-5h2v5zm35-3v-5h2v5zm11-3v-5h2v5z" />
      <path fill="#b7a485" d="M46 84h17v1H46zm40-2h16v1H86zm44-2 16-4v1l-16 5z" />
    </g>
  );
}

function Sea() {
  return (
    <>
      <Dawn />
      <path fill="#899293" d="M-90 67h71l24-5 19 1 19-4 22 2 16-3 27 2 17 5h20v10H-90zM159 65l27-9 12 1 16-6h18l17 6 22-4 28 2v20H159z" />
      <path fill="#647a7e" d="M-90 72h112l21-4 17 2 14-4 19 4 25 1v7H-90zM154 72l23-4 12-2 22 1 19-6 13 3 18-2h89v14H154z" />
      <path fill="#89938f" d="m171 66 13-4 6 1-3 2-10 1zm51-5 8-2 3 1-5 2z" />
      <Beacon />
      <path fill="#455d65" d="m180 73 8-3 11-1 5-3 7 4 8 1 13 1 7-2 16 2h90v7H180z" />
      <path fill="#8a9189" d="m188 70 12-2 5-2 4 3-6-1-5 2z" />
      <Tide />
      <path fill="#a3a28c" d="M201 76h8v1h-8zm-5 3h10v1h-10zm4 3h6v1h-6z" />
      <Wayfarer />
    </>
  );
}

function Letter() {
  return (
    <>
      <Dawn />
      <path fill="#789098" d="M-500 70 20 61l16-4 23 3 21-5 14 3 30 2 18 6 12-1 32-9 21 1 16-5 17 3 22-4 40 8 220-1v21H-500z" />
      <Tide y={69} />
      <g>
        <path fill="#1c343c" d="M-500 115 710 53v18L-500 145z" />
        <path fill="#a27657" d="M-500 113 710 51v6L-500 121z" />
        <path fill="#d0a375" d="M-500 112 710 50v2L-500 115z" />
        <path fill="#31494b" d="m44 90 8-1 4 107H42zm187-10 6-1 5 114h-9z" />
        <path fill="#785b4e" d="m43 90 4-1 2 107h-6zm188-10h3l4 113h-4z" />
      </g>
      <g className="mm-arr-letter">
        {/* The paper casts a cool shadow on the back of the curled fingers. */}
        <path fill="#563f3e" d="m56 118 17-17 10-17 7-5 25-5 12 4 39 14 6 9-6 12-22 10-32 1-19 12-16 8z" />
        <path fill="#a56e53" d="m66 116 12-13 10-18 25-7 15 6 33 11 6 7-5 7-21 10-32 2-18 12-11 5z" />
        <path fill="#cf9369" d="m67 115 12-11 10-17 20-5-12 9-10 18-12 11z" />
        <path fill="#4b4944" d="m91 51 69-17 12 2 22 62-7 6-43 12-30 4-8-20z" />
        <path fill="#af9876" d="m93 49 69-15 9 2 21 62-9 5-70 15-5-18z" />
        <path fill="#cfb58a" d="m92 47 30-4 41-13 5 3 7 23 12 32 2 10-33 8-43 9-6-18z" />
        <path fill="#efdaaa" d="m93 47 30-5 40-12-11 8-25 10-29 5z" />
        <path fill="#e1c99c" d="m97 53 31-5 34-13 9 25-26 12-39 7z" />
        <path fill="#e6cd9f" d="m106 81 37-6 12 29-40 9z" />
        <path fill="#c6a681" d="m143 75 29-12 12 34-27 7z" />
        <path fill="#f0d8a8" d="m113 111 41-9 32-9 2 5-34 8-41 9z" />
        <path fill="#997e64" d="m122 44 2-1 21 29 10 31-13-29z" />
        <path fill="#edd6a8" d="m124 43 2-1 21 29 9 29-12-28z" />
        <path fill="#ae9474" d="m103 78 39-8 32-12 1 3-32 12-39 7z" />
        <path fill="#efe1b5" d="m104 81 38-8 32-12 1 2-32 12-38 7z" />
        {/* Broken ink strokes read as a letter at this distance without baking in dialogue. */}
        <g fill="none" stroke="#726e63" strokeWidth="1.3">
          <path d="m107 61 4-2 1 1 4-3 4 1 6-3m2-1 5-2m7-2 8-3 3 1 7-3m-49 21 9-2 2-2 6-1m3-1 5-2m7-1 9-3m3-1 8-3m-49 22 7-1 2-2 6-1m3 0 5-2" />
          <path d="m118 89 3-1 2 1 4-3 8-1 3-2m-18 11 5-1 4-3 6 1 6-3m-19 10 6-2 4 1 6-3" />
        </g>
        <g transform="translate(158 82)">
          <path fill="#92614e" d="m0-2 5-3 6 1 4 5-1 5-5 3-7-1-4-5z" />
          <path fill="#af7858" d="m1-2 5-2 5 1 2 4-2 4-6 1-5-3z" />
          <path fill="none" stroke="#745147" d="m3 3 1-3 3 1 2-3m-4 6 5-2" />
        </g>
        {/* The left thumb lands on the face of the page while the other fingers stay behind it. */}
        <path fill="#704c43" d="m76 112 7-14 5-10 11-9 5-9 5-3 6 2 2 5-5 11-7 9-4 12-9 10-6 7z" />
        <path fill="#be8360" d="m78 109 7-12 5-8 11-9 5-9 4-2 4 2 1 4-5 9-7 9-4 11-10 13-5 3z" />
        <path fill="#dfa87d" d="m86 98 6-9 10-8 6-10 4-1 2 3-3 7-10 11-6 9z" />
        <path fill="#edd0a2" d="m104 79 4-7 3-1 2 2-3 5-3 3z" />
        <path fill="#95674f" d="m90 102 8-5-6 7-7 4zm20-17 4-5-2 6-6 6z" />
        <path fill="#294e4f" d="M-500 275-90 169l71 2 47 19-23 19-64 51-230 200h-211z" />
        <path fill="#1d363b" d="M-90 209v-40l118-29 31-31 9-3 24 22-2 9-38 35-47 37z" />
        <path fill="#34635f" d="m-71 171 104-33 25-25 8 3 20 16-38 38-50 39h-69z" />
        <path fill="#528079" d="m-53 172 86-34 25-25 7 5-28 29-69 32z" />
        <path fill="#254b4c" d="m-12 192 54-32-1 5 30-27 9 3-34 31-39 25z" />
        <path fill="#4a443c" d="m49 116 12-15 6-2 10 4 14 13 8 12-1 6-12 13-9-1-21-18z" />
        <path fill="#ac864e" d="m51 116 11-13 5-1 10 4 11 11 9 12-2 6-10 10-7-1-21-19z" />
        <path fill="#dab278" d="m53 115 10-11 4-1 5 2-14 16-3-1zm26 23 14-15 3 6-14 14z" />
        <path fill="#755b40" d="m63 125 12-13 10 8-13 13z" />
        <path fill="#efce83" d="m62 124 11-14 6-1 7 7v5l-10 13-6 1-8-7z" />
        <path fill="#5e6654" d="m65 123 9-11 4-1 6 6v3l-10 12-4-1-5-5z" />
        <path fill="#304c4d" d="m68 123 7-9 3-1 4 4v3l-9 10z" />
        <path fill="#77958a" d="m68 122 8-9h2l-1 3-8 9z" />
        <path fill="#f0ca80" d="m61 113 2-2 2 2-2 2zm24 24 2-2 2 2-2 2z" />
      </g>
    </>
  );
}

function Casement({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path fill="#514d49" d="M0 0h7v9H0z" />
      <path fill="#dcb47d" d="M1 1h5v6H1z" />
      <path fill="#736a5c" d="M3 1h1v7H3zM1 4h5v1H1z" />
      <path fill="#dec29a" d="M-1 9h9v1h-9z" />
    </g>
  );
}

function Waterfront() {
  return (
    <g>
      {/* Spill beyond the stage to keep a continuous street along a widescreen quay. */}
      <path fill="#52686b" d="M-650 94v-18h623l20-11 18 9 10-12 16 11 15-8 18 12 23-11 15 9 12-5 22 7 16-11 8 3 8-8 19 11 21-15 13 8 13-5 13 7 17-8 19 12h480v23z" />
      <path fill="#7c7565" d="M-27 68h46v23h-46zm55-11h29v33H28zm42 6h31v27H70zm52-19h29v45h-29zm55 15h29v35h-29z" />
      <path fill="#607d77" d="m-32 68 14-12h21l18 8v5zm56-10 10-11h20l8 11zm43 6 10-10h18l10 10zm51-18 17-14 18 14zm53 14 13-12h19l9 12z" />
      <path fill="#9f987d" d="M56 70h15V57l10-9 13 7v35H56zM104 77h17v16h-17z" />
      <path fill="#62615a" d="M60 75h4v7h-4zm13-15h4v9h-4zm7 0h5v9h-5zm48-10h4v8h-4zm10 0h4v8h-4zm43 14h5v8h-5zm10 0h5v8h-5z" />
      <path fill="#8b795f" d="M-40 54H24v40h-64z" />
      <path fill="#516761" d="m-46 55 8-15H7l21 14v3z" />
      <path fill="#3c5153" d="M32 91V66l22-16 19 12v30z" />
      <path fill="#cab18a" d="M34 68 53 53l15 11v26H34z" />
      <path fill="#937f69" d="m53 53 17 11v26H58z" />
      <path fill="#7e534a" d="m29 67 23-20 21 15-3 4-17-14-21 17z" />
      <path fill="#b88869" d="m31 64 21-18 22 15-3 1-19-13z" />
      <path fill="#917461" d="M44 47V36h5v13z" />
      <path fill="#b19273" d="M43 36h7v3h-7z" />
      <Casement x={41} y={69} />
      <path fill="#4f5852" d="M54 75h8v15h-8z" />
      <path fill="#405456" d="M88 90V56l12-13h28l14 12v35z" />
      <path fill="#bda57f" d="M90 57h33v33H90z" />
      <path fill="#9a886f" d="m123 56 8-8 9 9v33h-17z" />
      <path fill="#38595a" d="m85 57 13-19h29l18 17-4 3-13-13-6 13z" />
      <path fill="#70908a" d="m98 39 29-1 11 10-12-7-10 13H88z" />
      <path fill="#526e6a" d="m97 45 26-1-1 2-27 1zm-5 6 27-1-1 2H91z" />
      <path fill="#d3b085" d="M104 33h6v6h-6z" />
      <path fill="#6a655c" d="M103 31h8v3h-8z" />
      <Casement x={94} y={61} /><Casement x={108} y={61} />
      <path fill="#80634f" d="M89 74h34v2H89zM93 77h8v13h-8zm14 0h10v13h-10z" />
      <path fill="#4b5653" d="M138 92V72l8-6h37l8 6v20z" />
      <path fill="#9c8169" d="M140 73h47v17h-47z" />
      <path fill="#5f745e" d="m135 72 10-10h32l14 8v4h-56z" />
      <path fill="#a2a582" d="M145 63h31l6 3h-40z" />
      <path fill="#7c6957" d="m143 78 8-3 2 1-10 4zm26-12h4v2h-4zm6 0h4v2h-4z" />
      <path fill="#555a50" d="M144 76h6v11h-6zm13 0h16v15h-16zm22 0h4v10h-4z" />
      <path fill="#416161" d="M203 89V59l16-11 20 8 14 8v27z" />
      <path fill="#b9a382" d="m205 60 15-9 18 8v29h-33z" />
      <path fill="#8b7661" d="m238 59 13 6v24h-13z" />
      <path fill="#785c4e" d="m199 59 18-16 22 6 18 14-6 3-15-10-17-6-16 13z" />
      <path fill="#b08b67" d="m202 56 15-14 22 6 12 10-15-8-17-5z" />
      <path fill="#bea080" d="M-21 59h35v2h-35zm0 8h35v1h-35zm0 8h35v1h-35z" />
      <Casement x={0} y={62} /><Casement x={12} y={62} />
      <path fill="#6e574b" d="M2 82h16v7H2z" />
      <path fill="#3e5b57" d="M9 78h19v2h-2v7h-2v-7H11v7H9z" />
      <path fill="#9f6451" d="m8 78 4-5h11l6 5v2H8z" />
      <path fill="#d5b487" d="m13 74 2-1h2l-1 6h-4zm7-1h2l3 6h-3z" />
      <path fill="#786953" d="M38 80h11v3H38z" />
      <path fill="#62745d" d="M39 79v-2h2v1h2v-2h3v2h2v2z" />
      <path fill="#bb866a" d="M42 78h1v1h-1zm3-1h1v1h-1z" />
      <Casement x={209} y={64} /><Casement x={222} y={64} />
      <path fill="#5b5d51" d="M210 79h8v10h-8zm18-1h8v13h-8z" />
    </g>
  );
}

function Quay() {
  return (
    <>
      <Dawn />
      <path fill="#8a9790" d="M-800 67H-40l23-11 16 4 12-6 13 3 18-9 23 3 24-8 19 2 23 12 21-7 18 2 15-5 24 7 14-5 28 2 20 11 28-3h731v26H-800z" />
      <Waterfront />
      <Tide y={93} />
      <path fill="#363f40" d="m-500 97 1200-29v12L-500 119z" />
      <path fill="#9a8a71" d="m-500 92 1200-26v4L-500 100z" />
      <path fill="#c5ac87" d="m-500 95 1200-27v2L-500 99z" />
      <path fill="#726d5e" d="m-20 88 33-1v2l-33 1zm43-1 41-1v2l-41 1zm68-2h23v2H91zm58-1h29v2h-29zm48-1 41-1v2l-41 1z" />
      <g fill="#384747">
        <path d="M4 95h6v18H7v4H4zm27 0h5v15h-5zm42-1h6v16h-5zm40-1h6v12h-6zm40-1h5v10h-5zm39-1h5v9h-5zm42-1h5v9h-5z" />
        <path fill="#7e7764" d="M4 95h2v15H4zm27 0h2v12h-2zm42-1h2v12h-2zm40-1h2v9h-2zm40-1h2v8h-2zm39-1h2v7h-2zm42-1h2v6h-2z" />
      </g>
      <path fill="#5c6259" d="m-15 100 22-1v1l-22 1zm27-5h18v1H12zm32-3h12v1H44zm-3 6h25v1H41zm46-4h17v1H87zm46-3h7v2h-8zm30-2h14v1h-14zm48 0h14v1h-14z" />
      <path fill="#514f46" d="M24 89v-3h-2v-2h7v2h-2v3zm118-4v-3h-2v-2h7v2h-2v3zm58-1v-2h-1v-2h5v2h-1v2z" />
      <path fill="none" stroke="#c4a980" d="m25 87 6 5 5 2 6-3m98-8 3 2h4l3-3" />
      {/* Timber jib and hanging tackle occupy the opposite shore from the arriving bow. */}
      <g>
        <path fill="#444a46" d="M154 86V45l-9 4-17 3-3-3 43-20 4 3-10 11v43zm6-46 6-7-25 13z" />
        <path fill="#b5946e" d="m126 48 42-20 3 3-42 20zm29-5 3-2v44h-3z" />
        <path fill="#886d54" d="m157 61 12 24h-4l-8-16z" />
        <path fill="none" stroke="#5d5e53" d="M129 50v20l2 3 2-3M132 49v19m-3-19 28 10" />
        <path fill="#514d45" d="M125 71h9v3h-9zM74 82h8v7h-8zm7-3h7v10h-7z" />
        <path fill="#b4946a" d="M126 71h7v1h-7zm-51 12h6v2h-6zm8-3h4v3h-4z" />
        <path fill="#3d4a49" d="M181 68h2v17h-2z" />
        <Lantern x={182} y={66} />
      </g>
      {/* Nia's raised sleeve is legible as a small silhouette even at handheld resolution. */}
      <g transform="translate(119 79)">
        <path fill="#3e484a" d="M-2-8h4v1h1v3H2v1h2v2l3-3v-3h2v4L5 2H3v5h1v3H1L0 5l-1 5h-3V6l1-4h-2v-3l3-2z" />
        <path fill="#bb8466" d="M-1-6h3v3h-3zm8-1h2v2H7z" />
        <path fill="#a86952" d="M-2-2h5v2l3-2 1 1-3 3H2v3h-5V1h-1z" />
        <path fill="#dbab75" d="M-2-2h4v1h-4z" />
      </g>
      <path fill="#647e78" d="M83 112h15v1H83zm66-5h18v1h-18zm35-3h9v1h-9z" />
      <g className="mm-arr-bow">
        <path fill="#1c343c" d="m154 175 53-41 109 20 486 111v430H265z" />
        <path fill="#192f38" d="M154 177v-11l24-21 10-15 16-15 13-19h8l-2 14 20 14 23 16 50 15v32z" />
        <path fill="#9a775a" d="m161 163 30-36 16-18 11-13h4l-2 12 22 19 25 15 20 10-4 5-54-18-32-6z" />
        <path fill="#c39b70" d="m174 153 18-26 16-17 10-14h3l-2 5-10 14-16 17z" />
        <path fill="#795e50" d="m191 139 28-30 35 27 35 16-7 8-46-13z" />
        <path fill="none" stroke="#574d47" d="m188 145 34-33m-20 31 25-26m-12 28 18-22m-5 24 12-19m1 21 8-15" />
        <path fill="#48524a" d="m211 134 6-3 8 2 2 4-5 3-8-1-4-2z" />
        <path fill="none" stroke="#c09c70" d="m212 134 6-2 6 2 1 2-4 2-7-1z" />
        <path fill="#3d4646" d="M205 122v-17h3v13zm13-17V92h3v14zm20 24v-18h3v21zm18 10v-16h3v18z" />
        <path fill="none" stroke="#bca17c" strokeWidth="2" d="m153 162 53-55 13-13 20 18 19 12 46 25" />
      </g>
    </>
  );
}

export function ArrivalArt({ shot }: { shot: ArrivalShot }) {
  return (
    <svg className="mm-arrival-art" viewBox="0 0 256 160" preserveAspectRatio="xMidYMid meet"
      aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      {shot === 'sea' ? <Sea /> : shot === 'letter' ? <Letter /> : <Quay />}
    </svg>
  );
}
