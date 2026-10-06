//! High-performance dimer engine for `@sfstudio_tools/primer-calc`.
//!
//! Strict parity with the TypeScript engine (`src/structure/dimer.ts` +
//! `src/thermo/nearest-neighbor.ts`):
//! - SantaLucia (1998) unified nearest-neighbor stacks, duplex initiation,
//!   terminal A·T penalties, self-complementary symmetry correction;
//! - single-nucleotide dangling ends (Bommarito, Peyret & SantaLucia 2000,
//!   via SantaLucia & Hicks 2004 Table 3);
//! - ungapped block scan plus single-mismatch-bridged merges;
//! - polymerase-extendable 3′ anchoring (run ≥ 2 nt).
//!
//! Build:
//! ```sh
//! npm run build:wasm   # cargo + wasm-bindgen, see package.json
//! ```

use wasm_bindgen::prelude::*;

const R_CAL: f64 = 1.987;
const ZERO_C: f64 = 273.15;
const T37: f64 = 310.15;

fn is_wc(a: u8, b: u8) -> bool {
    matches!(
        (a, b),
        (b'A', b'T') | (b'T', b'A') | (b'G', b'C') | (b'C', b'G')
    )
}

/// SantaLucia (1998) unified NN stack → (dH kcal/mol, dS cal/(mol·K)).
fn nn_params(t0: u8, t1: u8, b0: u8, b1: u8) -> Option<(f64, f64)> {
    const TABLE: [((u8, u8, u8, u8), (f64, f64)); 10] = [
        ((b'A', b'A', b'T', b'T'), (-7.6, -21.3)),
        ((b'A', b'T', b'T', b'A'), (-7.2, -20.4)),
        ((b'T', b'A', b'A', b'T'), (-7.2, -21.3)),
        ((b'C', b'A', b'G', b'T'), (-8.5, -22.7)),
        ((b'G', b'T', b'C', b'A'), (-8.4, -22.4)),
        ((b'C', b'T', b'G', b'A'), (-7.8, -21.0)),
        ((b'G', b'A', b'C', b'T'), (-8.2, -22.2)),
        ((b'C', b'G', b'G', b'C'), (-10.6, -27.2)),
        ((b'G', b'C', b'C', b'G'), (-9.8, -24.4)),
        ((b'G', b'G', b'C', b'C'), (-8.0, -19.9)),
    ];
    for ((a, b, c, d), v) in TABLE {
        if (a, b, c, d) == (t0, t1, b0, b1) {
            return Some(v);
        }
        // 180° rotation symmetry: XY/WZ ≡ reverse(WZ)/reverse(XY).
        if (d, c, b, a) == (t0, t1, b0, b1) {
            return Some(v);
        }
    }
    None
}

/// Internal single-mismatch NN steps (dH, dS): Allawi & SantaLucia
/// (1997, 1998), Peyret et al. (1999), Watkins & SantaLucia (2005).
/// Complete for isolated single mismatches (direct or 180° rotation).
fn imm_params(t0: u8, t1: u8, b0: u8, b1: u8) -> Option<(f64, f64)> {
    const TABLE: [((u8, u8, u8, u8), (f64, f64)); 51] = [
        ((b'A', b'A', b'T', b'A'), (1.2, 1.7)),
        ((b'A', b'A', b'T', b'C'), (2.3, 4.6)),
        ((b'A', b'A', b'T', b'G'), (-0.6, -2.3)),
        ((b'A', b'C', b'T', b'A'), (5.3, 14.6)),
        ((b'A', b'C', b'T', b'C'), (0.0, -4.4)),
        ((b'A', b'C', b'T', b'T'), (0.7, 0.2)),
        ((b'A', b'G', b'T', b'A'), (-0.7, -2.3)),
        ((b'A', b'G', b'T', b'G'), (-3.1, -9.5)),
        ((b'A', b'G', b'T', b'T'), (1.0, 0.9)),
        ((b'A', b'T', b'T', b'C'), (-1.2, -6.2)),
        ((b'A', b'T', b'T', b'G'), (-2.5, -8.3)),
        ((b'A', b'T', b'T', b'T'), (-2.7, -10.8)),
        ((b'C', b'A', b'G', b'A'), (-0.9, -4.2)),
        ((b'C', b'A', b'G', b'C'), (1.9, 3.7)),
        ((b'C', b'A', b'G', b'G'), (-0.7, -2.3)),
        ((b'C', b'C', b'G', b'A'), (0.6, -0.6)),
        ((b'C', b'C', b'G', b'C'), (-1.5, -7.2)),
        ((b'C', b'C', b'G', b'T'), (-0.8, -4.5)),
        ((b'C', b'G', b'G', b'A'), (-4.0, -13.2)),
        ((b'C', b'G', b'G', b'G'), (-4.9, -15.3)),
        ((b'C', b'G', b'G', b'T'), (-4.1, -11.7)),
        ((b'C', b'T', b'G', b'C'), (-1.5, -6.1)),
        ((b'C', b'T', b'G', b'G'), (-2.8, -8.0)),
        ((b'C', b'T', b'G', b'T'), (-5.0, -15.8)),
        ((b'G', b'A', b'C', b'A'), (-2.9, -9.8)),
        ((b'G', b'A', b'C', b'C'), (5.2, 14.2)),
        ((b'G', b'A', b'C', b'G'), (-0.6, -1.0)),
        ((b'G', b'C', b'C', b'A'), (-0.7, -3.8)),
        ((b'G', b'C', b'C', b'C'), (3.6, 8.9)),
        ((b'G', b'C', b'C', b'T'), (2.3, 5.4)),
        ((b'G', b'G', b'C', b'A'), (0.5, 3.2)),
        ((b'G', b'G', b'C', b'G'), (-6.0, -15.8)),
        ((b'G', b'G', b'C', b'T'), (3.3, 10.4)),
        ((b'G', b'G', b'T', b'T'), (5.8, 16.3)),
        ((b'G', b'T', b'C', b'C'), (5.2, 13.5)),
        ((b'G', b'T', b'C', b'G'), (-4.4, -12.3)),
        ((b'G', b'T', b'C', b'T'), (-2.2, -8.4)),
        ((b'G', b'T', b'T', b'G'), (4.1, 9.5)),
        ((b'T', b'A', b'A', b'A'), (4.7, 12.9)),
        ((b'T', b'A', b'A', b'C'), (3.4, 8.0)),
        ((b'T', b'A', b'A', b'G'), (0.7, 0.7)),
        ((b'T', b'C', b'A', b'A'), (7.6, 20.2)),
        ((b'T', b'C', b'A', b'C'), (6.1, 16.4)),
        ((b'T', b'C', b'A', b'T'), (1.2, 0.7)),
        ((b'T', b'G', b'A', b'A'), (3.0, 7.4)),
        ((b'T', b'G', b'A', b'G'), (1.6, 3.6)),
        ((b'T', b'G', b'A', b'T'), (-0.1, -1.7)),
        ((b'T', b'G', b'G', b'T'), (-1.4, -6.2)),
        ((b'T', b'T', b'A', b'C'), (1.0, 0.7)),
        ((b'T', b'T', b'A', b'G'), (-1.3, -5.3)),
        ((b'T', b'T', b'A', b'T'), (0.2, -1.5)),
    ];
    lookup_nn(&TABLE, t0, t1, b0, b1)
}

/// Terminal-mismatch NN units (dH, dS): SantaLucia & Peyret (2001).
/// Each covers a terminal mismatch plus its adjacent WC pair, subsuming
/// that end's terminal corrections. Complete for all such ends.
fn tmm_params(t0: u8, t1: u8, b0: u8, b1: u8) -> Option<(f64, f64)> {
    const TABLE: [((u8, u8, u8, u8), (f64, f64)); 48] = [
        ((b'A', b'A', b'T', b'A'), (-3.1, -7.8)),
        ((b'A', b'A', b'T', b'C'), (-1.6, -4.0)),
        ((b'A', b'A', b'T', b'G'), (-1.9, -4.4)),
        ((b'A', b'C', b'T', b'A'), (-1.8, -3.8)),
        ((b'A', b'C', b'T', b'C'), (-0.1, 0.5)),
        ((b'A', b'C', b'T', b'T'), (-0.9, -1.7)),
        ((b'A', b'G', b'T', b'A'), (-2.5, -5.9)),
        ((b'A', b'G', b'T', b'G'), (-1.1, -2.1)),
        ((b'A', b'G', b'T', b'T'), (-3.2, -8.7)),
        ((b'A', b'T', b'T', b'C'), (-2.3, -6.3)),
        ((b'A', b'T', b'T', b'G'), (-3.5, -9.4)),
        ((b'A', b'T', b'T', b'T'), (-2.4, -6.5)),
        ((b'C', b'A', b'G', b'A'), (-4.3, -10.7)),
        ((b'C', b'A', b'G', b'C'), (-2.6, -5.9)),
        ((b'C', b'A', b'G', b'G'), (-3.9, -9.6)),
        ((b'C', b'C', b'G', b'A'), (-2.7, -6.0)),
        ((b'C', b'C', b'G', b'C'), (-2.1, -5.1)),
        ((b'C', b'C', b'G', b'T'), (-3.2, -8.0)),
        ((b'C', b'G', b'G', b'A'), (-6.0, -15.5)),
        ((b'C', b'G', b'G', b'G'), (-3.8, -9.5)),
        ((b'C', b'G', b'G', b'T'), (-3.8, -9.0)),
        ((b'C', b'T', b'G', b'C'), (-3.9, -10.6)),
        ((b'C', b'T', b'G', b'G'), (-6.6, -18.7)),
        ((b'C', b'T', b'G', b'T'), (-6.1, -16.9)),
        ((b'G', b'A', b'C', b'A'), (-8.0, -22.5)),
        ((b'G', b'A', b'C', b'C'), (-5.0, -13.8)),
        ((b'G', b'A', b'C', b'G'), (-4.3, -11.1)),
        ((b'G', b'C', b'C', b'A'), (-3.2, -7.1)),
        ((b'G', b'C', b'C', b'C'), (-3.9, -10.6)),
        ((b'G', b'C', b'C', b'T'), (-4.9, -13.5)),
        ((b'G', b'G', b'C', b'A'), (-4.6, -11.4)),
        ((b'G', b'G', b'C', b'G'), (-0.7, -19.2)),
        ((b'G', b'G', b'C', b'T'), (-5.7, -15.9)),
        ((b'G', b'T', b'C', b'C'), (-3.0, -7.8)),
        ((b'G', b'T', b'C', b'G'), (-5.9, -16.1)),
        ((b'G', b'T', b'C', b'T'), (-7.4, -21.2)),
        ((b'T', b'A', b'A', b'A'), (-2.5, -6.3)),
        ((b'T', b'A', b'A', b'C'), (-2.3, -5.9)),
        ((b'T', b'A', b'A', b'G'), (-2.0, -4.7)),
        ((b'T', b'C', b'A', b'A'), (-2.7, -7.0)),
        ((b'T', b'C', b'A', b'C'), (-0.7, -1.3)),
        ((b'T', b'C', b'A', b'T'), (-2.5, -6.3)),
        ((b'T', b'G', b'A', b'A'), (-2.4, -5.8)),
        ((b'T', b'G', b'A', b'G'), (-1.1, -2.7)),
        ((b'T', b'G', b'A', b'T'), (-3.9, -10.5)),
        ((b'T', b'T', b'A', b'C'), (-0.7, -1.2)),
        ((b'T', b'T', b'A', b'G'), (-3.6, -9.8)),
        ((b'T', b'T', b'A', b'T'), (-3.2, -8.9)),
    ];
    lookup_nn(&TABLE, t0, t1, b0, b1)
}

/// Shared direct + 180°-rotation lookup over an NN-style table.
fn lookup_nn(
    table: &[((u8, u8, u8, u8), (f64, f64))],
    t0: u8,
    t1: u8,
    b0: u8,
    b1: u8,
) -> Option<(f64, f64)> {
    for ((a, b, c, d), v) in table {
        if (*a, *b, *c, *d) == (t0, t1, b0, b1) {
            return Some(*v);
        }
        if (*d, *c, *b, *a) == (t0, t1, b0, b1) {
            return Some(*v);
        }
    }
    None
}
/// `five_prime`: overhang side; `same`/`opp`: closing-pair bases on the
/// dangling strand / opposite strand; `d`: the unpaired base.
fn dangle_params(five_prime: bool, same: u8, opp: u8, d: u8) -> Option<(f64, f64)> {
    let dg: f64 = match (five_prime, same, opp, d) {
        // 5' dangling ends.
        (true, b'A', b'T', b'A') => -0.51,
        (true, b'A', b'T', b'C') => -0.42,
        (true, b'A', b'T', b'G') => -0.62,
        (true, b'A', b'T', b'T') => -0.71,
        (true, b'C', b'G', b'A') => -0.96,
        (true, b'C', b'G', b'C') => -0.52,
        (true, b'C', b'G', b'G') => -0.72,
        (true, b'C', b'G', b'T') => -0.58,
        (true, b'G', b'C', b'A') => -0.58,
        (true, b'G', b'C', b'C') => -0.34,
        (true, b'G', b'C', b'G') => -0.56,
        (true, b'G', b'C', b'T') => -0.61,
        (true, b'T', b'A', b'A') => -0.50,
        (true, b'T', b'A', b'C') => -0.02,
        (true, b'T', b'A', b'G') => 0.48,
        (true, b'T', b'A', b'T') => -0.10,
        // 3' dangling ends.
        (false, b'A', b'T', b'A') => -0.12,
        (false, b'A', b'T', b'C') => 0.28,
        (false, b'A', b'T', b'G') => -0.01,
        (false, b'A', b'T', b'T') => 0.13,
        (false, b'C', b'G', b'A') => -0.82,
        (false, b'C', b'G', b'C') => -0.31,
        (false, b'C', b'G', b'G') => -0.01,
        (false, b'C', b'G', b'T') => -0.52,
        (false, b'G', b'C', b'A') => -0.92,
        (false, b'G', b'C', b'C') => -0.23,
        (false, b'G', b'C', b'G') => -0.44,
        (false, b'G', b'C', b'T') => -0.35,
        (false, b'T', b'A', b'A') => -0.48,
        (false, b'T', b'A', b'C') => -0.19,
        (false, b'T', b'A', b'G') => -0.50,
        (false, b'T', b'A', b'T') => -0.29,
        _ => return None,
    };
    let dh: f64 = match (five_prime, same, opp, d) {
        (true, b'A', b'T', b'A') => 0.2,
        (true, b'A', b'T', b'C') => 0.6,
        (true, b'A', b'T', b'G') => -1.1,
        (true, b'A', b'T', b'T') => -6.9,
        (true, b'C', b'G', b'A') => -6.3,
        (true, b'C', b'G', b'C') => -4.4,
        (true, b'C', b'G', b'G') => -5.1,
        (true, b'C', b'G', b'T') => -4.0,
        (true, b'G', b'C', b'A') => -3.7,
        (true, b'G', b'C', b'C') => -4.0,
        (true, b'G', b'C', b'G') => -3.9,
        (true, b'G', b'C', b'T') => -4.9,
        (true, b'T', b'A', b'A') => -2.9,
        (true, b'T', b'A', b'C') => -4.1,
        (true, b'T', b'A', b'G') => -4.2,
        (true, b'T', b'A', b'T') => -0.2,
        (false, b'A', b'T', b'A') => -0.5,
        (false, b'A', b'T', b'C') => 4.7,
        (false, b'A', b'T', b'G') => -4.1,
        (false, b'A', b'T', b'T') => -3.8,
        (false, b'C', b'G', b'A') => -5.9,
        (false, b'C', b'G', b'C') => -2.6,
        (false, b'C', b'G', b'G') => -3.2,
        (false, b'C', b'G', b'T') => -5.2,
        (false, b'G', b'C', b'A') => -2.1,
        (false, b'G', b'C', b'C') => -0.2,
        (false, b'G', b'C', b'G') => -3.9,
        (false, b'G', b'C', b'T') => -4.4,
        (false, b'T', b'A', b'A') => -0.7,
        (false, b'T', b'A', b'C') => 4.4,
        (false, b'T', b'A', b'G') => -1.6,
        (false, b'T', b'A', b'T') => 2.9,
        _ => return None,
    };
    Some((dh, (dh - dg) * 1000.0 / T37))
}

#[derive(Clone, Copy, Default)]
struct Flanks {
    top5: Option<u8>,
    bottom3: Option<u8>,
    top3: Option<u8>,
    bottom5: Option<u8>,
}

/// Score one alignment. Returns (dH, dS, paired_count).
fn score_alignment(
    top: &[u8],
    bot: &[u8],
    self_comp: bool,
    fl: Flanks,
) -> Option<(f64, f64, usize)> {
    let paired: Vec<usize> = (0..top.len())
        .filter(|&i| is_wc(top[i], bot[i]))
        .collect();
    if paired.is_empty() {
        return None;
    }
    let mut dh = 0.2_f64;
    let mut ds = -5.7_f64;
    let first = paired[0];
    let last = paired[paired.len() - 1];
    // Terminal mismatches (SantaLucia & Peyret 2001): a facing non-WC pair
    // just outside the paired span scores as a unit subsuming that end.
    // Total per the test-locked completeness invariant (see TS engine).
    let mut left_tmm = false;
    let mut right_tmm = false;
    if first > 0 && !is_wc(top[first - 1], bot[first - 1]) {
        if let Some((h, s)) = tmm_params(
            top[first - 1],
            top[first],
            bot[first - 1],
            bot[first],
        ) {
            dh += h;
            ds += s;
            left_tmm = true;
        }
    }
    if last + 1 < top.len() && !is_wc(top[last + 1], bot[last + 1]) {
        if let Some((h, s)) = tmm_params(
            top[last],
            top[last + 1],
            bot[last],
            bot[last + 1],
        ) {
            dh += h;
            ds += s;
            right_tmm = true;
        }
    }
    // Bit-identical accumulation order with the TypeScript engine
    // (single scaled terminal correction, stacks in 5′→3′ order).
    let mut terminal_at = 0u32;
    if first == last {
        if !(left_tmm || right_tmm) && (top[first] == b'A' || top[first] == b'T') {
            terminal_at += 1;
        }
    } else {
        if !left_tmm && (top[first] == b'A' || top[first] == b'T') {
            terminal_at += 1;
        }
        if !right_tmm && (top[last] == b'A' || top[last] == b'T') {
            terminal_at += 1;
        }
    }
    for w in paired.windows(2) {
        if w[1] == w[0] + 1 {
            if let Some((h, s)) = nn_params(top[w[0]], top[w[1]], bot[w[0]], bot[w[1]]) {
                dh += h;
                ds += s;
            }
        } else if w[1] == w[0] + 2 {
            // Isolated single internal mismatch: left + right IMM steps.
            let m = w[0] + 1;
            if !is_wc(top[m], bot[m]) {
                if let (Some((h1, s1)), Some((h2, s2))) = (
                    imm_params(top[w[0]], top[m], bot[w[0]], bot[m]),
                    imm_params(top[m], top[w[1]], bot[m], bot[w[1]]),
                ) {
                    dh += h1 + h2;
                    ds += s1 + s2;
                }
            }
        }
    }
    dh += 2.2 * terminal_at as f64;
    ds += 6.9 * terminal_at as f64;
    let t5 = top[first];
    let u5 = bot[first];
    let t3 = top[last];
    let u3 = bot[last];
    for (five, same, opp, base, tmm_end) in [
        (true, t5, u5, fl.top5, left_tmm),
        (false, u5, t5, fl.bottom3, left_tmm),
        (false, t3, u3, fl.top3, right_tmm),
        (true, u3, t3, fl.bottom5, right_tmm),
    ] {
        if tmm_end {
            continue;
        }
        if let Some(b) = base {
            if let Some((h, s)) = dangle_params(five, same, opp, b) {
                dh += h;
                ds += s;
            }
        }
    }
    if self_comp {
        ds -= 1.4;
    }
    // DP tracebacks may carry single-nucleotide bulges ('-'): flat penalty.
    let bulges = top.iter().filter(|&&c| c == b'-').count()
        + bot.iter().filter(|&&c| c == b'-').count();
    dh += 3.0 * bulges as f64;
    Some((dh, ds, paired.len()))
}

struct Best {
    dg: f64,
    dh: f64,
    ds: f64,
    paired: usize,
    run: usize,
    anchored: bool,
    gc_frac: f64,
    span: usize,
}

fn depict(top: &[u8], bot: &[u8]) -> (Vec<u8>, Vec<u8>) {
    let mut t = Vec::with_capacity(top.len());
    let mut u = Vec::with_capacity(bot.len());
    for (&a, &b) in top.iter().zip(bot.iter()) {
        if is_wc(a, b) {
            t.push(a);
            u.push(b);
        } else {
            t.push(b'-');
            u.push(b'-');
        }
    }
    (t, u)
}

fn trailing_run_cond(dep: &[u8], reached: bool) -> usize {
    if !reached {
        return 0;
    }
    dep.iter().rev().take_while(|&&c| c != b'-').count()
}

fn leading_run_cond(dep: &[u8], reached: bool) -> usize {
    if !reached {
        return 0;
    }
    dep.iter().take_while(|&&c| c != b'-').count()
}

/// Thermodynamic local alignment (Smith–Waterman over WC-pair states).
/// Returns (top, bottom, a_start, b_start, deltaG); `-` marks bulges.
/// Mirrors the TypeScript engine (`dp-align.ts`) transition by transition.
fn dp_traceback(a: &[u8], brev: &[u8], eval_temp_c: f64) -> Option<(Vec<u8>, Vec<u8>, usize, usize, f64)> {
    const START: i8 = 0;
    const STACK: i8 = 1;
    const MISMATCH: i8 = 2;
    const BULGE_TOP: i8 = 3;
    const BULGE_BOT: i8 = 4;
    let n = a.len();
    let m = brev.len();
    if n == 0 || m == 0 {
        return None;
    }
    let t_k = eval_temp_c + ZERO_C;
    let dg_init = 0.2 - t_k * -5.7 / 1000.0;
    let at = |i: usize, j: usize| i * m + j;
    let mut s = vec![f64::INFINITY; n * m];
    let mut p = vec![0i8; n * m];
    let mut best = f64::INFINITY;
    let mut bi = 0usize;
    let mut bj = 0usize;
    let mut found = false;
    for i in 0..n {
        for j in 0..m {
            if !is_wc(a[i], brev[j]) {
                continue;
            }
            let mut v = dg_init;
            let mut pred = START;
            if i > 0 && j > 0 && s[at(i - 1, j - 1)] < f64::INFINITY {
                if let Some((h, st)) = nn_params(a[i - 1], a[i], brev[j - 1], brev[j]) {
                    // Same association as TypeScript: S + (dH − T·dS/1000).
                    let step = h - t_k * st / 1000.0;
                    let cand = s[at(i - 1, j - 1)] + step;
                    if cand < v {
                        v = cand;
                        pred = STACK;
                    }
                }
            }
            if i >= 2 && j >= 2 && s[at(i - 2, j - 2)] < f64::INFINITY {
                if let (Some((h1, s1)), Some((h2, s2))) = (
                    imm_params(a[i - 2], a[i - 1], brev[j - 2], brev[j - 1]),
                    imm_params(a[i - 1], a[i], brev[j - 1], brev[j]),
                ) {
                    let step = h1 + h2 - t_k * (s1 + s2) / 1000.0;
                    let cand = s[at(i - 2, j - 2)] + step;
                    if cand < v {
                        v = cand;
                        pred = MISMATCH;
                    }
                }
            }
            if i >= 2 && j >= 1 && s[at(i - 2, j - 1)] < f64::INFINITY {
                let cand = s[at(i - 2, j - 1)] + 3.0;
                if cand < v {
                    v = cand;
                    pred = BULGE_TOP;
                }
            }
            if i >= 1 && j >= 2 && s[at(i - 1, j - 2)] < f64::INFINITY {
                let cand = s[at(i - 1, j - 2)] + 3.0;
                if cand < v {
                    v = cand;
                    pred = BULGE_BOT;
                }
            }
            s[at(i, j)] = v;
            p[at(i, j)] = pred;
            if v < best {
                best = v;
                bi = i;
                bj = j;
                found = true;
            }
        }
    }
    if !found {
        return None;
    }
    let mut ci = bi;
    let mut cj = bj;
    let mut tops: Vec<u8> = Vec::new();
    let mut bots: Vec<u8> = Vec::new();
    loop {
        tops.push(a[ci]);
        bots.push(brev[cj]);
        let t = p[at(ci, cj)];
        if t == START {
            break;
        } else if t == STACK {
            ci -= 1;
            cj -= 1;
        } else if t == MISMATCH {
            tops.push(a[ci - 1]);
            bots.push(brev[cj - 1]);
            ci -= 2;
            cj -= 2;
        } else if t == BULGE_TOP {
            tops.push(a[ci - 1]);
            bots.push(b'-');
            ci -= 2;
            cj -= 1;
        } else {
            tops.push(b'-');
            bots.push(brev[cj - 1]);
            ci -= 1;
            cj -= 2;
        }
    }
    tops.reverse();
    bots.reverse();
    Some((tops, bots, ci, cj, best))
}

fn scan(
    a: &[u8],
    brev: &[u8],
    self_comp: bool,
    eval_temp_c: f64,
) -> Option<Best> {
    let t_k = eval_temp_c + ZERO_C;
    let mut best: Option<Best> = None;
    let consider = |top: &[u8],
                         bot: &[u8],
                         a_start: usize,
                         b_start: usize,
                         best: &mut Option<Best>| {
        let paired_wc = top
            .iter()
            .zip(bot.iter())
            .filter(|(&x, &y)| is_wc(x, y))
            .count();
        if paired_wc < 2 {
            return;
        }
        let len = top.len();
        let fl = Flanks {
            top5: a_start.checked_sub(1).map(|i| a[i]),
            bottom3: b_start.checked_sub(1).map(|j| brev[j]),
            top3: (a_start + len < a.len()).then(|| a[a_start + len]),
            bottom5: (b_start + len < brev.len()).then(|| brev[b_start + len]),
        };
        if let Some((dh, ds, paired)) = score_alignment(top, bot, self_comp, fl) {
            let dg = dh - t_k * ds / 1000.0;
            let replace = best.as_ref().map_or(true, |b: &Best| dg < b.dg);
            if replace {
                let (td, ud) = depict(top, bot);
                // A strand whose block misses its 3′ terminus (overhang)
                // cannot be extended: run 0 by definition. Top is 5′→3′
                // (3′ end right), bottom is 3′→5′ (3′ end left).
                let run = trailing_run_cond(&td, a_start + len == a.len())
                    .max(leading_run_cond(&ud, b_start == 0));
                // Traced duplex composition for Owczarzy %GC/N (GC pairs/span).
                let gc = top
                    .iter()
                    .zip(bot.iter())
                    .filter(|(&x, &y)| {
                        is_wc(x, y) && (x == b'G' || x == b'C')
                    })
                    .count();
                *best = Some(Best {
                    dg,
                    dh,
                    ds,
                    paired,
                    run,
                    anchored: run >= 2,
                    gc_frac: gc as f64 / len as f64,
                    span: len,
                });
            }
        }
    };

    // Scores a block plus its terminal-mismatch extensions (≤ 1 per end).
    // Blocks are maximal, so in-range facing bases just outside are always
    // mismatched and eligible for SantaLucia–Peyret TMM units.
    let extend = |top: &[u8],
                  bot: &[u8],
                  a_start: usize,
                  b_start: usize,
                  best: &mut Option<Best>| {
        consider(top, bot, a_start, b_start, best);
        let len = top.len();
        let can_left = a_start > 0 && b_start > 0;
        let can_right = a_start + len < a.len() && b_start + len < brev.len();
        if can_left {
            let mut t = Vec::with_capacity(len + 1);
            t.push(a[a_start - 1]);
            t.extend_from_slice(top);
            let mut u = Vec::with_capacity(len + 1);
            u.push(brev[b_start - 1]);
            u.extend_from_slice(bot);
            consider(&t, &u, a_start - 1, b_start - 1, best);
        }
        if can_right {
            let mut t = Vec::from(top);
            t.push(a[a_start + len]);
            let mut u = Vec::from(bot);
            u.push(brev[b_start + len]);
            consider(&t, &u, a_start, b_start, best);
        }
        if can_left && can_right {
            let mut t = Vec::with_capacity(len + 2);
            t.push(a[a_start - 1]);
            t.extend_from_slice(top);
            t.push(a[a_start + len]);
            let mut u = Vec::with_capacity(len + 2);
            u.push(brev[b_start - 1]);
            u.extend_from_slice(bot);
            u.push(brev[b_start + len]);
            consider(&t, &u, a_start - 1, b_start - 1, best);
        }
    };

    let alo = 0isize - (brev.len() as isize - 1);
    let ahi = a.len() as isize - 1;
    // Candidate generators union: maximal WC blocks, single-mismatch
    // merges, and the thermodynamic DP traceback. Every candidate is fully
    // scored and the minimum wins, so the DP can only improve on — never
    // regress — the block scan.
    let mut raw: Vec<(Vec<u8>, Vec<u8>, usize, usize)> = Vec::new();
    for d in alo..=ahi {
        let cells: Vec<(usize, usize)> = (0..a.len())
            .filter_map(|i| {
                let j = i as isize - d;
                (j >= 0 && (j as usize) < brev.len()).then_some((i, j as usize))
            })
            .collect();
        let mut blocks: Vec<(usize, usize, usize)> = Vec::new(); // (a_start, b_start, len)
        let mut k = 0;
        while k < cells.len() {
            if !is_wc(a[cells[k].0], brev[cells[k].1]) {
                k += 1;
                continue;
            }
            let mut k2 = k;
            while k2 + 1 < cells.len()
                && is_wc(a[cells[k2 + 1].0], brev[cells[k2 + 1].1])
            {
                k2 += 1;
            }
            let (i0, j0) = cells[k];
            blocks.push((i0, j0, k2 - k + 1));
            k = k2 + 1;
        }
        for &(i0, j0, len) in &blocks {
            raw.push((
                a[i0..i0 + len].to_vec(),
                brev[j0..j0 + len].to_vec(),
                i0,
                j0,
            ));
        }
        for w in blocks.windows(2) {
            let (li, lj, llen) = w[0];
            let (ri, rj, _rlen) = w[1];
            if ri == li + llen + 1 && rj == lj + llen + 1 {
                let mut top = Vec::from(&a[li..li + llen]);
                top.push(a[li + llen]);
                top.extend_from_slice(&a[ri..ri + w[1].2]);
                let mut bot = Vec::from(&brev[lj..lj + llen]);
                bot.push(brev[lj + llen]);
                bot.extend_from_slice(&brev[rj..rj + w[1].2]);
                raw.push((top, bot, li, lj));
            }
        }
    }
    if let Some((top, bot, i0, j0, _dg)) = dp_traceback(a, brev, eval_temp_c) {
        raw.push((top, bot, i0, j0));
    }
    for (top, bot, i0, j0) in &raw {
        extend(top, bot, *i0, *j0, &mut best);
    }
    best
}

/// Full dimer report as JSON:
/// `{"found":bool,"dg":…,"tm":…,"paired":…,"run3p":…,"anchored":bool}`.
/// Temperatures in °C; `ct_m` = total strand concentration (M);
/// `salt_adj_c` = precomputed salt term (°C).
#[wasm_bindgen]
pub fn dimer_report_json(
    a: &str,
    b: &str,
    self_complementary: bool,
    eval_temp_c: f64,
    ct_m: f64,
    salt_adj_c: f64,
    dmso_percent: f64,
) -> String {
    let av: Vec<u8> = a.bytes().map(|c| c.to_ascii_uppercase()).collect();
    let bv: Vec<u8> = b.bytes().map(|c| c.to_ascii_uppercase()).collect();
    let brev: Vec<u8> = bv.iter().rev().copied().collect();
    if av.is_empty() || brev.is_empty() {
        return "{\"found\":false}".to_string();
    }
    match scan(&av, &brev, self_complementary, eval_temp_c) {
        None => "{\"found\":false}".to_string(),
        Some(best) => {
            let conc = if self_complementary {
                R_CAL * ct_m.ln()
            } else {
                R_CAL * (ct_m / 2.0).ln()
            };
            let tm =
                best.dh * 1000.0 / (best.ds + conc) - ZERO_C + salt_adj_c
                    - 0.75 * dmso_percent;
            // `{}` prints the shortest round-tripping decimal: bit-identical
            // f64 values on the TypeScript side after JSON.parse.
            format!(
                "{{\"found\":true,\"dg\":{},\"tm\":{},\"paired\":{},\"run3p\":{},\"anchored\":{},\"dh\":{},\"ds\":{},\"gc\":{},\"n\":{}}}",
                best.dg,
                tm,
                best.paired,
                best.run,
                if best.anchored { "true" } else { "false" },
                best.dh,
                best.ds,
                best.gc_frac,
                best.span
            )
        }
    }
}

/// N×N cross-dimerization ΔG°37 matrix (row-major, `NaN` = no dimer).
/// `seqs` are `|`-separated unambiguous primer sequences.
#[wasm_bindgen]
pub fn cross_dimer_matrix(seqs: &str) -> Vec<f64> {
    let list: Vec<Vec<u8>> = seqs
        .split('|')
        .map(|s| s.bytes().map(|c| c.to_ascii_uppercase()).collect())
        .collect();
    let n = list.len();
    let mut out = vec![f64::NAN; n * n];
    for i in 0..n {
        for j in i..n {
            let brev: Vec<u8> = list[j].iter().rev().copied().collect();
            if let Some(b) = scan(&list[i], &brev, i == j, 37.0) {
                out[i * n + j] = b.dg;
                out[j * n + i] = b.dg;
            }
        }
    }
    out
}
