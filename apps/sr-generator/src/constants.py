from __future__ import annotations

import sys
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib import font_manager as _fm
from pptx.enum.shapes import MSO_SHAPE_TYPE

# Resolve base directory: next to exe when frozen, project root when running as script
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).parent.parent

DATA_DIR = BASE_DIR / "data"

# Register bundled Poppins fonts and set as global default
for _ttf in (DATA_DIR / "fonts" / "Poppins").glob("*.ttf"):
    _fm.fontManager.addfont(str(_ttf))
plt.rcParams["font.family"] = "Poppins"

TEMPLATE = DATA_DIR / "template.pptx"

SHAPE_TYPE_LABELS = {
    MSO_SHAPE_TYPE.AUTO_SHAPE: "shape",
    MSO_SHAPE_TYPE.PICTURE: "image",
    MSO_SHAPE_TYPE.TABLE: "table",
    MSO_SHAPE_TYPE.TEXT_BOX: "textbox",
    MSO_SHAPE_TYPE.PLACEHOLDER: "placeholder",
    MSO_SHAPE_TYPE.GROUP: "group",
    MSO_SHAPE_TYPE.CHART: "chart",
}