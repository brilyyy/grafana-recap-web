"""
debug.py — Interactive BPTX template inspector (TUI)

Keyboard controls:
  ↑ / k       previous slide
  ↓ / j       next slide
  PgUp        scroll shapes up
  PgDn        scroll shapes down
  r           reload file from disk
  g           run main.py → open output.pptx
  q / Esc     quit
"""

from __future__ import annotations

import curses
import re
import subprocess
import sys
from pathlib import Path
from typing import List, NamedTuple, Optional, Tuple

from pptx.enum.shapes import MSO_SHAPE_TYPE

EMU_PER_INCH = 914_400
EMU_PER_PT = 12_700
EMU_PER_PX = 9_525  # 914_400 / 96 dpi
PLACEHOLDER_PATTERN = re.compile(r"\{\{(\w+)\}\}")

SHAPE_LABELS: dict = {
    MSO_SHAPE_TYPE.AUTO_SHAPE: "shape",
    MSO_SHAPE_TYPE.PICTURE: "image",
    MSO_SHAPE_TYPE.TABLE: "table",
    MSO_SHAPE_TYPE.TEXT_BOX: "textbox",
    MSO_SHAPE_TYPE.PLACEHOLDER: "placeholder",
    MSO_SHAPE_TYPE.GROUP: "group",
    MSO_SHAPE_TYPE.CHART: "chart",
}

# ─── Color pair IDs ────────────────────────────────────────────────────────────
_C_HEADER = 1
_C_SELECTED = 2
_C_KIND = 3
_C_PLACEHOLDER = 4
_C_ERROR = 5
_C_DIM = 6


# ─── Data models ───────────────────────────────────────────────────────────────


class FontInfo(NamedTuple):
    name: Optional[str]  # None = inherited from theme
    size_pt: Optional[float]
    bold: Optional[bool]

    def __str__(self) -> str:
        parts = []
        if self.name:
            parts.append(self.name)
        if self.size_pt is not None:
            parts.append(f"{self.size_pt}pt")
        if self.bold:
            parts.append("bold")
        return "  ".join(parts) if parts else "(inherited)"


class ShapeInfo(NamedTuple):
    kind: str
    name: str
    x: float
    y: float
    w: float
    h: float
    text: str
    extra: str  # e.g. "4r × 8c" for tables
    fonts: List[FontInfo]  # unique fonts used in this shape
    img_px: Optional[Tuple[int, int]] = None  # embedded image (px_w, px_h)
    img_dpi: Optional[Tuple[int, int]] = None  # effective (horz_dpi, vert_dpi)


class SlideInfo(NamedTuple):
    num: int
    placeholders: List[str]
    shapes: List[ShapeInfo]


# ─── Font helpers ──────────────────────────────────────────────────────────────


def _collect_fonts(shape: object) -> List[FontInfo]:
    """Collect unique FontInfo entries from all runs in a shape (text frame or table)."""
    seen: dict = {}

    def _from_run(run: object) -> None:
        f = getattr(run, "font", None)
        if f is None:
            return
        sz_emu = f.size
        size_pt = round(sz_emu / EMU_PER_PT, 1) if sz_emu else None
        key = (f.name, size_pt, f.bold)
        if key not in seen:
            seen[key] = FontInfo(name=f.name, size_pt=size_pt, bold=f.bold)

    tf = getattr(shape, "text_frame", None)
    if tf is not None:
        for para in tf.paragraphs:
            for run in para.runs:
                _from_run(run)

    # Table cells each have their own text frame
    if getattr(shape, "shape_type", None) == MSO_SHAPE_TYPE.TABLE:
        table = getattr(shape, "table")
        for row in table.rows:
            for cell in row.cells:
                for para in cell.text_frame.paragraphs:
                    for run in para.runs:
                        _from_run(run)

    return list(seen.values())


# ─── Loader ────────────────────────────────────────────────────────────────────


def load_file(path: Path) -> Tuple[List[SlideInfo], Optional[str]]:
    """Parse a .pptx and return (slides, error). Never raises."""
    try:
        from pptx import Presentation

        prs = Presentation(str(path))
        slides: List[SlideInfo] = []

        for slide_num, slide in enumerate(prs.slides, 1):
            found_ph: List[str] = []
            shapes: List[ShapeInfo] = []

            for shape in slide.shapes:
                kind = SHAPE_LABELS.get(shape.shape_type, str(shape.shape_type))
                raw: str = getattr(shape, "text", "") or ""
                if raw:
                    found_ph.extend(PLACEHOLDER_PATTERN.findall(raw))

                preview = raw.strip().replace("\n", " ")

                extra = ""
                if shape.shape_type == MSO_SHAPE_TYPE.TABLE:
                    t = getattr(shape, "table")
                    extra = f"{len(t.rows)}r × {len(t.columns)}c"

                def _inch(v: int | None) -> float:
                    return round(v / EMU_PER_INCH, 2) if v else 0.0

                def _px(v: int | None) -> int:
                    return round(v / EMU_PER_PX) if v else 0

                img_px: Optional[Tuple[int, int]] = None
                img_dpi: Optional[Tuple[int, int]] = None
                try:
                    img = shape.image  # type: ignore # raises AttributeError if not a picture
                    px_w, px_h = img.size
                    img_px = (px_w, px_h)
                    shape_w_in = int(shape.width) / EMU_PER_INCH
                    shape_h_in = int(shape.height) / EMU_PER_INCH
                    if shape_w_in > 0 and shape_h_in > 0:
                        img_dpi = (
                            round(px_w / shape_w_in),
                            round(px_h / shape_h_in),
                        )
                except (AttributeError, Exception):
                    pass

                shapes.append(
                    ShapeInfo(
                        kind=kind,
                        name=shape.name,
                        x=_inch(shape.left),
                        y=_inch(shape.top),
                        w=_inch(shape.width),
                        h=_inch(shape.height),
                        text=preview,
                        extra=extra,
                        fonts=_collect_fonts(shape),
                        img_px=img_px,
                        img_dpi=img_dpi,
                    )
                )

            slides.append(
                SlideInfo(
                    num=slide_num,
                    placeholders=sorted(set(found_ph)),
                    shapes=shapes,
                )
            )

        return slides, None

    except Exception as exc:
        return [], str(exc)


# ─── Drawing helpers ───────────────────────────────────────────────────────────


def _put(win: curses.window, y: int, x: int, text: str, attr: int = 0) -> None:
    """Safe addstr — clips to window bounds, never raises."""
    max_y, max_x = win.getmaxyx()
    if y < 0 or y >= max_y or x < 0 or x >= max_x:
        return
    clip = max_x - x
    if clip <= 0:
        return
    try:
        win.addstr(y, x, text[:clip], attr)
    except curses.error:
        pass


def _fill(win: curses.window, y: int, attr: int = 0) -> None:
    _, w = win.getmaxyx()
    _put(win, y, 0, " " * w, attr)


def draw_header(stdscr: curses.window, path: Path, n: int, flash: str) -> None:
    _, w = stdscr.getmaxyx()
    title = f" BPTX Inspector — {path}  ({n} slide{'s' if n != 1 else ''})"
    _fill(stdscr, 0, curses.color_pair(_C_HEADER) | curses.A_BOLD)
    _put(stdscr, 0, 0, title, curses.color_pair(_C_HEADER) | curses.A_BOLD)
    if flash:
        msg = f" {flash} "
        _put(
            stdscr,
            0,
            w - len(msg) - 1,
            msg,
            curses.color_pair(_C_HEADER) | curses.A_BOLD,
        )


def draw_footer(stdscr: curses.window) -> None:
    h, w = stdscr.getmaxyx()
    hint = "  ↑↓/jk navigate    PgUp/PgDn scroll shapes    r reload    g generate    q quit"
    _fill(stdscr, h - 1, curses.color_pair(_C_HEADER))
    _put(stdscr, h - 1, 0, hint, curses.color_pair(_C_HEADER))


def draw_slide_list(win: curses.window, slides: List[SlideInfo], selected: int) -> None:
    win.erase()
    h, w = win.getmaxyx()
    _fill(win, 0, curses.color_pair(_C_SELECTED))
    _put(win, 0, 0, " Slides".ljust(w), curses.color_pair(_C_SELECTED) | curses.A_BOLD)

    for i, slide in enumerate(slides):
        row = i + 1
        if row >= h:
            break
        label = f"  Slide {slide.num}"
        if i == selected:
            _fill(win, row, curses.color_pair(_C_SELECTED))
            _put(win, row, 0, label, curses.color_pair(_C_SELECTED) | curses.A_BOLD)
        else:
            _put(win, row, 0, label)

    win.noutrefresh()


def _build_shape_lines(slide: SlideInfo, max_text: int) -> List[Tuple[str, int]]:
    """Build the list of (text, attr) lines for the shapes panel."""
    lines: List[Tuple[str, int]] = []

    if slide.placeholders:
        ph_str = "  {{placeholders}}  " + "  ·  ".join(slide.placeholders)
        lines.append((ph_str, curses.color_pair(_C_PLACEHOLDER) | curses.A_BOLD))
        lines.append(("", 0))

    for shape in slide.shapes:
        lines.append(
            (
                f"  [{shape.kind}]  {shape.name!r}",
                curses.color_pair(_C_KIND) | curses.A_BOLD,
            )
        )
        if shape.extra:
            lines.append((f"    dimensions  {shape.extra}", curses.color_pair(_C_DIM)))
        lines.append(
            (f'    position   x={shape.x}"  y={shape.y}"', curses.color_pair(_C_DIM))
        )
        lines.append(
            (f"    size       w={shape.w}px  h={shape.h}px", curses.color_pair(_C_DIM))
        )
        if shape.img_px:
            px_w, px_h = shape.img_px
            lines.append((f"    image      {px_w}×{px_h}px", curses.color_pair(_C_DIM)))
        if shape.img_dpi:
            hdpi, vdpi = shape.img_dpi
            lines.append(
                (f"    dpi        {hdpi}h  {vdpi}v", curses.color_pair(_C_DIM))
            )
        if shape.fonts:
            # First font on same line as label; subsequent fonts indented below
            first, *rest = shape.fonts
            lines.append((f"    font       {first}", curses.color_pair(_C_PLACEHOLDER)))
            for fi in rest:
                lines.append(
                    (f"               {fi}", curses.color_pair(_C_PLACEHOLDER))
                )
        if shape.text:
            preview = shape.text[:max_text]
            lines.append((f'    text       "{preview}"', 0))
        lines.append(("", 0))

    return lines


def draw_shapes_panel(
    win: curses.window, slide: SlideInfo, scroll: int, error: Optional[str]
) -> None:
    win.erase()
    h, w = win.getmaxyx()

    header = f" Slide {slide.num} — {len(slide.shapes)} shape(s)"
    _fill(win, 0, curses.color_pair(_C_SELECTED))
    _put(win, 0, 0, header, curses.color_pair(_C_SELECTED) | curses.A_BOLD)

    if error:
        _put(
            win,
            2,
            2,
            f"Load error: {error}",
            curses.color_pair(_C_ERROR) | curses.A_BOLD,
        )
        win.noutrefresh()
        return

    lines = _build_shape_lines(slide, max_text=w - 20)
    total = len(lines)

    for screen_row, (text, attr) in enumerate(lines[scroll:], start=1):
        if screen_row >= h:
            break
        _put(win, screen_row, 0, text, attr)

    # Scroll indicator (bottom-right corner)
    if total > h - 1:
        pct = int(scroll / max(1, total - (h - 1)) * 100)
        indicator = f" {pct}% ↕ "
        _put(win, h - 1, w - len(indicator) - 1, indicator, curses.color_pair(_C_DIM))

    win.noutrefresh()


# ─── Main TUI loop ─────────────────────────────────────────────────────────────


def _run(stdscr: curses.window, path: Path) -> None:
    curses.curs_set(0)
    stdscr.keypad(True)
    curses.start_color()
    curses.use_default_colors()
    curses.init_pair(_C_HEADER, curses.COLOR_WHITE, curses.COLOR_BLUE)
    curses.init_pair(_C_SELECTED, curses.COLOR_BLACK, curses.COLOR_CYAN)
    curses.init_pair(_C_KIND, curses.COLOR_CYAN, -1)
    curses.init_pair(_C_PLACEHOLDER, curses.COLOR_YELLOW, -1)
    curses.init_pair(_C_ERROR, curses.COLOR_RED, -1)
    curses.init_pair(_C_DIM, curses.COLOR_WHITE, -1)

    slides: List[SlideInfo] = []
    error: Optional[str] = None
    selected = 0
    scroll = 0
    flash = ""

    def reload() -> None:
        nonlocal slides, error, selected, scroll, flash
        slides, error = load_file(path)
        selected = min(selected, max(0, len(slides) - 1))
        scroll = 0
        flash = "Reloaded ✓" if not error else "Load failed ✗"

    reload()

    LEFT_W = 16

    while True:
        h, w = stdscr.getmaxyx()
        stdscr.erase()

        right_x = LEFT_W + 1
        right_w = max(1, w - right_x)

        left_win = curses.newwin(h - 2, LEFT_W, 1, 0)
        right_win = curses.newwin(h - 2, right_w, 1, right_x)

        draw_header(stdscr, path, len(slides), flash)
        draw_footer(stdscr)

        # Divider
        for row in range(1, h - 1):
            _put(stdscr, row, LEFT_W, "│", curses.color_pair(_C_DIM))

        stdscr.noutrefresh()

        if slides:
            draw_slide_list(left_win, slides, selected)
            draw_shapes_panel(
                right_win, slides[selected], scroll, error if not slides else None
            )
        elif error:
            left_win.noutrefresh()
            _put(
                right_win,
                2,
                2,
                f"Error: {error}",
                curses.color_pair(_C_ERROR) | curses.A_BOLD,
            )
            right_win.noutrefresh()

        curses.doupdate()
        flash = ""

        key = stdscr.getch()

        if key in (ord("q"), ord("Q"), 27):
            break
        elif key in (ord("g"), ord("G")):
            draw_header(stdscr, path, len(slides), "Generating…")
            curses.doupdate()
            _project_root = Path(__file__).parent.parent
            try:
                result = subprocess.run(
                    ["uv", "run", "python", "src/main.py"],
                    cwd=_project_root,
                    capture_output=True,
                    text=True,
                )
                if result.returncode == 0:
                    flash = "Generated ✓"
                else:
                    flash = f"Failed ✗  {result.stderr.strip()[:60]}"
            except Exception as exc:
                flash = f"Error: {exc}"
        elif key in (ord("r"), ord("R")):
            reload()
        elif key in (curses.KEY_UP, ord("k")) and selected > 0:
            selected -= 1
            scroll = 0
        elif (
            key in (curses.KEY_DOWN, ord("j")) and slides and selected < len(slides) - 1
        ):
            selected += 1
            scroll = 0
        elif key == curses.KEY_PPAGE:
            scroll = max(0, scroll - (h - 4))
        elif key == curses.KEY_NPAGE:
            scroll += h - 4


# ─── Entry points ──────────────────────────────────────────────────────────────


def inspect(path: Path) -> None:
    """Non-interactive inspector: print all slides and shapes to stdout."""
    slides, error = load_file(path)

    if error:
        print(f"Error: {error}", file=sys.stderr)
        return

    print(f"\n{'─' * 60}")
    print(f"  {path}  ({len(slides)} slide{'s' if len(slides) != 1 else ''})")
    print(f"{'─' * 60}")

    for slide in slides:
        print(f"\n── Slide {slide.num} {'─' * 48}")
        if slide.placeholders:
            print(f"  {{{{placeholders}}}}  {', '.join(slide.placeholders)}")

        for shape in slide.shapes:
            kind_tag = f"[{shape.kind}]"
            print(f"\n  {kind_tag:<14}  name={shape.name!r}")
            if shape.extra:
                print(f"  {'':14}  dimensions  {shape.extra}")
            print(f'  {"":14}  position    x={shape.x}"  y={shape.y}"')
            print(f"  {'':14}  size        w={shape.w}px  h={shape.h}px")
            if shape.img_px:
                px_w, px_h = shape.img_px
                print(f"  {'':14}  image       {px_w}×{px_h}px")
            if shape.img_dpi:
                hdpi, vdpi = shape.img_dpi
                print(f"  {'':14}  dpi         {hdpi}h  {vdpi}v")
            if shape.fonts:
                first, *rest = shape.fonts
                print(f"  {'':14}  font        {first}")
                for fi in rest:
                    print(f"  {'':14}              {fi}")
            if shape.text:
                print(f'  {"":14}  text        "{shape.text[:80]}"')


def main(path: Optional[str] = None) -> None:
    """Launch the interactive TUI inspector."""
    target = Path(path) if path else Path("data/template_test.pptx")
    if not target.exists():
        print(f"File not found: {target}", file=sys.stderr)
        sys.exit(1)
    curses.wrapper(_run, target)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="BPTX interactive template inspector")
    parser.add_argument(
        "path", nargs="?", help="Path to .pptx file (default: data/template_test.pptx)"
    )
    parser.add_argument(
        "--print", action="store_true", help="Print inspection to stdout instead of TUI"
    )
    args = parser.parse_args()

    if args.print:
        inspect(Path(args.path) if args.path else Path("data/template_test.pptx"))
    else:
        main(args.path)
