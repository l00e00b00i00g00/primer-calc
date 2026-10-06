#!/usr/bin/env python3
"""Regenerate (or verify) tests/primer3-goldens.json using primer3-py.

The JSON file freezes Primer3 reference values consumed by
tests/primer3.test.ts, so the npm package never depends on Python.

Usage:
    pip install primer3-py
    python3 scripts/primer3-regen.py           # regenerate goldens
    python3 scripts/primer3-regen.py --check   # fail (exit 1) on drift

Matched engine conditions mirror the test harness: 1 M monovalent, no
divalent, effective 50 nM in both engines (ours: Ct/4 at 200 nM total;
primer3: dna_conc/2 at 100 nM total).
"""

import json
import sys
from pathlib import Path

MATCHED_SEQS = [
    "ATGCGTAGCTAGCTAGCTA",
    "GCGCGCGC",
    "ATATATATATATATATATAT",
    "ATCGATCGATCGATCG",
    "CGTTGA",
    "GCGCGC",
    "CCCCCCCC",
    "GAGAGAGA",
    "CACACACA",
    "CTCTCTCT",
]

PAIR_DELTAS = [
    ("GGGGAAAA", "GGGGTTTT"),
    ("CCCCAAAA", "CCCCTTTT"),
    ("AAAACCCC", "TTTTCCCC"),
    ("ATATATAT", "TATATATA"),
]

HOMODIMERS = ["GCGCGCGC", "ATCGCGAT"]

HETERO = [
    ("ATGCGTAGCTAG", "CTAGCTACGCAT"),
    ("ATGCGTAGCTAG", "CTAGCAACGCAT"),
    ("ATGCGTAGCTAG", "CTAGCTACGCAA"),
    ("TTTGACAGCCTCTGAC", "ATCAGAGGCTGTCAAA"),
    ("ATGCGTAGCTAG", "CTATCTACTCAT"),
]

FULL_SEQS = [
    "ATGCGTAGCTAGCTAGCTA",
    "GCGCGCGC",
    "ATATATATATATATATATAT",
    "ATCGATCGATCGATCG",
    "CGTTGA",
    "GCGCGC",
]

GOLDENS = Path(__file__).resolve().parent.parent / "tests" / "primer3-goldens.json"


def build() -> dict:
    import primer3  # pip install primer3-py

    matched = {
        s: round(
            primer3.calc_tm(
                s, mv_conc=1000.0, dv_conc=0.0, dntp_conc=0.0, dna_conc=100.0
            ),
            2,
        )
        for s in MATCHED_SEQS
    }
    deltas = [
        [
            a,
            b,
            round(
                primer3.calc_tm(
                    a, mv_conc=1000.0, dv_conc=0.0, dntp_conc=0.0, dna_conc=100.0
                )
                - primer3.calc_tm(
                    b, mv_conc=1000.0, dv_conc=0.0, dntp_conc=0.0, dna_conc=100.0
                ),
                3,
            ),
        ]
        for a, b in PAIR_DELTAS
    ]
    homo = {
        s: round(
            primer3.calc_homodimer(
                s,
                mv_conc=50.0,
                dv_conc=2.5,
                dntp_conc=0.8,
                dna_conc=200.0,
                temp_c=37.0,
            ).dg
            / 1000.0,
            2,
        )
        for s in HOMODIMERS
    }
    hetero = [
        [
            a,
            b,
            round(
                primer3.calc_heterodimer(
                    a,
                    b,
                    mv_conc=50.0,
                    dv_conc=2.5,
                    dntp_conc=0.8,
                    dna_conc=200.0,
                    temp_c=37.0,
                ).dg
                / 1000.0,
                2,
            ),
        ]
        for a, b in HETERO
    ]
    full = {
        s: round(
            primer3.calc_tm(
                s, mv_conc=50.0, dv_conc=2.5, dntp_conc=0.8, dna_conc=200.0
            ),
            2,
        )
        for s in FULL_SEQS
    }
    return {
        "matched_tm": matched,
        "pair_deltas": deltas,
        "homodimer_dg": homo,
        "heterodimers": hetero,
        "full_tm": full,
    }


def main() -> int:
    check = "--check" in sys.argv[1:]
    fresh = build()
    if check:
        reference = json.loads(GOLDENS.read_text())
        if reference == fresh:
            print("primer3 goldens: no drift.")
            return 0
        print("primer3 goldens DRIFTED:")
        for key in fresh:
            if reference.get(key) != fresh[key]:
                print(f"  [{key}] reference={reference.get(key)} fresh={fresh[key]}")
        return 1
    GOLDENS.write_text(json.dumps(fresh, indent=2) + "\n")
    print(f"primer3 goldens written to {GOLDENS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
