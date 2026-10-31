export function isRunePuzzleRoute(pathname: string): boolean {
  return (
    pathname === "/rune-delve" ||
    pathname === "/rune-delve/journey" ||
    pathname === "/rune-delve/guide" ||
    pathname.startsWith("/rune-delve/chamber/")
  );
}
